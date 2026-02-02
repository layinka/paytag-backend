import { db } from './index.js';
import { users } from './schemas/index.js';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

/**
 * Seed admin user
 * Admin authentication is password-based (not OTP)
 * Password is stored in ADMIN_PASSWORD env var
 */
async function seed() {
  try {
    const adminEmail = 'admin@paytag.com';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD environment variable is required');
    }

    console.log('🌱 Seeding database...');

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('ℹ️  Admin user already exists');
    } else {
      await db.insert(users).values({
        email: adminEmail,
        emailVerifiedAt: new Date(),
      });
      console.log('✅ Admin user created:', adminEmail);
    }

    console.log('');
    console.log('📝 Admin credentials:');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
    console.log('');
    console.log('✅ Seeding completed successfully');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
