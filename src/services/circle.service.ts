import { CircleDeveloperControlledWalletsClient, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import crypto from 'crypto';

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

interface PublicKeyResponse {
  data: {
    id: string;
    algorithm: string;
    publicKey: string;
    createDate: string;
  };
}

export class CircleService {
  private readonly apiKey: string;
  private readonly entitySecret: string;
  private readonly walletSetId: string;
  private readonly environment: string;
  private client: CircleDeveloperControlledWalletsClient | undefined = undefined;
  private publicKeyCache: Map<string, string> = new Map();

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _userId = userId; // Reserved for future metadata implementation
    
    const response = await this.client?.createWallets({
      walletSetId: this.walletSetId,
      blockchains: ['ETH-SEPOLIA',  'BASE-SEPOLIA'],// 'ETH','BASE',
      count,
    //   metadata: [
    //     { name:'', refId:   userId}
    //   ],
    });

    console.log('🔵 Circle Wallet Created:');
    // console.log('   RESPONSE:', response);
    // console.log('   Data:', response?.data);

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
   * Get wallet balances by wallet ID
   * Returns USDC and ETH balances for all supported blockchains
   */
  async getWalletBalance(walletId: string): Promise<{
    walletId: string;
    balances: Array<{
      token?: {
        id: string;
        blockchain: string;
        name?: string;
        symbol?: string;
        decimals?: number;
      };
      amount: string;
    }>;
  } | null> {
    if (!this.client) {
      throw new Error('Circle API client not initialized');
    }

    try {
      const response = await this.client.getWalletTokenBalance({ id: walletId });
      
      console.log('🔵 Wallet Balance Retrieved:', walletId);
      console.log('   Balances:', response.data);
      console.log('   Balances Token:', response.data?.tokenBalances);

      return {
        walletId,
        balances: response.data?.tokenBalances || [],
      };
    } catch (error: any) {
      console.error('❌ Failed to get wallet balance:', error.message);
      throw new Error(`Failed to retrieve wallet balance: ${error.message}`);
    }
  }

  /**
   * Fetch Circle's public key for webhook signature verification
   * Public keys are cached as they're static for a given keyId
   */
  private async fetchPublicKey(keyId: string): Promise<string> {
    // Check cache first
    if (this.publicKeyCache.has(keyId)) {
      return this.publicKeyCache.get(keyId)!;
    }

    try {
      const circleBaseUrl = this.environment === 'production' 
        ? 'https://api.circle.com'
        : 'https://api.circle.com'; // -sandbox
      
      const response = await fetch(
        `${circleBaseUrl}/v2/notifications/publicKey/${keyId}`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch public key: ${response.statusText}`);
      }

      const data = await response.json() as PublicKeyResponse;
      const publicKey = data.data.publicKey;

      // Cache the public key
      this.publicKeyCache.set(keyId, publicKey);
      
      console.log('🔑 Public key retrieved and cached:', keyId);
      return publicKey;
    } catch (error: any) {
      console.error('❌ Failed to fetch public key:', error.message);
      throw new Error(`Public key fetch failed: ${error.message}`);
    }
  }

  /**
   * Verify Circle webhook signature using ECDSA_SHA_256
   * 
   * @param payload - Raw webhook payload as string (exact bytes received)
   * @param signature - Base64 encoded signature from X-Circle-Signature header
   * @param keyId - Public key ID from X-Circle-Key-Id header
   */
  async verifyWebhookSignature(
    payload: string, 
    signature: string,
    keyId: string
  ): Promise<boolean> {
    try {
      // Fetch the public key
      const publicKeyBase64 = await this.fetchPublicKey(keyId);

      console.log('🔐 Verifying webhook signature for key:', keyId);
      
      // Decode the public key from base64 (DER format)
      const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');
      
      // Import the public key
      const publicKey = crypto.createPublicKey({
        key: publicKeyBytes,
        format: 'der',
        type: 'spki',
      });

      // Decode the signature from base64
      const signatureBytes = Buffer.from(signature, 'base64');
      
      // Convert payload string to UTF-8 bytes (exactly as received)
      const messageBytes = Buffer.from(payload, 'utf-8');

      // Verify the signature using ECDSA with SHA-256
      const isValid = crypto.verify(
        'sha256',
        messageBytes,
        {
          key: publicKey,
          dsaEncoding: 'der', // ECDSA signatures from Circle are DER-encoded
        },
        signatureBytes
      );

      if (isValid) {
        console.log('✅ Webhook signature verified');
      } else {
        console.error('⚠️  Invalid webhook signature - possible security issue or payload tampering');
      }

      return isValid;
    } catch (error: any) {
      console.error('❌ Signature verification error:', error.message);
      // Don't expose internal error details to potential attackers
      return false;
    }
  }

  /**
   * Parse Circle webhook payload
   * 
   * Handles Circle's webhook format:
   * - notificationType: "transactions.inbound" | "transactions.outbound" | etc.
   * - notification: actual transaction data
   */
  parseWebhookEvent(payload: any): {
    type: string;
    walletId?: string;
    transactionId?: string;
    amount?: string;
    tokenId?: string;
    destinationAddress?: string;
    blockchain?: string;
    state?: string;
    transactionType?: string;
    createDate?: string;
    updateDate?: string;
    txHash?: string;
  } {
    const notificationType = payload.notificationType || 'unknown';
    const notification = payload.notification || {};

    return {
      type: notificationType,
      walletId: notification.walletId,
      transactionId: notification.id,
      amount: notification.amounts?.[0] || '0',
      tokenId: notification.tokenId,
      destinationAddress: notification.destinationAddress,
      blockchain: notification.blockchain,
      state: notification.state,
      transactionType: notification.transactionType,
      createDate: notification.createDate,
      updateDate: notification.updateDate,
      txHash: notification.txHash,
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

  /**
   * Execute a contract call from a Circle wallet
   * Used for swaps and other onchain interactions
   * 
   * @param walletId - Circle wallet ID
   * @param contractAddress - Target contract address
   * @param callData - Encoded function call data
   * @param value - ETH value to send (in wei, as string)
   * @param feeLevel - Gas fee level (LOW, MEDIUM, HIGH)
   * @returns Transaction response with transaction ID
   */
  async executeContractCall(
    walletId: string,
    contractAddress: string,
    callData: string,
    value: string = '0',
    feeLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): Promise<{
    transactionId: string;
    state: string;
    txHash?: string;
  }> {
    if (!this.client) {
      throw new Error('Circle API client not initialized');
    }

    try {
      console.log('🔵 Executing contract call from Circle wallet:', {
        walletId: walletId.substring(0, 16) + '...',
        contract: contractAddress,
        value,
        feeLevel,
      });

      const response = await this.client.createTransaction({
        walletId,
        contractAddress,
        abiFunctionSignature: 'execute(bytes,bytes[])',
        abiParameters: [callData],
        fee: {
          type: 'level',
          config: {
            feeLevel,
          },
        },
        amount: value !== '0' ? [value] : undefined,
      });

      console.log('✅ Transaction submitted:', {
        transactionId: response.data?.id,
        state: response.data?.state,
      });

      return {
        transactionId: response.data?.id || '',
        state: response.data?.state || 'INITIATED',
        txHash: response.data?.txHash,
      };
    } catch (error: any) {
      console.error('❌ Contract call failed:', error.message);
      throw new Error(`Contract execution failed: ${error.message}`);
    }
  }

  /**
   * Get transaction status by ID
   * Used to poll for transaction confirmation
   */
  async getTransaction(transactionId: string): Promise<{
    id: string;
    state: string;
    txHash?: string;
    blockchain?: string;
    createDate?: string;
    updateDate?: string;
  } | null> {
    if (!this.client) {
      throw new Error('Circle API client not initialized');
    }

    try {
      const response = await this.client.getTransaction({ id: transactionId });
      
      return {
        id: response.data?.transaction?.id || transactionId,
        state: response.data?.transaction?.state || 'UNKNOWN',
        txHash: response.data?.transaction?.txHash,
        blockchain: response.data?.transaction?.blockchain,
        createDate: response.data?.transaction?.createDate,
        updateDate: response.data?.transaction?.updateDate,
      };
    } catch (error: any) {
      console.error('❌ Failed to get transaction:', error.message);
      return null;
    }
  }
}
