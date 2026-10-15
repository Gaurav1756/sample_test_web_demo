/**
 * Role-aware header navigation (BRD §4, BR-016). Each signed-in role sees
 * only its own portal entries; signed-out visitors see discovery plus the
 * host-acquisition link. Pure module: unit-tested, no framework imports.
 */
import type { Role } from "./api-types";

export interface HeaderLink {
  label: string;
  href: string;
}

export function headerLinks(role: Role | null): HeaderLink[] {
  if (!role) {
    return [
      { label: "Explore", href: "/explore" },
      { label: "For hosts", href: "/host" },
    ];
  }
  switch (role) {
    case "user":
      return [
        { label: "Explore", href: "/explore" },
        { label: "Bookings", href: "/bookings" },
      ];
    case "host":
      return [
        { label: "Explore", href: "/explore" },
        { label: "Host dashboard", href: "/host" },
      ];
    case "event_staff":
      // Staff surface is the scanner only (BR-016).
      return [{ label: "Scanner", href: "/host/scanner" }];
    case "super_admin":
      return [
        { label: "Explore", href: "/explore" },
        { label: "Admin", href: "/admin" },
      ];
  }
}
