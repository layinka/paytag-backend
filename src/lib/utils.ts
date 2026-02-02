/**
 * Generate a 6-digit OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate PayTag handle format
 * - Lowercase alphanumeric + hyphens
 * - 3-20 characters
 * - Must start with letter
 */
export function isValidHandle(handle: string): boolean {
  const regex = /^[a-z][a-z0-9-]{2,19}$/;
  return regex.test(handle);
}

/**
 * Normalize handle (lowercase, trim)
 */
export function normalizeHandle(handle: string): string {
  return handle.toLowerCase().trim();
}
