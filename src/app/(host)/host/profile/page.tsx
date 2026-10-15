import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { HostVerification, PublicHost, User } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Host profile" };

/** Public host card as attendees see it, plus account shortcuts. */
export default async function HostProfilePage() {
  const { user } = await requireSession(["host", "super_admin"]);

  let host: PublicHost | null = null;
  let me: User | null = null;
  let verification: HostVerification | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [hostRes, meRes, verRes] = await Promise.all([
      api.get<PublicHost>(`hosts/${user.id}`),
      api.get<User>("users/me"),
      api.get<HostVerification>("hosts/me/verification").catch(() => null),
    ]);
    host = hostRes;
    me = meRes;
    verification = verRes;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Host profile</h1>
      <div className="mt-6 max-w-2xl">
        {failure || !host ? (
          <>
            <ErrorState title={failure?.title ?? "Profile unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-stone-200 p-6">
            <div className="flex items-center gap-4">
              {host.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={host.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 font-display text-2xl font-bold text-brand-900"
                >
                  {host.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-display text-2xl">{host.name}</p>
                <p className="text-stone-600">
                  {host.eventsHostedCount ?? 0} events hosted
                  {host.avgRating != null ? ` · ★ ${host.avgRating.toFixed(1)}` : ""}
                </p>
              </div>
            </div>
            {host.bio ? <p className="mt-4 leading-relaxed">{host.bio}</p> : null}
            {verification ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-stone-600">Identity</span>
                <StatusBadge status={verification.identity?.status ?? "pending"} />
                <span className="ml-2 text-stone-600">Payout account</span>
                <StatusBadge status={verification.payoutAccount?.status ?? "pending"} />
                <Link
                  href="/host/verifications"
                  className="ml-1 font-semibold text-brand-800 hover:underline"
                >
                  Details →
                </Link>
              </div>
            ) : null}
            {host.communities && host.communities.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-stone-600">Communities</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {host.communities.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/communities/${c.id}`}
                        className="inline-block rounded-full bg-stone-100 px-3 py-1 text-sm font-medium hover:bg-stone-200"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
              <Link href="/profile/edit" className="text-brand-800 hover:underline">
                Edit profile →
              </Link>
              <Link href="/settings" className="text-brand-800 hover:underline">
                Settings →
              </Link>
              <Link href="/host/finance" className="text-brand-800 hover:underline">
                Finance →
              </Link>
              <Link href="/host/analytics" className="text-brand-800 hover:underline">
                Analytics →
              </Link>
              {me ? <span className="text-stone-400">Signed in as {me.email ?? me.phone ?? me.name}</span> : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
