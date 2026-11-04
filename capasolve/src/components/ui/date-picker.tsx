"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export interface DatePickerFieldProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePickerField({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  const dateObj = useMemo(() => {
    if (!value) return undefined;
    const parts = value.split("-").map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return undefined;
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="font-semibold text-xs text-slate-700 dark:text-slate-300">{label}</Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full h-8.5 justify-between px-3 text-xs font-normal border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-2xs cursor-pointer rounded-lg",
              !value && "text-slate-400",
            )}
          >
            <span className="font-medium truncate">
              {dateObj ? format(dateObj, "MMM dd, yyyy") : placeholder}
            </span>
            <CalendarIcon className="h-3.5 w-3.5 text-slate-400 opacity-80 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50"
          align="start"
        >
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={(d) => {
              if (d) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const day = String(d.getDate()).padStart(2, "0");
                onChange(`${year}-${month}-${day}`);
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
