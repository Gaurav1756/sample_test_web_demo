import { describe, expect, it } from "vitest";
import { headerLinks } from "../src/lib/nav-links";

describe("role-aware header links (BRD §4)", () => {
  it("shows discovery plus host acquisition when signed out", () => {
    expect(headerLinks(null)).toEqual([
      { label: "Explore", href: "/explore" },
      { label: "For hosts", href: "/host" },
    ]);
  });

  it("shows attendee entries without the host portal", () => {
    const links = headerLinks("user");
    expect(links).toContainEqual({ label: "Explore", href: "/explore" });
    expect(links).toContainEqual({ label: "Bookings", href: "/bookings" });
    expect(links.some((l) => l.href === "/host")).toBe(false);
  });

  it("links hosts to their dashboard", () => {
    expect(headerLinks("host")).toContainEqual({ label: "Host dashboard", href: "/host" });
  });

  it("limits staff to the scanner (BR-016)", () => {
    expect(headerLinks("event_staff")).toEqual([{ label: "Scanner", href: "/host/scanner" }]);
  });

  it("links admins to the admin portal", () => {
    expect(headerLinks("super_admin")).toContainEqual({ label: "Admin", href: "/admin" });
  });
});
