"use client";

import * as React from "react";
import { formatCountdown, secondsUntil } from "@/lib/format";

/** Live countdown to a hold's expiry. Expiry itself is enforced server-side. */
export function HoldCountdown({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = React.useState(() => secondsUntil(expiresAt));
  const fired = React.useRef(false);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      const s = secondsUntil(expiresAt);
      setLeft(s);
      if (s <= 0 && !fired.current) {
        fired.current = true;
        onExpire();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, onExpire]);

  return (
    <p
      role="timer"
      aria-live={left <= 60 ? "assertive" : "off"}
      className={`rounded-lg px-3 py-2 text-center text-sm font-bold ${
        left <= 60 ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900"
      }`}
    >
      {left > 0 ? `Tickets held for ${formatCountdown(left)}` : "Hold expired"}
    </p>
  );
}
