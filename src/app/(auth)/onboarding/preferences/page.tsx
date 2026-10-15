import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import type { User } from "@/lib/api-types";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = { title: "Personalize" };

export default async function OnboardingPage() {
  await requireSession();
  const api = await serverApi();
  const [user, interests, cities] = await Promise.all([
    api.get<User>("users/me"),
    api.get<string[]>("meta/interests", { auth: false }).catch(() => [] as string[]),
    api.get<string[]>("meta/cities", { auth: false }).catch(() => [] as string[]),
  ]);

  return (
    <div>
      <OnboardingForm
        interests={interests}
        cities={cities}
        defaults={{ interests: user.interests ?? [], city: user.city ?? "" }}
      />
      <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
        <h2 className="font-display text-lg text-brand-900">Planning to host?</h2>
        <p className="mt-1 text-sm text-brand-950">
          Create events, sell tickets, and grow a community around what you organize.
        </p>
        <Link
          href="/host"
          className="mt-3 inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Explore hosting →
        </Link>
      </div>
    </div>
  );
}
