-- AutoSwap Schema Migration
-- Add autoswap fields to users, payments, receipts
-- Add swap_jobs table

-- Add autoswap fields to users table
ALTER TABLE users ADD COLUMN autoswap_enabled INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN autoswap_slippage_bps INTEGER DEFAULT 50 NOT NULL;
ALTER TABLE users ADD COLUMN autoswap_max_gas_gwei INTEGER;
ALTER TABLE users ADD COLUMN autoswap_min_amount_wei TEXT;

-- Add swap tracking fields to payments table
ALTER TABLE payments ADD COLUMN swap_status TEXT DEFAULT 'not_applicable' NOT NULL;
ALTER TABLE payments ADD COLUMN swap_tx_hash TEXT;
ALTER TABLE payments ADD COLUMN swap_error TEXT;
ALTER TABLE payments ADD COLUMN amount_out_usdc TEXT;
ALTER TABLE payments ADD COLUMN router_used TEXT;

-- Add swap details to receipts table
ALTER TABLE receipts ADD COLUMN swap_details_json TEXT;

-- Create swap_jobs table for async processing
CREATE TABLE IF NOT EXISTS swap_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'queued' NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  max_attempts INTEGER DEFAULT 3 NOT NULL,
  next_run_at INTEGER NOT NULL,
  locked_at INTEGER,
  locked_by TEXT,
  completed_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

-- Create indexes for efficient job processing
CREATE INDEX IF NOT EXISTS idx_swap_jobs_status ON swap_jobs(status);
CREATE INDEX IF NOT EXISTS idx_swap_jobs_next_run ON swap_jobs(next_run_at);
CREATE INDEX IF NOT EXISTS idx_swap_jobs_payment ON swap_jobs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_swap_status ON payments(swap_status);
