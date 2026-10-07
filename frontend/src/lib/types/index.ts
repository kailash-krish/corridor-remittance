export type InvoiceStatus = 'open' | 'in_progress' | 'closed';

export interface Invoice {
  id: string;
  user_id: string;
  track_id?: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  recipient_name?: string;
  recipient_email?: string;
  amount_paise: number; // Stored as integer paise (e.g. 10000 paise = ₹100.00)
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null; // Soft-delete timestamp
}

export type CreateInvoiceInput = {
  track_id?: string;
  invoice_number: string;
  customer_name?: string;
  customer_email?: string;
  recipient_name?: string;
  recipient_email?: string;
  amount_paise: number;
  status?: InvoiceStatus;
  issue_date?: string;
  due_date: string;
  remarks?: string | null;
};

export type UpdateInvoiceInput = {
  track_id?: string;
  customer_name?: string;
  customer_email?: string;
  recipient_name?: string;
  recipient_email?: string;
  amount_paise?: number;
  status?: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  remarks?: string | null;
};

export type TrackEventType =
  | 'invoice_created'
  | 'invoice_updated'
  | 'invoice_deleted'
  | 'draft_generated'
  | 'mail_sent'
  | 'reminder_sent'
  | 'note_added';

export interface Track {
  id: string;
  user_id: string;
  name: string;
  symbol: string;
  archived?: boolean;
  created_at: string;
  // Backward compatibility fields for event tracking
  invoice_id?: string | null;
  event_type?: TrackEventType;
  message?: string;
  metadata?: Record<string, unknown>;
}

export type CreateTrackInput = {
  name?: string;
  symbol?: string;
  archived?: boolean;
  invoice_id?: string | null;
  event_type?: TrackEventType;
  message?: string;
  metadata?: Record<string, unknown>;
};

export interface EmailDraft {
  id: string;
  user_id: string;
  invoice_id: string;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateEmailDraftInput = {
  invoice_id: string;
  recipient_name: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at?: string | null;
};

export interface InvoicesRepo {
  findById(userId: string, id: string): Promise<Invoice | null>;
  findByInvoiceNumber(userId: string, invoiceNumber: string): Promise<Invoice | null>;
  list(userId: string, options?: { status?: InvoiceStatus; includeDeleted?: boolean }): Promise<Invoice[]>;
  create(userId: string, data: CreateInvoiceInput): Promise<Invoice>;
  update(userId: string, id: string, data: UpdateInvoiceInput): Promise<Invoice | null>;
  softDelete(userId: string, id: string): Promise<boolean>;
}

export interface TracksRepo {
  list(
    userId: string,
    options?: { invoiceId?: string; includeArchived?: boolean; events?: boolean }
  ): Promise<Track[]>;
  findById(userId: string, id: string): Promise<Track | null>;
  create(userId: string, data: CreateTrackInput): Promise<Track>;
}

export interface EmailDraftsRepo {
  findById(userId: string, id: string): Promise<EmailDraft | null>;
  save(userId: string, data: CreateEmailDraftInput): Promise<EmailDraft>;
  markSent(userId: string, id: string): Promise<EmailDraft | null>;
  listByInvoice(userId: string, invoiceId: string): Promise<EmailDraft[]>;
}

export interface DraftInput {
  invoice_number: string;
  customer_name: string;
  amount_paise: number;
  status: InvoiceStatus;
  due_date?: string;
  issue_date?: string;
  remarks?: string | null;
  sender_name?: string;
  /** Optional trading segment / instrument name; used by the AI path for context. */
  track?: string;
  /** Recipient display name override; used by the AI path. */
  recipient_name?: string;
}

export type DraftSource = 'ai' | 'template_fallback';

export interface DraftOutput {
  subject: string;
  body: string;
  /** Indicates which code path produced the email. */
  source: DraftSource;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}
