"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ExploreFilters } from "@/lib/search-params";

/**
 * Discovery filter form. Applies filters by updating URL search params,
 * which the server page reads for GET /events. Categories come from
 * GET /meta/categories; enums are the documented §4 values.
 */
export function ExploreFilters({
  initial,
  categories,
}: {
  initial: ExploreFilters;
  categories: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = React.useState(initial.search ?? "");
  const [city, setCity] = React.useState(initial.city ?? "");
  const [category, setCategory] = React.useState(initial.category ?? "");
  const [mode, setMode] = React.useState(initial.mode ?? "");
  const [eventType, setEventType] = React.useState(initial.eventType ?? "");
  const [pricingModel, setPricingModel] = React.useState(initial.pricingModel ?? "");
  const [dateFrom, setDateFrom] = React.useState(
    initial.dateFrom ? initial.dateFrom.slice(0, 10) : "",
  );
  const [dateTo, setDateTo] = React.useState(initial.dateTo ? initial.dateTo.slice(0, 10) : "");
  const [priceMin, setPriceMin] = React.useState(
    initial.priceMin !== undefined ? String(initial.priceMin / 100) : "",
  );
  const [priceMax, setPriceMax] = React.useState(
    initial.priceMax !== undefined ? String(initial.priceMax / 100) : "",
  );

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams(params.toString());
    const set = (k: string, v: string) => {
      if (v.trim()) q.set(k, v.trim());
      else q.delete(k);
    };
    set("search", search);
    set("city", city);
    set("category", category);
    set("mode", mode);
    set("eventType", eventType);
    set("pricingModel", pricingModel);
    set("dateFrom", dateFrom);
    set("dateTo", dateTo);
    // Backend expects paise (§4b); the form works in rupees.
    const minPaise = priceMin.trim() === "" ? "" : String(Math.round(Number(priceMin) * 100));
    const maxPaise = priceMax.trim() === "" ? "" : String(Math.round(Number(priceMax) * 100));
    set("priceMin", minPaise === "NaN" ? "" : minPaise);
    set("priceMax", maxPaise === "NaN" ? "" : maxPaise);
    q.delete("page");
    router.push(`/explore?${q.toString()}`);
  };

  const clear = () => {
    setSearch("");
    setCity("");
    setCategory("");
    setMode("");
    setEventType("");
    setPricingModel("");
    setDateFrom("");
    setDateTo("");
    setPriceMin("");
    setPriceMax("");
    router.push("/explore");
  };

  return (
    <form
      onSubmit={apply}
      className="rounded-[1.75rem] border border-stone-200/70 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Search</span>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Event name or keyword"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">City</span>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Category</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Mode</span>
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">Online + in-person</option>
            <option value="online">Online</option>
            <option value="offline">In-person</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Visibility</span>
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">All events</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite_only">Invite only</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Pricing</span>
          <Select value={pricingModel} onChange={(e) => setPricingModel(e.target.value)}>
            <option value="">Any price</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="vip">VIP</option>
            <option value="hybrid">Hybrid</option>
          </Select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">From</span>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">To</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Min price (₹)</span>
          <Input
            type="number"
            min={0}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Max price (₹)</span>
          <Input
            type="number"
            min={0}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="Any"
          />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
          <Button type="submit">Apply</Button>
          <Button type="button" variant="secondary" onClick={clear}>
            Clear
          </Button>
        </div>
      </div>
    </form>
  );
}
