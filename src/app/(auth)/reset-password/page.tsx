import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset password" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return <ResetPasswordForm phone={first(params.phone)} email={first(params.email)} />;
}
