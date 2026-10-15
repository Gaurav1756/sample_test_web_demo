"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { saveOnboarding } from "@/lib/account-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";

const INITIAL = { ok: false as const };

const PREF_TOGGLES = [
  { key: "upcomingReminders", label: "Reminders for upcoming events" },
  { key: "recommendedEvents", label: "Events picked for me" },
  { key: "nearbyEvents", label: "Events near me" },
  { key: "communityEvents", label: "Community event updates" },
];

/** Post-signup personalization (AUTH-05): interests, city, key notif prefs. */
export function OnboardingForm({
  interests,
  cities,
  defaults,
}: {
  interests: string[];
  cities: string[];
  defaults: { interests: string[]; city: string };
}) {
  const [state, action, pending] = useActionState(saveOnboarding, INITIAL);
  const [picked, setPicked] = React.useState<string[]>(defaults.interests);

  const toggle = (interest: string) => {
    setPicked((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev.slice(0, 9), interest],
    );
  };

  return (
    <div>
      <h1 className="font-display text-2xl">Make it yours</h1>
      <p className="mt-1 text-sm text-stone-600">
        Pick interests and a city to personalize your feed. You can skip and do this later.
      </p>
      <form action={action} className="mt-5 flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Interests (up to 10)</legend>
          {picked.map((i) => (
            <input key={i} type="hidden" name="interests" value={i} />
          ))}
          <div className="flex flex-wrap gap-2">
            {interests.length > 0 ? (
              interests.map((interest) => {
                const active = picked.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggle(interest)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-stone-300 bg-white text-stone-700 hover:border-brand-400"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })
            ) : (
              <Input name="interest-note" disabled placeholder="Interests unavailable right now" />
            )}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">City</span>
          {cities.length > 0 ? (
            <Select name="city" defaultValue={defaults.city}>
              <option value="">Choose a city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          ) : (
            <Input name="city" defaultValue={defaults.city} placeholder="Your city" />
          )}
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Notify me about</legend>
          <div className="flex flex-col gap-2">
            {PREF_TOGGLES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={t.key} defaultChecked className="h-4 w-4 accent-brand-700" />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        {state.message ? (
          <InlineError message={state.message} recovery={state.recovery} />
        ) : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save and continue"}
        </Button>
        <Link
          href="/home"
          className="text-center text-sm font-semibold text-brand-800 hover:underline"
        >
          Skip for now
        </Link>
      </form>
    </div>
  );
}
