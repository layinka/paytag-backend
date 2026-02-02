import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { WebhookService } from '../services/webhook.service.js';

const webhookService = new WebhookService();

/**
 * Webhook Routes
 */
const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Circle webhook handler
   */
  fastify.post(
    '/v1/webhooks/circle',
    {
      schema: {
        tags: ['webhooks'],
        summary: 'Circle webhook handler',
        description: 'Receive and process Circle webhook events',
        headers: Type.Object({
          'x-circle-signature': Type.Optional(Type.String()),
        }),
        body: Type.Any(),
        response: {
          200: Type.Object({
            message: Type.String(),
          }),
          400: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const signature = request.headers['x-circle-signature'] as string | undefined;
      const payload = request.body;

      if (!signature) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing webhook signature',
        });
      }

      try {
        await webhookService.processWebhook(payload, signature);

        return {
          message: 'Webhook processed',
        };
      } catch (error: any) {
        fastify.log.error('Webhook processing error:', error);

        return reply.code(400).send({
          error: 'Bad Request',
          message: error.message || 'Failed to process webhook',
        });
      }
    }
  );
};

export default webhookRoutes;
