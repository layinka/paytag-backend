import { db, paytags, users, Paytag, NewPaytag } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { CircleService } from './circle.service.js';
import { createENSServiceFromEnv } from './ens.service.js';
import { normalizeHandle, isValidHandle } from '../lib/utils.js';

/**
 * PayTag Service
 * Handles PayTag creation, management, and lookups
 */
export class PaytagService {
  private circleService: CircleService;
  private ensService: ReturnType<typeof createENSServiceFromEnv> | null;

  constructor() {
    this.circleService = new CircleService();
    
    // Initialize ENS service if configured
    try {
      this.ensService = createENSServiceFromEnv();
    } catch (error) {
      console.warn('ENS service not configured:', error);
      this.ensService = null;
    }
  }

  /**
   * Create a new PayTag
   * - Validates handle format
   * - Ensures user doesn't already have a PayTag (one per user)
   * - Creates Circle wallet
   * - Stores PayTag mapping
   */
  async createPaytag(
    userId: string,
    handle: string,
    displayName?: string,
    destinationAddress?: string
  ): Promise<Paytag> {
    const normalizedHandle = normalizeHandle(handle);

    // Validate handle format
    if (!isValidHandle(normalizedHandle)) {
      throw new Error(
        'Invalid handle format. Must be 3-20 lowercase alphanumeric characters, starting with a letter.'
      );
    }

    // Check if handle is already taken
    const [existingByHandle] = await db
      .select()
      .from(paytags)
      .where(eq(paytags.handle, normalizedHandle))
      .limit(1);

    if (existingByHandle) {
      throw new Error('Handle already taken');
    }

    // Check if user already has a PayTag (enforce one per user)
    const [existingByUser] = await db
      .select()
      .from(paytags)
      .where(eq(paytags.userId, userId))
      .limit(1);

    if (existingByUser) {
      throw new Error('User already has a PayTag. Only one PayTag per user is allowed.');
    }

    // Create Circle wallet
    const wallet = await this.circleService.createWallet(userId);

    if(!wallet){    
        throw new Error('Failed to create Circle wallet');
    }

    // Use Circle wallet address as default destination, or use provided one
    const finalDestination = wallet.wallets[0].address; // destinationAddress || 

    // Create PayTag
    const [paytag] = await db
      .insert(paytags)
      .values({
        userId,
        handle: normalizedHandle,
        displayName: displayName || normalizedHandle,
        destinationAddress: finalDestination,
        circleWalletId: wallet.wallets[0].id,
        circleWalletAddress: wallet.wallets[0].address,
        status: 'active',
      })
      .returning();

    // Create ENS subdomain if ENS is configured
    if (this.ensService) {
      try {
        const ensResult = await this.ensService.createSubname({
          label: normalizedHandle,
          targetAddress: wallet.wallets[0].address as `0x${string}`,
        });
        
        console.log(`ENS subdomain created: ${ensResult.subname} -> ${ensResult.targetAddress}`);
        console.log('Transactions:', ensResult.transactions);
      } catch (error) {
        console.error('Failed to create ENS subdomain:', error);
        // Don't fail the whole operation if ENS creation fails
        // The PayTag is still usable without ENS
      }
    }

    return paytag;
  }

  /**
   * Check if ENS subdomain exists for a handle
   */
  async checkEnsSubdomainExists(handle: string): Promise<boolean> {
    if (!this.ensService) {
      return false; // ENS not configured
    }

    try {
      const normalizedHandle = normalizeHandle(handle);
      const chainInfo = this.ensService.getChainInfo();
      const subdomain = `${normalizedHandle}.${chainInfo.parentName}`;
      
      const resolvedAddress = await this.ensService.resolveAddress(subdomain);
      return resolvedAddress !== null;
    } catch (error) {
      console.error('Error checking ENS subdomain:', error);
      return false;
    }
  }

  /**
   * Get PayTag by handle
   */
  async getPaytagByHandle(handle: string): Promise<Paytag | null> {
    const normalizedHandle = normalizeHandle(handle);

    const [paytag] = await db
      .select()
      .from(paytags)
      .where(eq(paytags.handle, normalizedHandle))
      .limit(1);

    return paytag || null;
  }

  /**
   * Get PayTag by user ID
   */
  async getPaytagByUserId(userId: string): Promise<Paytag | null> {
    const [paytag] = await db
      .select()
      .from(paytags)
      .where(eq(paytags.userId, userId))
      .limit(1);

    return paytag || null;
  }

  /**
   * Update PayTag (user can only update displayName and destinationAddress)
   */
  async updatePaytag(
    handle: string,
    userId: string,
    updates: { displayName?: string; destinationAddress?: string }
  ): Promise<Paytag> {
    const normalizedHandle = normalizeHandle(handle);

    // Get existing PayTag
    const [existing] = await db
      .select()
      .from(paytags)
      .where(
        and(eq(paytags.handle, normalizedHandle), eq(paytags.userId, userId))
      )
      .limit(1);

    if (!existing) {
      throw new Error('PayTag not found or unauthorized');
    }

    // Update
    const [updated] = await db
      .update(paytags)
      .set({
        displayName: updates.displayName ?? existing.displayName,
        destinationAddress: updates.destinationAddress ?? existing.destinationAddress,
      })
      .where(eq(paytags.id, existing.id))
      .returning();

    return updated;
  }

  /**
   * Admin: Update PayTag (can update status, override any field)
   */
  async adminUpdatePaytag(
    handle: string,
    updates: Partial<Omit<Paytag, 'id' | 'createdAt'>>
  ): Promise<Paytag> {
    const normalizedHandle = normalizeHandle(handle);

    const [existing] = await db
      .select()
      .from(paytags)
      .where(eq(paytags.handle, normalizedHandle))
      .limit(1);

    if (!existing) {
      throw new Error('PayTag not found');
    }

    const [updated] = await db
      .update(paytags)
      .set(updates)
      .where(eq(paytags.id, existing.id))
      .returning();

    return updated;
  }

  /**
   * Get PayTag by Circle wallet address
   */
  async getPaytagByWalletAddress(walletAddress: string): Promise<Paytag | null> {
    const [paytag] = await db
      .select()
      .from(paytags)
      .where(eq(paytags.circleWalletAddress, walletAddress))
      .limit(1);

    return paytag || null;
  }
}
