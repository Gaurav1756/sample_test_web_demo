"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { DataSummary, ExportJob } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";

/** Data summary + async exports (§11h). */
export function DataPane({
  communityId,
  summary,
  jobs,
}: {
  communityId: string;
  summary: DataSummary;
  jobs: ExportJob[];
}) {
  const router = useRouter();
  const [type, setType] = React.useState("full");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const request = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/exports`, { method: "POST", body: { type } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg border border-stone-200 p-3">
          <dt className="text-stone-500">Members</dt>
          <dd className="font-bold">{summary.members}</dd>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <dt className="text-stone-500">Posts</dt>
          <dd className="font-bold">{summary.posts}</dd>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <dt className="text-stone-500">Events</dt>
          <dd className="font-bold">{summary.events}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-stone-500">
        Updated {formatDateTime(summary.lastUpdatedAt)}
      </p>

      <form onSubmit={request} className="mt-5 flex max-w-md gap-2">
        <div className="flex-1">
          <Field label="New export" htmlFor="export-type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="full">Full</option>
              <option value="members">Members</option>
              <option value="content">Content</option>
              <option value="events">Events</option>
            </Select>
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Queuing…" : "Request"}
          </Button>
        </div>
      </form>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}

      <h3 className="mt-6 font-display text-lg">Exports</h3>
      {jobs.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {jobs.map((job, i) => (
            <li
              key={job.exportId ?? job.id ?? i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm"
            >
              <span className="font-medium">{job.type ?? "Export"}</span>
              <span className="flex items-center gap-3">
                <StatusBadge status={job.status} />
                {job.downloadUrl ? (
                  <a
                    href={job.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-800 hover:underline"
                  >
                    Download
                  </a>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-stone-500">No exports yet.</p>
      )}
    </div>
  );
}
