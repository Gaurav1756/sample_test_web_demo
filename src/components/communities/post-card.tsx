"use client";

import * as React from "react";
import Link from "next/link";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { CursorPage, Post } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface CommentItem {
  id: string;
  author: { id: string; name: string };
  text: string;
  createdAt: string;
}

/** Community post with likes and expandable comments (§11i). */
export function PostCard({ post, signedIn }: { post: Post; signedIn: boolean }) {
  const { notify } = useToast();
  const [liked, setLiked] = React.useState(Boolean(post.likedByMe));
  const [likes, setLikes] = React.useState(post.likesCount);
  const [open, setOpen] = React.useState(false);
  const [comments, setComments] = React.useState<CommentItem[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  if (post.status !== "published") {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
        {post.status === "held" ? "This post is awaiting review." : "This post was removed."}
      </div>
    );
  }

  const toggleLike = async () => {
    if (!signedIn) {
      notify("Sign in to like posts.");
      return;
    }
    setBusy(true);
    try {
      if (liked) {
        await bff(`posts/${post.id}/likes`, { method: "DELETE" });
        setLiked(false);
        setLikes((n) => Math.max(0, n - 1));
      } else {
        await bff(`posts/${post.id}/likes`, { method: "POST" });
        setLiked(true);
        setLikes((n) => n + 1);
      }
    } catch (e) {
      notify(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const loadComments = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (comments !== null) return;
    try {
      const res = await bff<CursorPage<CommentItem>>(`posts/${post.id}/comments`);
      setComments(res.data);
    } catch (e) {
      notify(e instanceof ApiError ? e.guidance().message : "Something went wrong.");
      setOpen(false);
    }
  };

  const sendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      notify("Sign in to comment.");
      return;
    }
    const text = draft.trim().slice(0, 1000);
    if (!text) return;
    setBusy(true);
    try {
      const created = await bff<CommentItem>(`posts/${post.id}/comments`, {
        method: "POST",
        body: { text },
      });
      setComments((prev) => [...(prev ?? []), created]);
      setDraft("");
    } catch (err) {
      notify(err instanceof ApiError ? err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-stone-200 p-4">
      <p className="text-sm text-stone-500">
        <Link
          href={`/users/${post.author.id}`}
          className="font-semibold text-brand-800 hover:underline"
        >
          {post.author.name}
        </Link>{" "}·{" "}
        {formatDateTime(post.createdAt)}
      </p>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{post.text}</p>
      <div className="mt-3 flex gap-2 text-sm">
        <Button variant="ghost" size="sm" disabled={busy} onClick={toggleLike} aria-pressed={liked}>
          {liked ? "♥" : "♡"} {likes}
        </Button>
        <Button variant="ghost" size="sm" onClick={loadComments} aria-expanded={open}>
          Comments ({post.commentsCount})
        </Button>
      </div>
      {open ? (
        <div className="mt-3 border-t border-stone-100 pt-3">
          {comments === null ? (
            <p className="text-sm text-stone-500">Loading comments…</p>
          ) : comments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
                  <Link
                    href={`/users/${c.author.id}`}
                    className="font-semibold text-brand-800 hover:underline"
                  >
                    {c.author.name}
                  </Link>{" "}
                  <span className="text-stone-500">{formatDateTime(c.createdAt)}</span>
                  <p className="mt-0.5">{c.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No comments yet.</p>
          )}
          <form onSubmit={sendComment} className="mt-3 flex gap-2">
            <input
              value={draft}
              maxLength={1000}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={signedIn ? "Write a comment…" : "Sign in to comment"}
              disabled={!signedIn}
              aria-label="Write a comment"
              className="h-9 w-full rounded-lg border border-stone-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-brand-600 disabled:bg-stone-100"
            />
            <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
              Send
            </Button>
          </form>
        </div>
      ) : null}
    </article>
  );
}
