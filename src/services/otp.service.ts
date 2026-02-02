import { db, otpCodes, users } from '../db/index.js';
import { eq, and, gt } from 'drizzle-orm';
import { generateOtpCode } from '../lib/utils.js';

/**
 * OTP Service
 * Handles generation, storage, and verification of one-time passcodes
 */
export class OtpService {
  private readonly expirySeconds: number;

  constructor() {
    this.expirySeconds = parseInt(process.env.OTP_EXPIRY_SECONDS || '600', 10);
  }

  /**
   * Generate and store a new OTP code for an email
   */
  async createOtp(email: string): Promise<string> {
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + this.expirySeconds * 1000);

    await db.insert(otpCodes).values({
      email,
      code,
      expiresAt,
    });

    return code;
  }

  /**
   * Verify an OTP code
   * Returns the email if valid, null otherwise
   */
  async verifyOtp(email: string, code: string): Promise<boolean> {
    const now = new Date();

    // Find valid OTP
    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.email, email),
          eq(otpCodes.code, code),
          gt(otpCodes.expiresAt, now)
        )
      )
      .limit(1);

    if (!otp || otp.usedAt) {
      return false;
    }

    // Mark OTP as used
    await db
      .update(otpCodes)
      .set({ usedAt: now })
      .where(eq(otpCodes.id, otp.id));

    return true;
  }

  /**
   * Clean up expired OTP codes
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date();
    await db.delete(otpCodes).where(gt(now, otpCodes.expiresAt));
  }
}
