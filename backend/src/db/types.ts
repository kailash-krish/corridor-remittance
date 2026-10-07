/**
 * Database type definitions matching PostgreSQL schema
 */

export type KycStatus = "NOT_STARTED" | "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";

export type TransferStatus =
  | "CREATED"
  | "KYC_CHECK"
  | "AWAITING_FUNDS"
  | "FUNDS_RECEIVED"
  | "AML_CHECK"
  | "AML_REVIEW"
  | "CONVERTING"
  | "PAYOUT_PENDING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type AmlFlagStatus = "PENDING" | "APPROVED" | "REJECTED";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

export interface KycRecord {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  id_type: string;
  id_number: string;
  country: string;
  status: KycStatus;
  provider_reference: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  user_id: string;
  source_currency: string;
  target_currency: string;
  send_amount_minor: number; // BigInt represented in JS as number for minor units
  receive_amount_minor: number;
  fee_minor: number;
  exchange_rate: number;
  expires_at: string;
  is_consumed: boolean;
  consumed_at: string | null;
  created_at: string;
}

export interface RecipientDetails {
  name: string;
  account_number?: string;
  ifsc?: string;
  upi_id?: string;
  bank_name?: string;
  country: string;
}

export interface Transfer {
  id: string;
  user_id: string;
  quote_id: string;
  status: TransferStatus;
  source_currency: string;
  target_currency: string;
  send_amount_minor: number;
  receive_amount_minor: number;
  fee_minor: number;
  exchange_rate: number;
  sender_account_id: string | null;
  recipient_details: RecipientDetails;
  blockchain_tx_hash: string | null;
  payout_reference: string | null;
  cancellation_reason: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferEvent {
  id: string;
  transfer_id: string;
  from_status: TransferStatus | null;
  to_status: TransferStatus;
  event_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AmlFlag {
  id: string;
  transfer_id: string;
  user_id: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: AmlFlagStatus;
  decision_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  transfer_id: string | null;
  channel: "EMAIL" | "SMS" | "IN_APP" | "PUSH";
  type: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface IdempotencyKey {
  id: string;
  key: string;
  user_id: string;
  request_path: string;
  request_params_hash: string;
  response_code: number | null;
  response_body: Record<string, unknown> | null;
  locked_at: string;
  created_at: string;
}
