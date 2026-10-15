/**
 * BRD §5.5 pricing chain, shared by the sample backend (and safe to reuse
 * anywhere totals must match the backend): all money in integer paise.
 *
 *   host price → +10% platform fee → display price → −discount →
 *   taxable amount → +18% GST → final payable
 *
 * The fee is embedded in the displayed price (BR-008), GST applies after
 * discounts (BR-009). Verifies against the BRD example: 50000 → 5000 →
 * 55000 → −10000 → 45000 → 8100 → 53100.
 */
import type { Quote, QuoteItem, QuoteTotals } from "../api-types";
import type { DiscountBearer } from "../api-types";

export const PLATFORM_FEE_PCT = 10;
export const GST_PCT = 18;

export interface PricedItem {
  tierId: string;
  qty: number;
  /** Tier unit price in paise (host price). */
  unitHostPrice: number;
}

export function quoteForItems(
  items: PricedItem[],
  discount: number,
  discountBearer: DiscountBearer = "pegwin",
): Quote {
  const quoteItems: QuoteItem[] = items.map((i) => {
    const hostPrice = i.unitHostPrice * i.qty;
    const platformFee = Math.round((hostPrice * PLATFORM_FEE_PCT) / 100);
    return { tierId: i.tierId, qty: i.qty, hostPrice, platformFee, displayPrice: hostPrice + platformFee };
  });
  const totals: QuoteTotals = {
    hostPrice: quoteItems.reduce((n, i) => n + i.hostPrice, 0),
    platformFee: quoteItems.reduce((n, i) => n + i.platformFee, 0),
    displayPrice: quoteItems.reduce((n, i) => n + i.displayPrice, 0),
    discount: Math.max(0, Math.round(discount)),
    discountBearer,
    taxableAmount: 0,
    gst: 0,
    finalPayable: 0,
  };
  totals.taxableAmount = Math.max(0, totals.displayPrice - totals.discount);
  totals.gst = Math.round((totals.taxableAmount * GST_PCT) / 100);
  totals.finalPayable = totals.taxableAmount + totals.gst;
  return { items: quoteItems, totals };
}
