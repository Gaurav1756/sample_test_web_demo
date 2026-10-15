"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { AdminCoupon } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";

/** Coupon creation (POST /admin/coupons, §6). */
export function CouponCreateForm() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    code: "",
    discountType: "flat",
    value: "",
    eventId: "",
    tierId: "",
    maxUses: "",
    validFrom: "",
    validTo: "",
    discountBearer: "pegwin",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,50}$/.test(code)) {
      setError("Code must be 1–50 characters: A–Z, 0–9, _ or -.");
      return;
    }
    const rawValue = Number(form.value);
    const value =
      form.discountType === "flat" ? Math.round(rawValue * 100) : Math.round(rawValue);
    if (
      !Number.isFinite(value) ||
      (form.discountType === "flat" ? value < 0 : value < 1 || value > 100)
    ) {
      setError(form.discountType === "flat" ? "Enter a valid rupee amount." : "Percent must be 1–100.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff("admin/coupons", {
        method: "POST",
        body: {
          code,
          discountType: form.discountType,
          value,
          ...(form.eventId.trim() ? { eventId: form.eventId.trim() } : {}),
          ...(form.tierId.trim() ? { tierId: form.tierId.trim() } : {}),
          ...(form.maxUses.trim() ? { maxUses: Number(form.maxUses) } : {}),
          ...(form.validFrom ? { validFrom: new Date(form.validFrom).toISOString() } : {}),
          ...(form.validTo ? { validTo: new Date(form.validTo).toISOString() } : {}),
          discountBearer: form.discountBearer,
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
    <form onSubmit={submit} className="grid max-w-3xl gap-3 sm:grid-cols-3">
      <Field label="Code" htmlFor="code" required>
        <Input value={form.code} maxLength={50} onChange={set("code")} placeholder="WELCOME10" className="font-mono" />
      </Field>
      <Field label="Type" htmlFor="discountType">
        <Select value={form.discountType} onChange={set("discountType")}>
          <option value="flat">Flat (₹)</option>
          <option value="pct">Percent (%)</option>
        </Select>
      </Field>
      <Field label={form.discountType === "flat" ? "Value (₹)" : "Value (%)"} htmlFor="value">
        <Input type="number" min={0} value={form.value} onChange={set("value")} />
      </Field>
      <Field label="Event id (optional)" htmlFor="eventId">
        <Input value={form.eventId} onChange={set("eventId")} placeholder="Scope to event" />
      </Field>
      <Field label="Tier id (optional)" htmlFor="tierId">
        <Input value={form.tierId} onChange={set("tierId")} placeholder="Scope to tier" />
      </Field>
      <Field label="Max uses (optional)" htmlFor="maxUses">
        <Input type="number" min={1} value={form.maxUses} onChange={set("maxUses")} />
      </Field>
      <Field label="Valid from" htmlFor="validFrom">
        <Input type="datetime-local" value={form.validFrom} onChange={set("validFrom")} />
      </Field>
      <Field label="Valid to" htmlFor="validTo">
        <Input type="datetime-local" value={form.validTo} onChange={set("validTo")} />
      </Field>
      <Field label="Discount bearer" htmlFor="discountBearer">
        <Select value={form.discountBearer} onChange={set("discountBearer")}>
          <option value="pegwin">Pegwin</option>
          <option value="host">Host</option>
          <option value="split">Split</option>
        </Select>
      </Field>
      {error ? (
        <div className="sm:col-span-3">
          <InlineError message={error} />
        </div>
      ) : null}
      <div className="sm:col-span-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create coupon"}
        </Button>
      </div>
    </form>
  );
}

/** Coupon row with enable/disable (PATCH enabled, §13c). */
export function CouponRow({ coupon }: { coupon: AdminCoupon }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const enabled = coupon.status ? coupon.status === "active" || coupon.status === "enabled" : true;

  const flip = async () => {
    setError(null);
    setBusy(true);
    try {
      await bff(`admin/coupons/${coupon.id}`, { method: "PATCH", body: { enabled: !enabled } });
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono font-bold">{coupon.code}</p>
          <p className="mt-0.5 text-sm text-stone-600">
            {coupon.discountType === "flat" ? `₹${(coupon.value / 100).toFixed(2)} off` : `${coupon.value}% off`}
            {coupon.maxUses != null ? ` · ${coupon.usedCount ?? 0}/${coupon.maxUses} used` : ""}
            {coupon.validTo ? ` · until ${formatDate(coupon.validTo)}` : ""}
            {coupon.discountBearer ? ` · borne by ${coupon.discountBearer}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={enabled ? "verified" : "expired"}>{enabled ? "Active" : "Disabled"}</Badge>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            {enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="mt-2">
          <InlineError message={error} />
        </div>
      ) : null}
      {confirming ? (
        <ConfirmModal
          title={`${enabled ? "Disable" : "Enable"} ${coupon.code}?`}
          body={enabled ? "New checkouts can no longer use this coupon." : "Checkouts can use this coupon again."}
          confirmLabel={enabled ? "Disable" : "Enable"}
          danger={enabled}
          busy={busy}
          onConfirm={flip}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </li>
  );
}
