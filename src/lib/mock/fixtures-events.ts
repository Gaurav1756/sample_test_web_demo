/**
 * Sample users, events, tiers, coupons and one seeded booking. Dates are
 * relative to seed time so discovery windows (live/this-week/upcoming)
 * always have content. Money in paise. See docs/analysis/brd-deep-read-notes.md.
 */
import type { EventDetail, EventStatus, Tier, User } from "../api-types";
import { quoteForItems } from "./pricing";
import {
  daysAgo,
  daysFromNow,
  hoursFromNow,
  ticketCode,
  uid,
  type MockStore,
} from "./store";

const DEMO_PASSWORD = "demo1234";

function user(
  id: string,
  name: string,
  username: string,
  email: string,
  phone: string,
  role: User["role"],
  city: string,
  interests: string[] = [],
): User {
  return {
    id,
    name,
    username,
    avatarUrl: null,
    bio: null,
    phone,
    email,
    role,
    interests,
    city,
    country: "India",
    locale: "en",
    visibility: { profileVisible: true },
    createdAt: daysAgo(120),
  };
}

interface EventSeed {
  id: string;
  title: string;
  category: string;
  city: string;
  venue: string;
  address: string;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
  status: EventStatus;
  hostId: string;
  blurb: string;
  sold: number;
  going: number;
  rating: number | null;
  tiers: Array<{ name: string; price: number; capacity: number; sold: number }>;
}

const CITY_COORDS: Record<string, [number, number]> = {
  Bengaluru: [12.9716, 77.5946],
  Mumbai: [19.076, 72.8777],
  Delhi: [28.6139, 77.209],
  Hyderabad: [17.385, 78.4867],
  Chennai: [13.0827, 80.2707],
};

function toDetail(store: MockStore, seed: EventSeed, host: User, hostedCount: number): EventDetail {
  const tiers: Tier[] = seed.tiers.map((t, i) => ({
    id: `${seed.id}_t${i + 1}`,
    name: t.name,
    price: t.price,
    capacity: t.capacity,
    soldCount: t.sold,
    availableCount: Math.max(0, t.capacity - t.sold),
  }));
  store.tiers[seed.id] = tiers;
  const minPrice = tiers.length ? Math.min(...tiers.map((t) => t.price)) : 0;
  return {
    id: seed.id,
    title: seed.title,
    coverImage: null,
    category: seed.category,
    city: seed.city,
    venue: seed.venue,
    startAt: seed.startAt,
    endAt: seed.endAt,
    status: seed.status,
    minPrice,
    soldCount: seed.sold,
    goingCount: seed.going,
    avgRating: seed.rating,
    description: seed.blurb,
    language: "English",
    targetAudience: "Everyone",
    maxAttendees: seed.tiers.reduce((n, t) => n + t.capacity, 0),
    agenda: [
      { time: "Doors open", title: "Check-in and welcome" },
      { time: "Main slot", title: seed.title },
      { time: "Close", title: "Wrap-up and community hangout" },
    ],
    address: seed.address,
    latitude: seed.lat,
    longitude: seed.lng,
    tiers,
    policies: {
      refundPolicy: "Full refund up to 48 hours before start time.",
      entryRules: "Carry a valid ticket QR and a photo ID.",
      ageRestriction: "All ages",
    },
    host: {
      id: host.id,
      name: host.name,
      avatarUrl: null,
      bio: `${host.name} hosts ${seed.category.toLowerCase()} experiences across ${seed.city}.`,
      eventsHostedCount: hostedCount,
      avgRating: 4.6,
    },
    going: seed.going,
    attended: seed.status === "completed" ? seed.sold : 0,
    sold: seed.sold,
  };
}

