import React from "react";
import { SystemHealth } from "@/types/sentinel";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  health: SystemHealth;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({ health, className, size = "md" }: StatusBadgeProps) {
  const configs: Record<
    SystemHealth,
    { label: string; dot: string; bg: string; text: string; border: string }
  > = {
    HEALTHY: {
      label: "Healthy",
      dot: "bg-[#00D068]",
      bg: "bg-[#00D068]/10",
      text: "text-[#00D068]",
      border: "border-[#00D068]/25",
    },
    DEGRADED: {
      label: "Degraded",
      dot: "bg-[#B6FF4A] animate-pulse",
      bg: "bg-[#B6FF4A]/10",
      text: "text-[#B6FF4A]",
      border: "border-[#B6FF4A]/25",
    },
    INCIDENT_ACTIVE: {
      label: "Incident Active",
      dot: "bg-[#FF5C5C] animate-ping",
      bg: "bg-[#FF5C5C]/15",
      text: "text-[#FF5C5C]",
      border: "border-[#FF5C5C]/35",
    },
    RECOVERING: {
      label: "Self-Healing",
      dot: "bg-[#58DC9C] animate-pulse",
      bg: "bg-[#58DC9C]/10",
      text: "text-[#58DC9C]",
      border: "border-[#58DC9C]/25",
    },
  };

  const config = configs[health] || configs.HEALTHY;

  const sizeClasses = {
    sm: "text-[11px] px-2 py-0.5 gap-1.5",
    md: "text-xs px-2.5 py-1 gap-2",
    lg: "text-sm px-3.5 py-1.5 gap-2.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wider border",
        config.bg,
        config.text,
        config.border,
        sizeClasses[size],
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  );
}
