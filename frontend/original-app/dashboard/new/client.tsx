"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MultiStepForm } from "@/UI/multi-step-form";
import GlideSelect from "@/components/ui/glide-select";
import { createInvoice, listTracks, createTrack } from "@/lib/api";
import type { InvoiceStatus, Track } from "@/lib/types";
import { formatIndianCurrency } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a rupee string like "1,25,000.50" or "125000" into integer paise.
 * Returns NaN if the string is invalid.
 */
function parseRupeesToPaise(raw: string): number {
  const clean = raw.replace(/[₹,\s]/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return NaN;

  const paise = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return paise <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(paise) : NaN;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface FormState {
  // Step 1 — Track & Invoice basics
  track_id: string;
  invoice_number: string;
  amount_rupees: string; // user types in rupees, stored as string
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  remarks: string;
  // Step 2 — Recipient
  customer_name: string;
  customer_email: string;
  recipient_name: string;
  recipient_email: string;
}

const INITIAL: FormState = {
  track_id: "",
  invoice_number: "",
  amount_rupees: "",
  status: "open",
  issue_date: today(),
  due_date: inDays(30),
  remarks: "",
  customer_name: "",
  customer_email: "",
  recipient_name: "",
  recipient_email: "",
};

const STATUS_OPTIONS: { label: string; value: InvoiceStatus }[] = [
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Closed", value: "closed" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function NewEntryClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick add track state
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackSymbol, setNewTrackSymbol] = useState("");
  const [creatingTrack, setCreatingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Load tracks on mount
  useEffect(() => {
    listTracks().then((res) => {
      setTracksLoading(false);
      if (res.error) {
        setTrackError(res.error.message);
      } else if (res.data) {
        const activeTracks = res.data.filter((t) => !t.archived);
        setTracks(activeTracks);
        if (activeTracks.length > 0) {
          setForm((current) => current.track_id
            ? current
            : { ...current, track_id: activeTracks[0].id });
        }
      }
    });
  }, []);

  async function handleQuickAddTrack() {
    if (!newTrackName.trim() || !newTrackSymbol.trim()) return;
    setCreatingTrack(true);
    setTrackError(null);
    const res = await createTrack({
      name: newTrackName.trim(),
      symbol: newTrackSymbol.trim().toUpperCase(),
    });
    setCreatingTrack(false);
    if (res.error) {
      setTrackError(res.error.message);
    } else if (res.data) {
      const created = res.data;
      setTracks((prev) => [...prev, created]);
      set("track_id", created.id);
      setNewTrackName("");
      setNewTrackSymbol("");
      setIsAddingTrack(false);
    }
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────
  const activeTracks = tracks.filter((t) => !t.archived);
  const amountPaise = parseRupeesToPaise(form.amount_rupees);
  const step1Valid =
    activeTracks.length > 0 &&
    form.track_id.trim().length > 0 &&
    form.invoice_number.trim().length > 0 &&
    !isNaN(amountPaise) &&
    amountPaise > 0 &&
    form.due_date.length === 10;

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setError(null);
    const paise = parseRupeesToPaise(form.amount_rupees);
    const res = await createInvoice({
      track_id: form.track_id,
      invoice_number: form.invoice_number.trim(),
      amount_paise: paise,
      status: form.status,
      issue_date: form.issue_date,
      due_date: form.due_date,
      remarks: form.remarks.trim() || null,
      customer_name: form.customer_name.trim() || undefined,
      customer_email: form.customer_email.trim() || undefined,
      recipient_name: form.recipient_name.trim() || undefined,
      recipient_email: form.recipient_email.trim() || undefined,
    });

    if (res.error) {
      setError(res.error.message);
      setSaving(false);
    } else {
      router.push(`/dashboard/invoices/${res.data.id}`);
    }
  }

  // ── Review step content ────────────────────────────────────────────────────
  const paise = parseRupeesToPaise(form.amount_rupees);
  const rupeeDisplay = isNaN(paise) ? "—" : formatIndianCurrency(paise);
  const selectedTrack = tracks.find((t) => t.id === form.track_id);

  return (
    <div className="flex items-start justify-center px-4 py-6 animate-fade-in">
      <MultiStepForm
        currentStep={step}
        totalSteps={3}
        stepLabels={["Invoice details", "Recipient", "Review"]}
        title="New invoice"
        description="Fill in the details to create a new invoice entry."
        onBack={() => setStep((s) => Math.max(1, s - 1))}
        onNext={() => setStep((s) => Math.min(3, s + 1))}
        onClose={() => router.push("/dashboard/invoices")}
        nextDisabled={step === 1 ? !step1Valid : false}
        nextLoading={step === 3 && saving}
        nextButtonText={step === 3 ? "Create invoice" : "Next step"}
        footerActions={
          step === 3 ? (
            <button
              id="new-invoice-submit"
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-300 disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create invoice"}
            </button>
          ) : undefined
        }
      >
        {step === 1 && (
          <Step1
            form={form}
            set={set}
            tracks={activeTracks}
            tracksLoading={tracksLoading}
            isAddingTrack={isAddingTrack}
            setIsAddingTrack={setIsAddingTrack}
            newTrackName={newTrackName}
            setNewTrackName={setNewTrackName}
            newTrackSymbol={newTrackSymbol}
            setNewTrackSymbol={setNewTrackSymbol}
            creatingTrack={creatingTrack}
            trackError={trackError}
            handleQuickAddTrack={handleQuickAddTrack}
          />
        )}
        {step === 2 && <Step2 form={form} set={set} />}
        {step === 3 && (
          <Step3
            form={form}
            selectedTrack={selectedTrack}
            rupeeDisplay={rupeeDisplay}
            error={error}
          />
        )}
      </MultiStepForm>
    </div>
  );
}

// ── Step 1: Invoice details ────────────────────────────────────────────────────

interface Step1Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  tracks: Track[];
  tracksLoading: boolean;
  isAddingTrack: boolean;
  setIsAddingTrack: (v: boolean) => void;
  newTrackName: string;
  setNewTrackName: (v: string) => void;
  newTrackSymbol: string;
  setNewTrackSymbol: (v: string) => void;
  creatingTrack: boolean;
  trackError: string | null;
  handleQuickAddTrack: () => void;
}

function Step1({
  form,
  set,
  tracks,
  tracksLoading,
  isAddingTrack,
  setIsAddingTrack,
  newTrackName,
  setNewTrackName,
  newTrackSymbol,
  setNewTrackSymbol,
  creatingTrack,
  trackError,
  handleQuickAddTrack,
}: Step1Props) {
  return (
    <div className="space-y-5">
      {/* ── Required Track field as FIRST field ── */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="track_id" className="block text-xs font-medium text-foreground/80">
            Track *
          </label>
          {!isAddingTrack && (
            <button
              type="button"
              onClick={() => setIsAddingTrack(true)}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add track
            </button>
          )}
        </div>

        {isAddingTrack ? (
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 backdrop-blur-xl">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                id="new_track_name"
                placeholder="Name (e.g. Nifty 50)"
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                className={inputCls}
                autoFocus
              />
              <input
                id="new_track_symbol"
                placeholder="Symbol (e.g. NIFTY)"
                value={newTrackSymbol}
                onChange={(e) => setNewTrackSymbol(e.target.value)}
                className={inputCls}
              />
            </div>
            {trackError && <p className="text-xs text-red-400">{trackError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingTrack(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQuickAddTrack}
                disabled={creatingTrack || !newTrackName.trim() || !newTrackSymbol.trim()}
                className="rounded-xl bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-md shadow-cyan-500/20 disabled:opacity-50"
              >
                {creatingTrack ? "Saving…" : "Save track"}
              </button>
            </div>
          </div>
        ) : tracksLoading ? (
          <div className="text-xs text-muted-foreground">Loading tracks…</div>
        ) : tracks.length === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <span>Add a track first </span>
            <Link href="/dashboard/tracks" className="font-semibold underline hover:text-amber-200">
              at /dashboard/tracks
            </Link>
          </div>
        ) : (
          <GlideSelect
            id="track_id"
            ariaLabel="Track"
            options={tracks.map((track) => ({
              value: track.id,
              label: `${track.name} (${track.symbol})`,
            }))}
            value={form.track_id}
            onChange={(trackId) => set("track_id", trackId)}
            placeholder="Select track"
            className="w-full"
            surfaceColor="#101a35"
            highlightColor="rgba(0, 207, 255, 0.28)"
            accentColor="#67e8f9"
          />
        )}
        {!isAddingTrack && trackError && (
          <p role="alert" className="text-xs text-red-300">{trackError}</p>
        )}

        {!form.track_id && tracks.length > 0 && !isAddingTrack && (
          <p className="text-xs text-red-400">Track is required</p>
        )}
      </div>

      <Field label="Invoice number *" id="invoice_number">
        <input
          id="invoice_number"
          value={form.invoice_number}
          onChange={(e) => set("invoice_number", e.target.value)}
          placeholder="INV-001"
          className={inputCls}
        />
      </Field>

      <Field label="Amount (₹) *" id="amount_rupees" hint="Enter in rupees e.g. 1,25,000.50">
        <input
          id="amount_rupees"
          value={form.amount_rupees}
          onChange={(e) => set("amount_rupees", e.target.value)}
          placeholder="1,25,000"
          className={inputCls}
          inputMode="decimal"
        />
      </Field>

      <Field label="Status" id="status">
        <GlideSelect
          id="status"
          ariaLabel="Status"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(status) => set("status", status as InvoiceStatus)}
          className="w-full"
          surfaceColor="#101a35"
          highlightColor="rgba(0, 207, 255, 0.28)"
          accentColor="#67e8f9"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Issue date" id="issue_date">
          <input
            id="issue_date"
            type="date"
            value={form.issue_date}
            onChange={(e) => set("issue_date", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Due date *" id="due_date">
          <input
            id="due_date"
            type="date"
            value={form.due_date}
            onChange={(e) => set("due_date", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Remarks" id="remarks">
        <textarea
          id="remarks"
          value={form.remarks}
          onChange={(e) => set("remarks", e.target.value)}
          placeholder="Any notes about this invoice…"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </Field>
    </div>
  );
}

// ── Step 2: Recipient ──────────────────────────────────────────────────────────

function Step2({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        These details are used when generating the email draft. All fields are optional.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Customer / company name" id="customer_name">
          <input id="customer_name" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Sharma & Co." className={inputCls} />
        </Field>
        <Field label="Customer email" id="customer_email">
          <input id="customer_email" type="email" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} placeholder="billing@co.in" className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Recipient name" id="recipient_name">
          <input id="recipient_name" value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} placeholder="Mr. Sharma" className={inputCls} />
        </Field>
        <Field label="Recipient email" id="recipient_email">
          <input id="recipient_email" type="email" value={form.recipient_email} onChange={(e) => set("recipient_email", e.target.value)} placeholder="mr.sharma@co.in" className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

// ── Step 3: Review ─────────────────────────────────────────────────────────────

function Step3({
  form,
  selectedTrack,
  rupeeDisplay,
  error,
}: {
  form: FormState;
  selectedTrack?: Track;
  rupeeDisplay: string;
  error: string | null;
}) {
  const trackLabel = selectedTrack
    ? `${selectedTrack.name} (${selectedTrack.symbol})`
    : form.track_id || "—";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review your details before saving.</p>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <ReviewRow label="Track" value={trackLabel} highlight />
        <ReviewRow label="Invoice number" value={form.invoice_number || "—"} />
        <ReviewRow label="Amount" value={rupeeDisplay} highlight />
        <ReviewRow label="Status" value={form.status.replace("_", " ")} />
        <ReviewRow label="Issue date" value={form.issue_date} />
        <ReviewRow label="Due date" value={form.due_date} />
        {form.customer_name && <ReviewRow label="Customer" value={form.customer_name} />}
        {form.recipient_name && <ReviewRow label="Recipient" value={form.recipient_name} />}
        {form.remarks && <ReviewRow label="Remarks" value={form.remarks} />}
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/30";

function Field({
  label, id, hint, children,
}: {
  label: string; id: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-foreground/80">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={highlight ? "font-bold text-foreground" : "text-foreground text-right"}>{value}</span>
    </div>
  );
}
