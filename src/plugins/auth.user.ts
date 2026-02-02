import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyToken, extractToken, JwtPayload } from '../lib/jwt.js';

/**
 * User JWT Authentication Plugin
 * Validates JWT tokens for user routes
 */
const userAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorator to attach user info to request
  fastify.decorateRequest('user', null);

  // User auth hook
  fastify.decorate('requireUser', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = extractToken(request.headers.authorization);

      if (!token) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'No authentication token provided',
        });
      }

      const payload = verifyToken(token);

      if (payload.type !== 'user') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'User access required',
        });
      }

      // Attach user info to request
      (request as any).user = payload;
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
    requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export default fp(userAuthPlugin, {
  name: 'user-auth',
});
