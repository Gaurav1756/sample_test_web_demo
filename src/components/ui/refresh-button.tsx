"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Re-runs the current server-rendered route (used for error retries). */
export function RefreshButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  return (
    <Button variant="secondary" onClick={() => router.refresh()}>
      {label}
    </Button>
  );
}
