import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type CommunityGroup, type CursorPage, type GroupMessage } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { HostChatThread } from "@/components/host/host-chat-thread";

export const metadata: Metadata = { title: "Host chat" };

type Props = {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function HostChatPage({ params, searchParams }: Props) {
  const { user } = await requireSession(["host", "super_admin"]);
  const { groupId } = await params;
  const communityId = first((await searchParams)?.community);

  let groupName = "Group chat";
  let messages: GroupMessage[] = [];
  let cursor: string | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    if (communityId) {
      const groups = toList<CommunityGroup>(
        await api.get<unknown>(`communities/${communityId}/groups`).catch(() => [] as unknown),
      );
      groupName = groups.find((g) => g.id === groupId)?.name ?? groupName;
    }
    const res = await api.get<CursorPage<GroupMessage>>(`groups/${groupId}/messages`, {
      query: { limit: 50 },
    });
    messages = res.data;
    cursor = res.nextCursor;
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
        <Link href="/host/chats" className="font-semibold text-brand-800 hover:underline">
          ← Chats
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Chat</h1>
      <div className="mt-6 max-w-3xl">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <HostChatThread
            groupId={groupId}
            groupName={groupName}
            initial={messages}
            initialCursor={cursor}
            userId={user.id}
          />
        )}
      </div>
    </main>
  );
}
