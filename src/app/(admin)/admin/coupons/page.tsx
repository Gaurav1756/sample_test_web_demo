import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type AdminCoupon } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { CouponCreateForm, CouponRow } from "@/components/admin/coupon-forms";

export const metadata: Metadata = { title: "Coupons" };

/** Coupon management: create + enable/disable (§6). */
export default async function CouponsPage() {
  let coupons: AdminCoupon[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    coupons = toList<AdminCoupon>(await api.get<unknown>("admin/coupons"));
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Coupons</h1>
      <h2 className="mt-6 font-display text-xl">New coupon</h2>
      <div className="mt-3">
        <CouponCreateForm />
      </div>
      <h2 className="mt-10 font-display text-xl">Existing coupons</h2>
      <div className="mt-3">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : coupons.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {coupons.map((coupon) => (
              <CouponRow key={coupon.id} coupon={coupon} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No coupons" body="Create the first one above." />
        )}
      </div>
    </main>
  );
}
