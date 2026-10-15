import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { HelpArticle } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Help article" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function HelpArticlePage({ params }: Props) {
  const { id } = await params;

  let article: HelpArticle | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    article = await api.get<HelpArticle>(`help/articles/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      missing = true;
    } else {
      const g =
        e instanceof ApiError
          ? e.guidance()
          : { message: "Something went wrong.", recovery: "Please try again." };
      failure = { title: g.message, body: g.recovery };
    }
  }

  if (missing) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm">
        <Link href="/help" className="font-semibold text-brand-800 hover:underline">
          ← Help
        </Link>
      </p>
      {failure || !article ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Article unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <article className="mt-4">
          <p className="text-sm font-medium text-stone-500">{article.category}</p>
          <h1 className="mt-1 font-display text-3xl">{article.title}</h1>
          <p className="mt-2 text-sm text-stone-500">Updated {formatDate(article.updatedAt)}</p>
          <div className="mt-6 whitespace-pre-line leading-relaxed text-stone-800">
            {article.body}
          </div>
        </article>
      )}
    </main>
  );
}
