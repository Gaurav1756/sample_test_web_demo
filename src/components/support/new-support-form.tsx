"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { SupportConversation } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

/** Start a user↔support thread (§13a). */
export function NewSupportForm({ topics }: { topics: string[] }) {
  const router = useRouter();
  const [topic, setTopic] = React.useState(topics[0] ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = topic.trim().slice(0, 100);
    if (!value) {
      setError("Choose or enter a topic.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const created = await bff<SupportConversation>("support/conversations", {
        method: "POST",
        body: { topic: value },
      });
      router.push(`/support/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-stone-200 p-4">
      <Field label="Start a new conversation" htmlFor="topic">
        {topics.length > 0 ? (
          <Select value={topic} onChange={(e) => setTopic(e.target.value)}>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        ) : (
          <input
            value={topic}
            maxLength={100}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic"
            aria-label="Topic"
            className="h-10 w-full rounded-lg border border-stone-300 px-3 text-sm"
          />
        )}
      </Field>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <Button type="submit" disabled={busy} className="mt-3">
        {busy ? "Starting…" : "Start conversation"}
      </Button>
    </form>
  );
}
