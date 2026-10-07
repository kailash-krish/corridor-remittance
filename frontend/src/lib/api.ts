/**
 * Standalone Client API with Mock In-Memory Store for UI Prototyping.
 * STRICTLY NO BACKEND OR DATABASE DEPENDENCIES.
 * Allows full interactive testing of tables, search, filters, modals, and draft generation.
 */

import type {
  Invoice,
  Track,
  EmailDraft,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreateTrackInput,
  DraftInput,
  DraftOutput,
  InvoiceStatus,
} from "@/lib/types";

type ApiOk<T> = { data: T; error: null };
type ApiErr = { data: null; error: { code: string; message: string; fields?: Record<string, string[]> } };
type ApiResult<T> = ApiOk<T> | ApiErr;

// ── In-Memory Sample Data ────────────────────────────────────────────────────

let MOCK_INVOICES: Invoice[] = [
  {
    id: "inv-001",
    user_id: "demo-user",
    track_id: "track-01",
    invoice_number: "INV-2024-001",
    customer_name: "Aarav Sharma",
    customer_email: "aarav@zerodha-traders.in",
    recipient_name: "Aarav Sharma",
    recipient_email: "aarav@zerodha-traders.in",
    amount_paise: 2500000, // ₹25,000.00
    status: "open",
    issue_date: "2024-03-01",
    due_date: "2024-03-15",
    remarks: "Bank Nifty Weekly Advisory Services",
    created_at: "2024-03-01T10:00:00Z",
    updated_at: "2024-03-01T10:00:00Z",
    deleted_at: null,
  },
  {
    id: "inv-002",
    user_id: "demo-user",
    track_id: "track-02",
    invoice_number: "INV-2024-002",
    customer_name: "Neha Patel",
    customer_email: "neha.patel@quantfin.com",
    recipient_name: "Neha Patel",
    recipient_email: "neha.patel@quantfin.com",
    amount_paise: 7500000, // ₹75,000.00
    status: "in_progress",
    issue_date: "2024-02-20",
    due_date: "2024-03-05",
    remarks: "Custom Algo Strategy Retainer",
    created_at: "2024-02-20T12:00:00Z",
    updated_at: "2024-02-28T09:30:00Z",
    deleted_at: null,
  },
  {
    id: "inv-003",
    user_id: "demo-user",
    track_id: "track-01",
    invoice_number: "INV-2024-003",
    customer_name: "Rohan Kapoor",
    customer_email: "rohan@capitalgrowth.in",
    recipient_name: "Rohan Kapoor",
    recipient_email: "rohan@capitalgrowth.in",
    amount_paise: 1500000, // ₹15,000.00
    status: "closed",
    issue_date: "2024-01-15",
    due_date: "2024-01-30",
    remarks: "Nifty 50 Positional Desk Consultation",
    created_at: "2024-01-15T08:00:00Z",
    updated_at: "2024-01-30T16:00:00Z",
    deleted_at: null,
  },
  {
    id: "inv-004",
    user_id: "demo-user",
    track_id: "track-03",
    invoice_number: "INV-2024-004",
    customer_name: "Vikram Malhotra",
    customer_email: "vikram@malhotra-invest.com",
    recipient_name: "Vikram Malhotra",
    recipient_email: "vikram@malhotra-invest.com",
    amount_paise: 4200000, // ₹42,000.00
    status: "open",
    issue_date: "2024-02-01",
    due_date: "2024-02-15", // Overdue
    remarks: "Commodities Crude & Gold Swing Signals",
    created_at: "2024-02-01T11:00:00Z",
    updated_at: "2024-02-01T11:00:00Z",
    deleted_at: null,
  },
];

let MOCK_TRACKS: Track[] = [
  {
    id: "track-01",
    user_id: "demo-user",
    name: "Nifty 50 Futures",
    symbol: "NIFTY",
    archived: false,
    created_at: "2024-01-01T00:00:00Z",
    event_type: "invoice_created",
    message: "Created invoice INV-2024-001 for Aarav Sharma",
  },
  {
    id: "track-02",
    user_id: "demo-user",
    name: "Bank Nifty Options",
    symbol: "BANKNIFTY",
    archived: false,
    created_at: "2024-01-05T00:00:00Z",
    event_type: "draft_generated",
    message: "Drafted email reminder for Neha Patel",
  },
  {
    id: "track-03",
    user_id: "demo-user",
    name: "MCX Crude Oil",
    symbol: "CRUDEOIL",
    archived: false,
    created_at: "2024-01-10T00:00:00Z",
    event_type: "reminder_sent",
    message: "Overdue alert flagged for Vikram Malhotra",
  },
];

