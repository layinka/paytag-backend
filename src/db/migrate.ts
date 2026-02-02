import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL || './data/paytag.sqlite';

async function runMigrations() {
  try {
    // Ensure data directory exists
    await mkdir(dirname(databaseUrl), { recursive: true });

    const sqlite = new Database(databaseUrl);
    const db = drizzle(sqlite);

    console.log('🔄 Running migrations...');
    
    migrate(db, { migrationsFolder: './src/db/migrations' });
    
    console.log('✅ Migrations completed successfully');
    
    sqlite.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
