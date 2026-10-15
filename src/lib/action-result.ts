import { ApiError } from "./api-errors";

/** Result shape for form server actions. */
export interface ActionResult {
  ok: boolean;
  message?: string;
  recovery?: string;
}

/** Map unknown action errors to user-facing results (backend message first). */
export function actionFailed(e: unknown): ActionResult {
  if (e instanceof ApiError) {
    const g = e.guidance();
    return { ok: false, message: e.message || g.message, recovery: g.recovery };
  }
  return { ok: false, message: "Something went wrong.", recovery: "Please try again." };
}
