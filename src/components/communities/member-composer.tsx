"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

/** Member post composer: text-only, max 5000 chars (POST .../posts, §11i). */
export function MemberComposer({ communityId }: { communityId: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (value.length < 1 || value.length > 5000) {
      setError("Post text must be 1–5000 characters.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/posts`, {
        method: "POST",
        body: { text: value },
      });
      setText("");
      notify("Post published.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message || err.guidance().message
          : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={publish} className="rounded-xl border border-soft bg-surface-card p-4">
      <Field label="Start a discussion" htmlFor="member-post">
        <Textarea
          value={text}
          maxLength={5000}
          rows={3}
          placeholder="Share something with the community…"
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <div className="mt-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Publishing…" : "Post"}
        </Button>
      </div>
    </form>
  );
}
