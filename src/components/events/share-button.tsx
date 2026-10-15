"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Device share sheet (Web Share API) with clipboard fallback.
 * No backend involved — shares the page URL only.
 */
export function ShareButton({ title, text }: { title: string; text: string }) {
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = window.location.href;
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        notify("Link copied to clipboard.");
      } else {
        notify("Copy the page URL from your address bar to share.");
      }
    } catch {
      // User dismissed the sheet — nothing to report.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" disabled={busy} onClick={share}>
      Share
    </Button>
  );
}
