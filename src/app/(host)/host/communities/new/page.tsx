import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { NewCommunityForm } from "@/components/host/new-community-form";

export const metadata: Metadata = { title: "New community" };

export default async function NewCommunityPage() {
  await requireSession(["host", "super_admin"]);
  const api = await serverApi();
  const [categories, interests] = await Promise.all([
    api.get<string[]>("meta/categories", { auth: false }).catch(() => [] as string[]),
    api.get<string[]>("meta/interests", { auth: false }).catch(() => [] as string[]),
  ]);

  return (
    <main>
      <h1 className="font-display text-3xl">New community</h1>
      <div className="mt-6">
        <NewCommunityForm categories={categories} interests={interests} />
      </div>
    </main>
  );
}
