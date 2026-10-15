"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { CommunityReport } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

type ReportAction = "remove_content" | "warn" | "block" | "dismiss";

/** Host report queue with remove/warn/block/dismiss (§11e). */
export function ReportsManager({
  communityId,
  initial,
}: {
  communityId: string;
  initial: CommunityReport[];
}) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CommunityReport | null>(null);

  const act = async (reportId: string, action: ReportAction) => {
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/reports/${reportId}/actions`, {
        method: "POST",
        body: { action },
      });
      notify("Action recorded.");
      setDetail(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const open = async (reportId: string) => {
    setError(null);
    try {
      const full = await bff<CommunityReport>(`communities/${communityId}/reports/${reportId}`);
      setDetail(full);
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    }
  };

  if (initial.length === 0) {
    return <p className="text-sm text-stone-500">No reports in this queue.</p>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {initial.map((report) => (
          <li key={report.id} className="rounded-xl border border-stone-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {report.type} · {report.reportCount} report{report.reportCount === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 truncate text-sm text-stone-600">
                  {report.preview?.text ?? report.reason}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {report.reporters.map((r) => r.name).join(", ")} · {formatDateTime(report.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={report.status} />
                <Button variant="secondary" size="sm" onClick={() => open(report.id)}>
                  Detail
                </Button>
              </div>
            </div>
            {detail?.id === report.id ? (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-sm">
                  <span className="font-semibold">Reason:</span> {detail.reason}
                </p>
                {detail.preview?.text ? (
                  <p className="mt-1 rounded-lg bg-stone-50 p-3 text-sm">{detail.preview.text}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["remove_content", "Remove content"],
                      ["warn", "Warn"],
                      ["block", "Block"],
                      ["dismiss", "Dismiss"],
                    ] as Array<[ReportAction, string]>
                  ).map(([action, label]) => (
                    <Button
                      key={action}
                      size="sm"
                      variant={action === "dismiss" ? "secondary" : "primary"}
                      disabled={busy}
                      onClick={() => act(report.id, action)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
    </div>
  );
}
