"use client";

import * as React from "react";
import { useActionState } from "react";
import { resendOtp, verifyOtp } from "@/lib/auth-actions";
import type { OtpPurpose } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

const INITIAL = { ok: false as const };

/** Client-side resend throttle. The backend enforces its own cooldown (OTP_COOLDOWN 429). */
const RESEND_COOLDOWN_SEC = 30;

export function VerifyOtpForm({
  purpose,
  phone,
  email,
  next,
}: {
  purpose: OtpPurpose;
  phone: string;
  email: string;
  next: string;
}) {
  const [state, action, pending] = useActionState(verifyOtp, INITIAL);
  const [resendState, resendAction, resendPending] = useActionState(resendOtp, INITIAL);
  const contact = phone || email;
  // A code was just sent to reach this page, so the cooldown starts full.
  const [cooldown, setCooldown] = React.useState(RESEND_COOLDOWN_SEC);
  const [lastResend, setLastResend] = React.useState(resendState);
  // A completed resend restarts the cooldown (render-phase adjustment).
  if (resendState !== lastResend) {
    setLastResend(resendState);
    if (resendState.ok) setCooldown(RESEND_COOLDOWN_SEC);
  }

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <div>
      <h1 className="font-display text-2xl">Enter your code</h1>
      <p className="mt-1 text-sm text-stone-600">
        We sent a 6-digit code to {contact || "your phone or email"}. Didn&apos;t get it? Request
        a new one below.
      </p>
      <form action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="purpose" value={purpose} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <Field label="One-time code" htmlFor="otp" required>
          <Input
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
          />
        </Field>
        {state.message ? (
          <InlineError message={state.message} recovery={state.recovery} />
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Verifying…" : "Verify"}
        </Button>
      </form>
      <form action={resendAction} className="mt-3">
        <input type="hidden" name="purpose" value={purpose} />
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="email" value={email} />
        {resendState.message ? (
          <div className="mb-3">
            {resendState.ok ? (
              <p className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
                {resendState.message}
              </p>
            ) : (
              <InlineError message={resendState.message} recovery={resendState.recovery} />
            )}
          </div>
        ) : null}
        <Button
          type="submit"
          variant="secondary"
          disabled={resendPending || cooldown > 0}
          className="w-full"
        >
          {resendPending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
      </form>
    </div>
  );
}
