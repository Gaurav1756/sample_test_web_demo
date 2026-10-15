"use client";

import * as React from "react";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { toList, type Tier } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { validateTierCapacity, validateTierName } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

/** Ticket tier CRUD (§6). Capacity cuts below sold and deletes with sales fail server-side (409). */
export function TierManager({ eventId, initial }: { eventId: string; initial: Tier[] }) {
  const { notify } = useToast();
  const [tiers, setTiers] = React.useState(initial);
  const [name, setName] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [editing, setEditing] = React.useState<Tier | null>(null);
  const [deleting, setDeleting] = React.useState<Tier | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = async () => {
    const res = await bff<unknown>(`events/${eventId}/tiers`);
    setTiers(toList<Tier>(res));
  };

  const fail = (e: unknown) => {
    setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = validateTierName(name);
    const priceNum = Math.round(Number(price) * 100);
    const capNum = Number(capacity);
    const capError = validateTierCapacity(capNum);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Enter a valid price in rupees.");
      return;
    }
    if (capError) {
      setError(capError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await bff(`events/${eventId}/tiers`, {
        method: "POST",
        body: { name: name.trim(), price: priceNum, capacity: capNum },
      });
      setName("");
      setPrice("");
      setCapacity("");
      await reload();
      notify("Tier added.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setBusy(true);
    try {
      await bff(`tiers/${editing.id}`, {
        method: "PATCH",
        body: { name: editing.name, price: editing.price, capacity: editing.capacity },
      });
      setEditing(null);
      await reload();
      notify("Tier updated.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await bff(`tiers/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      await reload();
      notify("Tier removed.");
    } catch (err) {
      fail(err);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {tiers.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {tiers.map((tier) => (
            <li
              key={tier.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-3"
            >
              <div>
                <p className="font-semibold">{tier.name}</p>
                <p className="text-sm text-stone-600">
                  {formatPaise(tier.price)} · {tier.soldCount} sold · {tier.availableCount} left
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setEditing({ ...tier })}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(tier)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">No tiers yet. Add the first one below.</p>
      )}

      <form onSubmit={create} className="mt-4 grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-[1fr_140px_140px_auto]">
        <Field label="Tier name" htmlFor="tier-name">
          <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Early bird" />
        </Field>
        <Field label="Price (₹)" htmlFor="tier-price">
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" />
        </Field>
        <Field label="Capacity" htmlFor="tier-cap">
          <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="100" />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </div>
      </form>

      {error ? (
        <div className="mt-3">
          <InlineError message={error} />
        </div>
      ) : null}

      {editing ? (
        <EditTierModal
          tier={editing}
          busy={busy}
          onChange={setEditing}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Remove tier?"
          body={`“${deleting.name}” will be removed. Tiers with sales cannot be removed.`}
          confirmLabel="Remove"
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </div>
  );
}

function EditTierModal({
  tier,
  busy,
  onChange,
  onSave,
  onClose,
}: {
  tier: Tier;
  busy: boolean;
  onChange: (t: Tier) => void;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div role="dialog" aria-modal="true" aria-label="Edit tier" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl">Edit tier</h2>
        <form onSubmit={onSave} className="mt-4 flex flex-col gap-3">
          <Field label="Tier name" htmlFor="edit-tier-name">
            <Input
              value={tier.name}
              maxLength={80}
              onChange={(e) => onChange({ ...tier, name: e.target.value })}
            />
          </Field>
          <Field label="Price (paise)" htmlFor="edit-tier-price" hint="Stored value, in paise.">
            <Input
              type="number"
              min={0}
              value={tier.price}
              onChange={(e) => onChange({ ...tier, price: Number(e.target.value) })}
            />
          </Field>
          <Field label="Capacity" htmlFor="edit-tier-cap" hint="Cannot go below tickets sold.">
            <Input
              type="number"
              min={1}
              value={tier.capacity}
              onChange={(e) => onChange({ ...tier, capacity: Number(e.target.value) })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
