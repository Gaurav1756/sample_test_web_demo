import { describe, expect, it } from "vitest";
import { exploreQuery, parseExploreParams } from "../src/lib/search-params";

describe("parseExploreParams", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseExploreParams({})).toEqual({ page: 1 });
  });

  it("accepts documented filters", () => {
    const f = parseExploreParams({
      search: "music",
      city: "Bengaluru",
      category: "Music",
      mode: "online",
      eventType: "public",
      pricingModel: "paid",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      priceMin: "0",
      priceMax: "50000",
      lat: "12.97",
      lng: "77.59",
      radiusKm: "25",
      page: "2",
    });
    expect(f.search).toBe("music");
    expect(f.city).toBe("Bengaluru");
    expect(f.mode).toBe("online");
    expect(f.eventType).toBe("public");
    expect(f.pricingModel).toBe("paid");
    expect(f.dateFrom).toContain("2026-08-01");
    expect(f.priceMin).toBe(0);
    expect(f.priceMax).toBe(50000);
    expect(f.lat).toBeCloseTo(12.97);
    expect(f.lng).toBeCloseTo(77.59);
    expect(f.radiusKm).toBe(25);
    expect(f.page).toBe(2);
  });

  it("drops undocumented enum values instead of forwarding them", () => {
    const f = parseExploreParams({ mode: "hybrid", eventType: "secret", pricingModel: "freebie" });
    expect(f.mode).toBeUndefined();
    expect(f.eventType).toBeUndefined();
    expect(f.pricingModel).toBeUndefined();
  });

  it("drops malformed numbers and dates", () => {
    const f = parseExploreParams({
      dateFrom: "not-a-date",
      priceMin: "-5",
      lat: "999",
      radiusKm: "500",
      page: "0",
    });
    expect(f.dateFrom).toBeUndefined();
    expect(f.priceMin).toBeUndefined();
    expect(f.lat).toBeUndefined();
    expect(f.radiusKm).toBeUndefined();
    expect(f.page).toBe(1);
  });

  it("trims and bounds free text", () => {
    expect(parseExploreParams({ search: "  jazz  " }).search).toBe("jazz");
    expect(parseExploreParams({ search: "   " }).search).toBeUndefined();
    expect(parseExploreParams({ city: "x".repeat(500) }).city?.length).toBe(100);
  });
});

describe("exploreQuery", () => {
  it("round-trips filters for pagination links", () => {
    const q = exploreQuery({ search: "jazz", city: undefined, page: 3 });
    expect(q).toContain("search=jazz");
    expect(q).toContain("page=3");
    expect(q).not.toContain("city");
  });

  it("omits page 1", () => {
    expect(exploreQuery({ page: 1 })).toBe("");
  });
});
