-- ============================================================================
-- Blockchain Cross-Border Remittance Core Backend Migration
-- Version: 001_initial_schema
-- ============================================================================

-- Enable required Postgres extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE kyc_status_enum AS ENUM (
  'NOT_STARTED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REVIEW'
);

CREATE TYPE transfer_status_enum AS ENUM (
  'CREATED',
  'KYC_CHECK',
  'AWAITING_FUNDS',
  'FUNDS_RECEIVED',
  'AML_CHECK',
  'AML_REVIEW',
  'CONVERTING',
  'PAYOUT_PENDING',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TYPE aml_flag_status_enum AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE notification_status_enum AS ENUM (
  'PENDING',
  'SENT',
  'FAILED'
);

-- ============================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TABLES
-- ============================================================================

-- Table 1: kyc_records
-- Tracks customer identity verification details and status
CREATE TABLE IF NOT EXISTS kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  id_type TEXT NOT NULL, -- e.g. 'PASSPORT', 'EMIRATES_ID', 'AADHAAR'
  id_number TEXT NOT NULL,
  country VARCHAR(3) NOT NULL, -- ISO 3166-1 alpha-3 (e.g. 'ARE', 'IND')
  status kyc_status_enum NOT NULL DEFAULT 'PENDING',
  provider_reference TEXT NULL,
  rejection_reason TEXT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_kyc_user UNIQUE (user_id)
);

CREATE TRIGGER set_kyc_records_updated_at
  BEFORE UPDATE ON kyc_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table 2: quotes
-- Locked FX quote with short expiry (e.g. 60s). Minor units used for all money.
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_currency VARCHAR(3) NOT NULL, -- e.g. 'AED'
  target_currency VARCHAR(3) NOT NULL, -- e.g. 'INR'
  send_amount_minor BIGINT NOT NULL, -- Integer minor units (e.g. 10000 fils = 100.00 AED)
  receive_amount_minor BIGINT NOT NULL, -- Integer minor units (e.g. 227000 paise = 2270.00 INR)
  fee_minor BIGINT NOT NULL, -- Source currency fee in minor units
  exchange_rate NUMERIC(18, 6) NOT NULL, -- e.g. 22.700000
  expires_at TIMESTAMPTZ NOT NULL,
  is_consumed BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 3: transfers
-- Core stateful remittance transaction
CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
  status transfer_status_enum NOT NULL DEFAULT 'CREATED',
  source_currency VARCHAR(3) NOT NULL,
  target_currency VARCHAR(3) NOT NULL,
  send_amount_minor BIGINT NOT NULL,
  receive_amount_minor BIGINT NOT NULL,
  fee_minor BIGINT NOT NULL,
  exchange_rate NUMERIC(18, 6) NOT NULL,
  sender_account_id TEXT NULL, -- Mock UAE bank account / IBAN
  recipient_details JSONB NOT NULL, -- { "name": "...", "account_number": "...", "ifsc": "...", "upi_id": "..." }
  blockchain_tx_hash TEXT NULL, -- Mock chain transaction hash from ChainService
  payout_reference TEXT NULL, -- Mock Indian bank payout reference
  cancellation_reason TEXT NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_transfers_updated_at
  BEFORE UPDATE ON transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table 4: transfer_events
-- Append-only audit log for state machine history
CREATE TABLE IF NOT EXISTS transfer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  from_status transfer_status_enum NULL,
  to_status transfer_status_enum NOT NULL,
  event_name TEXT NOT NULL, -- e.g. 'INITIATE', 'KYC_VERIFIED', 'FUNDS_RECEIVED'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 5: aml_flags
-- Suspicious transaction flags requiring automated or manual compliance review
CREATE TABLE IF NOT EXISTS aml_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  status aml_flag_status_enum NOT NULL DEFAULT 'PENDING',
  decision_notes TEXT NULL,
  reviewed_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_aml_flags_updated_at
  BEFORE UPDATE ON aml_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table 6: notifications
-- Outbox for customer status alert notifications (email, push, webhook)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transfer_id UUID NULL REFERENCES transfers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'EMAIL', -- 'EMAIL', 'SMS', 'IN_APP', 'PUSH'
  type TEXT NOT NULL, -- e.g. 'TRANSFER_STATUS_UPDATE', 'KYC_STATUS_UPDATE'
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status notification_status_enum NOT NULL DEFAULT 'PENDING',
  sent_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 7: idempotency_keys
-- Prevents duplicate payment creation and state transitions
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_path TEXT NOT NULL,
  request_params_hash VARCHAR(64) NOT NULL,
  response_code INTEGER NULL,
  response_body JSONB NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_idempotency_user_key UNIQUE (user_id, key)
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- kyc_records
CREATE INDEX IF NOT EXISTS idx_kyc_records_user_id ON kyc_records(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON kyc_records(status);

-- quotes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_expires_at ON quotes(expires_at);

-- transfers
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_quote_id ON transfers(quote_id);

-- transfer_events
CREATE INDEX IF NOT EXISTS idx_transfer_events_transfer_id ON transfer_events(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_events_created_at ON transfer_events(created_at ASC);

-- aml_flags
CREATE INDEX IF NOT EXISTS idx_aml_flags_transfer_id ON aml_flags(transfer_id);
CREATE INDEX IF NOT EXISTS idx_aml_flags_user_id ON aml_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_aml_flags_status ON aml_flags(status);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_transfer_id ON notifications(transfer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- idempotency_keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_key ON idempotency_keys(user_id, key);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
/*
  RLS ARCHITECTURE NOTES:
  1. Service Role Bypass: The backend core orchestrator connects with the
     `SUPABASE_SERVICE_ROLE_KEY`, which automatically bypasses RLS for backend operations.
  2. Direct Client / End-user Access: When frontend or authenticated users query
     PostgREST directly with their Supabase JWT:
     - Users can only read/write their own records (`auth.uid() = user_id`).
     - Admin users (`auth.jwt() ->> 'role' = 'admin'`) can inspect and update compliance records.
*/

ALTER TABLE kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- KYC Policies
CREATE POLICY "Users can view own KYC record"
  ON kyc_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own KYC record"
  ON kyc_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Quotes Policies
CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Transfers Policies
CREATE POLICY "Users can view own transfers"
  ON transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfers"
  ON transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Transfer Events Policies
CREATE POLICY "Users can view events for own transfers"
  ON transfer_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transfers
      WHERE transfers.id = transfer_events.transfer_id
        AND transfers.user_id = auth.uid()
    )
  );

-- AML Flags Policies (Users cannot see AML flags; Compliance Admins only)
CREATE POLICY "Admins can view and manage all AML flags"
  ON aml_flags FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
  );

-- Notifications Policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Idempotency Keys Policies
CREATE POLICY "Users can manage own idempotency keys"
  ON idempotency_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
