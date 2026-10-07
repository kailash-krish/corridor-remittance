"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CirclePlus,
  FileText,
  TrendingUp,
  Clock,
  CircleCheck,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { listInvoices } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { formatIndianCurrency, formatDate, isOverdue } from "@/lib/utils";

type StatCard = {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href: string;
  color: string;
  bg: string;
};

export function DashboardHomeClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listInvoices().then((r) => {
      if (r.error) setError(r.error.message);
      else setInvoices(r.data ?? []);
      setLoading(false);
    });
  }, []);

  const open = invoices.filter((i) => i.status === "open" && !i.deleted_at);
  const inProgress = invoices.filter((i) => i.status === "in_progress" && !i.deleted_at);
  const closed = invoices.filter((i) => i.status === "closed" && !i.deleted_at);
  const overdue = open.filter((i) => isOverdue(i.due_date));
  const totalPending = open.reduce((s, i) => s + i.amount_paise, 0) +
    inProgress.reduce((s, i) => s + i.amount_paise, 0);

  const stats: StatCard[] = [
    { label: "Open", value: open.length, icon: FileText, href: "/dashboard/invoices?status=open", color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "In progress", value: inProgress.length, icon: Clock, href: "/dashboard/invoices?status=in_progress", color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Closed", value: closed.length, icon: CircleCheck, href: "/dashboard/invoices?status=closed", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Overdue", value: overdue.length, icon: AlertCircle, href: "/dashboard/invoices?status=open", color: "text-rose-400", bg: "bg-rose-500/10" },
  ];

  const recent = [...invoices]
    .filter((i) => !i.deleted_at)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gradient-text text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your invoice overview at a glance
          </p>
        </div>
        <Link
          href="/dashboard/new"
          id="dashboard-new-invoice"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-300"
        >
          <CirclePlus className="h-4 w-4" strokeWidth={1.75} />
          New invoice
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Pending total */}
      <div className="rounded-2xl border border-cyan-100/10 bg-gradient-to-br from-cyan-400/15 via-blue-500/10 to-white/[0.03] p-6 shadow-xl shadow-cyan-950/20 backdrop-blur-xl">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Total pending
        </p>
        <p className="mt-2 text-4xl font-extrabold tracking-tight text-white">
          {formatIndianCurrency(totalPending)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Across {open.length + inProgress.length} active invoices
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-4 backdrop-blur-xl transition-all hover:border-white/15 hover:bg-white/[0.05] hover:shadow-lg hover:shadow-blue-950/20"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
              <s.icon className={`h-5 w-5 ${s.color}`} strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {/* Recent invoices */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent invoices</h2>
          <Link href="/dashboard/invoices" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-card backdrop-blur-xl">
            {recent.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>
        )}
      </div>

      {/* Tracks shortcut */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-4 backdrop-blur-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
          <TrendingUp className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Activity log</p>
          <p className="text-xs text-muted-foreground">View all invoice events and drafts</p>
        </div>
        <Link
          href="/dashboard/tracks"
          className="text-xs font-medium text-primary hover:underline"
        >
          View →
        </Link>
      </div>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const overdue = invoice.status !== "closed" && isOverdue(invoice.due_date);
  const statusColors: Record<string, string> = {
    open: "status-open",
    in_progress: "status-progress",
    closed: "status-closed",
  };

  return (
    <Link
      href={`/dashboard/invoices/${invoice.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-white/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {invoice.invoice_number}
          </span>
          {overdue && (
            <span className="status-overdue shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
              Overdue
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {invoice.customer_name || invoice.recipient_name || "—"} · Due {formatDate(invoice.due_date)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-semibold text-foreground">
          {formatIndianCurrency(invoice.amount_paise)}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors[invoice.status]}`}>
          {invoice.status.replace("_", " ")}
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
      <p className="mt-4 text-sm font-medium text-foreground">No invoices yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Create your first invoice to get started.</p>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="h-32 rounded-2xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  );
}
