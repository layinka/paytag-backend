import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, extractToken, JwtPayload } from '../lib/jwt.js';

/**
 * Admin JWT Authentication Plugin
 * Validates JWT tokens for admin routes
 */
const adminAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorator to attach admin user info to request
  fastify.decorateRequest('admin', null);

  // Admin auth hook
  fastify.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = extractToken(request.headers.authorization);

      if (!token) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'No authentication token provided',
        });
      }

      const payload = verifyToken(token);

      if (payload.type !== 'admin') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Admin access required',
        });
      }

      // Attach admin info to request
      (request as any).admin = payload;
    } catch (error) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  });
};

// Type augmentation for TypeScript
declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    admin?: JwtPayload;
  }
}

export default fp(adminAuthPlugin, {
  name: 'admin-auth',
});
