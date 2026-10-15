import { SiteHeader } from "@/components/layout/site-header";
import { PortalNav } from "@/components/layout/portal-nav";
import { requireSession } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession(["super_admin"]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-8">
        <PortalNav
          label="Administration"
          items={[
            { label: "Overview", href: "/admin" },
            { label: "Review queue", href: "/admin/review", prefix: true },
            { label: "Events", href: "/admin/events", prefix: true },
            { label: "Hosts", href: "/admin/hosts" },
            { label: "Moderation", href: "/admin/moderation" },
            { label: "Coupons", href: "/admin/coupons" },
            { label: "Payouts", href: "/admin/payouts" },
            { label: "Audit logs", href: "/admin/audit" },
          ]}
        />
        <div id="page-content" className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}
