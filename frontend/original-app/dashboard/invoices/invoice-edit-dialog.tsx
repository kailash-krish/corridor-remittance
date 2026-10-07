"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import GlideSelect from "@/components/ui/glide-select";
import { listTracks, updateInvoice } from "@/lib/api";
import type { Invoice, InvoiceStatus, Track, UpdateInvoiceInput } from "@/lib/types";

interface InvoiceEditDialogProps {
  invoice: Invoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (invoice: Invoice) => void;
}

interface InvoiceForm {
  trackId: string;
  customerName: string;
  customerEmail: string;
  recipientName: string;
  recipientEmail: string;
  amountRupees: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  remarks: string;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
];

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30";

function formatPaiseAsRupees(amountPaise: number) {
  const paise = BigInt(amountPaise);
  return `${(paise / 100n).toLocaleString("en-IN")}.${(paise % 100n).toString().padStart(2, "0")}`;
}

function parseRupeesToPaise(raw: string): number {
  const clean = raw.replace(/[₹,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return NaN;

  const paise = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return paise <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(paise) : NaN;
}

function createForm(invoice: Invoice): InvoiceForm {
  return {
    trackId: invoice.track_id ?? "",
    customerName: invoice.customer_name || invoice.recipient_name || "",
    customerEmail: invoice.customer_email || invoice.recipient_email || "",
    recipientName: invoice.recipient_name || invoice.customer_name || "",
    recipientEmail: invoice.recipient_email || invoice.customer_email || "",
    amountRupees: formatPaiseAsRupees(invoice.amount_paise),
    status: invoice.status,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    remarks: invoice.remarks ?? "",
  };
}

export function InvoiceEditDialog({ invoice, open, onOpenChange, onSaved }: InvoiceEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <InvoiceEditForm
          key={`${invoice.id}-${invoice.updated_at}`}
          invoice={invoice}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function InvoiceEditForm({
  invoice,
  onOpenChange,
  onSaved,
}: {
  invoice: Invoice;
  onOpenChange: (open: boolean) => void;
  onSaved: (invoice: Invoice) => void;
}) {
  const [form, setForm] = useState(() => createForm(invoice));
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listTracks().then((result) => {
      if (!active) return;
      if (result.data) setTracks(result.data);
      setTracksLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  function setField<Key extends keyof InvoiceForm>(key: Key, value: InvoiceForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const amountPaise = parseRupeesToPaise(form.amountRupees);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    const changes: UpdateInvoiceInput = {
      ...(form.trackId ? { track_id: form.trackId } : {}),
      customer_name: form.customerName.trim(),
      recipient_name: form.recipientName.trim(),
      ...(form.customerEmail.trim() ? { customer_email: form.customerEmail.trim() } : {}),
      ...(form.recipientEmail.trim() ? { recipient_email: form.recipientEmail.trim() } : {}),
      amount_paise: amountPaise,
      status: form.status,
      issue_date: form.issueDate,
      due_date: form.dueDate,
      remarks: form.remarks.trim() || null,
    };

    setSaving(true);
    const result = await updateInvoice(invoice.id, changes);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSaved(result.data);
    onOpenChange(false);
  }

  const trackOptions = tracks
    .filter((track) => !track.archived || track.id === form.trackId)
    .map((track) => ({ value: track.id, label: `${track.name} (${track.symbol})` }));

  return (
    <DialogContent className="grid-rows-[auto_1fr_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl">
      <DialogHeader className="border-b border-white/10 px-6 py-5 pr-12">
        <DialogTitle className="gradient-text text-xl font-bold">Edit invoice</DialogTitle>
        <DialogDescription>
          Update the details for invoice <span className="font-medium text-foreground">{invoice.invoice_number}</span>.
        </DialogDescription>
      </DialogHeader>

      <form id="invoice-edit-form" onSubmit={handleSubmit} className="min-h-0 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EditField label="Customer name" id={`edit-customer-name-${invoice.id}`}>
            <input
              id={`edit-customer-name-${invoice.id}`}
              value={form.customerName}
              onChange={(event) => setField("customerName", event.target.value)}
              autoComplete="organization"
              required
              className={INPUT_CLASS}
            />
          </EditField>
          <EditField label="Customer email" id={`edit-customer-email-${invoice.id}`}>
            <input
              id={`edit-customer-email-${invoice.id}`}
              type="email"
              value={form.customerEmail}
              onChange={(event) => setField("customerEmail", event.target.value)}
              autoComplete="email"
              className={INPUT_CLASS}
            />
          </EditField>
          <EditField label="Recipient name" id={`edit-recipient-name-${invoice.id}`}>
            <input
              id={`edit-recipient-name-${invoice.id}`}
              value={form.recipientName}
              onChange={(event) => setField("recipientName", event.target.value)}
              required
              className={INPUT_CLASS}
            />
          </EditField>
          <EditField label="Recipient email" id={`edit-recipient-email-${invoice.id}`}>
            <input
              id={`edit-recipient-email-${invoice.id}`}
              type="email"
              value={form.recipientEmail}
              onChange={(event) => setField("recipientEmail", event.target.value)}
              className={INPUT_CLASS}
            />
          </EditField>
          <EditField label="Amount (₹)" id={`edit-amount-${invoice.id}`}>
            <input
              id={`edit-amount-${invoice.id}`}
              value={form.amountRupees}
              onChange={(event) => setField("amountRupees", event.target.value)}
              inputMode="decimal"
              required
              className={INPUT_CLASS}
            />
          </EditField>
          <EditField label="Status" id={`edit-status-${invoice.id}`}>
            <GlideSelect
              id={`edit-status-${invoice.id}`}
              ariaLabel="Invoice status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(status) => setField("status", status as InvoiceStatus)}
              size="lg"
              menuWidth={240}
              menuZIndex={102}
            />
          </EditField>
          <EditField label="Issue date" id={`edit-issue-date-${invoice.id}`}>
            <input
              id={`edit-issue-date-${invoice.id}`}
              type="date"
              value={form.issueDate}
              onChange={(event) => setField("issueDate", event.target.value)}
              className={INPUT_CLASS}
            />
          </EditField>
          <EditField label="Due date" id={`edit-due-date-${invoice.id}`}>
            <input
              id={`edit-due-date-${invoice.id}`}
              type="date"
              value={form.dueDate}
              onChange={(event) => setField("dueDate", event.target.value)}
              required
              className={INPUT_CLASS}
            />
          </EditField>
          {trackOptions.length > 0 && (
            <EditField label="Track" id={`edit-track-${invoice.id}`} className="sm:col-span-2">
              <GlideSelect
                id={`edit-track-${invoice.id}`}
                ariaLabel="Invoice track"
                options={trackOptions}
                value={form.trackId}
                onChange={(trackId) => setField("trackId", trackId)}
                placeholder={tracksLoading ? "Loading tracks…" : "Select track"}
                disabled={tracksLoading}
                size="lg"
                menuWidth={360}
                menuZIndex={102}
              />
            </EditField>
          )}
          <EditField label="Remarks" id={`edit-remarks-${invoice.id}`} className="sm:col-span-2">
            <textarea
              id={`edit-remarks-${invoice.id}`}
              value={form.remarks}
              onChange={(event) => setField("remarks", event.target.value)}
              rows={3}
              className={`${INPUT_CLASS} h-auto resize-y py-2.5`}
            />
          </EditField>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
      </form>

      <DialogFooter className="border-t border-white/10 px-6 py-4">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving}>Cancel</Button>
        </DialogClose>
        <Button type="submit" form="invoice-edit-form" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditField({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="block text-xs font-medium text-foreground/85">{label}</label>
      {children}
    </div>
  );
}