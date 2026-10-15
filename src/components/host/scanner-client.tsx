"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { bff } from "@/lib/bff";
import { ApiError } from "@/lib/api-errors";
import { newIdempotencyKey } from "@/lib/api-client";
import type {
  CheckinRecord,
  CheckinResult,
  CheckinSyncResult,
  EventCard,
  ValidationData,
} from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { CheckinsTable } from "./checkins-table";

interface QueuedScan {
  ticketCode: string;
  scannedAt: string;
  deviceId: string;
}

const bundleKey = (eventId: string) => `pw_bundle_${eventId}`;
const queueKey = (eventId: string) => `pw_queue_${eventId}`;
const DEVICE_KEY = "pw_device_id";

function deviceId(): string {
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newIdempotencyKey();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
  } catch {
    id = "web-scanner";
  }
  return id ?? "web-scanner";
}

function loadQueue(eventId: string | null): QueuedScan[] {
  if (!eventId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(queueKey(eventId));
    return raw ? (JSON.parse(raw) as QueuedScan[]) : [];
  } catch {
    return [];
  }
}

function loadBundleAt(eventId: string | null): string | null {
  if (!eventId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(bundleKey(eventId));
    return raw ? ((JSON.parse(raw) as ValidationData).generatedAt ?? "downloaded") : null;
  } catch {
    return null;
  }
}

function loadBundle(eventId: string | null): ValidationData | null {
  if (!eventId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(bundleKey(eventId));
    return raw ? (JSON.parse(raw) as ValidationData) : null;
  } catch {
    return null;
  }
}

/**
 * Gate scanner: online verify (camera or manual), offline bundle + queued
 * batch sync, recent check-ins (§10). Single check-in is enforced
 * server-side (atomic online, first-wins on sync); duplicate offline
 * acceptance across devices is an acknowledged residual risk (BRD §5.6).
 */
