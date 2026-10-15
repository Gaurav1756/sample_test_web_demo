import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Sign up" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SignUpPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return <SignUpForm next={first(params.next)} />;
}
