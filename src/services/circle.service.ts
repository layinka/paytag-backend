import { CircleDeveloperControlledWalletsClient, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

/**
 * Circle Service
 * Handles Circle Programmable Wallets API integration
 * 
 * NOTE: This is a mock implementation for hackathon purposes
 * In production, integrate with @circle-fin/circle-sdk
 */

interface CircleWallet {
  walletId: string;
  walletAddress: string;
  blockchain: string;
  state: string;
}

interface CreateWalletResponse {
  walletId: string;
  walletAddress: string;
}

export class CircleService {
  private readonly apiKey: string;
  private readonly entitySecret: string;
  private readonly walletSetId: string;
  private readonly environment: string;
  private client: CircleDeveloperControlledWalletsClient | undefined = undefined;

  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY || '';
    this.entitySecret = process.env.CIRCLE_ENTITY_SECRET || '';
    this.walletSetId = process.env.CIRCLE_WALLET_SET_ID || '';
    this.environment = process.env.CIRCLE_ENV || 'sandbox';

    if (!this.apiKey || !this.entitySecret ) {
      console.warn('⚠️  Circle API credentials not configured. Using mock mode.');
    }else{
        this.client = initiateDeveloperControlledWalletsClient({
            apiKey: this.apiKey,
            entitySecret: this.entitySecret,
        });
    }
  }

  async createWalletSet(name?: string){
    if(!this.client) {
      throw new Error('Circle API client not initialized');
    }
    const walletSetResponse = await this.client.createWalletSet({ 
      name: name || `PayTag WalletSet ${Date.now()}` 
    });
    console.log("Created WalletSet", walletSetResponse.data?.walletSet);
    return walletSetResponse.data?.walletSet;
  }

  


  /**
   * Create a new Circle programmable wallet
   */
  async createWallet(userId: string, count: number = 1) {
    //
    const response = await this.client?.createWallets({
      walletSetId: this.walletSetId,
      blockchains: ['ETH-SEPOLIA', 'BASE-SEPOLIA'],
      count,
    //   metadata: [
    //     { name:'', refId:   userId}
    //   ],
    });

    console.log('🔵 Circle Wallet Created:');
    console.log('   RESPONSE:', response);
    console.log('   Data:', response?.data);

    return response?.data;
  }

  async createMockWallet(userId: string): Promise<CreateWalletResponse> {
    // Mock implementation for hackathon
    // TODO: Integrate with Circle SDK
    // const circle = new Circle({
    //   apiKey: this.apiKey,
    //   entitySecret: this.entitySecret,
    // });
    //
    // const response = await circle.wallets.create({
    //   walletSetId: this.walletSetId,
    //   blockchains: ['ETH-SEPOLIA'],
    //   metadata: { userId },
    // });

    const mockWalletId = `wlt_${Date.now()}_${userId.slice(0, 8)}`;
    const mockWalletAddress = `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`;

    console.log('🔵 Circle Wallet Created (MOCK):');
    console.log('   Wallet ID:', mockWalletId);
    console.log('   Address:', mockWalletAddress);

    return {
      walletId: mockWalletId,
      walletAddress: mockWalletAddress,
    };
  }

  /**
   * Get wallet details by ID
   */
  async getWallet(walletId: string): Promise<CircleWallet | null> {
    // Mock implementation
    console.log('🔵 Fetching Circle Wallet (MOCK):', walletId);

    return {
      walletId,
      walletAddress: '0x' + Math.random().toString(16).slice(2, 42).padEnd(40, '0'),
      blockchain: 'ETH-SEPOLIA',
      state: 'LIVE',
    };
  }

  /**
   * Verify Circle webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = process.env.WEBHOOK_SECRET || '';

    // TODO: Implement Circle webhook signature verification
    // const expectedSignature = crypto
    //   .createHmac('sha256', webhookSecret)
    //   .update(payload)
    //   .digest('hex');
    //
    // return crypto.timingSafeEqual(
    //   Buffer.from(signature),
    //   Buffer.from(expectedSignature)
    // );

    // For hackathon: basic check
    console.log('🔵 Verifying webhook signature (MOCK)');
    return signature.length > 0;
  }

  /**
   * Parse Circle webhook payload
   */
  /**
   * Parse Circle webhook payload
   */
  parseWebhookEvent(payload: any): {
    type: string;
    walletId?: string;
    transferId?: string;
    amount?: string;
    asset?: string;
    fromAddress?: string;
    toAddress?: string;
    txHash?: string;
    blockchain?: string;
  } {
    // Example Circle webhook structure
    // Adapt based on actual Circle webhook format
    const event = payload;

    return {
      type: event.type || 'unknown',
      walletId: event.wallet?.id,
      transferId: event.transfer?.id,
      amount: event.transfer?.amount,
      asset: event.transfer?.tokenId || 'USDC',
      fromAddress: event.transfer?.source?.address,
      toAddress: event.transfer?.destination?.address,
      txHash: event.transfer?.transactionHash,
      blockchain: event.transfer?.blockchain || 'ETH-SEPOLIA',
    };
  }

  /**
   * Register Entity Secret Ciphertext
   * 
   * Encrypts and registers your Entity Secret with Circle.
   * This must be done once before creating wallets.
   * 
   * @param entitySecret - The 32-byte hex Entity Secret (from generateEntitySecret)
   * @param recoveryFileDownloadPath - Optional path to save recovery file
   * @returns Response containing recovery file data
   * 
   * @example
   * ```typescript
   * const response = await circleService.registerEntitySecretCiphertext(
   *   'ecd4d5e33b8e...',
   *   './recovery-file.json'
   * );
   * ```
   * 
   * @warning IMPORTANT: Save the recovery file securely! 
   * Circle does not store your Entity Secret and cannot recover it.
   */
  async registerEntitySecretCiphertext(
    entitySecret: string,
    recoveryFileDownloadPath: string = './circle-recovery-file.dat'
  ): Promise<{
    data?: {
      recoveryFile?: string;
    };
    error?: any;
  }> {
    try {
      if (!this.apiKey) {
        throw new Error('Circle API key not configured');
      }

      if (!entitySecret) {
        throw new Error('Entity secret is required');
      }

      console.log('🔐 Registering Entity Secret with Circle...');

      const response = await registerEntitySecretCiphertext({
        apiKey: this.apiKey,
        entitySecret,
        recoveryFileDownloadPath,
      });

      console.log('✅ Entity Secret registered successfully');
      
      if (response.data?.recoveryFile) {
        console.log('📄 Recovery file generated');
        console.log('⚠️  IMPORTANT: Save this recovery file securely!');
      }

      return response;
    } catch (error: any) {
      console.error('❌ Failed to register Entity Secret:', error.message);
      throw new Error(`Entity Secret registration failed: ${error.message}`);
    }
  }
}
