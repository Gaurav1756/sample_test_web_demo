import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { signOut } from "@/lib/auth-actions";
import { isMockData } from "@/lib/data-source";
import { headerLinks } from "@/lib/nav-links";
import { Brand } from "./brand";

/** Role-aware header: each role sees its own portal entries (BRD §4). */
export async function SiteHeader() {
  const user = await getSessionUser();
  const mock = isMockData();
  const links = headerLinks(user?.role ?? null);
  // Staff get a single link to their only tool; keep it visible on mobile.
  const alwaysVisible = user?.role === "event_staff";

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <span className="flex items-center gap-2">
          <Brand />
          {mock ? (
            <span
              title="Sample data mode: every screen runs on built-in demo data. No real backend, payments, or messages."
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
            >
              Sample data
            </span>
          ) : null}
        </span>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm font-semibold">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-4 py-2.5 text-stone-700 hover:bg-brand-50 hover:text-brand-900 ${
                alwaysVisible ? "" : "hidden sm:inline"
              }`}
            >
              {link.label}
            </Link>
          ))}
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
