import type { Metadata } from "next";
import Link from "next/link";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";
import type { OtpPurpose } from "@/lib/api-types";

export const metadata: Metadata = { title: "Verify code" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function VerifyOtpPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const purpose = first(params.purpose);
  const phone = first(params.phone);
  const email = first(params.email);
  const valid = ["register", "login", "reset"].includes(purpose) && (phone || email);

  if (!valid) {
    return (
      <div>
        <h1 className="font-display text-2xl">No code requested</h1>
        <p className="mt-2 text-sm text-stone-600">
          Start from sign in or sign up and we&apos;ll send you a fresh code.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/sign-in" className="font-semibold text-brand-800 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <VerifyOtpForm
      purpose={purpose as OtpPurpose}
      phone={phone}
      email={email}
      next={first(params.next)}
    />
  );
}
