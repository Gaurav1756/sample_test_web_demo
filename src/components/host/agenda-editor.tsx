"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { AgendaSlot } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/** Agenda editor: replaces the full slot list (PUT, max 50 slots, §4a). */
export function AgendaEditor({ eventId, initial }: { eventId: string; initial: AgendaSlot[] }) {
  const { notify } = useToast();
  const [slots, setSlots] = React.useState<AgendaSlot[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const update = (index: number, patch: Partial<AgendaSlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const save = async () => {
    for (const [i, s] of slots.entries()) {
      if (!s.time.trim() || !s.title.trim()) {
        setError(`Slot ${i + 1} needs both a time and a title.`);
        return;
      }
      if (s.time.length > 20 || s.title.length > 200) {
        setError(`Slot ${i + 1} exceeds the length limit (time ≤20, title ≤200).`);
        return;
      }
    }
    if (slots.length > 50) {
      setError("Agenda supports at most 50 slots.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${eventId}/agenda`, {
        method: "PUT",
        body: { slots: slots.map((s) => ({ time: s.time.trim(), title: s.title.trim() })) },
      });
      notify("Agenda saved.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {slots.map((slot, i) => (
          <li key={i} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
            <Input
              value={slot.time}
              maxLength={20}
              onChange={(e) => update(i, { time: e.target.value })}
              placeholder="6:00 PM"
              aria-label={`Slot ${i + 1} time`}
            />
            <Input
              value={slot.title}
              maxLength={200}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Doors open"
              aria-label={`Slot ${i + 1} title`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}
              aria-label={`Remove slot ${i + 1}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {slots.length === 0 ? (
        <p className="text-sm text-stone-500">No agenda slots yet.</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={slots.length >= 50}
          onClick={() => setSlots((prev) => [...prev, { time: "", title: "" }])}
        >
          + Add slot
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save agenda"}
        </Button>
      </div>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
    </div>
  );
}
