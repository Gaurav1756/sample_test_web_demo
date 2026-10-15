import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type FlaggedHost } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { HostRow } from "@/components/admin/host-row";

export const metadata: Metadata = { title: "Flagged hosts" };

/** Enforcement for hosts with ≥3 cancellations or violations (§13). */
export default async function AdminHostsPage() {
  let hosts: FlaggedHost[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    hosts = toList<FlaggedHost>(await api.get<unknown>("admin/hosts/flagged"));
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Flagged hosts</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : hosts.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {hosts.map((host, i) => (
              <HostRow key={host.hostId ?? host.id ?? i} host={host} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No flagged hosts" body="Hosts with violations will appear here." />
        )}
      </div>
    </main>
  );
}
