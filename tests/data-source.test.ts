import { describe, expect, it } from "vitest";
import { dataSourceKind, isMockData, MOCK_BASE_URL } from "../src/lib/data-source";

function env(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as unknown as NodeJS.ProcessEnv;
}

describe("data source switch", () => {
  it("selects mock only when explicitly requested", () => {
    expect(dataSourceKind(env({ PEGWIN_DATA_SOURCE: "mock" }))).toBe("mock");
    expect(dataSourceKind(env({ PEGWIN_DATA_SOURCE: "Mock" }))).toBe("mock");
  });

  it("defaults to api when unset, blank or api", () => {
    expect(dataSourceKind(env({}))).toBe("api");
    expect(dataSourceKind(env({ PEGWIN_DATA_SOURCE: "" }))).toBe("api");
    expect(dataSourceKind(env({ PEGWIN_DATA_SOURCE: "api" }))).toBe("api");
  });

  it("refuses mock in production with a loud error (no silent fallback)", () => {
    expect(() => dataSourceKind(env({ PEGWIN_DATA_SOURCE: "mock", NODE_ENV: "production" }))).toThrow(
      /not allowed in production/,
    );
  });

  it("exposes a non-throwing UI check", () => {
    expect(isMockData(env({ PEGWIN_DATA_SOURCE: "mock" }))).toBe(true);
    expect(isMockData(env({}))).toBe(false);
    expect(isMockData(env({ PEGWIN_DATA_SOURCE: "mock", NODE_ENV: "production" }))).toBe(false);
  });

  it("provides a placeholder mock base URL", () => {
    expect(MOCK_BASE_URL).toMatch(/^https?:\/\//);
  });
});
