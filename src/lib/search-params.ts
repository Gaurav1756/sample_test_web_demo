/**
 * Explore-page URL parameter parsing. Only documented GET /events filters
 * (API §4) are accepted; unknown or malformed values are dropped so the
 * backend never receives invented enums.
 */

export type ExploreMode = "online" | "offline";
export type ExploreEventType = "public" | "private" | "invite_only";
export type ExplorePricing = "free" | "paid" | "vip" | "hybrid";

export interface ExploreFilters {
  search?: string;
  city?: string;
  category?: string;
  mode?: ExploreMode;
  eventType?: ExploreEventType;
  pricingModel?: ExplorePricing;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: number;
  priceMax?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function nonEmpty(value: string | string[] | undefined, max = 100): string | undefined {
  const v = first(value)?.trim();
  if (!v) return undefined;
  return v.slice(0, max);
}

function oneOf<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | undefined {
  const v = first(value);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function validDate(value: string | string[] | undefined): string | undefined {
  const v = first(value)?.trim();
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

function validNumber(
  value: string | string[] | undefined,
  min: number,
  max: number,
): number | undefined {
  const v = first(value)?.trim();
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

/** Parse raw URL params into validated explore filters (page defaults to 1). */
export function parseExploreParams(raw: RawParams): ExploreFilters {
  return {
    search: nonEmpty(raw.search),
    city: nonEmpty(raw.city),
    category: nonEmpty(raw.category),
    mode: oneOf(raw.mode, ["online", "offline"]),
    eventType: oneOf(raw.eventType, ["public", "private", "invite_only"]),
    pricingModel: oneOf(raw.pricingModel, ["free", "paid", "vip", "hybrid"]),
    dateFrom: validDate(raw.dateFrom),
    dateTo: validDate(raw.dateTo),
    priceMin: validNumber(raw.priceMin, 0, Number.MAX_SAFE_INTEGER),
    priceMax: validNumber(raw.priceMax, 0, Number.MAX_SAFE_INTEGER),
    lat: validNumber(raw.lat, -90, 90),
    lng: validNumber(raw.lng, -180, 180),
    radiusKm: validNumber(raw.radiusKm, 5, 100),
    page: validNumber(raw.page, 1, 10000) ?? 1,
  };
}

/** Serialize filters back to a query string for pagination links. */
export function exploreQuery(filters: ExploreFilters): string {
  const q = new URLSearchParams();
  const set = (k: string, v: string | number | undefined) => {
    if (v !== undefined) q.set(k, String(v));
  };
  set("search", filters.search);
  set("city", filters.city);
  set("category", filters.category);
  set("mode", filters.mode);
  set("eventType", filters.eventType);
  set("pricingModel", filters.pricingModel);
  set("dateFrom", filters.dateFrom);
  set("dateTo", filters.dateTo);
  set("priceMin", filters.priceMin);
  set("priceMax", filters.priceMax);
  set("lat", filters.lat);
  set("lng", filters.lng);
  set("radiusKm", filters.radiusKm);
  if (filters.page > 1) set("page", filters.page);
  return q.toString();
}
