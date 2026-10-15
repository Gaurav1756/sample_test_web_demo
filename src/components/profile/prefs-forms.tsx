"use client";

import { useActionState } from "react";
import { updateLocale, updateNotificationPrefs } from "@/lib/account-actions";
import type { NotificationPreferences } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

const INITIAL = { ok: false as const };

const TOGGLES: Array<{ key: keyof NotificationPreferences; label: string }> = [
  { key: "push", label: "Push notifications" },
  { key: "email", label: "Email notifications" },
  { key: "upcomingReminders", label: "Reminders for upcoming events" },
  { key: "eventUpdates", label: "Event updates (time, venue)" },
  { key: "ticketUpdates", label: "Ticket updates" },
  { key: "savedActivity", label: "Activity on saved events" },
  { key: "communityActivity", label: "Community activity" },
  { key: "communityEvents", label: "Community event updates" },
  { key: "mentionsReplies", label: "Mentions and replies" },
  { key: "recommendedEvents", label: "Recommended events" },
  { key: "nearbyEvents", label: "Nearby events" },
];

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPreferences }) {
  const [state, action, pending] = useActionState(updateNotificationPrefs, INITIAL);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      {TOGGLES.map((t) => (
        <label key={t.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={t.key}
            defaultChecked={Boolean(prefs[t.key])}
            className="h-4 w-4 accent-brand-700"
          />
          {t.label}
        </label>
      ))}
      {state.message ? (
        state.ok ? (
          <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
            {state.message}
          </p>
        ) : (
          <InlineError message={state.message} recovery={state.recovery} />
        )
      ) : null}
      <Button type="submit" disabled={pending} className="mt-2 self-start">
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}

export function LanguageForm({ languages, current }: { languages: string[]; current: string }) {
  const [state, action, pending] = useActionState(updateLocale, INITIAL);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Language</span>
        <Select name="locale" defaultValue={current}>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </label>
      {state.message ? (
        state.ok ? (
          <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
            {state.message}
          </p>
        ) : (
          <InlineError message={state.message} recovery={state.recovery} />
        )
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save language"}
      </Button>
    </form>
  );
}
