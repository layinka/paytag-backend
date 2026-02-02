import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * Users table
 * Stores authenticated users who can create PayTags
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * OTP Codes table
 * Stores one-time passcodes for email authentication
 */
export const otpCodes = sqliteTable('otp_codes', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * PayTags table
 * Maps human-readable handles to Circle programmable wallets
 */
export const paytags = sqliteTable('paytags', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  handle: text('handle').notNull().unique(),
  displayName: text('display_name'),
  destinationAddress: text('destination_address').notNull(),
  circleWalletId: text('circle_wallet_id').notNull(),
  circleWalletAddress: text('circle_wallet_address').notNull(),
  status: text('status', { enum: ['active', 'suspended'] })
    .notNull()
    .default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Payments table
 * Stores detected crypto payments from Circle webhooks
 */
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  paytagId: text('paytag_id')
    .notNull()
    .references(() => paytags.id, { onDelete: 'cascade' }),
  chain: text('chain').notNull(),
  asset: text('asset', { enum: ['USDC', 'ETH', 'UNKNOWN'] })
    .notNull()
    .default('UNKNOWN'),
  amount: text('amount').notNull(),
  fromAddress: text('from_address'),
  toAddress: text('to_address').notNull(),
  txHash: text('tx_hash').notNull().unique(),
  circleTransferId: text('circle_transfer_id'),
  rawEvent: text('raw_event', { mode: 'json' }).notNull(),
  status: text('status', { enum: ['detected', 'processed', 'failed'] })
    .notNull()
    .default('detected'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Receipts table
 * Public-facing payment receipts for end users
 */
export const receipts = sqliteTable('receipts', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  paymentId: text('payment_id')
    .notNull()
    .references(() => payments.id, { onDelete: 'cascade' }),
  receiptPublicId: text('receipt_public_id').notNull().unique(),
  paytagHandle: text('paytag_handle').notNull(),
  amountUSDC: text('amount_usdc').notNull(),
  txHash: text('tx_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type OtpCode = typeof otpCodes.$inferSelect;
export type NewOtpCode = typeof otpCodes.$inferInsert;

export type Paytag = typeof paytags.$inferSelect;
export type NewPaytag = typeof paytags.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
