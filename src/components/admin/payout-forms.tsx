"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { Payout, PayoutStatus } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";

/** Manual payout initiation (POST /admin/payouts, TBD §9). */
export function PayoutInitiateForm() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ eventId: "", hostId: "", amount: "" });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.eventId.trim() || !form.hostId.trim()) {
      setError("Event id and host id are required.");
      return;
    }
    const paise = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(paise) || paise <= 0) {
      setError("Enter a valid amount in rupees.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff("admin/payouts", {
        method: "POST",
        body: { eventId: form.eventId.trim(), hostId: form.hostId.trim(), amount: paise },
      });
      setForm({ eventId: "", hostId: "", amount: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_160px_auto]">
      <Field label="Event id" htmlFor="eventId">
        <Input value={form.eventId} onChange={set("eventId")} />
      </Field>
      <Field label="Host id" htmlFor="hostId">
        <Input value={form.hostId} onChange={set("hostId")} />
      </Field>
      <Field label="Amount (₹)" htmlFor="amount">
        <Input type="number" min={0} value={form.amount} onChange={set("amount")} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Initiate"}
        </Button>
      </div>
      {error ? (
        <div className="sm:col-span-4">
          <InlineError message={error} />
        </div>
      ) : null}
    </form>
  );
}

/** Payout row with status update (PATCH processing/paid/failed + reference). */
export function PayoutRow({ payout }: { payout: Payout }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<PayoutStatus>(
    ["processing", "paid", "failed"].includes(payout.status) ? (payout.status as PayoutStatus) : "processing",
  );
  const [reference, setReference] = React.useState(payout.reference ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await bff(`admin/payouts/${payout.id}`, {
        method: "PATCH",
        body: { status, ...(reference.trim() ? { reference: reference.trim().slice(0, 200) } : {}) },
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">{formatPaise(payout.netAmount)}</p>
          <p className="mt-0.5 font-mono text-xs text-stone-500">
            {payout.id} · event {payout.eventId}
          </p>
        </div>
        <StatusBadge status={payout.status} />
      </div>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="Status" htmlFor={`status-${payout.id}`}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus)}>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </Select>
        </Field>
        <Field label="Reference" htmlFor={`ref-${payout.id}`}>
          <Input value={reference} maxLength={200} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Update"}
        </Button>
      </form>
      {error ? (
        <div className="mt-2">
          <InlineError message={error} />
        </div>
      ) : null}
    </li>
  );
}
