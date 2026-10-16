import React from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function InfoTooltip({
  content,
  title,
  side = "top",
  className,
}: {
  content: string;
  title?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-help shrink-0 focus:outline-hidden ${className || ""}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            aria-label={title || content}
          >
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={6}
          className="max-w-xs text-xs p-2.5 bg-slate-900 text-slate-100 dark:bg-slate-800 dark:text-slate-100 border border-slate-700 shadow-xl rounded-lg z-50"
        >
          {title && <div className="font-semibold text-white mb-0.5">{title}</div>}
          <div className="leading-snug text-slate-300 font-normal">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
