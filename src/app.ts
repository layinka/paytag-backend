import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';

// Plugins
import swaggerPlugin from './plugins/swagger.js';
import adminAuthPlugin from './plugins/auth.admin.js';
import userAuthPlugin from './plugins/auth.user.js';

// Routes
import healthRoutes from './routes/health.js';
import userAuthRoutes from './routes/auth.user.js';
import paytagRoutes from './routes/paytags.js';
import receiptRoutes from './routes/receipts.js';
import webhookRoutes from './routes/webhooks.js';
import settingsRoutes from './routes/settings.js';

// Admin Routes
import adminAuthRoutes from './routes/admin/admin.auth.js';
import adminCircleRoutes from './routes/admin/admin.circle.js';
import adminPaytagRoutes from './routes/admin/admin.paytags.js';

/**
 * Build Fastify application with all plugins and routes
 */
export async function buildApp() {
  const isDev = process.env.NODE_ENV !== 'production';

  const fastify = Fastify({
    logger: {
      level: isDev ? 'info' : 'warn',
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              colorize: true,
            },
          }
        : undefined,
    },
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // OpenAPI / Swagger
  await fastify.register(swaggerPlugin);

  // Auth plugins
  await fastify.register(adminAuthPlugin);
  await fastify.register(userAuthPlugin);

  // Routes
  await fastify.register(healthRoutes);
  await fastify.register(userAuthRoutes);
  await fastify.register(paytagRoutes);
  await fastify.register(receiptRoutes);
  await fastify.register(webhookRoutes);
  await fastify.register(settingsRoutes);

  // Admin Routes
  await fastify.register(adminAuthRoutes);
  await fastify.register(adminCircleRoutes);
  await fastify.register(adminPaytagRoutes);

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    reply.status(error.statusCode || 500).send({
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });

  // 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  return fastify;
}
