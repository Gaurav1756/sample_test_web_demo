import { describe, expect, it } from "vitest";
import { GST_PCT, PLATFORM_FEE_PCT, quoteForItems } from "../src/lib/mock/pricing";

describe("BRD pricing chain (paise)", () => {
  it("matches the BRD §5.5 worked example exactly", () => {
    const quote = quoteForItems([{ tierId: "t1", qty: 1, unitHostPrice: 50000 }], 10000);
    expect(PLATFORM_FEE_PCT).toBe(10);
    expect(GST_PCT).toBe(18);
    expect(quote.totals).toEqual({
      hostPrice: 50000,
      platformFee: 5000,
      displayPrice: 55000,
      discount: 10000,
      discountBearer: "pegwin",
      taxableAmount: 45000,
      gst: 8100,
      finalPayable: 53100,
    });
  });

  it("embeds the fee per item and sums totals", () => {
    const quote = quoteForItems(
      [
        { tierId: "t1", qty: 2, unitHostPrice: 29900 },
        { tierId: "t2", qty: 1, unitHostPrice: 49900 },
      ],
      0,
    );
    expect(quote.items[0]).toEqual({ tierId: "t1", qty: 2, hostPrice: 59800, platformFee: 5980, displayPrice: 65780 });
    expect(quote.totals.hostPrice).toBe(59800 + 49900);
    expect(quote.totals.finalPayable).toBe(quote.totals.taxableAmount + quote.totals.gst);
  });

  it("clamps discounts so totals never go negative", () => {
    const quote = quoteForItems([{ tierId: "t1", qty: 1, unitHostPrice: 10000 }], 999999);
    expect(quote.totals.taxableAmount).toBe(0);
    expect(quote.totals.gst).toBe(0);
    expect(quote.totals.finalPayable).toBe(0);
  });
});
