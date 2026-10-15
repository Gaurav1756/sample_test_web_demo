"use client";

import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { NotificationItem } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type DayGroup = "Today" | "Yesterday" | "Earlier";

/** Bucket a timestamp into Today / Yesterday / Earlier (Figma p128). */
function dayGroup(createdAt: string, now: Date): DayGroup {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const startOf = (x: Date) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

/** Notification inbox with read / mark-all-read (§12). */
export function InboxList({ initial }: { initial: NotificationItem[] }) {
  const router = useRouter();
  const { notify } = useToast();

  const markRead = async (id: string) => {
    try {
      await bff(`users/me/notifications/${id}/read`, { method: "PATCH" });
      router.refresh();
    } catch (e) {
      notify(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    }
  };

  const markAll = async () => {
    try {
      await bff("users/me/notifications/read-all", { method: "POST" });
      router.refresh();
    } catch (e) {
      notify(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    }
  };

  const unread = initial.filter((n) => !n.readAt).length;
  const now = new Date();
  const groups: { label: DayGroup; items: NotificationItem[] }[] = (
    ["Today", "Yesterday", "Earlier"] as const
  )
    .map((label) => ({ label, items: initial.filter((n) => dayGroup(n.createdAt, now) === label) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
        {unread > 0 ? (
          <Button variant="secondary" size="sm" onClick={markAll}>
            Mark all read
          </Button>
        ) : null}
      </div>
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="mt-6">
          <h2 className="font-display text-lg">{g.label}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {g.items.map((n) => (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${n.readAt ? "border-stone-200" : "border-brand-300 bg-brand-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{n.title}</p>
                    <p className="mt-0.5 text-sm text-stone-600">{n.body}</p>
                    <p className="mt-1 text-xs text-stone-500">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.readAt ? (
                    <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
