import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24">
      <Spinner label="Loading…" />
    </main>
  );
}
