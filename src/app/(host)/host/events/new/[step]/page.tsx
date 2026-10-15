import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventDetail, type Tier } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { TierManager } from "@/components/host/tier-manager";
import {
  StepBasics,
  StepDetails,
  StepMedia,
  StepReview,
  StepVenue,
  WizardShell,
} from "@/components/host/wizard-steps";

export const metadata: Metadata = { title: "New event" };

type Props = {
  params: Promise<{ step: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** 6-step event creation wizard (FIG p35-p42) over POST/PATCH + tiers/agenda/team. */
export default async function NewEventPage({ params, searchParams }: Props) {
  await requireSession(["host", "super_admin"]);
  const step = Number((await params).step);
  if (!Number.isInteger(step) || step < 1 || step > 6) notFound();
  const draftId = first((await searchParams)?.draft);

  let draft: EventDetail | null = null;
  let tiers: Tier[] = [];
  let categories: string[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    categories = await api.get<string[]>("meta/categories", { auth: false }).catch(() => [] as string[]);
    if (draftId) {
      draft = await api.get<EventDetail>(`events/${draftId}`);
      if (step === 4) {
        tiers = toList<Tier>(await api.get<unknown>(`events/${draftId}/tiers`).catch(() => [] as unknown));
      }
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  if (failure) {
    return (
      <main>
        <ErrorState title={failure.title} body={failure.body} />
        <div className="mt-4 flex justify-center">
          <RefreshButton />
        </div>
      </main>
    );
  }

  if (step > 1 && !draft) {
    return (
      <main>
        <EmptyState
          title="No draft yet"
          body="Start with the basics to create your draft."
          action={
            <Button asChild>
              <Link href="/host/events/new/1">Go to step 1</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main>
      <h1 className="font-display text-3xl">New event</h1>
      <div className="mt-6">
        <WizardShell step={step} draftId={draft?.id ?? null}>
          {step === 1 ? <StepBasics draft={draft} categories={categories} /> : null}
          {step === 2 && draft ? <StepVenue draft={draft} /> : null}
          {step === 3 && draft ? <StepMedia draft={draft} /> : null}
          {step === 4 && draft ? (
            <StepFour draftId={draft.id} tiers={tiers} />
          ) : null}
          {step === 5 && draft ? <StepDetails draft={draft} /> : null}
          {step === 6 && draft ? <StepReview draft={draft} /> : null}
        </WizardShell>
      </div>
    </main>
  );
}

function StepFour({ draftId, tiers }: { draftId: string; tiers: Tier[] }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-xl">Ticket tiers</h2>
      <p className="mt-1 text-sm text-stone-600">
        The platform fee (+10%) and GST (18%) are computed by the server at checkout.
      </p>
      <div className="mt-4">
        <TierManager eventId={draftId} initial={tiers} />
      </div>
      <div className="mt-5 flex gap-3">
        <StepFourNav draftId={draftId} />
      </div>
    </div>
  );
}

function StepFourNav({ draftId }: { draftId: string }) {
  return (
    <>
      <Button asChild variant="secondary">
        <Link href={`/host/events/new/3?draft=${draftId}`}>Back</Link>
      </Button>
      <Button asChild>
        <Link href={`/host/events/new/5?draft=${draftId}`}>Continue</Link>
      </Button>
    </>
  );
}
