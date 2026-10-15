import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type HelpArticle } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { HelpSearch } from "@/components/support/help-search";

export const metadata: Metadata = { title: "Help" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Help articles + links to support and policy pages (§13a). */
export default async function HelpPage({ searchParams }: Props) {
  const search = first((await searchParams)?.search).slice(0, 100);

  let articles: HelpArticle[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    articles = toList<HelpArticle>(
      await api.get<unknown>("help/articles", {
        query: search ? { search } : {},
      }),
    );
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl">Help</h1>
      <div className="mt-4 max-w-md">
        <HelpSearch initial={search} />
      </div>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : articles.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/help/${a.id}`}
                  className="block rounded-xl border border-stone-200 p-4 hover:border-brand-400"
                >
                  <p className="font-semibold">{a.title}</p>
                  <p className="mt-0.5 text-sm text-stone-500">{a.category}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No articles found" body="Try another search." />
        )}
      </div>
      <div className="mt-10 border-t border-stone-200 pt-6 text-sm">
        <p>
          <Link href="/support" className="font-semibold text-brand-800 hover:underline">
            Chat with support →
          </Link>
        </p>
        <p className="mt-3 font-semibold">Policies</p>
        <ul className="mt-1 flex flex-col gap-1 text-stone-600">
          {[
            ["refund-policy", "Refund policy"],
            ["privacy-policy", "Privacy policy"],
            ["safety-guidelines", "Safety guidelines"],
            ["child-safety", "Child safety"],
            ["moderation-guidelines", "Moderation guidelines"],
          ].map(([slug, label]) => (
            <li key={slug}>
              <Link href={`/p/${slug}`} className="hover:underline">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
