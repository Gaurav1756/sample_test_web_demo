import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 disabled:bg-stone-300 disabled:shadow-none",
  secondary:
    "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100 disabled:text-stone-400",
  ghost: "text-brand-700 hover:bg-brand-50 disabled:text-stone-400",
  danger: "bg-red-700 text-white hover:bg-red-800 disabled:bg-stone-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render the single child element with button styling (e.g. a Link). */
  asChild?: boolean;
}

export function buttonClassName(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold",
    "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({ variant = "primary", size = "md", asChild, className = "", ...props }: ButtonProps) {
  const cls = buttonClassName(variant, size, className);
  if (asChild) {
    const child = React.Children.only(props.children) as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      ...stripChildren(props),
      className: [cls, child.props.className].filter(Boolean).join(" "),
    });
  }
  return <button {...props} className={cls} />;
}

function stripChildren({ children: _children, ...rest }: ButtonProps) {
  void _children;
  return rest;
}
