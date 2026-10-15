"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { CursorPage, GroupMessage, UploadResponse } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ReportButton } from "./report-button";

/**
 * Group chat thread. Members send text only (§11, BRD BR-014); the server
 * rejects member media with 403. No realtime channel is documented, so a
 * manual refresh re-reads the thread.
 */
export function ChatThread({
  groupId,
  groupName,
  initial,
  initialCursor,
  userId,
  onRefresh,
  onRemoveMessage,
  onAnnounce,
  onSendMedia,
}: {
  groupId: string;
  groupName: string;
  initial: GroupMessage[];
  initialCursor: string | null;
  userId: string;
  onRefresh: () => void;
  /** Host moderation: remove a message (DELETE, §11). */
  onRemoveMessage?: (messageId: string) => Promise<void>;
  /** Host announcements (type=announcement, host-team only). */
  onAnnounce?: (title: string, text: string) => Promise<GroupMessage>;
  /** Host-team media (image/video/file + mediaUrl, §11). */
  onSendMedia?: (type: "image" | "video" | "file", mediaUrl: string, text?: string) => Promise<GroupMessage>;
}) {
  const { notify } = useToast();
  const [messages, setMessages] = React.useState(initial);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [draft, setDraft] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [mode, setMode] = React.useState<"text" | "announcement">("text");
  const [busy, setBusy] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const loadOlder = async () => {
    if (!cursor) return;
    setBusy(true);
    try {
      const res = await bff<CursorPage<GroupMessage>>(`groups/${groupId}/messages`, {
        query: { before: cursor, limit: 50 },
      });
      setMessages((prev) => [...res.data, ...prev]);
      setCursor(res.nextCursor);
    } catch (e) {
      notify(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 2000);
    if (!text) return;
    setBusy(true);
    try {
      const created =
        mode === "announcement" && onAnnounce
          ? await onAnnounce(title.trim().slice(0, 200), text)
          : await bff<GroupMessage>(`groups/${groupId}/messages`, {
              method: "POST",
              body: { type: "text", text },
            });
      setMessages((prev) => [...prev, created]);
      setDraft("");
      setTitle("");
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      notify(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (messageId: string) => {
    if (!onRemoveMessage) return;
    try {
      await onRemoveMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      notify(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    }
  };

  const attach = async (file: File | undefined) => {
    if (!file || !onSendMedia) return;
    const kind =
      ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ? ("image" as const)
        : file.type === "video/mp4"
          ? ("video" as const)
          : file.type === "application/pdf"
            ? ("file" as const)
            : null;
    if (!kind || file.size > 50 * 1024 * 1024) {
      notify("Attach a JPEG/PNG/WebP image, MP4 video, or PDF up to 50 MB.");
      return;
    }
    setBusy(true);
    try {
      const signed = await bff<UploadResponse>("uploads", {
        method: "POST",
        body: { contentType: file.type, byteSize: file.size, purpose: "message_media" },
      });
      const put = await fetch(signed.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      const caption = draft.trim().slice(0, 2000);
      const created = await onSendMedia(kind, signed.mediaUrl, caption || undefined);
      setMessages((prev) => [...prev, created]);
      setDraft("");
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      notify(err instanceof ApiError ? err.message || err.guidance().message : "Media send failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl">{groupName}</h2>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
      {cursor ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={loadOlder} className="self-center">
          Load older messages
        </Button>
      ) : null}
      <ul className="flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 ? (
          <li className="text-sm text-stone-500">No messages yet. Say hello.</li>
        ) : null}
        {messages.map((m) => {
          const mine = m.author.id === userId;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2 ${
                  m.type === "announcement"
                    ? "border border-accent-500 bg-accent-100"
                    : mine
                      ? "bg-brand-700 text-white"
                      : "bg-stone-100"
                }`}
              >
                {!mine ? (
                  <p className="text-xs font-semibold text-stone-500">{m.author.name}</p>
                ) : null}
                {m.type === "announcement" ? (
                  <p className="text-xs font-bold uppercase tracking-wide">Announcement</p>
                ) : null}
                {m.type === "image" && m.mediaUrl ? (
                  // Plain img: media hosts are backend-controlled.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.mediaUrl} alt="" loading="lazy" className="max-h-64 rounded-lg object-cover" />
                ) : null}
                {m.type === "video" && m.mediaUrl ? (
                  <video src={m.mediaUrl} controls preload="metadata" className="max-h-64 rounded-lg" />
                ) : null}
                {m.type === "file" && m.mediaUrl ? (
                  <a
                    href={m.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold underline"
                  >
                    View attached file
                  </a>
                ) : null}
                {m.text ? <p className="whitespace-pre-line text-sm">{m.text}</p> : null}
                <p className={`mt-1 flex items-center gap-2 text-xs ${mine ? "text-brand-100" : "text-stone-400"}`}>
                  {formatDateTime(m.createdAt)}
                  {!mine && !onRemoveMessage ? <ReportButton targetType="message" targetId={m.id} /> : null}
                  {onRemoveMessage ? (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="rounded px-1 font-medium hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div ref={bottomRef} />
      <form onSubmit={send} className="sticky bottom-0 flex flex-col gap-2 border-t border-stone-200 bg-white py-3">
        {onAnnounce ? (
          <div className="flex gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "text" | "announcement")}
              aria-label="Message type"
              className="h-10 rounded-lg border border-stone-300 px-2 text-sm"
            >
              <option value="text">Message</option>
              <option value="announcement">Announcement</option>
            </select>
            {mode === "announcement" ? (
              <input
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title"
                aria-label="Announcement title"
                className="h-10 w-full rounded-lg border border-stone-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-600"
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={onAnnounce ? "Write…" : "Write a message… (text only)"}
            aria-label="Write a message"
            className="h-10 w-full rounded-lg border border-stone-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-600"
          />
          {onSendMedia ? (
            <label className="inline-flex h-10 cursor-pointer items-center rounded-lg border border-stone-300 px-3 text-sm font-semibold text-stone-700 hover:bg-stone-100">
              Attach
              <input
                type="file"
                className="sr-only"
                disabled={busy}
                accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf"
                onChange={(e) => {
                  void attach(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
          <Button type="submit" disabled={busy || !draft.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
