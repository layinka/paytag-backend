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
      config: {
        // Preserve raw body for signature verification
        rawBody: true,
      },
      preParsing: async (request, _reply, payload) => {
        try {
          // Capture raw body before Fastify parses it
          const chunks: Buffer[] = [];
          
          for await (const chunk of payload) {
            chunks.push(chunk);
          }
          
          const rawBuffer = Buffer.concat(chunks);
          const rawString = rawBuffer.toString('utf-8');
          
          // Store raw body on request for signature verification
          (request as any).rawBody = rawString;
          
          // Return the raw buffer as a new stream for Fastify to parse
          const { Readable } = await import('stream');
          return Readable.from(rawBuffer);
        } catch (error: any) {
          fastify.log.error('Error in preParsing hook:', error);
          throw error;
        }
      },
      schema: {
        tags: ['webhooks'],
        summary: 'Circle webhook handler',
        description: 'Receive and process Circle webhook events',
        headers: Type.Object({
          'x-circle-signature': Type.Optional(Type.String()),
          'x-circle-key-id': Type.Optional(Type.String()),
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
      const keyId = request.headers['x-circle-key-id'] as string | undefined;
      const payload = request.body;
      
      // Get raw body for signature verification
      const rawBody = (request as any).rawBody;

      fastify.log.info({ keyId }, '📨 Webhook received from Circle');
      
      // Log the payload structure for debugging
      fastify.log.info({ 
        notificationType: payload?.notificationType,
        notificationHasData: !!payload?.notification,
        tokenId: payload?.notification?.tokenId,
        blockchain: payload?.notification?.blockchain,
        state: payload?.notification?.state
      }, 'Webhook payload structure');

      if (!signature) {
        fastify.log.warn('Webhook rejected: Missing signature header');
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing X-Circle-Signature header',
        });
      }

      if (!keyId) {
        fastify.log.warn('Webhook rejected: Missing key ID header');
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Missing X-Circle-Key-Id header',
        });
      }

      if (!rawBody) {
        fastify.log.error('Failed to capture raw body for signature verification');
        return (reply as any).code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to process webhook',
        });
      }

      try {
        await webhookService.processWebhook(payload, rawBody, signature, keyId);

        return {
          message: 'Webhook processed',
        };
      } catch (error: any) {
        // Log the full error for debugging
        fastify.log.error({ error: error.message, stack: error.stack }, 'Webhook processing failed');

        // Determine appropriate status code
        const statusCode = error.message?.includes('signature') ? 401 : 400;

        return (reply as any).code(statusCode).send({
          error: statusCode === 401 ? 'Unauthorized' : 'Bad Request',
          message: error.message || 'Failed to process webhook',
        });
      }
    }
  );
};

export default webhookRoutes;
