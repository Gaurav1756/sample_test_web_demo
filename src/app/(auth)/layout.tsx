import { Brand } from "@/components/layout/brand";

/** Centered shell for sign-in / sign-up / OTP flows (pages arrive in Phase 3). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center bg-stone-50 px-4 py-12">
      <Brand />
      <main
        id="page-content"
        className="mt-8 w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        {children}
      </main>
    </div>
  );
}
