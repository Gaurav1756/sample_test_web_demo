import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { ContentPage } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Policy" };

type Props = {
  params: Promise<{ slug: string }>;
};

/** Policy content pages (§13a). Only documented slugs are linked. */
export default async function ContentPageView({ params }: Props) {
  const { slug } = await params;

  let page: ContentPage | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    page = await api.get<ContentPage>(`content/${slug}`);
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
      {failure || !page ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Page unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <article className="mt-4">
          <h1 className="font-display text-3xl">{page.title}</h1>
          <div className="mt-6 whitespace-pre-line leading-relaxed text-stone-800">
            {page.body}
          </div>
        </article>
      )}
    </main>
  );
}
