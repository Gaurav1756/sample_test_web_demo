import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { PublicUser } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Member profile" };

type Props = { params: Promise<{ id: string }> };

/** Minimal public attendee profile (GET /users/:userId/public, §3). Bearer required. */
export default async function PublicUserPage({ params }: Props) {
  const { id } = await params;
  await requireSession();
  let user: PublicUser | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    user = await api.get<PublicUser>(`users/${id}/public`);
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
        <Link href="/home" className="font-semibold text-brand-800 hover:underline">
          ← Home
        </Link>
      </p>
      {failure || !user ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Profile unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <div className="mt-6 flex items-center gap-4">
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
              className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 font-display text-2xl"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="font-display text-3xl">{user.name}</h1>
            <p className="text-sm text-ink-soft">@{user.username}</p>
          </div>
        </div>
      )}
    </main>
  );
}
