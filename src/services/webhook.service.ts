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
  async processWebhook(payload: any, signature: string): Promise<void> {
    // Verify webhook signature
    const isValid = this.circleService.verifyWebhookSignature(
      JSON.stringify(payload),
      signature
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Parse webhook event
    const event = this.circleService.parseWebhookEvent(payload);

    console.log('🔔 Webhook Event Received:', event.type);

    // Handle transfer events
    if (event.type === 'transfer.completed' || event.type === 'transfer') {
      await this.handleTransferEvent(event, payload);
    }
  }

  /**
   * Handle transfer event (incoming payment)
   */
  private async handleTransferEvent(event: any, rawPayload: any): Promise<void> {
    const { toAddress, txHash, amount, asset, fromAddress, transferId, blockchain } = event;

    if (!toAddress || !txHash) {
      console.warn('⚠️  Incomplete transfer event, skipping');
      return;
    }

    // Find PayTag by wallet address
    const paytag = await this.paytagService.getPaytagByWalletAddress(toAddress);

    if (!paytag) {
      console.warn('⚠️  No PayTag found for wallet:', toAddress);
      return;
    }

    // Check if payment already exists
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(eq(payments.txHash, txHash))
      .limit(1);

    if (existingPayment) {
      console.log('ℹ️  Payment already recorded:', txHash);
      return;
    }

    // Create payment record
    const [payment] = await db
      .insert(payments)
      .values({
        paytagId: paytag.id,
        chain: blockchain || 'ETH-SEPOLIA',
        asset: this.normalizeAsset(asset || 'USDC'),
        amount: amount || '0',
        fromAddress: fromAddress || null,
        toAddress,
        txHash,
        circleTransferId: transferId,
        rawEvent: rawPayload,
        status: 'detected',
      })
      .returning();

    console.log('✅ Payment recorded:', payment.id);

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
}
