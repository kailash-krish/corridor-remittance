"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Pencil,
  Loader2,
  CircleDot,
  Clock,
  CircleCheck,
  Copy,
  Check,
} from "lucide-react";
import { generateDraft } from "@/lib/api";
import type { Invoice, EmailDraft, InvoiceStatus } from "@/lib/types";
import { formatIndianCurrency, formatDate, isOverdue, cn } from "@/lib/utils";
import { InvoiceEditDialog } from "../invoice-edit-dialog";

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  open: "status-open",
  in_progress: "status-progress",
  closed: "status-closed",
};

const STATUS_ICONS: Record<InvoiceStatus, React.ElementType> = {
  open: CircleDot,
  in_progress: Clock,
  closed: CircleCheck,
};

interface Props {
  id: string;
  invoice: Invoice;
  trackName: string | null;
  drafts: EmailDraft[];
}

export function InvoiceDetailClient({ id, invoice, trackName, drafts }: Props) {
  const router = useRouter();
  const [drafting, setDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<{ subject: string; body: string; source: string } | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  async function handleGenerateDraft() {
    setDrafting(true);
    setDraftError(null);
    setDraftResult(null);

    const res = await generateDraft({
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name || invoice.recipient_name || "Client",
      amount_paise: invoice.amount_paise,
      status: invoice.status,
      due_date: invoice.due_date,
      issue_date: invoice.issue_date,
      remarks: invoice.remarks,
      recipient_name: invoice.recipient_name,
    });

    if (res.error) setDraftError(res.error.message);
    else setDraftResult(res.data);
    setDrafting(false);
  }

  async function copyToClipboard() {
    if (!draftResult) return;
    await navigator.clipboard.writeText(`Subject: ${draftResult.subject}\n\n${draftResult.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const overdue = invoice.status !== "closed" && isOverdue(invoice.due_date);
  const StatusIcon = STATUS_ICONS[invoice.status];

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>

      <InvoiceEditDialog
        invoice={invoice}
        open={editing}
        onOpenChange={setEditing}
        onSaved={() => router.refresh()}
      />

      {/* Invoice card */}
      <div className="space-y-5 rounded-2xl border border-white/10 bg-card p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="gradient-text text-xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {invoice.customer_name || invoice.recipient_name || "No customer name"}
            </p>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize", STATUS_COLORS[invoice.status])}>
            <StatusIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {invoice.status.replace("_", " ")}
          </span>
        </div>

        <div className="text-3xl font-extrabold tracking-tight text-foreground">
          {formatIndianCurrency(invoice.amount_paise)}
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
          <InfoRow label="Issue date" value={formatDate(invoice.issue_date)} />
          {trackName && <InfoRow label="Track" value={trackName} />}
          <InfoRow
            label="Due date"
            value={formatDate(invoice.due_date)}
            className={overdue ? "text-rose-400" : undefined}
            suffix={overdue ? <span className="text-[10px] text-rose-400">Overdue</span> : null}
          />
          {invoice.recipient_name && <InfoRow label="Recipient" value={invoice.recipient_name} />}
          {invoice.recipient_email && <InfoRow label="Recipient email" value={invoice.recipient_email} />}
          {invoice.customer_email && <InfoRow label="Customer email" value={invoice.customer_email} />}
        </div>

        {invoice.remarks && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Remarks</p>
            <p className="text-sm text-foreground">{invoice.remarks}</p>
          </div>
        )}
      </div>

      {/* Draft email */}
      <div className="space-y-4 rounded-2xl border border-white/10 bg-card p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Draft email</h2>
          {draftResult && (
            <span className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
              draftResult.source === "ai"
                ? "bg-violet-500/10 text-violet-400"
                : "border-white/10 bg-white/5 text-slate-300"
            )}>
              {draftResult.source === "ai" ? "AI generated" : "Template"}
            </span>
          )}
        </div>

        {!draftResult ? (
          <div className="text-center py-6">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground/30" strokeWidth={1} />
            <p className="mt-3 text-sm text-muted-foreground">
              Generate a polished payment reminder email in one click.
            </p>
            {draftError && (
              <p className="mt-2 text-xs text-rose-400">{draftError}</p>
            )}
            <button
              id="generate-draft-btn"
              onClick={handleGenerateDraft}
              disabled={drafting}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-300 disabled:opacity-60"
            >
              {drafting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><Mail className="h-4 w-4" /> Generate draft</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
              <p className="text-sm text-foreground">{draftResult.subject}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Body</p>
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
                {draftResult.body}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleGenerateDraft}
                disabled={drafting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-60"
              >
                {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Past drafts */}
      {drafts.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-card p-6 shadow-lg shadow-black/10 backdrop-blur-xl">
          <h2 className="text-base font-semibold text-foreground">Past drafts</h2>
          <div className="divide-y divide-border/50">
            {drafts.map((d) => (
              <div key={d.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{d.subject}</p>
                  {d.sent_at && (
                    <span className="shrink-0 text-[10px] text-emerald-400">Sent</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(d.created_at)} · {d.recipient_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  className,
  suffix,
}: {
  label: string;
  value: string;
  className?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className={cn("text-sm text-foreground", className)}>{value}</p>
        {suffix}
      </div>
    </div>
  );
}
