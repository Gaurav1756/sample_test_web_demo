import * as React from "react";

const CONTROL =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder:text-stone-400 " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 " +
  "disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 " +
  "aria-[invalid=true]:border-red-600";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return <input {...props} className={`${CONTROL} h-10 text-sm ${className}`} />;
}

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = "", ...props }: TextareaProps) {
  return <textarea {...props} className={`${CONTROL} min-h-24 text-sm ${className}`} />;
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select {...props} className={`${CONTROL} h-10 text-sm ${className}`}>
      {children}
    </select>
  );
}
