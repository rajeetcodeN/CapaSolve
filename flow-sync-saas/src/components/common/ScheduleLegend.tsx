import React from "react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ScheduleLegendProps {
  className?: string;
  showManpower?: boolean;
  showOverloadedOutline?: boolean;
}

export function ScheduleLegend({
  className,
  showManpower = true,
  showOverloadedOutline = true,
}: ScheduleLegendProps) {
  const { columnMapping } = useAppStore();
  const setupLabel = columnMapping?.setupTime || "Setup R";
  const machLabel = columnMapping?.processTime || "Machining M";
  const manpowerLabel = columnMapping?.manpower || "Manpower P";

  const items = [
    { label: `${setupLabel} (Steel Blue)`, bg: "bg-[#4A90D9]" },
    { label: `${machLabel} (Green)`, bg: "bg-[#52C41A]" },
    { label: "Machine Overlap (Pulsing Red)", bg: "bg-red-500 animate-pulse" },
  ];

  if (showManpower) {
    items.push({ label: `${manpowerLabel} (Orange)`, bg: "bg-orange-500" });
  }

  if (showOverloadedOutline) {
    items.push({ label: "Overloaded Stack (Red Outline)", bg: "bg-red-500" });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-[10px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-sm shadow-sm", i.bg)} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
