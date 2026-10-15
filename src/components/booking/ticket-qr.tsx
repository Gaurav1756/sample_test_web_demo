"use client";

import { QRCodeSVG } from "qrcode.react";

/** Entry QR rendered from the backend qrPayload (§7). */
export function TicketQr({ payload }: { payload: string }) {
  return (
    <div className="inline-block rounded-xl border border-stone-200 bg-white p-4">
      <QRCodeSVG value={payload} size={220} role="img" aria-label="Entry QR code" />
    </div>
  );
}
