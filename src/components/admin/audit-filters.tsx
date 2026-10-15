"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface AuditFilterValues {
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
}

const EMPTY: AuditFilterValues = { action: "", actorId: "", entityType: "", entityId: "", from: "", to: "" };

/** Documented audit-log filters (§13). */
export function AuditFilters({ initial }: { initial: AuditFilterValues }) {
  const router = useRouter();
  const [values, setValues] = React.useState(initial);

  const set = (key: keyof AuditFilterValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((p) => ({ ...p, [key]: e.target.value }));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(values)) {
      if (v.trim()) q.set(k, v.trim());
    }
    router.push(`/admin/audit?${q.toString()}`);
  };

  const clear = () => {
    setValues(EMPTY);
    router.push("/admin/audit");
  };

  return (
    <form onSubmit={apply} className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-3">
      <Field label="Action" htmlFor="action">
        <Input value={values.action} maxLength={100} onChange={set("action")} placeholder="event.approve" />
      </Field>
      <Field label="Actor id" htmlFor="actorId">
        <Input value={values.actorId} maxLength={100} onChange={set("actorId")} />
      </Field>
      <Field label="Entity type" htmlFor="entityType">
        <Input value={values.entityType} maxLength={100} onChange={set("entityType")} placeholder="event" />
      </Field>
      <Field label="Entity id" htmlFor="entityId">
        <Input value={values.entityId} maxLength={100} onChange={set("entityId")} />
      </Field>
      <Field label="From" htmlFor="from">
        <Input type="date" value={values.from} onChange={set("from")} />
      </Field>
      <Field label="To" htmlFor="to">
        <Input type="date" value={values.to} onChange={set("to")} />
      </Field>
      <div className="flex items-end gap-2 sm:col-span-3">
        <Button type="submit">Apply</Button>
        <Button type="button" variant="secondary" onClick={clear}>
          Clear
        </Button>
      </div>
    </form>
  );
}
