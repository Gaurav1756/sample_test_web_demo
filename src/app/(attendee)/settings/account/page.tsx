import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type User } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { AccountSettingsForm } from "@/components/profile/account-settings-form";
import { BlockedCommunities } from "@/components/profile/blocked-communities";

export const metadata: Metadata = { title: "Account & privacy" };

export default async function AccountSettingsPage() {
  await requireSession();

  let user: User | null = null;
  let blocked: Array<{ id: string; name: string }> = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    user = await api.get<User>("users/me");
    blocked = await api
      .get<unknown>("users/me/blocked-communities")
      .then(toList<{ id: string; name: string }>)
      .catch(() => []);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm">
        <Link href="/settings" className="font-semibold text-brand-800 hover:underline">
          ← Settings
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Account & privacy</h1>
      <div className="mt-6">
        {failure || !user ? (
          <>
            <ErrorState title={failure?.title ?? "Settings unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-10">
            <AccountSettingsForm user={user} />
            <section>
              <h2 className="font-display text-xl">Password</h2>
              <p className="mt-2 text-sm">
                <Link
                  href="/forgot-password"
                  className="font-semibold text-brand-800 hover:underline"
                >
                  Change password
                </Link>{" "}
                via an OTP to your registered email or phone.
              </p>
            </section>
            <section>
              <h2 className="font-display text-xl">Blocked communities</h2>
              <div className="mt-3">
                <BlockedCommunities initial={blocked} />
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
