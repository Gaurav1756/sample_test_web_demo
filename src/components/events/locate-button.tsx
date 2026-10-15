"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Fill lat/lng from the browser geolocation API (user gesture required). */
export function LocateButton() {
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const [busy, setBusy] = React.useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      notify("Geolocation is not available in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const q = new URLSearchParams(params.toString());
        q.set("lat", String(pos.coords.latitude));
        q.set("lng", String(pos.coords.longitude));
        q.delete("page");
        router.push(`/explore/map?${q.toString()}`);
      },
      () => {
        setBusy(false);
        notify("Location permission was denied. Enter a city instead.");
      },
      { timeout: 10000 },
    );
  };

  return (
    <Button type="button" variant="secondary" onClick={locate} disabled={busy}>
      {busy ? "Locating…" : "Use my location"}
    </Button>
  );
}
