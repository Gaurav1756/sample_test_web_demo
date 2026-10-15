import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { NotificationPreferences } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { NotificationPrefsForm } from "@/components/profile/prefs-forms";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  await requireSession();

  let prefs: NotificationPreferences | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    prefs = await api.get<NotificationPreferences>("users/me/notification-preferences");
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
      <h1 className="mt-2 font-display text-3xl">Notifications</h1>
      <div className="mt-6">
        {failure || !prefs ? (
          <>
            <ErrorState title={failure?.title ?? "Settings unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <NotificationPrefsForm prefs={prefs} />
        )}
      </div>
    </main>
  );
}
