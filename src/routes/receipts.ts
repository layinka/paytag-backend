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
            displayName: Type.String(),
            amountUSDC: Type.String(),
            asset: Type.String(),
            txHash: Type.String(),
            fromAddress: Type.Union([Type.String(), Type.Null()]),
            chain: Type.String(),
            status: Type.String(),
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
        displayName: receipt.displayName || receipt.paytagHandle,
        amountUSDC: receipt.amountUSDC,
        asset: receipt.asset,
        txHash: receipt.txHash,
        fromAddress: receipt.fromAddress,
        chain: receipt.chain,
        status: receipt.status,
        createdAt: receipt.createdAt.toISOString(),
      };
    }
  );
};

export default receiptRoutes;
