import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-[10px] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#101010] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

    const variantStyles = {
      primary:
        "bg-[#B6FF4A] text-[#101010] font-bold shadow-sm hover:bg-[#C4FF70] hover:shadow-[0_0_25px_rgba(182,255,74,0.35)] active:scale-[0.98] focus:ring-[#B6FF4A]/40",
      secondary:
        "bg-[#282830] text-[#F5F5F5] hover:bg-[#303038] border border-[#303038] hover:border-[#3e3e48] shadow-sm active:scale-[0.98] focus:ring-[#00D068]/30",
      danger:
        "bg-[#FF5C5C]/15 text-[#FF5C5C] hover:bg-[#FF5C5C]/25 border border-[#FF5C5C]/35 hover:border-[#FF5C5C]/50 active:scale-[0.98] focus:ring-[#FF5C5C]/40",
      outline:
        "bg-transparent text-[#A0A0A8] hover:text-[#F5F5F5] border border-[#303038] hover:border-[#3e3e48] hover:bg-[#282830]/50 active:scale-[0.98]",
      ghost:
        "bg-transparent text-[#707078] hover:text-[#F5F5F5] hover:bg-white/[0.05]",
    };

    const sizeStyles = {
      sm: "text-xs px-3 py-1.5 h-8 gap-1.5",
      md: "text-sm px-4 py-2 h-10 gap-2",
      lg: "text-base px-5 py-2.5 h-12 gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
