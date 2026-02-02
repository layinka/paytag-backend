import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schemas/index.js';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const databaseUrl = process.env.DATABASE_URL || './data/paytag.sqlite';

// Ensure data directory exists
await mkdir(dirname(databaseUrl), { recursive: true });

// Initialize SQLite database
const sqlite = new Database(databaseUrl);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export types
export * from './schemas/index.js';
