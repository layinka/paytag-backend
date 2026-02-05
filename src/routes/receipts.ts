import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ReceiptService } from '../services/receipt.service.js';

const receiptService = new ReceiptService();

/**
 * Receipt Routes
 */
const receiptRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * PUBLIC: Get receipt by public ID
   */
  fastify.get(
    '/v1/receipts/:receiptPublicId',
    {
      schema: {
        tags: ['receipts'],
        summary: 'Get payment receipt',
        description: 'Get public payment receipt by ID',
        params: Type.Object({
          receiptPublicId: Type.String(),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            receiptPublicId: Type.String(),
            paytagHandle: Type.String(),
            paytagName: Type.String(),
            displayName: Type.Union([Type.String(), Type.Null()]),
            receiverAddress: Type.String(),
            chain: Type.String(),
            assetIn: Type.String(),
            amountIn: Type.String(),
            amountUSDC: Type.String(),
            txHash: Type.String(),
            fromAddress: Type.Union([Type.String(), Type.Null()]),
            blockTimestamp: Type.Union([Type.String(), Type.Null()]),
            status: Type.String(),
            explorerUrl: Type.Union([Type.String(), Type.Null()]),
            circleTransferId: Type.Union([Type.String(), Type.Null()]),
            walrusBlobId: Type.Union([Type.String(), Type.Null()]),
            walrusUrl: Type.Union([Type.String(), Type.Null()]),
            receiptHash: Type.Union([Type.String(), Type.Null()]),
            createdAt: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { receiptPublicId } = request.params as { receiptPublicId: string };

      const receipt = await receiptService.getReceiptByPublicId(receiptPublicId);

      if (!receipt) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Receipt not found',
        });
      }

      return {
        id: receipt.id,
        receiptPublicId: receipt.receiptPublicId,
        paytagHandle: receipt.paytagHandle,
        paytagName: receipt.paytagName,
        displayName: receipt.displayName || receipt.paytagHandle,
        receiverAddress: receipt.receiverAddress,
        chain: receipt.chain,
        assetIn: receipt.assetIn,
        amountIn: receipt.amountIn,
        amountUSDC: receipt.amountUSDC,
        txHash: receipt.txHash,
        fromAddress: receipt.fromAddress,
        blockTimestamp: receipt.blockTimestamp,
        status: receipt.status,
        explorerUrl: receipt.explorerUrl,
        circleTransferId: receipt.circleTransferId,
        walrusBlobId: receipt.walrusBlobId,
        walrusUrl: receipt.walrusUrl,
        receiptHash: receipt.receiptHash,
        createdAt: receipt.createdAt.toISOString(),
      };
    }
  );
};

export default receiptRoutes;
