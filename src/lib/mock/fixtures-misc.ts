/**
 * Sample notifications, saved items, help/support content, host finance,
 * admin records and meta lists.
 */
import type { NotificationPreferences } from "../api-types";
import { daysAgo, daysFromNow, hoursFromNow, uid, type MockStore } from "./store";

export const META = {
  categories: ["Music", "Comedy", "Tech", "Food", "Sports", "Arts", "Workshops"],
  interests: ["Music", "Comedy", "Networking", "Food", "Fitness", "Photography", "Tech", "Travel"],
  cities: ["Bengaluru", "Mumbai", "Delhi", "Hyderabad", "Chennai", "Pune"],
  languages: ["en", "hi", "kn", "ta", "te"],
};

function defaultPrefs(): NotificationPreferences {
  return {
    push: true,
    email: true,
    upcomingReminders: true,
    eventUpdates: true,
    ticketUpdates: true,
    savedActivity: true,
    communityActivity: true,
    communityEvents: true,
    mentionsReplies: true,
    recommendedEvents: false,
    nearbyEvents: false,
  };
}

export function seedMisc(store: MockStore): void {
  /* ----- notifications ----- */
  store.notifications = {
    u_attendee: [
      { id: uid(store, "ntf"), type: "ticket", title: "Booking confirmed", body: "Your 2 tickets for Weekend Comedy Open Mic are ready.", refType: "order", refId: "ord_001", readAt: daysAgo(1), createdAt: daysAgo(1) },
      { id: uid(store, "ntf"), type: "event_update", title: "Schedule update", body: "Bengaluru Indie Music Night: gates now open at 5 PM.", refType: "event", refId: "evt_001", readAt: null, createdAt: hoursFromNow(-6) },
      { id: uid(store, "ntf"), type: "community", title: "New announcement", body: "Bengaluru Tech Meetups: November demo day confirmed.", refType: "community", refId: "c_tech", readAt: null, createdAt: hoursFromNow(-2) },
    ],
    u_host: [
      { id: uid(store, "ntf"), type: "booking", title: "New bookings", body: "12 new tickets sold for Holi Glow Party this week.", refType: "event", refId: "evt_010", readAt: null, createdAt: hoursFromNow(-10) },
      { id: uid(store, "ntf"), type: "review", title: "Event under review", body: "Jazz Under the Stars was submitted and is awaiting approval.", refType: "event", refId: "evt_007", readAt: null, createdAt: daysAgo(2) },
    ],
    u_admin: [
      { id: uid(store, "ntf"), type: "moderation", title: "Host flagged", body: "Kabir Malhotra crossed 3 event cancellations.", refType: "host", refId: "u_host2", readAt: null, createdAt: daysAgo(3) },
    ],
  };
  store.notifPrefs = {
    u_attendee: defaultPrefs(),
    u_host: defaultPrefs(),
    u_staff: defaultPrefs(),
    u_admin: defaultPrefs(),
  };

  /* ----- saved ----- */
  store.savedEvents = [
    { userId: "u_attendee", eventId: "evt_001" },
    { userId: "u_attendee", eventId: "evt_004" },
  ];
  store.savedCommunities = [{ userId: "u_attendee", communityId: "c_tech" }];

  /* ----- help + policy content ----- */
  store.helpArticles = [
    { id: "help_refunds", title: "How do refunds work?", category: "Payments", body: "Events cancelled by the host are refunded automatically to the original payment method within 5–7 business days. For other cases, check the event's refund policy on its detail page.", updatedAt: daysAgo(20) },
    { id: "help_tickets", title: "Where are my tickets?", category: "Tickets", body: "Confirmed bookings appear under Bookings with a QR code per ticket. Open a ticket to show its QR at the gate.", updatedAt: daysAgo(20) },
    { id: "help_qr", title: "QR code won't scan at entry", category: "Tickets", body: "Raise your screen brightness and hold still. Staff can also enter your 12-character ticket code manually.", updatedAt: daysAgo(15) },
    { id: "help_account", title: "Delete my account", category: "Account", body: "Go to Settings → Account and type DELETE to confirm. Personal data is removed; legally required transaction records are retained.", updatedAt: daysAgo(30) },
  ];
  store.contentPages = {
    "privacy-policy": { slug: "privacy-policy", title: "Privacy Policy", body: "Pegwin Circle collects only the data needed to run events and communities. Exact real-time location is never exposed. Account deletion removes personal data; financial records required by law are retained.", updatedAt: daysAgo(60) },
    "terms-of-service": { slug: "terms-of-service", title: "Terms of Service", body: "Tickets are non-transferable. Hosts are responsible for their event content. Pegwin may warn, suspend or remove hosts for fraud, fake events, misuse or policy violations.", updatedAt: daysAgo(60) },
    "refund-policy": { slug: "refund-policy", title: "Refund Policy", body: "Host-cancelled events trigger automatic full refunds. Rescheduled events offer refunds as an option. Individual event pages may state stricter windows.", updatedAt: daysAgo(45) },
  };

  /* ----- support ----- */
  store.supportTopics = ["Payments", "Tickets", "Events", "Account"];
  // Hardcoded sup_001 below: start generated conversation ids past it.
  store.seq["sup"] = 100;
  store.supportConvos = [
    { id: "sup_001", topic: "Payments", status: "open", updatedAt: hoursFromNow(-3) },
  ];
  store.supportOwner = { sup_001: "u_attendee" };
  store.supportMessages = {
    sup_001: [
      { id: uid(store, "smsg"), author: { id: "u_attendee", name: "Aarav Sharma" }, text: "I was charged twice for my comedy night order.", createdAt: hoursFromNow(-5) },
      { id: uid(store, "smsg"), author: { id: "u_admin", name: "Pegwin Support" }, text: "Thanks for flagging this — we see a duplicate attempt and the extra hold will auto-release. Anything else?", createdAt: hoursFromNow(-3) },
    ],
  };

  /* ----- host finance ----- */
  store.payoutSchedule = {
    u_host: { policy: "Payouts settle approximately 5–7 days after event completion.", nextEta: daysFromNow(6) },
    u_host2: { policy: "Payouts settle approximately 5–7 days after event completion.", nextEta: null },
    u_host3: { policy: "Payouts settle approximately 5–7 days after event completion.", nextEta: null },
  };
  store.payouts = [
    { id: uid(store, "po"), eventId: "evt_008", hostId: "u_host", netAmount: 8421600, status: "paid", eta: daysAgo(2), reference: "PEGPO2026001" },
    { id: uid(store, "po"), eventId: "evt_002", hostId: "u_host", netAmount: 312400, status: "pending", eta: daysFromNow(6), reference: null },
  ];
  // The comedy-night ledger rows must equal the seeded booking's totals.
  const comedyOrder = store.orders.find((o) => o.eventId === "evt_002");
  const comedyTotal = comedyOrder?.order.amounts.finalPayable ?? 0;
  store.transactionsByHost = {
    u_host: [
      { id: uid(store, "tx"), type: "sale", eventId: "evt_002", amount: comedyTotal, label: "2 × General — Comedy Open Mic", createdAt: daysAgo(1) },
      { id: uid(store, "tx"), type: "sale", eventId: "evt_001", amount: 2928200, label: "Ticket sales — Indie Music Night", createdAt: daysAgo(4) },
      { id: uid(store, "tx"), type: "fee", eventId: "evt_001", amount: -266200, label: "Platform fee (10%)", createdAt: daysAgo(4) },
      { id: uid(store, "tx"), type: "refund", eventId: "evt_009", amount: -187110, label: "Refund — Rooftop Cinema cancellation", createdAt: daysAgo(2) },
      { id: uid(store, "tx"), type: "payout", eventId: "evt_008", amount: -8421600, label: "Payout PEGPO2026001", createdAt: daysAgo(2) },
      { id: uid(store, "tx"), type: "sale", eventId: "evt_008", amount: 9315600, label: "Ticket sales — City Marathon 10K", createdAt: daysAgo(9) },
    ],
    u_host2: [],
    u_host3: [],
  };
  store.payoutAccountsByHost = {
    u_host: [{ id: uid(store, "pa"), bankName: "HDFC Bank", last4: "4521", holder: "Meera Nair", method: "bank", status: "verified" }],
    u_host2: [],
    u_host3: [],
  };
  store.invoicesByHost = {
    u_host: [
      { id: uid(store, "inv"), eventId: "evt_008", amount: 9315600, downloadUrl: "/invoices/sample-marathon.pdf", issuedAt: daysAgo(8) },
      { id: uid(store, "inv"), eventId: "evt_002", amount: comedyTotal, downloadUrl: "/invoices/sample-comedy.pdf", issuedAt: daysAgo(1) },
    ],
    u_host2: [],
    u_host3: [],
  };
  store.taxInfoByHost = {
    u_host: { legalName: "Meera Nair", pan: "ABCDE1234F", gstin: "29ABCDE1234F1Z5" },
    u_host2: {},
    u_host3: {},
  };
  store.verificationByHost = {
    u_host: {
      identity: { status: "verified", name: "Meera Nair", verifiedAt: daysAgo(90) },
      payoutAccount: { status: "verified", bankName: "HDFC Bank", last4: "4521", holder: "Meera Nair" },
      hosting: { freeEvents: 12, paidEvents: 4, communityHosting: true },
    },
    u_host2: { identity: { status: "pending" }, payoutAccount: { status: "pending" }, hosting: { freeEvents: 1, paidEvents: 2, communityHosting: true } },
    u_host3: { identity: { status: "pending" }, payoutAccount: { status: "pending" }, hosting: { freeEvents: 0, paidEvents: 1, communityHosting: false } },
  };

  /* ----- admin ----- */
  store.auditLog = [
    { id: uid(store, "aud"), action: "event.approved", actorId: "u_admin", entityType: "event", entityId: "evt_004", createdAt: daysAgo(6) },
    { id: uid(store, "aud"), action: "host.warned", actorId: "u_admin", entityType: "host", entityId: "u_host2", createdAt: daysAgo(3) },
    { id: uid(store, "aud"), action: "payout.processed", actorId: "u_admin", entityType: "payout", entityId: "PEGPO2026001", createdAt: daysAgo(2) },
  ];
  store.flaggedExtra = {
    u_host2: {
      cancelledEvents: 4,
      violations: [
        { type: "fake_event_report", createdAt: daysAgo(9) },
        { type: "late_refund", createdAt: daysAgo(4) },
      ],
      status: "flagged",
    },
    u_host3: {
      cancelledEvents: 3,
      violations: [{ type: "misleading_listing", createdAt: daysAgo(7) }],
      status: "flagged",
    },
  };

  store.analytics = {
    members: { total: 1240, new: 86, deltaPct: 7.4 },
    eventsHosted: 9,
    funnel: { views: 48210, saved: 5312, purchases: 1418, attendees: 1290 },
    audience: { newMembers: 402, returningPct: 61, avgEventsPerAttendee: 2.3, topInterests: ["Music", "Comedy", "Food"] },
    engagement: { activePct: 34, posts: 128, comments: 402, discussions: 57 },
    revenue: { total: 12844500, deltaPct: 12.1, ticketsSold: 1418, avgTicketValue: 9058 },
    insights: [
      { title: "Weekend demand", text: "Saturday shows convert 2× better than weekday shows." },
      { title: "Comedy momentum", text: "Comedy events grew 18% month over month." },
    ],
  };
}
