import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { CircleService } from '../../services/circle.service.js';

const circleService = new CircleService();

/**
 * Admin Circle Management Routes
 */
const adminCircleRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * ADMIN: Register Entity Secret Ciphertext
   */
  fastify.post(
    '/v1/admin/circle/register-entity-secret',
    {
      onRequest: [fastify.requireAdmin],
      schema: {
        tags: ['admin', 'circle'],
        summary: 'Register Entity Secret with Circle',
        description: 'Encrypt and register Entity Secret with Circle. This must be done once before creating wallets.',
        security: [{ adminAuth: [] }],
        body: Type.Object({
          recoveryFileDownloadPath: Type.Optional(Type.String({
            description: 'Optional path to save recovery file'
          })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
            recoveryFile: Type.Optional(Type.String()),
          }),
          400: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
          401: Type.Object({
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
      const { recoveryFileDownloadPath } = request.body as {
        recoveryFileDownloadPath?: string;
      };

      try {
        const response = await circleService.registerEntitySecretCiphertext(
          process.env.CIRCLE_ENTITY_SECRET || '',
          recoveryFileDownloadPath || ''
        );

        if (response.error) {
          return reply.code(500).send({
            error: 'Registration Failed',
            message: 'Failed to register Entity Secret with Circle',
          });
        }

        return {
          success: true,
          message: 'Entity Secret registered successfully',
          recoveryFile: response.data?.recoveryFile,
        };
      } catch (error: any) {
        fastify.log.error('Entity Secret registration error:', error);

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Failed to register Entity Secret',
        });
      }
    }
  );

  /**
   * ADMIN: Create Wallet Set
   */
  fastify.post(
    '/v1/admin/circle/create-wallet-set',
    {
      onRequest: [fastify.requireAdmin],
      schema: {
        tags: ['admin', 'circle'],
        summary: 'Create Circle Wallet Set',
        description: 'Create a new Circle wallet set for organizing wallets',
        security: [{ adminAuth: [] }],
        body: Type.Object({
          name: Type.Optional(Type.String({
            description: 'Optional name for the wallet set'
          })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            message: Type.String(),
            walletSet: Type.Optional(Type.Any()),
          }),
          400: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
          401: Type.Object({
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
      const { name } = request.body as {
        name?: string;
      };

      try {
        const walletSet = await circleService.createWalletSet(name);

        return {
          success: true,
          message: 'Wallet set created successfully',
          walletSet,
        };
      } catch (error: any) {
        fastify.log.error('Wallet set creation error:', error);

        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Failed to create wallet set',
        });
      }
    }
  );
};

export default adminCircleRoutes;
