import crypto from 'crypto';

/**
 * Walrus Service
 * Handles blob storage on Walrus network
 */
export class WalrusService {
  private publisherUrl: string;
  private isTestnet: boolean;

  constructor() {
    this.isTestnet = process.env.NODE_ENV !== 'production';
    
    // Use testnet publisher for non-production
    this.publisherUrl = this.isTestnet
      ? 'https://publisher.walrus-testnet.walrus.space'
      : (process.env.WALRUS_PUBLISHER_URL || '');
  }

  /**
   * Store a JSON blob on Walrus
   */
  async storeBlob(
    data: any,
    options: {
      epochs?: number;
      permanent?: boolean;
      deletable?: boolean;
    } = {}
  ): Promise<{
    blobId: string;
    hash: string;
    objectId?: string;
  }> {
    const { epochs = 100, permanent = false, deletable = false } = options;

    // Serialize to JSON
    const jsonString = JSON.stringify(data, null, 2);
    
    // Calculate SHA-256 hash for integrity
    const hash = crypto
      .createHash('sha256')
      .update(jsonString)
      .digest('hex');

    // Skip actual upload if publisher URL is not configured
    if (!this.publisherUrl) {
      console.warn('⚠️  Walrus publisher URL not configured - skipping upload');
      return {
        blobId: `local_${hash.substring(0, 16)}`,
        hash,
      };
    }

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (epochs != null) {
        params.set('epochs', String(epochs));
      }
      if (permanent) {
        params.set('permanent', 'true');
      }
      if (deletable) {
        params.set('deletable', 'true');
      }

      const url = `${this.publisherUrl}/v1/blobs?${params.toString()}`;

      // Upload to Walrus
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonString,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Walrus upload failed: ${response.status} ${response.statusText} – ${errorText}`
        );
      }

      const result = await response.json();

      // Extract blobId from response
      let blobId: string;
      let objectId: string | undefined;

      if (result.newlyCreated) {
        blobId = result.newlyCreated.blobObject.blobId;
        objectId = result.newlyCreated.blobObject.id;
      } else if (result.alreadyCertified) {
        blobId = result.alreadyCertified.blobId;
        objectId = result.alreadyCertified.event?.blobObject?.id;
      } else {
        throw new Error('Unexpected Walrus response format');
      }

      console.log('✅ Blob stored on Walrus:', {
        blobId: blobId.substring(0, 16) + '...',
        hash: hash.substring(0, 16) + '...',
      });

      return {
        blobId,
        hash,
        objectId,
      };
    } catch (error: any) {
      console.error('❌ Walrus upload failed:', error.message);
      
      // Return local reference if Walrus fails
      return {
        blobId: `local_${hash.substring(0, 16)}`,
        hash,
      };
    }
  }

  /**
   * Retrieve blob from Walrus
   */
  async retrieveBlob(blobId: string): Promise<any> {
    // If it's a local reference, we can't retrieve it
    if (blobId.startsWith('local_')) {
      throw new Error('Blob is stored locally and cannot be retrieved from Walrus');
    }

    if (!this.publisherUrl) {
      throw new Error('Walrus publisher URL not configured');
    }

    try {
      const url = `${this.publisherUrl}/v1/blobs/${blobId}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to retrieve blob: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('❌ Walrus retrieval failed:', error.message);
      throw error;
    }
  }

  /**
   * Get aggregator URL for blob (for public access)
   */
  getAggregatorUrl(blobId: string): string {
    const aggregatorUrl = this.isTestnet
      ? 'https://aggregator.walrus-testnet.walrus.space'
      : (process.env.WALRUS_AGGREGATOR_URL || '');

    return `${aggregatorUrl}/v1/${blobId}`;
  }
}
