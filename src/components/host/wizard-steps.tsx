"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { EventDetail, UploadResponse } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { AgendaEditor } from "./agenda-editor";
import { TeamManager } from "./team-manager";

const STEPS = ["Basics", "Venue", "Media", "Tickets", "Details", "Review"];

/** Wizard shell with step navigation (steps 2+ need a draft). */
export function WizardShell({
  step,
  draftId,
  children,
}: {
  step: number;
  draftId: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <ol className="flex flex-wrap gap-1" aria-label="Event creation steps">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const reachable = n === 1 || draftId !== null;
          const href = `/host/events/new/${n}${draftId ? `?draft=${draftId}` : ""}`;
          const cls = `rounded-lg px-3 py-1.5 text-sm font-semibold ${
            n === step ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600"
          } ${!reachable ? "opacity-50" : ""}`;
          return (
            <li key={label}>
              {reachable ? (
                <Link href={href} aria-current={n === step ? "step" : undefined} className={cls}>
                  {n}. {label}
                </Link>
              ) : (
                <span className={cls} aria-disabled="true">
                  {n}. {label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function useWizardError() {
  const [error, setError] = React.useState<string | null>(null);
  const fail = (e: unknown) =>
    setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
  return { error, setError, fail };
}

function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Step 1: basics. Creates the draft (POST /events) or patches it. */
export function StepBasics({
  draft,
  categories,
}: {
  draft: EventDetail | null;
  categories: string[];
}) {
  const router = useRouter();
  const { error, setError, fail } = useWizardError();
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState(draft?.title ?? "");
  const [description, setDescription] = React.useState(draft?.description ?? "");
  const [category, setCategory] = React.useState(draft?.category ?? "");
  const [eventType, setEventType] = React.useState("public");
  const [mode, setMode] = React.useState("offline");
  const [startAt, setStartAt] = React.useState(toLocalInput(draft?.startAt));
  const [endAt, setEndAt] = React.useState(toLocalInput(draft?.endAt));
  const [age, setAge] = React.useState(draft?.policies?.ageRestriction ?? "");
  const [language, setLanguage] = React.useState(draft?.language ?? "");
  const [audience, setAudience] = React.useState(draft?.targetAudience ?? "");
  const [capacity, setCapacity] = React.useState(
    draft?.maxAttendees != null ? String(draft.maxAttendees) : "",
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 1 || title.trim().length > 150) {
      setError("Title must be 1–150 characters.");
      return;
    }
    if (description.trim().length < 1 || description.trim().length > 4000) {
      setError("Description must be 1–4000 characters.");
      return;
    }
    if (!startAt || !endAt) {
      setError("Start and end date/time are required.");
      return;
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setError("The end must be after the start.");
      return;
    }
    const capacityNum = capacity.trim() === "" ? undefined : Number(capacity);
    if (capacityNum !== undefined && (!Number.isInteger(capacityNum) || capacityNum <= 0)) {
      setError("Capacity must be a positive whole number.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        ...(category ? { category } : {}),
        eventType,
        // New drafts start online: offline events require venue fields that
        // step 2 collects; the mode is corrected there via PATCH (drafts are
        // fully editable, so this round-trips without data loss).
        mode: draft ? mode : "online",
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        ...(age.trim() ? { ageRestriction: age.trim() } : {}),
        ...(language.trim() ? { language: language.trim() } : {}),
        ...(audience.trim() ? { targetAudience: audience.trim() } : {}),
        ...(capacityNum !== undefined ? { maxAttendees: capacityNum } : {}),
      };
      const saved = draft
        ? await bff<EventDetail>(`events/${draft.id}`, { method: "PATCH", body })
        : await bff<EventDetail>("events", { method: "POST", body });
      router.push(`/host/events/new/2?draft=${saved.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-4">
      <Field label="Title" htmlFor="title" required>
        <Input value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="description" required>
        <Textarea value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} />
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
        <Field label="Event type" htmlFor="eventType">
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite_only">Invite only</option>
          </Select>
        </Field>
        <Field label="Mode" htmlFor="mode">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="offline">In-person</option>
            <option value="online">Online</option>
          </Select>
        </Field>
        <Field label="Age restriction" htmlFor="age">
          <Input value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 18+" />
        </Field>
        <Field label="Language" htmlFor="language">
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. English"
          />
        </Field>
        <Field label="Target audience" htmlFor="audience">
          <Input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. Beginners"
          />
        </Field>
        <Field label="Capacity" htmlFor="capacity" hint="Max attendees. Blank = unlimited.">
          <Input
            type="number"
            min={1}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Blank = unlimited"
          />
        </Field>
        <Field label="Starts" htmlFor="startAt" required>
          <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        <Field label="Ends" htmlFor="endAt" required>
          <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </Field>
      </div>
      {error ? <InlineError message={error} /> : null}
      <div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : draft ? "Save and continue" : "Create draft and continue"}
        </Button>
      </div>
    </form>
  );
}

/** Step 2: venue details (PATCH). */
export function StepVenue({ draft }: { draft: EventDetail }) {
  const router = useRouter();
  const { error, setError, fail } = useWizardError();
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState("offline");
  const [venue, setVenue] = React.useState(draft.venue ?? "");
  const [address, setAddress] = React.useState(draft.address ?? "");
  const [city, setCity] = React.useState(draft.city ?? "");
  const [onlineUrl, setOnlineUrl] = React.useState("");
  const [lat, setLat] = React.useState(draft.latitude != null ? String(draft.latitude) : "");
  const [lng, setLng] = React.useState(draft.longitude != null ? String(draft.longitude) : "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "offline" && (!venue.trim() || !address.trim() || !city.trim())) {
      setError("Venue, address and city are required for in-person events.");
      return;
    }
    const latNum = lat.trim() === "" ? undefined : Number(lat);
    const lngNum = lng.trim() === "" ? undefined : Number(lng);
    if (
      (latNum !== undefined && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)) ||
      (lngNum !== undefined && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180))
    ) {
      setError("Coordinates must be valid (lat −90…90, lng −180…180).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${draft.id}`, {
        method: "PATCH",
        body: {
          mode,
          ...(mode === "offline"
            ? { venue: venue.trim(), address: address.trim(), city: city.trim() }
            : { onlineUrl: onlineUrl.trim() || undefined }),
          ...(latNum !== undefined ? { lat: latNum } : {}),
          ...(lngNum !== undefined ? { lng: lngNum } : {}),
        },
      });
      router.push(`/host/events/new/3?draft=${draft.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex max-w-2xl flex-col gap-4">
      <Field label="Mode" htmlFor="mode">
        <Select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="offline">In-person</option>
          <option value="online">Online</option>
        </Select>
      </Field>
      {mode === "offline" ? (
        <>
          <Field label="Venue" htmlFor="venue" required>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="address" required>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="City" htmlFor="city" required>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitude" htmlFor="lat">
              <Input value={lat} inputMode="decimal" onChange={(e) => setLat(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Longitude" htmlFor="lng">
              <Input value={lng} inputMode="decimal" onChange={(e) => setLng(e.target.value)} placeholder="Optional" />
            </Field>
          </div>
        </>
      ) : (
        <Field label="Online URL" htmlFor="onlineUrl">
          <Input value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://…" />
        </Field>
      )}
      {error ? <InlineError message={error} /> : null}
      <WizardNav back={`/host/events/new/1?draft=${draft.id}`} busy={busy} />
    </form>
  );
}

/** Step 3: cover image (signed upload + PATCH). */
export function StepMedia({ draft }: { draft: EventDetail }) {
  const router = useRouter();
  const { notify } = useToast();
  const { error, setError, fail } = useWizardError();
  const [busy, setBusy] = React.useState(false);
  const [cover, setCover] = React.useState(draft.coverImage ?? "");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Image must be 50 MB or smaller.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const signed = await bff<UploadResponse>("uploads", {
        method: "POST",
        body: { contentType: file.type, byteSize: file.size, purpose: "event_cover" },
      });
      const put = await fetch(signed.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error("upload failed");
      await bff(`events/${draft.id}`, { method: "PATCH", body: { coverImage: signed.mediaUrl } });
      setCover(signed.mediaUrl);
      notify("Cover saved.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="aspect-[16/9] w-full rounded-xl object-cover" />
      ) : (
        <p className="text-sm text-stone-500">No cover yet. Upload one below.</p>
      )}
      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-semibold">Cover image</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])}
          className="text-sm"
        />
      </label>
      <p className="mt-2 text-sm text-stone-500">
        Galleries and video are not supported by the backend yet — the cover is the event image.
      </p>
      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" onClick={() => router.push(`/host/events/new/2?draft=${draft.id}`)}>
          Back
        </Button>
        <Button onClick={() => router.push(`/host/events/new/4?draft=${draft.id}`)}>
          Continue
        </Button>
      </div>
    </div>
  );
}

/** Step 5: agenda + policies. */
export function StepDetails({ draft }: { draft: EventDetail }) {
  const router = useRouter();
  const { error, setError, fail } = useWizardError();
  const [busy, setBusy] = React.useState(false);
  const [refundPolicy, setRefundPolicy] = React.useState(draft.policies?.refundPolicy ?? "");
  const [entryRules, setEntryRules] = React.useState(draft.policies?.entryRules ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (refundPolicy.length > 2000 || entryRules.length > 2000) {
      setError("Policies must be 2000 characters or fewer.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${draft.id}`, {
        method: "PATCH",
        body: { refundPolicy, entryRules },
      });
      router.push(`/host/events/new/6?draft=${draft.id}`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl">Agenda</h2>
      <div className="mt-3">
        <AgendaEditor eventId={draft.id} initial={draft.agenda ?? []} />
      </div>
      <form onSubmit={save} className="mt-8 flex flex-col gap-4">
        <h2 className="font-display text-xl">Policies</h2>
        <Field label="Refund policy" htmlFor="refundPolicy">
          <Textarea value={refundPolicy} maxLength={2000} onChange={(e) => setRefundPolicy(e.target.value)} />
        </Field>
        <Field label="Entry rules" htmlFor="entryRules">
          <Textarea value={entryRules} maxLength={2000} onChange={(e) => setEntryRules(e.target.value)} />
        </Field>
        {error ? <InlineError message={error} /> : null}
        <WizardNav back={`/host/events/new/4?draft=${draft.id}`} busy={busy} />
      </form>
    </div>
  );
}

/** Step 6: team + review + submit. */
export function StepReview({ draft }: { draft: EventDetail }) {
  const router = useRouter();
  const { notify } = useToast();
  const { error, setError, fail } = useWizardError();
  const [busy, setBusy] = React.useState(false);
  const [consent, setConsent] = React.useState(false);
  const [tiers, setTiers] = React.useState(draft.tiers ?? []);

  React.useEffect(() => {
    bff<unknown>(`events/${draft.id}/tiers`)
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setTiers(list as typeof tiers);
      })
      .catch(() => null);
  }, [draft.id]);

  const submit = async () => {
    if (!consent) {
      setError("Confirm the publishing policy to submit for review.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${draft.id}/submit-review`, { method: "POST" });
      notify("Submitted for review.");
      router.push(`/host/events/${draft.id}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl">Team</h2>
      <div className="mt-3">
        <TeamManager eventId={draft.id} initial={[]} />
      </div>

      <h2 className="mt-8 font-display text-xl">Review</h2>
      <dl className="mt-3 flex flex-col gap-2 rounded-xl border border-stone-200 p-4 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-stone-500">Title</dt>
          <dd className="font-medium">{draft.title}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-stone-500">Schedule</dt>
          <dd className="font-medium">
            {formatDateTime(draft.startAt)} → {formatDateTime(draft.endAt)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-stone-500">Venue</dt>
          <dd className="font-medium">{[draft.venue, draft.city].filter(Boolean).join(", ") || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-stone-500">Tiers</dt>
          <dd className="font-medium">
            {tiers.length > 0
              ? tiers.map((t) => `${t.name} (${formatPaise(t.price)})`).join(", ")
              : "None yet"}
          </dd>
        </div>
      </dl>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-brand-700"
        />
        This event follows the Pegwin publishing policy, and I accept that approval is at the
        Super Admin&apos;s discretion.
      </label>

      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => router.push(`/host/events/new/5?draft=${draft.id}`)}>
          Back
        </Button>
        <Button variant="secondary" onClick={() => router.push("/host/events?tab=drafts")}>
          Save draft
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}

function WizardNav({ back, busy }: { back: string; busy: boolean }) {
  const router = useRouter();
  return (
    <div className="flex gap-3">
      <Button type="button" variant="secondary" onClick={() => router.push(back)}>
        Back
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save and continue"}
      </Button>
    </div>
  );
}
