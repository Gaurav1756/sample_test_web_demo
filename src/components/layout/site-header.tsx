import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { signOut } from "@/lib/auth-actions";
import { Brand } from "./brand";

/** Session-aware public header. Signed-out visitors see auth links. */
export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm font-semibold">
          <Link
            href="/explore"
            className="hidden rounded-full px-4 py-2.5 text-stone-700 hover:bg-brand-50 hover:text-brand-900 sm:inline"
          >
            Explore
          </Link>
          <Link
            href="/host"
            className="hidden rounded-full px-4 py-2.5 text-stone-700 hover:bg-brand-50 hover:text-brand-900 sm:inline"
          >
            For hosts
          </Link>
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden rounded-full px-4 py-2.5 text-stone-700 hover:bg-brand-50 hover:text-brand-900 sm:inline"
              >
                {user.name}
              </Link>
              <form action={signOut} className="inline">
                <button
                  type="submit"
                  className="rounded-full px-4 py-2.5 text-stone-700 hover:bg-brand-50 hover:text-brand-900"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="rounded-full px-4 py-2.5 text-stone-700 hover:bg-brand-50 hover:text-brand-900"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-brand-600 px-5 py-2.5 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
