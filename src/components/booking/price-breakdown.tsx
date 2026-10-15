import type { Quote } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";

/**
 * Quote-driven price breakdown. Every number comes from POST /checkout/quote;
 * the client never computes payables. Display follows the BRD rule (fee
 * embedded in the total, CQ-11 still open on itemization).
 */
export function PriceBreakdown({ quote }: { quote: Quote }) {
  const t = quote.totals;
  return (
    <dl className="flex flex-col gap-2 rounded-xl border border-stone-200 p-4 text-sm">
      {quote.items.map((item) => (
        <div key={item.tierId} className="flex items-center justify-between gap-2">
          <dt className="text-stone-600">
            {item.qty} × ticket
          </dt>
          <dd className="font-medium">{formatPaise(item.displayPrice)}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-2">
        <dt className="text-stone-600">Subtotal</dt>
        <dd className="font-medium">{formatPaise(t.displayPrice)}</dd>
      </div>
      {t.discount > 0 ? (
        <div className="flex items-center justify-between gap-2 text-emerald-800">
          <dt>Discount</dt>
          <dd className="font-medium">−{formatPaise(t.discount)}</dd>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <dt className="text-stone-600">GST (18%)</dt>
        <dd className="font-medium">{formatPaise(t.gst)}</dd>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-2 text-base">
        <dt className="font-bold">Total payable</dt>
        <dd className="font-bold text-brand-900">{formatPaise(t.finalPayable)}</dd>
      </div>
    </dl>
  );
}
