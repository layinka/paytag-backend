import { db, payments, receipts, Payment, Receipt } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { CircleService } from './circle.service.js';
import { PaytagService } from './paytag.service.js';
import { WalrusService } from './walrus.service.js';
import { nanoid } from 'nanoid';

/**
 * Webhook Service
 * Handles Circle webhook events, payment detection, and receipt generation
 */
export class WebhookService {
  private circleService: CircleService;
  private paytagService: PaytagService;
  private walrusService: WalrusService;

  constructor() {
    this.circleService = new CircleService();
    this.paytagService = new PaytagService();
    this.walrusService = new WalrusService();
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
      transactionId: event.transactionId,
      tokenId: event.tokenId,
      amount: event.amount
    });

    // Handle inbound transactions (deposits)
    // Circle uses CONFIRMED state for successful transactions
    if (event.type === 'transactions.inbound' && (event.state === 'CONFIRMED' || event.state === 'COMPLETE')) {
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
      blockchain,
      txHash
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

    // Log token ID before normalization
    console.log('🔍 Token ID from webhook:', tokenId);
    const normalizedAsset = this.normalizeTokenId(tokenId);
    console.log('🔍 Normalized asset:', normalizedAsset);

    // Create payment record
    let payment;
    try {
      [payment] = await db
        .insert(payments)
        .values({
          paytagId: paytag.id,
          chain: blockchain || 'ETH-SEPOLIA',
          asset: normalizedAsset,
          amount: amount || '0',
          fromAddress: null, // Circle doesn't provide source address in this format
          toAddress: destinationAddress,
          txHash: txHash, // Use transaction ID as hash
          circleTransferId: transactionId,
          rawEvent: rawPayload,
          status: 'completed',
        })
        .returning();

      console.log('✅ Payment recorded:', {
        id: payment.id,
        amount,
        asset: normalizedAsset,
        blockchain,
        paytag: paytag.handle
      });
    } catch (error: any) {
      console.error('❌ Failed to create payment record:', error.message);
      throw new Error('Failed to record payment in database');
    }

    // Generate receipt
    console.log('🧾 Calling generateReceipt for payment:', payment.id);
    try {
      const receipt = await this.generateReceipt(payment, paytag, event);
      console.log('✅ Receipt generation completed successfully:', receipt.receiptPublicId);
    } catch (error: any) {
      // Log but don't fail the webhook if receipt generation fails
      console.error('❌ Failed to generate receipt:', error?.message);
      console.error('   Full error:', error);
      console.error('   Stack:', error?.stack);
    }
  }

  /**
   * Generate public receipt for payment
   */
  private async generateReceipt(
    payment: Payment,
    paytag: any,
    event: any
  ): Promise<Receipt> {
    console.log('🧾 Starting receipt generation for payment:', payment.id);
    
    const receiptPublicId = nanoid(12);

    // Get explorer URL based on chain
    const explorerUrl = this.getExplorerUrl(payment.txHash, payment.chain);

    console.log('   Receipt ID:', receiptPublicId);
    console.log('   PayTag:', paytag.handle);
    console.log('   Explorer URL:', explorerUrl);

    // Build receipt JSON for Walrus
    const receiptData = {
      receiptId: receiptPublicId,
      paytagHandle: paytag.handle,
      paytagName: `${paytag.handle}.paytag.eth`,
      receiverAddress: paytag.circleWalletAddress,
      chain: payment.chain,
      assetIn: payment.asset,
      amountIn: payment.amount,
      amountUSDC: payment.amount, // TODO: Add conversion if needed
      txHash: payment.txHash,
      paymentId: payment.id,
      blockTimestamp: event.timestamp || new Date().toISOString(),
      status: 'confirmed' as const,
      proof: {
        explorerUrl,
        circleTransferId: payment.circleTransferId,
      },
      createdAt: new Date().toISOString(),
    };

    // Store on Walrus
    let walrusBlobId: string | null = null;
    let receiptHash: string | null = null;

    console.log('   Attempting Walrus storage...');
    try {
      const walrusResult = await this.walrusService.storeBlob(receiptData, {
        epochs: 5, // Store for 5 epochs (reduced from 100 for testnet compatibility)
        permanent: false,
      });

      walrusBlobId = walrusResult.blobId;
      receiptHash = walrusResult.hash;

      console.log('📦 Receipt stored on Walrus:', {
        blobId: walrusBlobId.substring(0, 16) + '...',
        hash: receiptHash.substring(0, 16) + '...',
      });
    } catch (error: any) {
      console.error('⚠️  Walrus storage failed, continuing without it:', error.message);
      if (error.response?.data) {
        console.error('   Walrus error details:', JSON.stringify(error.response.data, null, 2));
      }
    }

    // Store in database
    console.log('   Storing receipt in database...');
    const [receipt] = await db
      .insert(receipts)
      .values({
        paymentId: payment.id,
        receiptPublicId,
        paytagHandle: paytag.handle,
        paytagName: `${paytag.handle}.paytag.base.eth`,
        receiverAddress: paytag.circleWalletAddress,
        chain: payment.chain,
        assetIn: payment.asset,
        amountIn: payment.amount,
        amountUSDC: payment.amount,
        txHash: payment.txHash,
        blockTimestamp: event.timestamp || null,
        status: 'confirmed',
        circleTransferId: payment.circleTransferId,
        explorerUrl,
        walrusBlobId,
        receiptHash,
      })
      .returning();

    console.log('✅ Receipt generated successfully:', receiptPublicId);

    return receipt;
  }

  /**
   * Get block explorer URL for transaction
   */
  private getExplorerUrl(txHash: string, chain: string): string {
    const explorers: Record<string, string> = {
      'BASE': 'https://basescan.org',
      'BASE-SEPOLIA': 'https://sepolia.basescan.org',
      'ETH': 'https://etherscan.io',
      'ETH-SEPOLIA': 'https://sepolia.etherscan.io',
      'ETHEREUM': 'https://etherscan.io',
      'ETHEREUM_SEPOLIA': 'https://sepolia.etherscan.io',
    };

    const baseUrl = explorers[chain] || explorers['BASE'];
    return `${baseUrl}/tx/${txHash}`;
  }

  /**
   * Normalize asset name
   */
  private normalizeAsset(asset: string): 'USDC' | 'EURC' | 'ETH' | 'UNKNOWN' {
    const normalized = asset.toUpperCase();
    if (normalized.includes('USDC')) return 'USDC';
    if (normalized.includes('EURC')) return 'EURC';
    if (normalized.includes('ETH')) return 'ETH';
    return 'UNKNOWN';
  }

  /**
   * Normalize Circle token ID to asset name
   * Maps Circle's token UUIDs to their corresponding asset symbols
   */
  private normalizeTokenId(tokenId?: string): 'USDC' | 'EURC' | 'ETH' | 'UNKNOWN' {
    if (!tokenId) {
      console.warn('⚠️  No tokenId provided, returning UNKNOWN');
      return 'UNKNOWN';
    }
    
    // Circle token ID mappings
    const TOKEN_ID_MAP: Record<string, 'USDC' | 'EURC' | 'ETH'> = {
      'c22b378a-843a-59b6-aaf5-bcba622729e6': 'USDC',
      '5797fbd6-3795-519d-84ca-ec4c5f80c3b1': 'EURC',
      '979869da-9115-5f7d-917d-12d434e56ae7': 'ETH',
    };
    
    const result = TOKEN_ID_MAP[tokenId];
    if (!result) {
      console.warn('⚠️  Unknown tokenId:', tokenId, '- returning UNKNOWN');
      return 'UNKNOWN';
    }
    
    return result;
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
