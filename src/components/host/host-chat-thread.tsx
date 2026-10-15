"use client";

import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import type { GroupMessage } from "@/lib/api-types";
import { ChatThread } from "@/components/communities/chat-thread";

/** Host thread: remove messages + post announcements (§11). */
export function HostChatThread({
  groupId,
  groupName,
  initial,
  initialCursor,
  userId,
}: {
  groupId: string;
  groupName: string;
  initial: GroupMessage[];
  initialCursor: string | null;
  userId: string;
}) {
  const router = useRouter();

  return (
    <ChatThread
      groupId={groupId}
      groupName={groupName}
      initial={initial}
      initialCursor={initialCursor}
      userId={userId}
      onRefresh={() => router.refresh()}
      onRemoveMessage={async (messageId) => {
        await bff(`groups/${groupId}/messages/${messageId}`, { method: "DELETE" });
      }}
      onAnnounce={async (title, text) => {
        return bff<GroupMessage>(`groups/${groupId}/messages`, {
          method: "POST",
          body: { type: "announcement", text, ...(title ? { title } : {}) },
        });
      }}
      onSendMedia={async (type, mediaUrl, text) => {
        return bff<GroupMessage>(`groups/${groupId}/messages`, {
          method: "POST",
          body: { type, mediaUrl, ...(text ? { text } : {}) },
        });
      }}
    />
  );
}
