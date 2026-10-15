import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { Page, User } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const saved = (await searchParams)?.saved === "1";

  let user: User | null = null;
  let attended: number | null = null;
  let savedCount: number | null = null;
  let communities: number | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    user = await api.get<User>("users/me");
    // Best-effort stat counts (Figma p137); shown only when the
    // backend reports a real total, otherwise omitted.
    const totalOf = async (path: string, query?: Record<string, string | number>) => {
      try {
        const res = await api.get<Page<unknown>>(path, query ? { query } : undefined);
        return typeof res.total === "number" ? res.total : null;
      } catch {
        return null;
      }
    };
    const [a, se, sc, c] = await Promise.all([
      totalOf("users/me/events", { filter: "attended", limit: 1 }),
      totalOf("users/me/saved-events", { when: "all", limit: 1 }),
      totalOf("users/me/saved-communities", { limit: 1 }),
      totalOf("users/me/communities", { limit: 1 }),
    ]);
    attended = a;
    savedCount = se !== null && sc !== null ? se + sc : (se ?? sc);
    communities = c;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="w-full max-w-3xl">
      <h1 className="font-display text-3xl">Profile</h1>
      {saved ? (
        <p className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Profile saved.
        </p>
      ) : null}
      <div className="mt-6">
        {failure || !user ? (
          <>
            <ErrorState title={failure?.title ?? "Profile unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-stone-200 p-6">
            <div className="flex items-center gap-4">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 font-display text-2xl font-bold text-brand-900"
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-display text-2xl">{user.name}</p>
                <p className="text-stone-600">@{user.username}</p>
              </div>
            </div>
            {user.bio ? <p className="mt-4 leading-relaxed">{user.bio}</p> : null}
            {attended !== null || savedCount !== null || communities !== null ? (
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-stone-50 px-2 py-3">
                  <dt className="text-xs text-stone-500">Attended</dt>
                  <dd className="font-display text-xl font-bold">{attended ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-stone-50 px-2 py-3">
                  <dt className="text-xs text-stone-500">Saved</dt>
                  <dd className="font-display text-xl font-bold">{savedCount ?? "—"}</dd>
                </div>
                <div className="rounded-lg bg-stone-50 px-2 py-3">
                  <dt className="text-xs text-stone-500">Communities</dt>
                  <dd className="font-display text-xl font-bold">{communities ?? "—"}</dd>
                </div>
              </dl>
            ) : null}
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {user.city ? (
                <div>
                  <dt className="text-stone-500">City</dt>
                  <dd className="font-medium">{user.city}</dd>
                </div>
              ) : null}
              {user.email ? (
                <div>
                  <dt className="text-stone-500">Email</dt>
                  <dd className="font-medium">{user.email}</dd>
                </div>
              ) : null}
              {user.phone ? (
                <div>
                  <dt className="text-stone-500">Phone</dt>
                  <dd className="font-medium">{user.phone}</dd>
                </div>
              ) : null}
              {user.locale ? (
                <div>
                  <dt className="text-stone-500">Language</dt>
                  <dd className="font-medium">{user.locale}</dd>
                </div>
              ) : null}
            </dl>
            {user.interests && user.interests.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {user.interests.map((i) => (
                  <span
                    key={i}
                    className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium"
                  >
                    {i}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/profile/edit" className="text-brand-800 hover:underline">
                Edit profile →
              </Link>
              <Link href="/profile/events?filter=attended" className="text-brand-800 hover:underline">
                My events →
              </Link>
              <Link href="/settings" className="text-brand-800 hover:underline">
                Settings →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
