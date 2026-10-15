"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import type { PayoutAccount } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/badge";

/** Payout request + account forms (§9/§9a, TBD draft — honest errors). */
export function PayoutRequestForm() {
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = amount.trim() === "" ? undefined : Math.round(Number(amount) * 100);
    if (paise !== undefined && (!Number.isFinite(paise) || paise <= 0)) {
      setError("Enter a valid amount in rupees, or leave blank for the full balance.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff("hosts/me/payout-requests", {
        method: "POST",
        body: paise !== undefined ? { amount: paise } : {},
      });
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-md gap-2">
      <div className="flex-1">
        <Field label="Amount (₹, blank = full)" htmlFor="payout-amount">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Requesting…" : "Request payout"}
        </Button>
      </div>
      {error ? (
        <div className="w-full">
          <InlineError message={error} />
        </div>
      ) : null}
    </form>
  );
}

export function PayoutAccountForm() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ bankName: "", accountNumber: "", ifsc: "", holder: "" });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bankName.trim() || !form.holder.trim()) {
      setError("Bank name and account holder are required.");
      return;
    }
    if (!/^[0-9]{9,18}$/.test(form.accountNumber.trim())) {
      setError("Account number must be 9–18 digits.");
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase())) {
      setError("Enter a valid IFSC (e.g. HDFC0001234).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff("hosts/me/payout-accounts", {
        method: "POST",
        body: {
          bankName: form.bankName.trim(),
          accountNumber: form.accountNumber.trim(),
          ifsc: form.ifsc.trim().toUpperCase(),
          holder: form.holder.trim(),
        },
      });
      setForm({ bankName: "", accountNumber: "", ifsc: "", holder: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-3 sm:grid-cols-2">
      <Field label="Bank name" htmlFor="bankName">
        <Input value={form.bankName} maxLength={100} onChange={set("bankName")} />
      </Field>
      <Field label="Account holder" htmlFor="holder">
        <Input value={form.holder} maxLength={100} onChange={set("holder")} />
      </Field>
      <Field label="Account number" htmlFor="accountNumber" hint="9–18 digits, write-only.">
        <Input value={form.accountNumber} inputMode="numeric" onChange={set("accountNumber")} />
      </Field>
      <Field label="IFSC" htmlFor="ifsc">
        <Input value={form.ifsc} maxLength={11} onChange={set("ifsc")} placeholder="HDFC0001234" />
      </Field>
      {error ? (
        <div className="sm:col-span-2">
          <InlineError message={error} />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Connecting…" : "Connect account"}
        </Button>
      </div>
    </form>
  );
}

/** Edit a connected payout account (PATCH …/payout-accounts/:id). */
export function PayoutAccountEditForm({
  accountId,
  initialBank,
  initialHolder,
  onDone,
}: {
  accountId: string;
  initialBank: string;
  initialHolder: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    bankName: initialBank,
    holder: initialHolder,
    accountNumber: "",
    ifsc: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bankName.trim() || !form.holder.trim()) {
      setError("Bank name and account holder are required.");
      return;
    }
    if (form.accountNumber.trim() && !/^[0-9]{9,18}$/.test(form.accountNumber.trim())) {
      setError("Account number must be 9–18 digits.");
      return;
    }
    const ifsc = form.ifsc.trim().toUpperCase();
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setError("Enter a valid IFSC (e.g. HDFC0001234).");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Only changed/specified fields are sent.
      const body: Record<string, string> = {};
      if (form.bankName.trim() !== initialBank) body.bankName = form.bankName.trim();
      if (form.holder.trim() !== initialHolder) body.holder = form.holder.trim();
      if (form.accountNumber.trim()) body.accountNumber = form.accountNumber.trim();
      if (ifsc) body.ifsc = ifsc;
      if (Object.keys(body).length === 0) {
        onDone();
        return;
      }
      await bff(`hosts/me/payout-accounts/${accountId}`, { method: "PATCH", body });
      onDone();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message || err.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Bank name" htmlFor={`bank-${accountId}`}>
        <Input value={form.bankName} maxLength={100} onChange={set("bankName")} />
      </Field>
      <Field label="Account holder" htmlFor={`holder-${accountId}`}>
        <Input value={form.holder} maxLength={100} onChange={set("holder")} />
      </Field>
      <Field label="New account number" htmlFor={`acct-${accountId}`} hint="Optional rotation.">
        <Input value={form.accountNumber} inputMode="numeric" onChange={set("accountNumber")} />
      </Field>
      <Field label="New IFSC" htmlFor={`ifsc-${accountId}`} hint="Optional rotation.">
        <Input value={form.ifsc} maxLength={11} onChange={set("ifsc")} placeholder="HDFC0001234" />
      </Field>
      {error ? (
        <div className="sm:col-span-2">
          <InlineError message={error} />
        </div>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/** Connected account row with inline edit toggle. */
export function PayoutAccountRow({ account }: { account: PayoutAccount }) {
  const [editing, setEditing] = React.useState(false);
  return (
    <li className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-semibold">{account.bankName}</span> ···· {account.last4} ·{" "}
          {account.holder}
        </span>
        <span className="flex items-center gap-2">
          <StatusBadge status={account.status} />
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit"}
          </Button>
          <DisconnectAccountButton accountId={account.id} />
        </span>
      </div>
      {editing ? (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <PayoutAccountEditForm
            accountId={account.id}
            initialBank={account.bankName}
            initialHolder={account.holder}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : null}
    </li>
  );
}

export function DisconnectAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const disconnect = async () => {
    setBusy(true);
    try {
      await bff(`hosts/me/payout-accounts/${accountId}/disconnect`, { method: "POST" });
      router.refresh();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={disconnect}>
      Disconnect
    </Button>
  );
}
