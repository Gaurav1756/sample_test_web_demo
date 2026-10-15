"use client";

import { useRouter } from "next/navigation";
import type { GroupMessage } from "@/lib/api-types";
import { ChatThread } from "./chat-thread";

/** Wires router refresh into the chat thread. */
export function ChatRefresh({
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
    />
  );
}
