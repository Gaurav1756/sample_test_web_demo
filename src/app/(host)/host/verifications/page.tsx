import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { HostVerification } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Verifications" };

/** Identity + payout-account trust status (§9a, TBD draft — honest states). */
export default async function VerificationsPage() {
  await requireSession(["host", "super_admin"]);

  let verification: HostVerification | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    verification = await api.get<HostVerification>("hosts/me/verification");
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Verifications</h1>
      <div className="mt-6 max-w-2xl">
        {failure || !verification ? (
          <>
            <ErrorState title={failure?.title ?? "Status unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <ul className="flex flex-col gap-3">
            <li className="rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg">Identity</h2>
                <StatusBadge status={verification.identity?.status ?? "pending"} />
              </div>
              {verification.identity?.name ? (
                <p className="mt-1 text-sm text-stone-600">{verification.identity.name}</p>
              ) : null}
              {verification.identity?.verifiedAt ? (
                <p className="mt-1 text-sm text-stone-500">
                  Verified {formatDateTime(verification.identity.verifiedAt)}
                </p>
              ) : null}
            </li>
            <li className="rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg">Payout account</h2>
                <StatusBadge status={verification.payoutAccount?.status ?? "pending"} />
              </div>
              {verification.payoutAccount?.bankName ? (
                <p className="mt-1 text-sm text-stone-600">
                  {verification.payoutAccount.bankName} ···· {verification.payoutAccount.last4} ·{" "}
                  {verification.payoutAccount.holder}
                </p>
              ) : (
                <p className="mt-1 text-sm text-stone-600">
                  Connect an account from Finance to get verified.
                </p>
              )}
            </li>
            {verification.hosting ? (
              <li className="rounded-xl border border-stone-200 p-5">
                <h2 className="font-display text-lg">Hosting</h2>
                <p className="mt-1 text-sm text-stone-600">
                  {verification.hosting.freeEvents ?? 0} free events ·{" "}
                  {verification.hosting.paidEvents ?? 0} paid events
                  {verification.hosting.communityHosting ? " · community hosting enabled" : ""}
                </p>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </main>
  );
}
