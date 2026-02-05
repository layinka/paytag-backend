import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PaytagService } from '../services/paytag.service.js';
import { CircleService } from '../services/circle.service.js';
import { db, payments, paytags, receipts } from '../db/index.js';
import { eq, desc } from 'drizzle-orm';

const paytagService = new PaytagService();
const circleService = new CircleService();

/**
 * PayTag Routes
 */
const paytagRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * PUBLIC: Get PayTag by handle
   */
  fastify.get(
    '/v1/paytags/:handle',
    {
      schema: {
        tags: ['paytags'],
        summary: 'Get PayTag by handle',
        description: 'Public endpoint to lookup PayTag details',
        params: Type.Object({
          handle: Type.String(),
        }),
        response: {
          200: Type.Object({
            handle: Type.String(),
            displayName: Type.String(),
            walletAddress: Type.String(),
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
      const { handle } = request.params as { handle: string };

      const paytag = await paytagService.getPaytagByHandle(handle);

      if (!paytag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'PayTag not found',
        });
      }

      return {
        handle: paytag.handle,
        displayName: paytag.displayName || paytag.handle,
        walletAddress: paytag.circleWalletAddress,
        status: paytag.status,
        createdAt: paytag.createdAt.toISOString(),
      };
    }
  );

  /**
   * PUBLIC: Get PayTag payments
   */
  fastify.get(
    '/v1/paytags/:handle/payments',
    {
      schema: {
        tags: ['paytags'],
        summary: 'Get PayTag payments',
        description: 'Get recent payments for a PayTag',
        params: Type.Object({
          handle: Type.String(),
        }),
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
        }),
        response: {
          200: Type.Object({
            handle: Type.String(),
            payments: Type.Array(
              Type.Object({
                id: Type.String(),
                amount: Type.String(),
                asset: Type.String(),
                chain: Type.String(),
                txHash: Type.String(),
                status: Type.String(),
                receiptPublicId: Type.Union([Type.String(), Type.Null()]),
                createdAt: Type.String(),
              })
            ),
          }),
          404: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { handle } = request.params as { handle: string };
      const { limit = 10 } = request.query as { limit?: number };

      const paytag = await paytagService.getPaytagByHandle(handle);

      if (!paytag) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'PayTag not found',
        });
      }

      const paymentList = await db
        .select({
          id: payments.id,
          amount: payments.amount,
          asset: payments.asset,
          chain: payments.chain,
          txHash: payments.txHash,
          status: payments.status,
          createdAt: payments.createdAt,
          receiptPublicId: receipts.receiptPublicId,
        })
        .from(payments)
        .leftJoin(receipts, eq(payments.id, receipts.paymentId))
        .where(eq(payments.paytagId, paytag.id))
        .orderBy(desc(payments.createdAt))
        .limit(limit);

      return {
        handle: paytag.handle,
        payments: paymentList.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    }
  );

  /**
   * PUBLIC: Get PayTag balance
   */
  fastify.get(
    '/v1/paytags/:handle/balance',
    {
      schema: {
        tags: ['paytags'],
        summary: 'Get PayTag wallet balance',
        description: 'Get USDC and ETH balance for a PayTag wallet',
        params: Type.Object({
          handle: Type.String(),
        }),
        response: {
          200: Type.Object({
            handle: Type.String(),
            walletId: Type.String(),
            walletAddress: Type.String(),
            balances: Type.Array(
              Type.Object({
                token: Type.Optional(
                  Type.Object({
                    id: Type.String(),
                    blockchain: Type.String(),
                    name: Type.String(),
                    symbol: Type.String(),
                    decimals: Type.Number(),
                  })
                ),
                amount: Type.String(),
              })
            ),
          }),
          404: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
          500: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { handle } = request.params as { handle: string };

      try {
        const paytag = await paytagService.getPaytagByHandle(handle);

        if (!paytag) {
          return reply.code(404).send({
            error: 'Not Found',
            message: 'PayTag not found',
          });
        }

        const balanceData = await circleService.getWalletBalance(paytag.circleWalletId);

        if (!balanceData) {
          return reply.code(500).send({
            error: 'Internal Server Error',
            message: 'Failed to retrieve wallet balance',
          });
        }

        return {
          handle: paytag.handle,
          walletId: paytag.circleWalletId,
          walletAddress: paytag.circleWalletAddress,
          balances: balanceData.balances,
        };
      } catch (error: any) {
        fastify.log.error('Balance retrieval error:', error);

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Failed to retrieve balance',
        });
      }
    }
  );

  /**
   * PUBLIC: Check handle availability
   */
  fastify.get(
    '/v1/paytags/check/:handle',
    {
      schema: {
        tags: ['paytags'],
        summary: 'Check handle availability',
        description: 'Check if a PayTag handle is available (checks both database and ENS)',
        params: Type.Object({
          handle: Type.String(),
        }),
        response: {
          200: Type.Object({
            available: Type.Boolean(),
            handle: Type.String(),
            reasons: Type.Optional(
              Type.Object({
                inDatabase: Type.Boolean(),
                ensSubdomainExists: Type.Boolean(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { handle } = request.params as { handle: string };

      // Check database
      const paytag = await paytagService.getPaytagByHandle(handle);
      const inDatabase = !!paytag;

      // Check ENS subdomain
      const ensSubdomainExists = await paytagService.checkEnsSubdomainExists(handle);

      const available = !inDatabase && !ensSubdomainExists;

      return {
        available,
        handle,
        reasons: {
          inDatabase,
          ensSubdomainExists,
        },
      };
    }
  );

  /**
   * USER: Get my PayTags
   */
  fastify.get(
    '/v1/paytags/me',
    {
      onRequest: [fastify.requireUser],
      schema: {
        tags: ['paytags'],
        summary: 'Get my PayTags',
        description: 'Get all PayTags for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            paytags: Type.Array(
              Type.Object({
                id: Type.String(),
                handle: Type.String(),
                displayName: Type.String(),
                walletAddress: Type.String(),
                walletId: Type.String(),
                status: Type.String(),
                createdAt: Type.String(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const userId = request.user!.userId;

      const userPaytags = await db
        .select()
        .from(paytags)
        .where(eq(paytags.userId, userId));

      return {
        paytags: userPaytags.map((paytag) => ({
          id: paytag.id,
          handle: paytag.handle,
          displayName: paytag.displayName || paytag.handle,
          walletAddress: paytag.circleWalletAddress,
          walletId: paytag.circleWalletId,
          status: paytag.status,
          createdAt: paytag.createdAt.toISOString(),
        })),
      };
    }
  );

  /**
   * USER: Create PayTag
   */
  fastify.post(
    '/v1/paytags',
    {
      onRequest: [fastify.requireUser],
      schema: {
        tags: ['paytags'],
        summary: 'Create PayTag',
        description: 'Create a new PayTag (one per user)',
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          handle: Type.String({ minLength: 3, maxLength: 20 }),
          displayName: Type.Optional(Type.String()),
        //   destinationAddress: Type.Optional(Type.String()),
        }),
        response: {
          201: Type.Object({
            id: Type.String(),
            handle: Type.String(),
            displayName: Type.String(),
            walletAddress: Type.String(),
            walletId: Type.String(),
            status: Type.String(),
            createdAt: Type.String(),
          }),
          400: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
          401: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { handle, displayName } = request.body as {
        handle: string;
        displayName?: string;
      };

      const userId = request.user!.userId;

      try {
        const paytag = await paytagService.createPaytag(
          userId,
          handle,
          displayName,
        //   destinationAddress
        );

        return reply.code(201).send({
          id: paytag.id,
          handle: paytag.handle,
          displayName: paytag.displayName || paytag.handle,
          walletAddress: paytag.circleWalletAddress,
          walletId: paytag.circleWalletId,
          status: paytag.status,
          createdAt: paytag.createdAt.toISOString(),
        });
      } catch (error: any) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }
    }
  );

  /**
   * USER: Update PayTag
   */
  fastify.patch(
    '/v1/paytags/:handle',
    {
      onRequest: [fastify.requireUser],
      schema: {
        tags: ['paytags'],
        summary: 'Update PayTag',
        description: 'Update PayTag display name or destination address (owner only)',
        security: [{ bearerAuth: [] }],
        params: Type.Object({
          handle: Type.String(),
        }),
        body: Type.Object({
          displayName: Type.Optional(Type.String()),
          destinationAddress: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            handle: Type.String(),
            displayName: Type.String(),
            destinationAddress: Type.String(),
            status: Type.String(),
          }),
          400: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
          401: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
          404: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { handle } = request.params as { handle: string };
      const updates = request.body as {
        displayName?: string;
        destinationAddress?: string;
      };

      const userId = request.user!.userId;

      try {
        const paytag = await paytagService.updatePaytag(handle, userId, updates);

        return {
          id: paytag.id,
          handle: paytag.handle,
          displayName: paytag.displayName || paytag.handle,
          destinationAddress: paytag.destinationAddress,
          status: paytag.status,
        };
      } catch (error: any) {
        if (error.message.includes('not found') || error.message.includes('unauthorized')) {
          return reply.code(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }

        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }
    }
  );
};

export default paytagRoutes;