const MOCK_DRAFTS: Record<string, EmailDraft[]> = {};

// ── Invoices ─────────────────────────────────────────────────────────────────

export async function listInvoices(params?: { status?: InvoiceStatus; q?: string }): Promise<ApiResult<Invoice[]>> {
  let filtered = MOCK_INVOICES.filter((i) => !i.deleted_at);

  if (params?.status && params.status !== ("all" as InvoiceStatus)) {
    filtered = filtered.filter((i) => i.status === params.status);
  }

  if (params?.q) {
    const query = params.q.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.invoice_number.toLowerCase().includes(query) ||
        i.customer_name.toLowerCase().includes(query) ||
        (i.remarks && i.remarks.toLowerCase().includes(query))
    );
  }

  return { data: filtered, error: null };
}

export async function createInvoice(data: CreateInvoiceInput): Promise<ApiResult<Invoice>> {
  const newInvoice: Invoice = {
    id: `inv-${Date.now()}`,
    user_id: "demo-user",
    track_id: data.track_id,
    invoice_number: data.invoice_number,
    customer_name: data.customer_name || data.recipient_name || "Client",
    customer_email: data.customer_email || data.recipient_email || "",
    recipient_name: data.recipient_name || data.customer_name,
    recipient_email: data.recipient_email || data.customer_email,
    amount_paise: data.amount_paise,
    status: data.status ?? "open",
    issue_date: data.issue_date ?? new Date().toISOString().slice(0, 10),
    due_date: data.due_date,
    remarks: data.remarks ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };

  MOCK_INVOICES.unshift(newInvoice);
  return { data: newInvoice, error: null };
}

export async function updateInvoice(id: string, data: UpdateInvoiceInput): Promise<ApiResult<Invoice>> {
  const invoice = MOCK_INVOICES.find((i) => i.id === id);
  if (!invoice) {
    return { data: null, error: { code: "not_found", message: "Invoice not found" } };
  }

  Object.assign(invoice, data, { updated_at: new Date().toISOString() });
  return { data: invoice, error: null };
}

export async function deleteInvoice(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  const invoice = MOCK_INVOICES.find((i) => i.id === id);
  if (invoice) {
    invoice.deleted_at = new Date().toISOString();
  }
  return { data: { deleted: true }, error: null };
}

// ── Tracks ───────────────────────────────────────────────────────────────────

export async function listTracks(params?: { invoiceId?: string; events?: boolean }): Promise<ApiResult<Track[]>> {
  return { data: MOCK_TRACKS, error: null };
}

export async function createTrack(data: CreateTrackInput): Promise<ApiResult<Track>> {
  const newTrack: Track = {
    id: `track-${Date.now()}`,
    user_id: "demo-user",
    name: data.name ?? "New Trading Segment",
    symbol: data.symbol ?? "CUSTOM",
    archived: false,
    created_at: new Date().toISOString(),
    event_type: "invoice_created",
    message: data.message ?? "New track created",
  };
  MOCK_TRACKS.push(newTrack);
  return { data: newTrack, error: null };
}

// ── Draft ─────────────────────────────────────────────────────────────────────

export async function generateDraft(data: DraftInput): Promise<ApiResult<DraftOutput>> {
  const rupees = (data.amount_paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });

  const subject = `Payment Reminder: Invoice ${data.invoice_number} (${rupees})`;
  const body = `Dear ${data.customer_name || "Valued Client"},

This is a gentle payment reminder regarding Invoice #${data.invoice_number} for ${rupees}${
    data.track ? ` under track "${data.track}"` : ""
  }.

Due Date: ${data.due_date || "Immediate"}
${data.remarks ? `Remarks: ${data.remarks}\n` : ""}
Please process this invoice at your earliest convenience. Thank you for your partnership!

Best regards,
Trader Billing Desk`;

  return {
    data: {
      subject,
      body,
      source: "ai",
    },
    error: null,
  };
}

// ── Email Drafts ──────────────────────────────────────────────────────────────

export async function listDrafts(invoiceId: string): Promise<ApiResult<EmailDraft[]>> {
  return { data: MOCK_DRAFTS[invoiceId] ?? [], error: null };
}
