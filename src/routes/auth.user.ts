import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { db, users } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { OtpService } from '../services/otp.service.js';
import { EmailService } from '../services/email.service.js';
import { generateToken } from '../lib/jwt.js';

const otpService = new OtpService();
const emailService = new EmailService();

/**
 * User Authentication Routes (Email + OTP)
 */
const userAuthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Start OTP flow - Generate and send OTP code
   */
  fastify.post(
    '/v1/auth/user/start',
    {
      schema: {
        tags: ['auth'],
        summary: 'Start OTP authentication',
        description: 'Generate and send OTP code to email',
        body: Type.Object({
          email: Type.String({ format: 'email' }),
        }),
        response: {
          200: Type.Object({
            message: Type.String(),
            email: Type.String(),
            expiresIn: Type.Number(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string };

      // Generate OTP
      const code = await otpService.createOtp(email.toLowerCase());

      // Send OTP via email (mock)
      await emailService.sendOtpEmail(email, code);

      return {
        message: 'OTP sent to email',
        email,
        expiresIn: parseInt(process.env.OTP_EXPIRY_SECONDS || '600', 10),
      };
    }
  );

  /**
   * Verify OTP code and issue JWT
   */
  fastify.post(
    '/v1/auth/user/verify',
    {
      schema: {
        tags: ['auth'],
        summary: 'Verify OTP code',
        description: 'Verify OTP code and receive JWT token',
        body: Type.Object({
          email: Type.String({ format: 'email' }),
          code: Type.String({ minLength: 6, maxLength: 6 }),
        }),
        response: {
          200: Type.Object({
            token: Type.String(),
            user: Type.Object({
              id: Type.String(),
              email: Type.String(),
              type: Type.String(),
              isNewUser: Type.Boolean(),
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
      const { email, code } = request.body as { email: string; code: string };

      const normalizedEmail = email.toLowerCase();

      // Verify OTP
      const isValid = await otpService.verifyOtp(normalizedEmail, code);

      if (!isValid) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired OTP code',
        });
      }

      // Find or create user
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      let isNewUser = false;

      if (!user) {
        // Create new user
        [user] = await db
          .insert(users)
          .values({
            email: normalizedEmail,
            emailVerifiedAt: new Date(),
          })
          .returning();

        isNewUser = true;

        // Send welcome email
        await emailService.sendWelcomeEmail(normalizedEmail);
      } else if (!user.emailVerifiedAt) {
        // Mark email as verified
        [user] = await db
          .update(users)
          .set({ emailVerifiedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
      }

      // Generate user JWT
      const token = generateToken({
        userId: user.id,
        email: user.email,
        type: 'user',
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          type: 'user',
          isNewUser,
        },
      };
    }
  );
};

export default userAuthRoutes;
