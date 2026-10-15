import { describe, expect, it } from "vitest";
import { toList } from "../src/lib/api-types";

/**
 * toList tolerates the list envelopes the spec leaves unstated (CQ-08/24):
 * bare arrays, { data: [...] }, and { items: [...] }.
 */
describe("toList", () => {
  it("passes through a bare array", () => {
    expect(toList([{ id: "a" }])).toEqual([{ id: "a" }]);
  });

  it("unwraps { data: [...] }", () => {
    expect(toList({ data: [{ id: "a" }], nextCursor: null })).toEqual([{ id: "a" }]);
  });

  it("unwraps { items: [...] }", () => {
    expect(toList({ items: [{ id: "a" }], total: 1 })).toEqual([{ id: "a" }]);
  });

  it("returns [] for null, undefined, and non-list shapes", () => {
    expect(toList(null)).toEqual([]);
    expect(toList(undefined)).toEqual([]);
    expect(toList({ id: "a" })).toEqual([]);
    expect(toList("nope")).toEqual([]);
  });
});
