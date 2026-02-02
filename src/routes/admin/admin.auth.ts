import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, users } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../../lib/jwt.js';

/**
 * Admin Authentication Routes
 */
const adminAuthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Admin login with password
   */
  fastify.post(
    '/v1/auth/admin/login',
    {
      schema: {
        tags: ['auth', 'admin'],
        summary: 'Admin login',
        description: 'Authenticate as admin using password',
        body: Type.Object({
          password: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({
            token: Type.String(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
              type: Type.String(),
            }),
          }),
          401: Type.Object({
            error: Type.String(),
            message: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { password } = request.body as { password: string };

      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminPassword) {
        return reply.code(500).send({
          error: 'Configuration Error',
          message: 'Admin password not configured',
        });
      }

      if (password !== adminPassword) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid password',
        });
      }

      // Get admin user
      const adminEmail = 'admin@paytag.com';
      const [admin] = await db
        .select()
        .from(users)
        .where(eq(users.email, adminEmail))
        .limit(1);

      if (!admin) {
        return reply.code(500).send({
          error: 'Configuration Error',
          message: 'Admin user not found. Run npm run db:seed',
        });
      }

      // Generate admin JWT
      const token = generateToken({
        userId: admin.id,
        email: admin.email,
        type: 'admin',
      });

      return {
        token,
        user: {
          id: admin.id,
          email: admin.email,
          type: 'admin',
        },
      };
    }
  );
};

export default adminAuthRoutes;
