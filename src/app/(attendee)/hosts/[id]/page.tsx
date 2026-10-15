import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { PublicHost } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Host profile" };

type Props = { params: Promise<{ id: string }> };

/** Public host profile (GET /hosts/:hostId, §4). Optional bearer — public page. */
export default async function PublicHostPage({ params }: Props) {
  const { id } = await params;
  let host: PublicHost | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    host = await api.get<PublicHost>(`hosts/${id}`);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm">
        <Link href="/explore" className="font-semibold text-brand-800 hover:underline">
          ← Explore events
        </Link>
      </p>
      {failure || !host ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Host unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <div className="mt-6">
          <div className="flex items-center gap-4">
            {host.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={host.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 font-display text-2xl"
              >
                {host.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <h1 className="font-display text-3xl">{host.name}</h1>
              <p className="text-sm text-ink-soft">
                {typeof host.eventsHostedCount === "number"
                  ? `${host.eventsHostedCount} events hosted`
                  : "Host"}
                {host.avgRating != null ? ` · ★ ${host.avgRating.toFixed(1)}` : ""}
              </p>
            </div>
          </div>
          {host.bio ? <p className="mt-4 text-sm">{host.bio}</p> : null}
          {host.communities && host.communities.length > 0 ? (
            <div className="mt-6">
              <h2 className="font-display text-xl">Communities</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {host.communities.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/communities/${c.id}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
