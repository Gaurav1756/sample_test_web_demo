"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** City + radius form for the nearby page (radius 5–100 km per §1a). */
export function NearbyForm({ city, radiusKm }: { city: string; radiusKm: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [cityValue, setCityValue] = React.useState(city);
  const [radiusValue, setRadiusValue] = React.useState(String(radiusKm));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams(params.toString());
    if (cityValue.trim()) q.set("city", cityValue.trim());
    else q.delete("city");
    q.set("radiusKm", radiusValue);
    q.delete("page");
    router.push(`/explore/map?${q.toString()}`);
  };

  return (
    <form onSubmit={apply} className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">City</span>
        <Input
          value={cityValue}
          onChange={(e) => setCityValue(e.target.value)}
          placeholder="City"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Radius</span>
        <Select value={radiusValue} onChange={(e) => setRadiusValue(e.target.value)}>
          {[5, 10, 25, 50, 100].map((r) => (
            <option key={r} value={r}>
              {r} km
            </option>
          ))}
        </Select>
      </label>
      <div className="flex items-end">
        <Button type="submit">Search</Button>
      </div>
    </form>
  );
}
