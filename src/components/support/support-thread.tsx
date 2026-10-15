"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { SupportMessage } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Support thread with message composer (§13a). */
export function SupportThread({
  conversationId,
  initial,
  userId,
}: {
  conversationId: string;
  initial: SupportMessage[];
  userId: string;
}) {
  const { notify } = useToast();
  const [messages, setMessages] = React.useState(initial);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 2000);
    if (!text) return;
    setBusy(true);
    try {
      const created = await bff<SupportMessage>(`support/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { text },
      });
      setMessages((prev) => [...prev, created]);
      setDraft("");
    } catch (err) {
      notify(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ul className="flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 ? (
          <li className="text-sm text-stone-500">No messages yet.</li>
        ) : null}
        {messages.map((m) => {
          const mine = m.author.id === userId;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 ${
                  mine ? "bg-brand-700 text-white" : "bg-stone-100"
                }`}
              >
                {!mine ? (
                  <p className="text-xs font-semibold text-stone-500">{m.author.name}</p>
                ) : null}
                <p className="whitespace-pre-line text-sm">{m.text}</p>
                <p className={`mt-1 text-xs ${mine ? "text-brand-100" : "text-stone-400"}`}>
                  {formatDateTime(m.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <form onSubmit={send} className="mt-4 flex gap-2 border-t border-stone-200 pt-4">
        <input
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          aria-label="Write a message"
          className="h-10 w-full rounded-lg border border-stone-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-600"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
