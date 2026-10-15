import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { User } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { LanguageForm } from "@/components/profile/prefs-forms";

export const metadata: Metadata = { title: "Language" };

export default async function LanguagePage() {
  await requireSession();

  let languages: string[] = [];
  let locale = "";
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [langs, user] = await Promise.all([
      api.get<string[]>("meta/languages", { auth: false }),
      api.get<User>("users/me"),
    ]);
    languages = langs;
    locale = user.locale ?? "";
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm">
        <Link href="/settings" className="font-semibold text-brand-800 hover:underline">
          ← Settings
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Language</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <LanguageForm languages={languages} current={locale} />
        )}
      </div>
    </main>
  );
}
