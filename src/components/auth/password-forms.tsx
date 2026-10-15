"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPassword, resetPassword } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ContactFields } from "./fields";

const INITIAL = { ok: false as const };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, INITIAL);

  return (
    <div>
      <h1 className="font-display text-2xl">Reset your password</h1>
      <p className="mt-1 text-sm text-stone-600">
        Enter your phone or email and we&apos;ll send a reset code.
      </p>
      <form action={action} className="mt-5 flex flex-col gap-4">
        <ContactFields />
        {state.message ? (
          <InlineError message={state.message} recovery={state.recovery} />
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending code…" : "Send reset code"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-600">
        <Link href="/sign-in" className="font-semibold text-brand-800 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ phone, email }: { phone: string; email: string }) {
  const [state, action, pending] = useActionState(resetPassword, INITIAL);

  return (
    <div>
      <h1 className="font-display text-2xl">Choose a new password</h1>
      <p className="mt-1 text-sm text-stone-600">
        Enter the code we sent{phone || email ? ` to ${phone || email}` : ""} and your new
        password.
      </p>
      <form action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="email" value={email} />
        <Field label="Reset code" htmlFor="otp" required>
          <Input
            name="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
          />
        </Field>
        <Field label="New password" htmlFor="password" hint="8–72 characters." required>
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm" required>
          <Input name="confirm" type="password" autoComplete="new-password" />
        </Field>
        {state.message ? (
          <InlineError message={state.message} recovery={state.recovery} />
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Updating…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
