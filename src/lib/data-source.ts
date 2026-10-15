/**
 * Central data-source switch: sample (mock) data vs the live backend API.
 *
 * One variable controls everything — screens never branch on it:
 *
 *   PEGWIN_DATA_SOURCE=mock   → deterministic in-memory sample backend
 *   PEGWIN_DATA_SOURCE=api    → live backend via PEGWIN_API_BASE_URL
 *   (unset)                   → live backend (explicit opt-in to mock)
 *
 * Production rule: mock is refused in production with a loud error, and api
 * without PEGWIN_API_BASE_URL fails visibly. Neither path silently degrades
 * into the other.
 *
 * Pure module (no Next.js imports): unit-testable with an injected env.
 */
export type DataSourceKind = "mock" | "api";

/** Placeholder origin for the mock client. Never fetched; mockFetch intercepts. */
export const MOCK_BASE_URL = "http://mock.local/";

export function dataSourceKind(env: NodeJS.ProcessEnv = process.env): DataSourceKind {
  const raw = (env.PEGWIN_DATA_SOURCE ?? "").trim().toLowerCase();
  if (raw === "mock") {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "PEGWIN_DATA_SOURCE=mock is not allowed in production. Configure PEGWIN_API_BASE_URL instead.",
      );
    }
    return "mock";
  }
  return "api";
}

/**
 * Non-throwing check for UI chrome (badges, hints). Data paths must use
 * dataSourceKind() so misconfiguration fails visibly instead of rendering
 * the wrong source's UI.
 */
export function isMockData(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return dataSourceKind(env) === "mock";
  } catch {
    return false;
  }
}
