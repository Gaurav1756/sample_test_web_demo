import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Welcome" };

/**
 * Welcome entry (Figma p7): Get Started for newcomers, sign-in for
 * returning users. Signed-in visitors skip ahead to their portal.
 */
export default async function WelcomePage() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === "super_admin" ? "/admin" : user.role === "host" ? "/host" : "/home");
  }

  return (
    <div className="text-center">
      <h1 className="font-display text-3xl">Welcome to Pegwin Circle</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Discover local events, book secure tickets, and join the communities behind them.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <p className="text-sm text-stone-600">
          Have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-brand-800 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
