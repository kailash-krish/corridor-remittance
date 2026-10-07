"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CirclePlus,
  FileText,
  CircleDot,
  Clock,
  CircleCheck,
  MoreHorizontal,
  Trash2,
  Pencil,
  Mail,
  Search,
} from "lucide-react";
import { listInvoices, deleteInvoice, updateInvoice } from "@/lib/api";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { formatIndianCurrency, formatDate, isOverdue, cn } from "@/lib/utils";
import { DropdownMenu } from "@/UI/dropdown-menu";
import { InvoiceEditDialog } from "./invoice-edit-dialog";

const STATUS_TABS: { label: string; value: InvoiceStatus | "all"; icon: React.ElementType }[] = [
  { label: "All", value: "all", icon: FileText },
  { label: "Open", value: "open", icon: CircleDot },
  { label: "In progress", value: "in_progress", icon: Clock },
  { label: "Closed", value: "closed", icon: CircleCheck },
];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  open: "status-open",
  in_progress: "status-progress",
  closed: "status-closed",
};

export function InvoicesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusParam = searchParams.get("status") as InvoiceStatus | null;
  const qParam = searchParams.get("q") ?? "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(qParam);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listInvoices(statusParam ? { status: statusParam } : undefined);
    if (r.error) setError(r.error.message);
    else setInvoices((r.data ?? []).filter((i) => !i.deleted_at));
    setLoading(false);
  }, [statusParam]);

  useEffect(() => {
    const id = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(id);
  }, [load]);

  const filtered = search.trim()
    ? invoices.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
          (i.customer_name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  async function handleDelete(id: string) {
    if (!confirm("Soft-delete this invoice?")) return;
    setDeleting(id);
    await deleteInvoice(id);
    setDeleting(null);
    load();
  }

  async function handleStatusChange(id: string, status: InvoiceStatus) {
    await updateInvoice(id, { status });
    load();
  }

  const activeTab = statusParam ?? "all";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="gradient-text text-2xl font-bold tracking-tight">Invoices</h1>
        <Link
          href="/dashboard/new"
          id="invoices-new-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-300"
        >
          <CirclePlus className="h-4 w-4" strokeWidth={1.75} />
          New invoice
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              id={`tab-${tab.value}`}
              onClick={() => {
                const u = new URL(window.location.href);
                if (tab.value === "all") u.searchParams.delete("status");
                else u.searchParams.set("status", tab.value);
                router.push(u.pathname + u.search);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.value
                  ? "bg-cyan-300/10 text-cyan-100 shadow-sm ring-1 ring-cyan-200/20"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            id="invoices-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice no. or name…"
            className="h-9 w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-cyan-400/40"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-card backdrop-blur-xl">
          {/* Desktop header */}
          <div className="hidden rounded-t-2xl xl:grid grid-cols-[1fr_1fr_120px_120px_100px_56px] gap-4 border-b border-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Invoice</span>
            <span>Customer</span>
            <span>Amount</span>
            <span>Due date</span>
            <span>Status</span>
            <span />
          </div>

          <div className="divide-y divide-white/5">
            {filtered.map((inv) => {
              const overdue = inv.status !== "closed" && isOverdue(inv.due_date);
              return (
                <div
                  key={inv.id}
                  className="group first:rounded-t-2xl last:rounded-b-2xl grid grid-cols-1 gap-1 px-4 py-3 transition-colors hover:bg-white/[0.04] xl:grid-cols-[1fr_1fr_120px_120px_100px_56px] xl:items-center xl:gap-4"
                >
                  {/* Invoice number */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {inv.invoice_number}
                    </Link>
                    {overdue && (
                      <span className="status-overdue shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Customer */}
                  <p className="truncate text-sm text-muted-foreground">
                    {inv.customer_name || inv.recipient_name || "—"}
                  </p>

                  {/* Amount */}
                  <p className="text-sm font-semibold text-foreground">
                    {formatIndianCurrency(inv.amount_paise)}
                  </p>

                  {/* Due date */}
                  <p className={cn("text-sm", overdue ? "text-rose-400" : "text-muted-foreground")}>
                    {formatDate(inv.due_date)}
                  </p>

                  {/* Status badge */}
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                      STATUS_COLORS[inv.status]
                    )}
                  >
                    {inv.status.replace("_", " ")}
                  </span>

                  {/* Actions */}
                  <div className="flex justify-end">
                    <InvoiceRowActions
                      invoice={inv}
                      deleting={deleting === inv.id}
                      onView={() => router.push(`/dashboard/invoices/${inv.id}`)}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onSaved={() => void load()}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceRowActions({
  invoice,
  deleting,
  onView,
  onStatusChange,
  onDelete,
  onSaved,
}: {
  invoice: Invoice;
  deleting: boolean;
  onView: () => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  onDelete: (id: string) => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <DropdownMenu
        align="right"
        variant="ghost"
        size="icon"
        options={[
          {
            label: "View / Draft email",
            Icon: <Mail className="h-4 w-4" />,
            onClick: onView,
          },
          {
            label: "Edit",
            Icon: <Pencil className="h-4 w-4" />,
            onClick: () => setEditing(true),
          },
          ...(invoice.status !== "closed"
            ? [
                {
                  label: "Mark closed",
                  Icon: <CircleCheck className="h-4 w-4" />,
                  onClick: () => onStatusChange(invoice.id, "closed"),
                },
              ]
            : []),
          {
            label: deleting ? "Deleting…" : "Delete",
            Icon: <Trash2 className="h-4 w-4" />,
            danger: true,
            disabled: deleting,
            onClick: () => onDelete(invoice.id),
          },
        ]}
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenu>
      <InvoiceEditDialog
        invoice={invoice}
        open={editing}
        onOpenChange={setEditing}
        onSaved={onSaved}
      />
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
      <p className="mt-4 text-sm font-medium text-foreground">No invoices found</p>
      <p className="mt-1 text-xs text-muted-foreground">Try a different filter or create a new invoice.</p>
      <Link
        href="/dashboard/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-300"
      >
        <CirclePlus className="h-3.5 w-3.5" />
        New invoice
      </Link>
    </div>
  );
}
