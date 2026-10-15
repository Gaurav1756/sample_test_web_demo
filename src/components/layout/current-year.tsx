"use client";

/** Client-rendered year so static pages stay prerenderable. */
export function CurrentYear() {
  return <>{new Date().getFullYear()}</>;
}
