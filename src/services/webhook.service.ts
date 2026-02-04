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
    rawBody: string,
    signature: string,
    keyId: string
  ): Promise<void> {
    
    // Verify webhook signature using Circle's asymmetric key verification
    // Use the raw body string, not the re-serialized JSON
    const isValid = await this.circleService.verifyWebhookSignature(
      rawBody,
      signature,
      keyId
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Parse payload if it's a string (shouldn't happen but let's be safe)
    let parsedPayload = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (parseError: any) {
        console.error('❌ Failed to parse webhook payload:', parseError.message);
        throw new Error('Invalid webhook payload format');
      }
    }

    // Parse webhook event
    const event = this.circleService.parseWebhookEvent(parsedPayload);

    console.log('🔔 Webhook Event:', {
      type: event.type,
      state: event.state,
      blockchain: event.blockchain,
      transactionId: event.transactionId
    });

    // Handle inbound transactions (deposits)
    // Circle uses CONFIRMED state for successful transactions
    if (event.type === 'transactions.inbound' && event.state === 'CONFIRMED') {
      await this.handleInboundTransaction(event, parsedPayload);
    } else if (event.type === 'transactions.inbound') {
      console.log(`ℹ️  Inbound transaction in ${event.state} state - not processing yet`);
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
      blockchain
    } = event;

    // Validate required fields
    if (!destinationAddress || !transactionId) {
      console.warn('⚠️  Incomplete transaction event - missing required fields', { destinationAddress, transactionId });
      return;
    }

    if (!amount || amount === '0') {
      console.warn('⚠️  Transaction has no amount, skipping', { transactionId });
      return;
    }

    // Validate blockchain - only process supported chains
    if (!this.isSupportedBlockchain(blockchain)) {
      console.warn('⚠️  Unsupported blockchain:', blockchain);
      console.log('   Supported chains:', this.getSupportedBlockchains().join(', '));
      return;
    }

    // Find PayTag by wallet address
    let paytag;
    try {
      paytag = await this.paytagService.getPaytagByWalletAddress(destinationAddress);
    } catch (error: any) {
      console.error('❌ Error looking up PayTag:', error.message);
      throw new Error('Failed to lookup PayTag for transaction');
    }

    if (!paytag) {
      console.warn('⚠️  No PayTag found for wallet address:', destinationAddress);
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
    let payment;
    try {
      [payment] = await db
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
          status: 'processed',
        })
        .returning();

      console.log('✅ Payment recorded:', {
        id: payment.id,
        amount,
        blockchain,
        paytag: paytag.handle
      });
    } catch (error: any) {
      console.error('❌ Failed to create payment record:', error.message);
      throw new Error('Failed to record payment in database');
    }

    // Generate receipt
    try {
      await this.generateReceipt(payment, paytag.handle);
    } catch (error: any) {
      // Log but don't fail the webhook if receipt generation fails
      console.error('❌ Failed to generate receipt:', error.message);
    }
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
    
    return ['ETH', 'BASE','ETH-SEPOLIA', 'BASE-SEPOLIA'];
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
