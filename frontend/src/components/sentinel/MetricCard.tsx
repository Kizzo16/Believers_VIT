import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  trend?: "positive" | "warning" | "neutral" | "danger";
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  icon,
  trend = "neutral",
  className,
}: MetricCardProps) {
  const trendColors = {
    positive: "text-[#00D068]",
    warning: "text-[#B6FF4A]",
    danger: "text-[#FF5C5C]",
    neutral: "text-[#707078]",
  };

  return (
    <div
      className={cn(
        "surface-card surface-card-hover p-5 flex flex-col justify-between",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]">
          {label}
        </span>
        {icon && <div className="text-[#707078]">{icon}</div>}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5] mb-1">
          {value}
        </div>
        {subtext && (
          <p className={cn("text-xs font-medium", trendColors[trend])}>
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
