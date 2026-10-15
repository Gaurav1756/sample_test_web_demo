import * as React from "react";
import { Button } from "./button";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 px-6 py-12 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-stone-600">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
  retryLabel = "Try again",
}: {
  title: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center"
    >
      <h2 className="font-display text-xl text-red-900">{title}</h2>
      {body ? <p className="mt-2 max-w-md text-red-800">{body}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-5">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function InlineError({ message, recovery }: { message: string; recovery?: string }) {
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      <span className="font-semibold">{message}</span>
      {recovery ? <span className="mt-0.5 block text-red-800">{recovery}</span> : null}
    </p>
  );
}