export function seedEvents(store: MockStore): void {
  /* ----- users ----- */
  const users: User[] = [
    user("u_attendee", "Aarav Sharma", "aarav", "attendee@pegwin.in", "+919820000001", "user", "Bengaluru", ["Music", "Comedy"]),
    user("u_host", "Meera Nair", "meera.hosts", "host@pegwin.in", "+919820000002", "host", "Mumbai", ["Music", "Food"]),
    user("u_staff", "Rohan Verma", "rohan.scans", "staff@pegwin.in", "+919820000003", "event_staff", "Bengaluru"),
    user("u_admin", "Pegwin Admin", "pegwin.admin", "admin@pegwin.in", "+919820000004", "super_admin", "Bengaluru"),
    user("u_host2", "Kabir Malhotra", "kabir.events", "kabir@example.com", "+919820000005", "host", "Delhi", ["Music"]),
    user("u_host3", "Zoya Khan", "zoya.eats", "zoya@example.com", "+919820000006", "host", "Chennai", ["Food"]),
    user("u_m1", "Divya Iyer", "divya", "divya@example.com", "+919820000011", "user", "Bengaluru", ["Tech"]),
    user("u_m2", "Arjun Patel", "arjun", "arjun@example.com", "+919820000012", "user", "Mumbai", ["Sports"]),
    user("u_m3", "Sneha Reddy", "sneha", "sneha@example.com", "+919820000013", "user", "Hyderabad", ["Arts"]),
    user("u_m4", "Vikram Singh", "vikram", "vikram@example.com", "+919820000014", "user", "Delhi", ["Comedy"]),
  ];
  store.users = users;
  for (const u of users) {
    store.passwords[u.id] = DEMO_PASSWORD;
    if (u.email) store.contactIndex[u.email.toLowerCase()] = u.id;
    if (u.phone) store.contactIndex[u.phone] = u.id;
  }
  const byId = (id: string): User => users.find((u) => u.id === id) as User;

  /* ----- events ----- */
  const seeds: EventSeed[] = [
    {
      id: "evt_001", title: "Bengaluru Indie Music Night", category: "Music", city: "Bengaluru",
      venue: "The Courtyard", address: "41 Shankara Farm, Bengaluru", ...{ lat: CITY_COORDS.Bengaluru[0], lng: CITY_COORDS.Bengaluru[1] },
      startAt: daysFromNow(9), endAt: daysFromNow(9.2), status: "on_sale", hostId: "u_host",
      blurb: "Five indie bands, one open-air stage. Food stalls, vinyl pop-ups and a late-night DJ set to close.",
      sold: 214, going: 320, rating: 4.5,
      tiers: [
        { name: "Early Bird", price: 34900, capacity: 200, sold: 188 },
        { name: "General", price: 49900, capacity: 500, sold: 214 },
        { name: "VIP Deck", price: 99900, capacity: 60, sold: 21 },
      ],
    },
    {
      id: "evt_002", title: "Weekend Comedy Open Mic", category: "Comedy", city: "Bengaluru",
      venue: "Laugh Loft", address: "2nd Floor, 100 Ft Road, Indiranagar", ...{ lat: CITY_COORDS.Bengaluru[0], lng: CITY_COORDS.Bengaluru[1] },
      startAt: hoursFromNow(-2), endAt: hoursFromNow(4), status: "live", hostId: "u_host",
      blurb: "Twelve comics, zero filters. Tonight's lineup mixes seasoned regulars with first-timers.",
      sold: 96, going: 120, rating: 4.2,
      tiers: [
        { name: "General", price: 29900, capacity: 120, sold: 96 },
        { name: "Front Row", price: 49900, capacity: 20, sold: 14 },
      ],
    },
    {
      id: "evt_003", title: "Cubbon Park Morning Runners", category: "Sports", city: "Bengaluru",
      venue: "Cubbon Park Gate 3", address: "Cubbon Park, Bengaluru", ...{ lat: CITY_COORDS.Bengaluru[0], lng: CITY_COORDS.Bengaluru[1] },
      startAt: daysFromNow(5), endAt: daysFromNow(5.1), status: "on_sale", hostId: "u_host",
      blurb: "Free community 5K/10K with pacers for every level. Breakfast meetup after the run.",
      sold: 180, going: 240, rating: 4.8,
      tiers: [{ name: "Free Entry", price: 0, capacity: 300, sold: 180 }],
    },
    {
      id: "evt_004", title: "Startup Networking Mixer", category: "Tech", city: "Mumbai",
      venue: "WeWork BKC", address: "Bandra Kurla Complex, Mumbai", ...{ lat: CITY_COORDS.Mumbai[0], lng: CITY_COORDS.Mumbai[1] },
      startAt: daysFromNow(12), endAt: daysFromNow(12.2), status: "on_sale", hostId: "u_host",
      blurb: "Founders, operators and investors over coffee. Curated intros plus a 60-second pitch corner.",
      sold: 74, going: 110, rating: 4.4,
      tiers: [
        { name: "General", price: 79900, capacity: 150, sold: 74 },
        { name: "Founder Pass", price: 149900, capacity: 40, sold: 12 },
      ],
    },
    {
      id: "evt_005", title: "Monsoon Food Festival", category: "Food", city: "Mumbai",
      venue: "Juhu Grounds", address: "Juhu Beach Road, Mumbai", ...{ lat: CITY_COORDS.Mumbai[0], lng: CITY_COORDS.Mumbai[1] },
      startAt: daysFromNow(20), endAt: daysFromNow(21), status: "published", hostId: "u_host",
      blurb: "Forty stalls of street food, regional kitchens and desserts. Tickets go on sale soon.",
      sold: 0, going: 410, rating: null,
      tiers: [
        { name: "Day Pass", price: 19900, capacity: 2000, sold: 0 },
        { name: "Weekend Pass", price: 49900, capacity: 800, sold: 0 },
      ],
    },
    {
      id: "evt_006", title: "Watercolour Weekend Workshop", category: "Workshops", city: "Delhi",
      venue: "Studio Khoj", address: "S-17 Khirkee Extension, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysFromNow(30), endAt: daysFromNow(30.3), status: "draft", hostId: "u_host",
      blurb: "Draft: two-day beginner watercolour intensive. Materials included.",
      sold: 0, going: 0, rating: null,
      tiers: [{ name: "Full Workshop", price: 249900, capacity: 25, sold: 0 }],
    },
    {
      id: "evt_007", title: "Jazz Under the Stars", category: "Music", city: "Delhi",
      venue: "Nehru Park Amphitheatre", address: "Nehru Park, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysFromNow(25), endAt: daysFromNow(25.2), status: "review", hostId: "u_host",
      blurb: "Awaiting review: an evening of contemporary jazz with a 6-piece ensemble.",
      sold: 0, going: 85, rating: null,
      tiers: [
        { name: "Lawn", price: 59900, capacity: 400, sold: 0 },
        { name: "Reserved", price: 119900, capacity: 120, sold: 0 },
      ],
    },
    {
      id: "evt_008", title: "City Marathon 10K", category: "Sports", city: "Hyderabad",
      venue: "Necklace Road", address: "Necklace Road, Hyderabad", ...{ lat: CITY_COORDS.Hyderabad[0], lng: CITY_COORDS.Hyderabad[1] },
      startAt: daysAgo(10), endAt: daysAgo(9.8), status: "completed", hostId: "u_host",
      blurb: "Completed: 1,200 runners across 5K and 10K categories with chip timing.",
      sold: 1180, going: 1180, rating: 4.7,
      tiers: [
        { name: "5K", price: 59900, capacity: 600, sold: 590 },
        { name: "10K", price: 89900, capacity: 600, sold: 590 },
      ],
    },
    {
      id: "evt_009", title: "Rooftop Cinema: Classics", category: "Arts", city: "Bengaluru",
      venue: "Skyline Terrace", address: "Koramangala, Bengaluru", ...{ lat: CITY_COORDS.Bengaluru[0], lng: CITY_COORDS.Bengaluru[1] },
      startAt: daysFromNow(6), endAt: daysFromNow(6.2), status: "cancelled", hostId: "u_host",
      blurb: "Cancelled due to weather. All ticket holders were notified and refunded.",
      sold: 45, going: 45, rating: null,
      tiers: [{ name: "General", price: 39900, capacity: 100, sold: 45 }],
    },
    {
      id: "evt_010", title: "Holi Glow Party", category: "Music", city: "Delhi",
      venue: "The Grub House", address: "Saket, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysFromNow(15), endAt: daysFromNow(15.3), status: "on_sale", hostId: "u_host2",
      blurb: "Neon colours, live dhol and a foam zone. Protective eyewear on the house.",
      sold: 340, going: 520, rating: 4.1,
      tiers: [
        { name: "General", price: 69900, capacity: 800, sold: 340 },
        { name: "Couple", price: 119900, capacity: 200, sold: 88 },
      ],
    },
    {
      id: "evt_011", title: "Cancelled: Silent Disco", category: "Music", city: "Delhi",
      venue: "Hauz Khas Arena", address: "Hauz Khas, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysAgo(40), endAt: daysAgo(39.8), status: "cancelled", hostId: "u_host2",
      blurb: "Cancelled by host.", sold: 60, going: 60, rating: null,
      tiers: [{ name: "General", price: 49900, capacity: 300, sold: 60 }],
    },
    {
      id: "evt_012", title: "Cancelled: Night Flea Market", category: "Arts", city: "Delhi",
      venue: "Dilli Haat", address: "INA, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysAgo(60), endAt: daysAgo(59.7), status: "cancelled", hostId: "u_host2",
      blurb: "Cancelled by host.", sold: 30, going: 30, rating: null,
      tiers: [{ name: "Entry", price: 9900, capacity: 500, sold: 30 }],
    },
    {
      id: "evt_013", title: "Cancelled: Karaoke Clash", category: "Music", city: "Delhi",
      venue: "Echo Room", address: "Connaught Place, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysAgo(20), endAt: daysAgo(19.9), status: "cancelled", hostId: "u_host2",
      blurb: "Cancelled by host.", sold: 22, going: 22, rating: null,
      tiers: [{ name: "General", price: 29900, capacity: 80, sold: 22 }],
    },
    {
      id: "evt_014", title: "Cancelled: Board Game Night", category: "Workshops", city: "Delhi",
      venue: "Dice Den", address: "Malviya Nagar, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysAgo(5), endAt: daysAgo(4.9), status: "cancelled", hostId: "u_host2",
      blurb: "Cancelled by host.", sold: 12, going: 12, rating: null,
      tiers: [{ name: "General", price: 19900, capacity: 40, sold: 12 }],
    },
    {
      id: "evt_015", title: "Sufi Night Live", category: "Music", city: "Delhi",
      venue: "Qawwali Hall", address: "Nizamuddin, Delhi", ...{ lat: CITY_COORDS.Delhi[0], lng: CITY_COORDS.Delhi[1] },
      startAt: daysFromNow(18), endAt: daysFromNow(18.2), status: "review", hostId: "u_host2",
      blurb: "Awaiting review: an intimate sufi evening with guest vocalists.",
      sold: 0, going: 64, rating: null,
      tiers: [{ name: "General", price: 79900, capacity: 200, sold: 0 }],
    },
    {
      id: "evt_016", title: "Food Truck Carnival", category: "Food", city: "Chennai",
      venue: "Island Grounds", address: "Island Grounds, Chennai", ...{ lat: CITY_COORDS.Chennai[0], lng: CITY_COORDS.Chennai[1] },
      startAt: daysFromNow(11), endAt: daysFromNow(11.5), status: "on_sale", hostId: "u_host3",
      blurb: "Twenty food trucks, live counters and a dessert street. Come hungry.",
      sold: 510, going: 700, rating: 4.3,
      tiers: [
        { name: "Entry", price: 14900, capacity: 1500, sold: 510 },
        { name: "Taster Pass", price: 79900, capacity: 300, sold: 96 },
      ],
    },
    {
      id: "evt_017", title: "Cancelled: Filter Coffee Crawl", category: "Food", city: "Chennai",
      venue: "Mylapore Trail", address: "Mylapore, Chennai", ...{ lat: CITY_COORDS.Chennai[0], lng: CITY_COORDS.Chennai[1] },
      startAt: daysAgo(30), endAt: daysAgo(29.9), status: "cancelled", hostId: "u_host3",
      blurb: "Cancelled by host.", sold: 25, going: 25, rating: null,
      tiers: [{ name: "General", price: 99900, capacity: 60, sold: 25 }],
    },
    {
      id: "evt_018", title: "Cancelled: Biryani Cook-off", category: "Food", city: "Chennai",
      venue: "Culinary Studio", address: "Adyar, Chennai", ...{ lat: CITY_COORDS.Chennai[0], lng: CITY_COORDS.Chennai[1] },
      startAt: daysAgo(50), endAt: daysAgo(49.8), status: "cancelled", hostId: "u_host3",
      blurb: "Cancelled by host.", sold: 18, going: 18, rating: null,
      tiers: [{ name: "Contestant", price: 149900, capacity: 30, sold: 18 }],
    },
    {
      id: "evt_019", title: "Cancelled: Night Bazaar Bites", category: "Food", city: "Chennai",
      venue: "Marina Stalls", address: "Marina Beach, Chennai", ...{ lat: CITY_COORDS.Chennai[0], lng: CITY_COORDS.Chennai[1] },
      startAt: daysAgo(12), endAt: daysAgo(11.9), status: "cancelled", hostId: "u_host3",
      blurb: "Cancelled by host.", sold: 40, going: 40, rating: null,
      tiers: [{ name: "Entry", price: 9900, capacity: 400, sold: 40 }],
    },
  ];
  const hostedCount: Record<string, number> = {};
  for (const s of seeds) hostedCount[s.hostId] = (hostedCount[s.hostId] ?? 0) + 1;
  for (const s of seeds) {
    store.events.push(toDetail(store, s, byId(s.hostId), hostedCount[s.hostId]));
    store.eventHost[s.id] = s.hostId;
  }

  /* ----- event team: staff scans the live comedy night ----- */
  store.team["evt_002"] = [
    { userId: "u_staff", user: { id: "u_staff", name: "Rohan Verma", username: "rohan.scans" }, permissions: ["scan_tickets"], status: "active" },
    { userId: "u_m1", user: { id: "u_m1", name: "Divya Iyer", username: "divya" }, permissions: ["manage_event"], status: "active" },
  ];

  store.ratings["evt_001"] = { sum: 45, count: 10 };

  /* ----- coupons ----- */
  store.coupons = [
    { id: "cpn_001", code: "WELCOME100", discountType: "flat", value: 10000, maxUses: 1000, usedCount: 12, validFrom: daysAgo(30), validTo: daysFromNow(60), discountBearer: "pegwin", status: "active" },
    { id: "cpn_002", code: "FESTIVE20", discountType: "pct", value: 20, maxUses: 500, usedCount: 130, validFrom: daysAgo(10), validTo: daysFromNow(20), discountBearer: "pegwin", status: "active" },
    { id: "cpn_003", code: "OLDDEAL", discountType: "flat", value: 5000, maxUses: 100, usedCount: 100, validFrom: daysAgo(90), validTo: daysAgo(1), discountBearer: "host", status: "expired" },
  ];

  /* ----- seeded booking: attendee holds 2 comedy-night tickets, 1 checked in ----- */
  const comedyTiers = store.tiers["evt_002"];
  const general = comedyTiers[0];
  const quote = quoteForItems([{ tierId: general.id, qty: 2, unitHostPrice: general.price }], 0);
  const orderId = uid(store, "ord");
  store.orders.push({
    order: {
      id: orderId,
      eventId: "evt_002",
      items: [{ tierId: general.id, tierName: general.name, qty: 2, unitPrice: general.price + Math.round((general.price * 10) / 100) }],
      amounts: quote.totals,
      status: "confirmed",
      createdAt: daysAgo(1),
    },
    userId: "u_attendee",
    eventId: "evt_002",
  });
  const codeA = ticketCode(store);
  const codeB = ticketCode(store);
  const mkTicket = (code: string, name: string, checkedIn: boolean) => ({
    ticketCode: code,
    qrPayload: `PGW1:${code}:evt_002`,
    attendee: { name, phone: "+919820000001" },
    tierName: general.name,
    verified: true,
    status: (checkedIn ? "checked_in" : "confirmed") as "checked_in" | "confirmed",
    checkedInAt: checkedIn ? hoursFromNow(-1) : null,
    event: { id: "evt_002", title: "Weekend Comedy Open Mic", startAt: seeds[1].startAt, venue: "Laugh Loft", address: "2nd Floor, 100 Ft Road, Indiranagar" },
    eventId: "evt_002",
    orderId,
  });
  const ticketA = mkTicket(codeA, "Aarav Sharma", true);
  const ticketB = mkTicket(codeB, "Aarav Sharma", false);
  store.orderTickets[orderId] = [ticketA, ticketB];
  store.ticketsByCode[codeA] = ticketA;
  store.ticketsByCode[codeB] = ticketB;
  store.checkins.push({
    ticketCode: codeA, eventId: "evt_002", attendee: "Aarav Sharma", tierName: general.name,
    status: "checked_in", checkedInAt: hoursFromNow(-1), scannedAt: hoursFromNow(-1),
  });
  const paymentId = uid(store, "pay");
  store.payments.push({
    id: paymentId, orderId, userId: "u_attendee", amount: quote.totals.finalPayable,
    gateway: "razorpay", gatewayOrderId: `gw_${paymentId}`, status: "success", attempts: 1,
    createdAt: daysAgo(1), confirmedAt: daysAgo(1),
  });
  // Hardcoded evt_001..evt_019 above: start generated event ids past them.
  store.seq["evt"] = 100;
}
