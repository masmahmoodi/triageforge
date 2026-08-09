import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonProps>): React.ReactElement {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-teal-600 text-white shadow-sm shadow-teal-900/10 hover:bg-teal-700 disabled:bg-teal-300",
    secondary:
      "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-teal-300 hover:text-teal-800 disabled:text-slate-400",
    danger:
      "bg-rose-600 text-white shadow-sm shadow-rose-900/10 hover:bg-rose-700 disabled:bg-rose-300",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 disabled:text-slate-400"
  };

  return (
    <button
      className={`focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
