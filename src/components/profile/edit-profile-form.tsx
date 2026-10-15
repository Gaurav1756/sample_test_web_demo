"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateProfile } from "@/lib/account-actions";
import { bff } from "@/lib/bff";
import type { UploadResponse, User } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

const INITIAL = { ok: false as const };

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Profile editor with username check and signed avatar upload (§3, §11a). */
export function EditProfileForm({ user }: { user: User }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  const { notify } = useToast();
  const [username, setUsername] = React.useState(user.username);
  const [usernameNote, setUsernameNote] = React.useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState(user.avatarUrl ?? "");
  const [uploading, setUploading] = React.useState(false);

  const checkUsername = async () => {
    const value = username.trim();
    if (value.length < 3 || value === user.username) {
      setUsernameNote(null);
      return;
    }
    try {
      const res = await bff<{ available: boolean }>("users/username-available", {
        query: { username: value },
      });
      setUsernameNote(res.available ? "Username is available." : "Username is taken.");
    } catch {
      setUsernameNote(null);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      notify("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      notify("Image must be 50 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const signed = await bff<UploadResponse>("uploads", {
        method: "POST",
        body: { contentType: file.type, byteSize: file.size, purpose: "avatar" },
      });
      const put = await fetch(signed.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      setAvatarUrl(signed.mediaUrl);
      notify("Photo uploaded. Save to apply it.");
    } catch {
      notify("Photo upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <input type="hidden" name="avatarUrl" value={avatarUrl} />
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 font-display text-2xl font-bold text-brand-900"
          >
            {user.name.charAt(0).toUpperCase()}
          </span>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Profile photo</span>
          <input
            type="file"
            accept={AVATAR_TYPES.join(",")}
            disabled={uploading}
            onChange={(e) => uploadAvatar(e.target.files?.[0])}
            className="text-sm"
          />
          {uploading ? <span className="text-stone-500">Uploading…</span> : null}
        </label>
      </div>
      <Field label="Full name" htmlFor="name">
        <Input name="name" defaultValue={user.name} maxLength={100} />
      </Field>
      <Field label="Username" htmlFor="username" hint={usernameNote ?? "3–30 characters."}>
        <Input
          name="username"
          value={username}
          minLength={3}
          maxLength={30}
          onChange={(e) => {
            setUsername(e.target.value);
            setUsernameNote(null);
          }}
          onBlur={checkUsername}
        />
      </Field>
      <Field label="Bio" htmlFor="bio">
        <Textarea name="bio" defaultValue={user.bio ?? ""} />
      </Field>
      <Field label="City" htmlFor="city">
        <Input name="city" defaultValue={user.city ?? ""} />
      </Field>
      {state.message ? (
        <InlineError message={state.message} recovery={state.recovery} />
      ) : null}
      <Button type="submit" disabled={pending || uploading}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
