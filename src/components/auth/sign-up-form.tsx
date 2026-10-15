"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { ContactFields } from "./fields";

const INITIAL = { ok: false as const };

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  return (
    <div>
      <h1 className="font-display text-2xl">Create your account</h1>
      <p className="mt-1 text-sm text-stone-600">
        One account for booking, hosting and communities.
      </p>
      <form action={action} className="mt-5 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Full name" htmlFor="name" required>
          <Input name="name" autoComplete="name" placeholder="Your name" />
        </Field>
        <ContactFields />
        <Field label="Password" htmlFor="password" hint="8–72 characters." required>
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" required>
          <Input name="confirm" type="password" autoComplete="new-password" />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-stone-700">
          <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 accent-brand-700" />
          <span>
            I agree to the{" "}
            <Link href="/p/privacy-policy" className="font-semibold text-brand-800 hover:underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/p/moderation-guidelines"
              className="font-semibold text-brand-800 hover:underline"
            >
              Community Guidelines
            </Link>
            .
          </span>
        </label>
        {state.message ? (
          <InlineError message={state.message} recovery={state.recovery} />
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-brand-800 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
