"use client";

import { useEffect, useState } from "react";
import { listTracks } from "@/lib/api";
import type { Track } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";
import {
  FileText,
  Pencil,
  Trash2,
  Mail,
  Bell,
  StickyNote,
  Send,
  TrendingUp,
  Loader2,
} from "lucide-react";

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  invoice_created:  { icon: FileText,   color: "text-blue-400 bg-blue-500/10",    label: "Created" },
  invoice_updated:  { icon: Pencil,     color: "text-amber-400 bg-amber-500/10",  label: "Updated" },
  invoice_deleted:  { icon: Trash2,     color: "text-rose-400 bg-rose-500/10",    label: "Deleted" },
  draft_generated:  { icon: Mail,       color: "text-violet-400 bg-violet-500/10", label: "Draft" },
  mail_sent:        { icon: Send,       color: "text-emerald-400 bg-emerald-500/10", label: "Sent" },
  reminder_sent:    { icon: Bell,       color: "text-orange-400 bg-orange-500/10", label: "Reminder" },
  note_added:       { icon: StickyNote, color: "text-sky-400 bg-sky-500/10",      label: "Note" },
};

export function TracksClient() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTracks({ events: true }).then((r) => {
      if (r.error) setError(r.error.message);
      else setTracks([...(r.data ?? [])].reverse()); // newest first
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10">
          <TrendingUp className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="gradient-text text-2xl font-bold tracking-tight">Activity log</h1>
          <p className="text-sm text-muted-foreground">All invoice events, drafts and actions</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <TrendingUp className="h-10 w-10 text-muted-foreground/30" strokeWidth={1} />
          <p className="mt-4 text-sm font-medium text-foreground">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Events will appear here as you work with invoices.</p>
        </div>
      ) : (
        <div className="relative pl-6">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border/50" />

          <div className="space-y-4">
            {tracks.map((track) => {
              const cfg = EVENT_CONFIG[track.event_type ?? ''] ?? EVENT_CONFIG.note_added;
              const Icon = cfg.icon;
              return (
                <div key={track.id} className="relative flex gap-4">
                  {/* Dot */}
                  <div className={cn("absolute -left-[22px] top-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", cfg.color.split(" ")[1])}>
                    <Icon className={cn("h-2.5 w-2.5", cfg.color.split(" ")[0])} strokeWidth={2} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-card p-4 shadow-lg shadow-black/10 backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        <p className="truncate text-sm text-foreground">{track.message}</p>
                      </div>
                      <p className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(track.created_at)}
                      </p>
                    </div>
                    {track.metadata && Object.keys(track.metadata).length > 0 && (
                      <pre className="mt-2 overflow-x-auto rounded-xl border border-white/5 bg-white/[0.03] p-2 text-[11px] text-muted-foreground">
                        {JSON.stringify(track.metadata, null, 2)}
                      </pre>
                    )}
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
