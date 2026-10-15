import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="page-content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-6xl text-brand-800">404</p>
      <h1 className="mt-4 font-display text-2xl">This page does not exist</h1>
      <p className="mt-2 text-stone-600">
        The link may be broken, or the page may have been moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
