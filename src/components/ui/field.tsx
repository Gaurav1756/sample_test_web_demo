import * as React from "react";

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

/** Accessible label + hint + error wrapper for a form control. */
export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = React.Children.only(children) as React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
  const enhanced = React.cloneElement(control, {
    id: htmlFor,
    "aria-describedby": describedBy,
    "aria-invalid": Boolean(error) || undefined,
  });

  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-stone-900">
        {label}
        {required ? <span aria-hidden="true" className="text-red-700"> *</span> : null}
      </label>
      {enhanced}
      {hint && !error ? (
        <p id={hintId} className="mt-1 text-sm text-stone-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
