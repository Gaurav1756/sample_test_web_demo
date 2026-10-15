import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { User } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EditProfileForm } from "@/components/profile/edit-profile-form";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  await requireSession();

  let user: User | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    user = await api.get<User>("users/me");
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
        <Link href="/profile" className="font-semibold text-brand-800 hover:underline">
          ← Profile
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Edit profile</h1>
      <div className="mt-6">
        {failure || !user ? (
          <>
            <ErrorState title={failure?.title ?? "Profile unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <EditProfileForm user={user} />
        )}
      </div>
    </main>
  );
}
