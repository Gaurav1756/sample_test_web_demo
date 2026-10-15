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

export function SignInForm({ next, resetDone }: { next: string; resetDone: boolean }) {
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
