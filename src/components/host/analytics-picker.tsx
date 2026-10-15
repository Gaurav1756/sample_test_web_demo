"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Community, EventCard } from "@/lib/api-types";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Scope + range picker driving the analytics overview query. */
export function AnalyticsPicker({
  scope,
  scopeId,
  range,
  events,
  communities,
}: {
  scope: "event" | "community";
  scopeId: string;
  range: string;
  events: EventCard[];
  communities: Community[];
}) {
  const router = useRouter();
  const [scopeValue, setScopeValue] = React.useState(scope);
  const [idValue, setIdValue] = React.useState(scopeId);
  const [rangeValue, setRangeValue] = React.useState(range);

  const options = scopeValue === "event" ? events : communities;

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ scope: scopeValue, range: rangeValue });
    if (idValue) q.set("scopeId", idValue);
    router.push(`/host/analytics?${q.toString()}`);
  };

  return (
    <form onSubmit={apply} className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-[160px_1fr_160px_auto]">
      <Field label="Scope" htmlFor="scope">
        <Select
          value={scopeValue}
          onChange={(e) => {
            setScopeValue(e.target.value as "event" | "community");
            setIdValue("");
          }}
        >
          <option value="event">Event</option>
          <option value="community">Community</option>
        </Select>
      </Field>
      <Field label={scopeValue === "event" ? "Event" : "Community"} htmlFor="scopeId">
        <Select value={idValue} onChange={(e) => setIdValue(e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {"title" in o ? o.title : o.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Range" htmlFor="range">
        <Select value={rangeValue} onChange={(e) => setRangeValue(e.target.value)}>
          <option value="7_days">7 days</option>
          <option value="30_days">30 days</option>
          <option value="3_months">3 months</option>
          <option value="12_months">12 months</option>
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit">View</Button>
      </div>
    </form>
  );
}
