import { db, receipts, payments, paytags } from '../db/index.js';
import { eq } from 'drizzle-orm';

export interface ReceiptDetails {
  id: string;
  receiptPublicId: string;
  paytagHandle: string;
  displayName: string | null;
  amountUSDC: string;
  asset: string;
  txHash: string;
  fromAddress: string | null;
  chain: string;
  createdAt: Date;
  status: string;
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
        amountUSDC: receipts.amountUSDC,
        txHash: receipts.txHash,
        createdAt: receipts.createdAt,
        asset: payments.asset,
        fromAddress: payments.fromAddress,
        chain: payments.chain,
        status: payments.status,
        displayName: paytags.displayName,
      })
      .from(receipts)
      .innerJoin(payments, eq(receipts.paymentId, payments.id))
      .innerJoin(paytags, eq(payments.paytagId, paytags.id))
      .where(eq(receipts.receiptPublicId, receiptPublicId))
      .limit(1);

    return receipt || null;
  }
}
