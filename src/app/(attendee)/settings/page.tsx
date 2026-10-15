import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

const LINKS = [
  { href: "/settings/account", title: "Account & privacy", body: "Visibility and account deletion." },
  { href: "/settings/notifications", title: "Notifications", body: "Choose what you hear about." },
  { href: "/settings/language", title: "Language", body: "Preferred app language." },
  { href: "/settings/payments", title: "Payments", body: "Payment history and refunds." },
];

export default async function SettingsPage() {
  await requireSession();
  return (
    <main className="w-full max-w-3xl">
      <h1 className="font-display text-3xl">Settings</h1>
      <ul className="mt-6 flex flex-col gap-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-xl border border-stone-200 p-5 hover:border-brand-400"
            >
              <p className="font-semibold">{l.title}</p>
              <p className="mt-0.5 text-sm text-stone-600">{l.body}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
