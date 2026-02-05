import { db, receipts, payments, paytags } from '../db/index.js';
import { eq } from 'drizzle-orm';

export interface ReceiptDetails {
  id: string;
  receiptPublicId: string;
  paytagHandle: string;
  paytagName: string;
  displayName: string | null;
  receiverAddress: string;
  chain: string;
  assetIn: string;
  amountIn: string;
  amountUSDC: string;
  txHash: string;
  fromAddress: string | null;
  blockTimestamp: string | null;
  status: string;
  explorerUrl: string | null;
  circleTransferId: string | null;
  walrusBlobId: string | null;
  walrusUrl: string | null;
  receiptHash: string | null;
  createdAt: Date;
}

/**
 * Receipt Service
 * Handles public receipt lookups
 */
export class ReceiptService {
  /**
   * Get receipt by public ID with full details
   */
  async getReceiptByPublicId(receiptPublicId: string): Promise<ReceiptDetails | null> {
    const [receipt] = await db
      .select({
        id: receipts.id,
        receiptPublicId: receipts.receiptPublicId,
        paytagHandle: receipts.paytagHandle,
        paytagName: receipts.paytagName,
        receiverAddress: receipts.receiverAddress,
        chain: receipts.chain,
        assetIn: receipts.assetIn,
        amountIn: receipts.amountIn,
        amountUSDC: receipts.amountUSDC,
        txHash: receipts.txHash,
        blockTimestamp: receipts.blockTimestamp,
        status: receipts.status,
        explorerUrl: receipts.explorerUrl,
        circleTransferId: receipts.circleTransferId,
        walrusBlobId: receipts.walrusBlobId,
        receiptHash: receipts.receiptHash,
        createdAt: receipts.createdAt,
        fromAddress: payments.fromAddress,
        displayName: paytags.displayName,
      })
      .from(receipts)
      .innerJoin(payments, eq(receipts.paymentId, payments.id))
      .innerJoin(paytags, eq(payments.paytagId, paytags.id))
      .where(eq(receipts.receiptPublicId, receiptPublicId))
      .limit(1);

    if (!receipt) {
      return null;
    }

    // Generate Walrus aggregator URL if blob ID exists
    // const walrusUrl = receipt.walrusBlobId
    //   ? `https://aggregator.walrus-testnet.walrus.space/v1/${receipt.walrusBlobId}`
    //   : null;
    const walrusUrl = receipt.walrusBlobId
      ? `https://walruscan.com/testnet/blob/${receipt.walrusBlobId}`
      : null;

    return {
      ...receipt,
      walrusUrl,
    };
  }
}
