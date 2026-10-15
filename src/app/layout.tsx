import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

/** Self-hosted Poppins (latin + latin-ext for ₹); no build-time network. */
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-latin-800-normal.woff2", weight: "800", style: "normal" },
    { path: "./fonts/poppins-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-ext-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-latin-ext-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-ext-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/poppins-latin-ext-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Pegwin Circle — Discover and host local events",
    template: "%s · Pegwin Circle",
  },
  description:
    "Pegwin Circle is a platform for discovering and booking local events, hosting and monetizing events, and building event communities.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${poppins.variable}`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#page-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
