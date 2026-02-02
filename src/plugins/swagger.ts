import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

/**
 * OpenAPI / Swagger Plugin with Scalar UI
 */
const swaggerPlugin: FastifyPluginAsync = async (fastify) => {
  // Register Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'PayTag API',
        description: 'Web3 Payments Backend - Create PayTags, receive crypto, generate receipts',
        version: '1.0.0',
      },
      servers: [
        {
          url: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'User JWT token (from /v1/auth/user/verify)',
          },
          adminAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Admin JWT token (from /v1/auth/admin/login)',
          },
        },
      },
      tags: [
        { name: 'health', description: 'Health check endpoints' },
        { name: 'auth', description: 'Authentication endpoints' },
        { name: 'paytags', description: 'PayTag management' },
        { name: 'receipts', description: 'Payment receipts' },
        { name: 'webhooks', description: 'Circle webhook handlers' },
        { name: 'admin', description: 'Admin operations' },
      ],
    },
  });

  // Register Swagger UI with Scalar theme
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
};

export default fp(swaggerPlugin, {
  name: 'swagger',
});
