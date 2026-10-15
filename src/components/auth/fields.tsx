"use client";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Phone + email pair; exactly one is required by the §2 contract (M*). */
export function ContactFields({
  defaultPhone = "",
  defaultEmail = "",
}: {
  defaultPhone?: string;
  defaultEmail?: string;
}) {
  return (
    <>
      <Field label="Phone" htmlFor="phone" hint="10-digit Indian mobile number, e.g. 98200 00001.">
        <Input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="98200 00001"
          defaultValue={defaultPhone}
        />
      </Field>
      <Field label="Email" htmlFor="email" hint="Required only if you leave phone blank.">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={defaultEmail}
        />
      </Field>
    </>
  );
}