export function ScannerClient({
  events,
  eventId,
  recent,
}: {
  events: EventCard[];
  eventId: string | null;
  recent: CheckinRecord[];
}) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Lazy initializers (the parent remounts per event via key).
  const [online, setOnline] = React.useState(
    () => typeof window === "undefined" || window.navigator.onLine,
  );
  const [queue, setQueue] = React.useState<QueuedScan[]>(() => loadQueue(eventId));
  const [bundleAt, setBundleAt] = React.useState<string | null>(() => loadBundleAt(eventId));
  const [cameraOn, setCameraOn] = React.useState(false);
  const cameraRef = React.useRef<{ stop: () => Promise<void> } | null>(null);

  React.useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // Stop the camera on unmount.
  React.useEffect(
    () => () => {
      cameraRef.current?.stop().catch(() => null);
    },
    [],
  );

  // Mirror of busy for the camera callback (avoids double-fires on one QR).
  const busyRef = React.useRef(false);
  React.useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const pickEvent = (id: string) => {
    router.push(id ? `/host/scanner?eventId=${id}` : "/host/scanner");
  };

  const verify = async (ticketCode: string) => {
    const code12 = ticketCode.trim().toUpperCase();
    if (!eventId) {
      setError("Choose an event first.");
      return;
    }
    if (!/^[A-Z0-9]{12}$/.test(code12)) {
      setError("Ticket codes are 12 letters/digits.");
      return;
    }
    setError(null);
    setResult(null);
    if (!online) {
      queueOffline(code12);
      return;
    }
    setBusy(true);
    try {
      const res = await bff<CheckinResult>("checkins", {
        method: "POST",
        body: { ticketCode: code12, scannedAt: new Date().toISOString() },
        idempotencyKey: newIdempotencyKey(),
      });
      setResult({ ok: true, message: `Checked in at ${formatDateTime(res.checkedInAt)}.` });
      setCode("");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === "BACKEND_UNREACHABLE") {
        queueOffline(code12);
        return;
      }
      setResult(null);
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const queueOffline = (ticketCode: string) => {
    if (!eventId) return;
    const current = loadQueue(eventId);
    if (current.some((q) => q.ticketCode === ticketCode)) {
      setCode("");
      setResult({ ok: false, message: "Already queued for sync." });
      return;
    }
    const bundle = loadBundle(eventId);
    if (bundle && !bundle.tickets.some((t) => t.ticketCode === ticketCode)) {
      setError("Ticket not found in the offline bundle.");
      return;
    }
    const entry: QueuedScan = {
      ticketCode,
      scannedAt: new Date().toISOString(),
      deviceId: deviceId(),
    };
    const next = [...current, entry];
    try {
      window.localStorage.setItem(queueKey(eventId), JSON.stringify(next));
    } catch {
      setError("Offline storage is unavailable.");
      return;
    }
    setQueue(next);
    setCode("");
    setResult({ ok: true, message: "Saved offline. Sync when reconnected (first-wins)." });
  };

  const downloadBundle = async () => {
    if (!eventId) return;
    setError(null);
    setBusy(true);
    try {
      const bundle = await bff<ValidationData>(`events/${eventId}/validation-data`);
      window.localStorage.setItem(bundleKey(eventId), JSON.stringify(bundle));
      setBundleAt(bundle.generatedAt);
      setResult({ ok: true, message: `Offline bundle ready (${bundle.tickets.length} tickets).` });
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const syncQueue = async () => {
    if (!eventId) return;
    const pending = loadQueue(eventId);
    if (pending.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      // Batches of ≤500 (§10).
      for (let i = 0; i < pending.length; i += 500) {
        const batch = pending.slice(i, i + 500);
        const res = await bff<CheckinSyncResult>("checkins/sync", {
          method: "POST",
          body: { scans: batch },
          idempotencyKey: newIdempotencyKey(),
        });
        const accepted = res.results.filter((r) => r.result === "checked_in").length;
        const rest = loadQueue(eventId).filter(
          (q) => !batch.some((b) => b.ticketCode === q.ticketCode && b.scannedAt === q.scannedAt),
        );
        window.localStorage.setItem(queueKey(eventId), JSON.stringify(rest));
        setQueue(rest);
        setResult({ ok: true, message: `Synced ${accepted} of ${batch.length} scans (first-wins).` });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message || e.guidance().message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      await cameraRef.current?.stop().catch(() => null);
      cameraRef.current = null;
      setCameraOn(false);
      return;
    }
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("pegwin-qr-reader");
      cameraRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (busyRef.current) return;
          void verify(decoded);
        },
        () => null,
      );
      setCameraOn(true);
    } catch {
      setError("Camera unavailable. Use manual entry instead.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!online ? (
        <p role="alert" className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
          Offline — scans will be queued for sync.
        </p>
      ) : null}

      <Field label="Event" htmlFor="event">
        <Select value={eventId ?? ""} onChange={(e) => pickEvent(e.target.value)}>
          <option value="">Choose an event…</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
      </Field>

      {eventId ? (
        <>
          <section aria-label="Verify ticket" className="flex flex-col gap-3">
            <div id="pegwin-qr-reader" className={cameraOn ? "max-w-sm overflow-hidden rounded-xl" : "hidden"} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={toggleCamera}>
                {cameraOn ? "Stop camera" : "Start camera"}
              </Button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verify(code);
              }}
              className="flex max-w-md gap-2"
            >
              <div className="flex-1">
                <Field label="Ticket code" htmlFor="code">
                  <Input
                    value={code}
                    maxLength={12}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="12-character code"
                    className="font-mono"
                  />
                </Field>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={busy}>
                  {busy ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </form>
            {result ? (
              <p
                role="status"
                className={`max-w-md rounded-lg px-4 py-3 text-sm font-semibold ${
                  result.ok ? "bg-brand-50 text-brand-900" : "bg-red-50 text-red-900"
                }`}
              >
                {result.message}
              </p>
            ) : null}
            {error ? <InlineError message={error} /> : null}
          </section>

          <section aria-label="Offline" className="max-w-md rounded-xl border border-stone-200 p-4">
            <h2 className="font-display text-lg">Offline mode</h2>
            <p className="mt-1 text-sm text-stone-600">
              Bundle: {bundleAt ? `downloaded (${bundleAt === "downloaded" ? "cached" : formatDateTime(bundleAt)})` : "none"} ·
              Queued scans: {queue.length}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" disabled={busy} onClick={downloadBundle}>
                Download bundle
              </Button>
              <Button size="sm" disabled={busy || queue.length === 0 || !online} onClick={syncQueue}>
                Sync {queue.length > 0 ? `(${queue.length})` : ""}
              </Button>
            </div>
          </section>

          <section aria-label="Recent check-ins">
            <h2 className="font-display text-xl">Recent check-ins</h2>
            <div className="mt-3">
              {recent.length > 0 ? (
                <CheckinsTable rows={recent} />
              ) : (
                <p className="text-sm text-stone-500">No check-ins recorded yet.</p>
              )}
            </div>
          </section>
        </>
      ) : (
        <p className="text-sm text-stone-500">Choose an event to start scanning.</p>
      )}
    </div>
  );
}
