import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function SignInPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  return <SignInForm next={first(params.next)} resetDone={first(params.reset) === "1"} />;
}
