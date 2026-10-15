"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

/** Host post / announcement composer (§11i). */
export function AnnounceForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [kind, setKind] = React.useState("post");
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (value.length < 1 || value.length > 5000) {
      setError("Text must be 1–5000 characters.");
      return;
    }
    if (kind === "announcement" && title.trim().length > 200) {
      setError("Title must be 200 characters or fewer.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/posts`, {
        method: "POST",
        body: {
          text: value,
          ...(kind === "announcement"
            ? { type: "announcement", ...(title.trim() ? { title: title.trim() } : {}) }
            : {}),
        },
      });
      setText("");
      setTitle("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={publish} className="flex max-w-2xl flex-col gap-3 rounded-xl border border-stone-200 p-4">
      <Field label="Type" htmlFor="post-kind">
        <Select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="post">Post</option>
          <option value="announcement">Announcement</option>
        </Select>
      </Field>
      {kind === "announcement" ? (
        <Field label="Title" htmlFor="post-title">
          <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Text" htmlFor="post-text">
        <Textarea value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} />
      </Field>
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </form>
  );
}
