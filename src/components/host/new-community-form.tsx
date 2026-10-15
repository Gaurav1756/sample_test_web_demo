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

/** Community creation (POST /communities, §11). */
export function NewCommunityForm({
  categories,
  interests,
}: {
  categories: string[];
  interests: string[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [city, setCity] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [logo, setLogo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = (interest: string) => {
    setPicked((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev.slice(0, 4), interest],
    );
  };

  const uploadLogo = async (file: File | undefined) => {
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
      setLogo(signed.mediaUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Logo upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
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
      const created = await bff<Community>("communities", {
        method: "POST",
        body: {
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(category ? { category } : {}),
          ...(logo ? { avatarUrl: logo } : {}),
          ...(city.trim() ? { city: city.trim() } : {}),
          ...(picked.length > 0 ? { interests: picked } : {}),
        },
      });
      router.push(`/host/communities/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={create} className="flex max-w-2xl flex-col gap-4">
      <Field label="Name" htmlFor="name" required>
        <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <Field label="City" htmlFor="city">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Interests (up to 5)</legend>
        <div className="flex flex-wrap gap-2">
          {interests.map((interest) => {
            const active = picked.includes(interest);
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggle(interest)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-stone-300 bg-white hover:border-brand-400"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="mb-1 block font-semibold">Logo (optional)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => uploadLogo(e.target.files?.[0])}
          className="text-sm"
        />
        {logo ? <span className="text-brand-800">Logo uploaded.</span> : null}
      </label>
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create community"}
        </Button>
      </div>
    </form>
  );
}
