"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { Community, UploadResponse } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

/** Community information edit (PATCH name/description/category/avatar, §11g). */
export function CommunityInfoForm({
  community,
  categories,
}: {
  community: Community;
  categories: string[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState(community.name);
  const [description, setDescription] = React.useState(community.description ?? "");
  const [category, setCategory] = React.useState(community.category ?? "");
  const [avatar, setAvatar] = React.useState(community.avatarUrl ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 50 * 1024 * 1024) {
      setError("Logo must be a JPEG/PNG/WebP image up to 50 MB.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const signed = await bff<UploadResponse>("uploads", {
        method: "POST",
        body: { contentType: file.type, byteSize: file.size, purpose: "community_media" },
      });
      const put = await fetch(signed.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      setAvatar(signed.mediaUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Logo upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 1 || name.trim().length > 100) {
      setError("Name must be 1–100 characters.");
      return;
    }
    if (description.length > 2000) {
      setError("Description must be 2000 characters or fewer.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${community.id}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          description: description.trim(),
          ...(category ? { category } : {}),
          ...(avatar ? { avatarUrl: avatar } : {}),
        },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-4">
      <Field label="Name" htmlFor="name">
        <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Category" htmlFor="category">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Choose…</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Logo</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])}
          className="text-sm"
        />
        {avatar ? <span className="text-brand-800"> Logo ready — save to apply.</span> : null}
      </label>
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save information"}
        </Button>
      </div>
    </form>
  );
}

/** Group creation (POST .../groups, §11). */
export function GroupCreateForm({ communityId }: { communityId: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 1 || name.trim().length > 100) {
      setError("Name must be 1–100 characters.");
      return;
    }
    if (description.length > 500) {
      setError("Description must be 500 characters or fewer.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`communities/${communityId}/groups`, {
        method: "POST",
        body: { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) },
      });
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={create} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <Field label="Group name" htmlFor="group-name">
        <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="group-description">
        <Input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create group"}
        </Button>
      </div>
      {error ? (
        <div className="sm:col-span-3">
          <InlineError message={error} />
        </div>
      ) : null}
    </form>
  );
}
