import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type FlaggedHost } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { HostRow } from "@/components/admin/host-row";

export const metadata: Metadata = { title: "Hosts" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Host monitoring (§11): every host, or only flagged ones (layout gates role). */
export default async function AdminHostsPage({ searchParams }: Props) {
  const tab = first((await searchParams)?.tab) === "all" ? "all" : "flagged";

  let hosts: FlaggedHost[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    hosts = toList<FlaggedHost>(
      await api.get<unknown>(tab === "all" ? "admin/hosts" : "admin/hosts/flagged"),
    );
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Hosts</h1>
      <div className="mt-4">
        <Tabs
          label="Host list"
          items={[
            { label: "Flagged", href: "/admin/hosts?tab=flagged", active: tab === "flagged" },
            { label: "All hosts", href: "/admin/hosts?tab=all", active: tab === "all" },
          ]}
        />
      </div>
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
        ) : tab === "flagged" ? (
          <EmptyState title="No flagged hosts" body="Hosts with violations will appear here." />
        ) : (
          <EmptyState title="No hosts yet" body="Hosts appear here once they register." />
        )}
      </div>
    </main>
  );
}
