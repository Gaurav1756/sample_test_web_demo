import Link from "next/link";
import { Brand } from "./brand";
import { CurrentYear } from "./current-year";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Discover",
    links: [
      { label: "Explore events", href: "/explore" },
      { label: "Nearby", href: "/explore/map" },
      { label: "Communities", href: "/communities" },
      { label: "Saved", href: "/saved" },
    ],
  },
  {
    heading: "Hosting",
    links: [
      { label: "Host portal", href: "/host" },
      { label: "Create event", href: "/host/events/new/1" },
      { label: "Scanner", href: "/host/scanner" },
      { label: "Finance", href: "/host/finance" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Contact support", href: "/support" },
      { label: "Bookings", href: "/bookings" },
      { label: "Inbox", href: "/inbox" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200/80 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_2fr] lg:px-8">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-stone-600">
            Event discovery, secure QR ticketing, and event communities in one
            place — for attendees and hosts.
          </p>
          <p className="mt-4 text-sm text-stone-500">
            © <CurrentYear /> Pegwin Circle
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3"
        >
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h2 className="font-semibold text-ink-900">{col.heading}</h2>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-stone-600 hover:text-brand-700">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
