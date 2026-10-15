import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type CommunityGroup, type CursorPage, type GroupMessage } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ChatRefresh } from "@/components/communities/chat-refresh";

export const metadata: Metadata = { title: "Group chat" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ChatPage({ params, searchParams }: Props) {
  const { user } = await requireSession();
  const { id } = await params;
  const wantedGroup = first((await searchParams)?.group);

  let group: CommunityGroup | null = null;
  let messages: GroupMessage[] = [];
  let cursor: string | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    const groups = toList<CommunityGroup>(await api.get<unknown>(`communities/${id}/groups`));
    group = groups.find((g) => g.id === wantedGroup) ?? groups[0] ?? null;
    if (!group) {
      missing = true;
    } else {
      const res = await api.get<CursorPage<GroupMessage>>(`groups/${group.id}/messages`, {
        query: { limit: 50 },
      });
      messages = res.data;
      cursor = res.nextCursor;
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      missing = true;
    } else {
      const g =
        e instanceof ApiError
          ? e.guidance()
          : { message: "Something went wrong.", recovery: "Please try again." };
      failure = { title: g.message, body: g.recovery };
    }
  }

  if (missing) notFound();

  return (
    <main>
      <p className="text-sm">
        <Link href={`/communities/${id}`} className="font-semibold text-brand-800 hover:underline">
          ← Back to community
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Chat</h1>
      <div className="mt-6">
        {failure || !group ? (
          <>
            <ErrorState title={failure?.title ?? "Chat unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <ChatRefresh
            groupId={group.id}
            groupName={group.name ?? "Group chat"}
            initial={messages}
            initialCursor={cursor}
            userId={user.id}
          />
        )}
      </div>
    </main>
  );
}
