"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { CommunityReport } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";

/** Platform moderation resolution: actioned/dismissed + note (§13). */
export function AdminReportRow({ report }: { report: CommunityReport }) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const [status, setStatus] = React.useState("actioned");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const resolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await bff(`admin/reports/${report.id}`, {
        method: "PATCH",
        body: {
          status,
          ...(note.trim() ? { actionNote: note.trim().slice(0, 2000) } : {}),
        },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-stone-200">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="font-semibold">
            {report.type} · {report.reportCount} report{report.reportCount === 1 ? "" : "s"}
          </span>
          <span className="mt-0.5 block truncate text-sm text-stone-600">
            {report.preview?.text ?? report.reason}
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            {formatDateTime(report.createdAt)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <StatusBadge status={report.status} />
          <span className="text-sm font-semibold text-brand-800">{expanded ? "Hide" : "Resolve"}</span>
        </span>
      </button>
      {expanded ? (
        <form onSubmit={resolve} className="flex flex-col gap-3 border-t border-stone-100 p-4">
          <p className="text-sm">
            <span className="font-semibold">Reason:</span> {report.reason}
          </p>
          {report.preview?.text ? (
            <p className="rounded-lg bg-stone-50 p-3 text-sm">{report.preview.text}</p>
          ) : null}
          <p className="text-sm text-stone-600">
            Reported by {report.reporters.map((r) => r.name).join(", ") || "—"}
          </p>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-[200px_1fr]">
            <Field label="Resolution" htmlFor={`status-${report.id}`}>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="actioned">Actioned</option>
                <option value="dismissed">Dismissed</option>
              </Select>
            </Field>
            <Field label="Action note" htmlFor={`note-${report.id}`}>
              <Textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {error ? <InlineError message={error} /> : null}
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save resolution"}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}
