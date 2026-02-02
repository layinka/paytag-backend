import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PaytagService } from '../../services/paytag.service.js';

const paytagService = new PaytagService();

/**
 * Admin PayTag Management Routes
 */
const adminPaytagRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * ADMIN: Create PayTag on behalf of user
   */
  fastify.post(
    '/v1/admin/paytags',
    {
      onRequest: [fastify.requireAdmin],
      schema: {
        tags: ['admin', 'paytags'],
        summary: 'Admin: Create PayTag',
        description: 'Create PayTag as admin',
        security: [{ adminAuth: [] }],
        body: Type.Object({
          userId: Type.String(),
          handle: Type.String({ minLength: 3, maxLength: 20 }),
          displayName: Type.Optional(Type.String()),
          destinationAddress: Type.Optional(Type.String()),
        }),
        response: {
          201: Type.Object({
            id: Type.String(),
            handle: Type.String(),
            displayName: Type.String(),
            walletAddress: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { userId, handle, displayName, destinationAddress } = request.body as {
        userId: string;
        handle: string;
        displayName?: string;
        destinationAddress?: string;
      };

      try {
        const paytag = await paytagService.createPaytag(
          userId,
          handle,
          displayName,
          destinationAddress
        );

        return reply.code(201).send({
          id: paytag.id,
          handle: paytag.handle,
          displayName: paytag.displayName || paytag.handle,
          walletAddress: paytag.circleWalletAddress,
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
   * ADMIN: Update PayTag (override)
   */
  fastify.patch(
    '/v1/admin/paytags/:handle',
    {
      onRequest: [fastify.requireAdmin],
      schema: {
        tags: ['admin', 'paytags'],
        summary: 'Admin: Update PayTag',
        description: 'Update PayTag with admin privileges (can suspend, override fields)',
        security: [{ adminAuth: [] }],
        params: Type.Object({
          handle: Type.String(),
        }),
        body: Type.Object({
          displayName: Type.Optional(Type.String()),
          destinationAddress: Type.Optional(Type.String()),
          status: Type.Optional(Type.Union([Type.Literal('active'), Type.Literal('suspended')])),
        }),
        response: {
          200: Type.Object({
            id: Type.String(),
            handle: Type.String(),
            displayName: Type.String(),
            status: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { handle } = request.params as { handle: string };
      const updates = request.body as {
        displayName?: string;
        destinationAddress?: string;
        status?: 'active' | 'suspended';
      };

      try {
        const paytag = await paytagService.adminUpdatePaytag(handle, updates);

        return {
          id: paytag.id,
          handle: paytag.handle,
          displayName: paytag.displayName || paytag.handle,
          status: paytag.status,
        };
      } catch (error: any) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
        });
      }
    }
  );
};

export default adminPaytagRoutes;
