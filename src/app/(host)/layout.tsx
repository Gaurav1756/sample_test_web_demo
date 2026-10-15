import { SiteHeader } from "@/components/layout/site-header";
import { PortalNav, type NavItem } from "@/components/layout/portal-nav";
import { requireSession } from "@/lib/session";

const HOST_ITEMS: NavItem[] = [
  { label: "Overview", href: "/host" },
  { label: "Events", href: "/host/events", prefix: true },
  { label: "Communities", href: "/host/communities", prefix: true },
  { label: "Chats", href: "/host/chats", prefix: true },
  { label: "Scanner", href: "/host/scanner" },
  { label: "Finance", href: "/host/finance" },
  { label: "Analytics", href: "/host/analytics" },
  { label: "Verifications", href: "/host/verifications" },
  { label: "Profile", href: "/host/profile" },
];

const STAFF_ITEMS: NavItem[] = [{ label: "Scanner", href: "/host/scanner" }];

/**
 * Host shell. Event staff pass the layout but only see the scanner;
 * every other host page re-gates to host/super_admin, and the backend
 * enforces ownership and staff scoping per event.
 */
export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession(["host", "super_admin", "event_staff"]);
  const items = user.role === "event_staff" ? STAFF_ITEMS : HOST_ITEMS;
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <PortalNav label="Host" items={items} />
        <div id="page-content" className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
