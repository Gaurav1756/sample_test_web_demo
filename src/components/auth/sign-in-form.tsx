"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, startLoginOtp } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ContactFields } from "./fields";

const INITIAL = { ok: false as const };

export function SignInForm({ next, resetDone, demo }: { next: string; resetDone: boolean; demo?: boolean }) {
  const [passwordState, passwordAction, passwordPending] = useActionState(signIn, INITIAL);
  const [otpState, otpAction, otpPending] = useActionState(startLoginOtp, INITIAL);
  const pending = passwordPending || otpPending;

  return (
    <div>
      <h1 className="font-display text-2xl">Welcome back</h1>
      <p className="mt-1 text-sm text-stone-600">
        Sign in with your password, or get a one-time code.
      </p>
      {resetDone ? (
        <p className="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {demo ? (
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
          <p className="font-semibold text-stone-900">Sample data mode — demo accounts</p>
          <ul className="mt-2 flex flex-col gap-1">
            <li><span className="font-mono text-xs">attendee@pegwin.in</span> · attendee</li>
            <li><span className="font-mono text-xs">host@pegwin.in</span> · host</li>
            <li><span className="font-mono text-xs">staff@pegwin.in</span> · event staff (scanner)</li>
            <li><span className="font-mono text-xs">admin@pegwin.in</span> · super admin</li>
          </ul>
          <p className="mt-2">Password <span className="font-mono text-xs">demo1234</span> · OTP code <span className="font-mono text-xs">123456</span></p>
        </div>
      ) : null}
      <form action={passwordAction} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <ContactFields />
        <Field label="Password" htmlFor="password">
          <Input name="password" type="password" autoComplete="current-password" />
        </Field>
        {passwordState.message ? (
          <InlineError message={passwordState.message} recovery={passwordState.recovery} />
        ) : null}
        {otpState.message ? (
          <InlineError message={otpState.message} recovery={otpState.recovery} />
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {passwordPending ? "Signing in…" : "Sign in"}
        </Button>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending}
          className="w-full"
          formAction={otpAction}
        >
          {otpPending ? "Sending code…" : "Send me a code instead"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-600">
        <Link href="/forgot-password" className="font-semibold text-brand-800 hover:underline">
          Forgot password?
        </Link>
        {" · "}
        <Link href="/sign-up" className="font-semibold text-brand-800 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
