import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { PortalNav } from "@/components/layout/portal-nav";

export default function AttendeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <PortalNav
          label="Attendee"
          items={[
            { label: "Home", href: "/home" },
            { label: "Explore", href: "/explore" },
            { label: "Nearby", href: "/explore/map" },
            { label: "Communities", href: "/communities", prefix: true },
            { label: "Saved", href: "/saved" },
            { label: "Bookings", href: "/bookings", prefix: true },
            { label: "Inbox", href: "/inbox" },
            { label: "Profile", href: "/profile", prefix: true },
            { label: "Help", href: "/help", prefix: true },
          ]}
        />
        <div id="page-content" className="min-w-0">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
