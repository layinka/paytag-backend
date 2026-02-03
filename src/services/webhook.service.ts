import { db, payments, receipts, Payment, Receipt } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { CircleService } from './circle.service.js';
import { PaytagService } from './paytag.service.js';
import { nanoid } from 'nanoid';

/**
 * Webhook Service
 * Handles Circle webhook events, payment detection, and receipt generation
 */
export class WebhookService {
  private circleService: CircleService;
  private paytagService: PaytagService;

  constructor() {
    this.circleService = new CircleService();
    this.paytagService = new PaytagService();
  }

  /**
   * Process Circle webhook event
   */
  async processWebhook(
    payload: any, 
    signature: string,
    keyId: string
  ): Promise<void> {
    // Verify webhook signature using Circle's asymmetric key verification
    const isValid = await this.circleService.verifyWebhookSignature(
      JSON.stringify(payload),
      signature,
      keyId
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Parse webhook event
    const event = this.circleService.parseWebhookEvent(payload);

    console.log('🔔 Webhook Event Received:', event.type);
    console.log('   Transaction State:', event.state);
    console.log('   Transaction Type:', event.transactionType);

    // Handle inbound transactions (deposits)
    if (event.type === 'transactions.inbound' && event.state === 'COMPLETED') {
      await this.handleInboundTransaction(event, payload);
    }
  }

  /**
   * Handle inbound transaction (incoming payment)
   */
  private async handleInboundTransaction(event: any, rawPayload: any): Promise<void> {
    const { 
      destinationAddress, 
      transactionId, 
      amount, 
      tokenId, 
      blockchain, 
      walletId 
    } = event;

    if (!destinationAddress || !transactionId) {
      console.warn('⚠️  Incomplete transaction event, skipping');
      return;
    }

    // Validate blockchain - only process supported chains
    if (!this.isSupportedBlockchain(blockchain)) {
      console.warn('⚠️  Unsupported blockchain:', blockchain);
      console.log('   Supported chains:', this.getSupportedBlockchains().join(', '));
      return;
    }

    // Find PayTag by wallet address
    const paytag = await this.paytagService.getPaytagByWalletAddress(destinationAddress);

    if (!paytag) {
      console.warn('⚠️  No PayTag found for wallet:', destinationAddress);
      return;
    }

    // Check if payment already exists (use transactionId as unique identifier)
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.circleTransferId, transactionId))
      .limit(1);

    if (existingPayment) {
      console.log('ℹ️  Payment already recorded:', transactionId);
      return;
    }

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        paytagId: paytag.id,
        chain: blockchain || 'ETH-SEPOLIA',
        asset: this.normalizeTokenId(tokenId),
        amount: amount || '0',
        fromAddress: null, // Circle doesn't provide source address in this format
        toAddress: destinationAddress,
        txHash: transactionId, // Use transaction ID as hash
        circleTransferId: transactionId,
        rawEvent: rawPayload,
        status: 'completed',
      })
      .returning();

    console.log('✅ Payment recorded:', payment.id);
    console.log('   Amount:', amount);
    console.log('   Blockchain:', blockchain);
    console.log('   Wallet ID:', walletId);

    // Generate receipt
    await this.generateReceipt(payment, paytag.handle);
  }

  /**
   * Generate public receipt for payment
   */
  private async generateReceipt(payment: Payment, paytagHandle: string): Promise<Receipt> {
    const receiptPublicId = nanoid(12);

    const [receipt] = await db
      .insert(receipts)
      .values({
        paymentId: payment.id,
        receiptPublicId,
        paytagHandle,
        amountUSDC: payment.amount,
        txHash: payment.txHash,
      })
      .returning();

    console.log('🧾 Receipt generated:', receiptPublicId);

    return receipt;
  }

  /**
   * Normalize asset name
   */
  private normalizeAsset(asset: string): 'USDC' | 'ETH' | 'UNKNOWN' {
    const normalized = asset.toUpperCase();
    if (normalized.includes('USDC')) return 'USDC';
    if (normalized.includes('ETH')) return 'ETH';
    return 'UNKNOWN';
  }

  /**
   * Normalize Circle token ID to asset name
   * In production, you'd map token IDs to actual token symbols via Circle API
   */
  private normalizeTokenId(tokenId?: string): 'USDC' | 'ETH' | 'UNKNOWN' {
    if (!tokenId) return 'USDC'; // Default to USDC
    
    // Circle's token IDs are UUIDs, you'd need to maintain a mapping
    // For now, assume USDC as it's the primary token for Circle
    return 'USDC';
  }

  /**
   * Get supported blockchains based on environment
   */
  private getSupportedBlockchains(): string[] {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      return ['ETH', 'BASE', 'ETH-MAINNET', 'BASE-MAINNET'];
    }
    
    return ['ETH-SEPOLIA', 'BASE-SEPOLIA'];
  }

  /**
   * Check if blockchain is supported
   */
  private isSupportedBlockchain(blockchain?: string): boolean {
    if (!blockchain) return false;
    
    const supported = this.getSupportedBlockchains();
    return supported.includes(blockchain);
  }
}
