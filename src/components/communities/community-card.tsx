import Link from "next/link";
import type { Community } from "@/lib/api-types";

/** Shared community card for hub and saved lists. */
export function CommunityCard({ community }: { community: Community }) {
  return (
    <Link
      href={`/communities/${community.id}`}
      className="flex h-full flex-col rounded-[1.75rem] border border-stone-200/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg hover:shadow-brand-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-lg font-bold text-brand-900"
        >
          {community.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{community.name}</h3>
          {community.category ? (
            <p className="text-sm text-stone-500">{community.category}</p>
          ) : null}
        </div>
      </div>
      {community.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-stone-600">{community.description}</p>
      ) : null}
      <div className="mt-3 flex gap-4 border-t border-stone-100 pt-3 text-sm text-stone-600">
        <span>
          <strong className="text-stone-900">{community.stats?.members ?? "—"}</strong> members
        </span>
        <span>
          <strong className="text-stone-900">{community.stats?.eventsHosted ?? "—"}</strong> events
        </span>
      </div>
    </Link>
  );
}
