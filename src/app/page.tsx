import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";

/**
 * Public landing page. Only documented, factual content: what Pegwin
 * Circle is (BRD §1) and where to go. No invented statistics, testimonials
 * or event data.
 */
export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main id="page-content" className="flex-1">
        <section className="bg-brand-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24 lg:px-8">
            <div>
              <p className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold tracking-wide text-brand-200">
                Local events, hosts and communities
              </p>
              <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Find your crowd. Book your weekend.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-100">
                Pegwin Circle brings event discovery, secure ticketing with
                QR-based entry, and event communities together in one place —
                for attendees, hosts and organizers.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/explore">Explore events</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <Link href="/host">Start hosting</Link>
                </Button>
              </div>
            </div>
            <div className="hidden flex-col justify-center gap-4 md:flex">
              <Feature title="Discover" body="Browse events by category, date and location, and save the ones you love." />
              <Feature title="Book securely" body="Transparent pricing with GST shown upfront, and digital QR tickets." />
              <Feature title="Belong" body="Join event communities and group chats hosted by people like you." />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-[2rem] border border-stone-200/70 bg-white p-8 shadow-sm sm:p-10">
              <h2 className="font-display text-2xl font-bold text-ink-900">Attending</h2>
              <p className="mt-2 leading-relaxed text-ink-600">
                Search events, book tickets in a few steps, manage your
                bookings and tickets, and stay updated through notifications.
              </p>
              <Button asChild variant="ghost" className="mt-4 px-0">
                <Link href="/home">Go to your home →</Link>
              </Button>
            </div>
            <div className="rounded-[2rem] bg-brand-600 p-8 text-white shadow-lg shadow-brand-600/25 sm:p-10">
              <h2 className="font-display text-2xl font-bold">Hosting</h2>
              <p className="mt-2 leading-relaxed text-brand-100">
                Create events, sell tiered tickets, validate entry with QR
                scanning, and grow a community around what you organize.
              </p>
              <Link
                href="/host"
                className="mt-5 inline-block rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-900 hover:bg-brand-100"
              >
                Open the host portal →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-brand-100">{body}</p>
    </div>
  );
}
