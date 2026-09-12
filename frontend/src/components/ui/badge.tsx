import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "emerald" | "amber" | "rose" | "cyan" | "indigo";
  size?: "sm" | "md";
}

export function Badge({ className, variant = "neutral", size = "sm", children, ...props }: BadgeProps) {
  const variantStyles = {
    neutral: "bg-white/[0.06] text-slate-300 border-white/[0.08]",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  };

  const sizeStyles = {
    sm: "text-[11px] font-medium px-2 py-0.5 rounded-full border",
    md: "text-xs font-medium px-2.5 py-1 rounded-full border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 tracking-wide uppercase transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
