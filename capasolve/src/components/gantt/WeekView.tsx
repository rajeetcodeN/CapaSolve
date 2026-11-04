import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useTranslations } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { Machine, ScheduleSlot } from "@/lib/types";
import { formatDateStr } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

export interface WeekViewProps {
  year: number;
  month: number;
  getLocalizedMonthName: (idx: number) => string;
  machines: Array<{ id: string; name: string }>;
  slots: ScheduleSlot[];
  onSelectDay: (dayStr: string) => void;
  onMonthChange?: (newMonth: number, newYear: number) => void;
}

export function WeekView({
  year,
  month,
  getLocalizedMonthName,
  machines,
  slots,
  onSelectDay,
  onMonthChange,
}: WeekViewProps) {
  const { machines: allMachines, dailyCapacities } = useAppStore();
  const { language } = useTranslations();

  const handlePrevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    onMonthChange?.(newMonth, newYear);
  };

  const handleNextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    onMonthChange?.(newMonth, newYear);
  };

  // Generate all days in selected month
  const calendarDays = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const list: { dayStr: string; label: string; weekday: string }[] = [];
    const weekdayNames =
      language === "de"
        ? ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]
        : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dayStr = formatDateStr(d);
      list.push({
        dayStr,
        label: `${String(i).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}`,
        weekday: weekdayNames[d.getDay()],
      });
    }
    return list;
  }, [year, month, language]);

  // Pre-aggregate daily setup and machining minutes by machineId/groupId and date Str in O(slots)
  const dailyCapacityMap = useMemo(() => {
    const map = new Map<string, { rMin: number; mMin: number }>();
    slots.forEach((s) => {
      // Machine key
      const mKey = `${s.machineId}_${s.date}`;
      if (!map.has(mKey)) {
        map.set(mKey, { rMin: 0, mMin: 0 });
      }
      const mEntry = map.get(mKey)!;
      if (s.slotType === "R") {
        mEntry.rMin += s.minutesUsed;
      } else if (s.slotType === "M") {
        mEntry.mMin += s.minutesUsed;
      }

      // Group key
      const machine = allMachines.find((m) => m.id === s.machineId);
      if (machine) {
        const gKey = `${machine.machineGroupId}_${s.date}`;
        if (!map.has(gKey)) {
          map.set(gKey, { rMin: 0, mMin: 0 });
        }
        const gEntry = map.get(gKey)!;
        if (s.slotType === "R") {
          gEntry.rMin += s.minutesUsed;
        } else if (s.slotType === "M") {
          gEntry.mMin += s.minutesUsed;
        }
      }
    });
    return map;
  }, [slots, allMachines]);

  // Calculate if the currently viewed month has scheduled slots
  const totalMonthScheduledMinutes = useMemo(() => {
    let total = 0;
    calendarDays.forEach((cd) => {
      machines.forEach((m) => {
        const entry = dailyCapacityMap.get(`${m.id}_${cd.dayStr}`);
        if (entry) {
          total += entry.rMin + entry.mMin;
        }
      });
    });
    return total;
  }, [calendarDays, machines, dailyCapacityMap]);

  // Find earliest slot month across the entire schedule
  const earliestSlotMonth = useMemo(() => {
    const dates = slots
      .map((s) => s.date)
      .filter(Boolean)
      .sort();
    if (dates.length > 0) {
      const parts = dates[0].split("-");
      if (parts.length === 3) {
        return {
          year: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10) - 1,
          dayStr: dates[0],
        };
      }
    }
    return null;
  }, [slots]);

  const getDayScheduledHours = (mId: string, dayStr: string) => {
    const entry = dailyCapacityMap.get(`${mId}_${dayStr}`) || { rMin: 0, mMin: 0 };

    const rHours = entry.rMin / 60;
    const mHours = entry.mMin / 60;
    const totalHours = rHours + mHours;

    // Check if mId is a group ID (M1 or M2)
    const isGroup = mId === "M1" || mId === "M2";
    const machinesCount = isGroup ? allMachines.filter((m) => m.machineGroupId === mId).length : 1;

    const availableHours = 14 * machinesCount;

    return { rHours, mHours, totalHours, availableHours };
  };

  return (
    <Card className="border border-border/80 shadow-md bg-card">
      <CardHeader className="border-b border-border/50 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" />
            Month Calendar Loading — {getLocalizedMonthName(month)} ({year})
          </CardTitle>
          <CardDescription>
            Shows R hours (blue) + M hours (green) stacked out of shift hours. Displays total
            scheduled hours inside each day. Click cell to zoom into that Day timeline.
          </CardDescription>
        </div>

        {/* Month Navigation Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="h-8 px-2.5 text-xs border-border/80 hover:bg-accent cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>

          <span className="text-xs font-semibold px-2.5 py-1 bg-muted/60 rounded border border-border/60 font-mono">
            {getLocalizedMonthName(month)} {year}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="h-8 px-2.5 text-xs border-border/80 hover:bg-accent cursor-pointer"
            title="Next Month"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>

      {/* Helpful banner if viewed month is empty but schedule exists */}
      {totalMonthScheduledMinutes === 0 &&
        slots.length > 0 &&
        earliestSlotMonth &&
        (earliestSlotMonth.month !== month || earliestSlotMonth.year !== year) && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                No operations scheduled in{" "}
                <strong>
                  {getLocalizedMonthName(month)} {year}
                </strong>
                . Active schedule runs are in{" "}
                <strong>
                  {getLocalizedMonthName(earliestSlotMonth.month)} {earliestSlotMonth.year}
                </strong>
                .
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMonthChange?.(earliestSlotMonth.month, earliestSlotMonth.year)}
              className="h-7 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer font-semibold"
            >
              Jump to {getLocalizedMonthName(earliestSlotMonth.month)} {earliestSlotMonth.year}
            </Button>
          </div>
        )}
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted border-b border-border text-slate-700">
              <th className="px-4 py-3 text-left font-bold w-[180px] border-r border-border sticky left-0 bg-muted z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                {machines.some((m) => m.id === "M1" || m.id === "M2")
                  ? "Machine Group"
                  : "Workstation"}
              </th>
              {calendarDays.map((cd, idx) => (
                <th
                  key={idx}
                  className="px-1.5 py-2 text-center font-bold border-r border-border min-w-[65px] font-sans"
                >
                  <div className="text-[10px] text-muted-foreground">{cd.weekday}</div>
                  <div className="text-xs font-bold font-mono">{cd.label.split(".")[0]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-muted/5 transition-colors">
                <td className="px-4 py-2 border-r border-border font-bold bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  {m.name}
                </td>
                {calendarDays.map((cd, idx) => {
                  const loads = getDayScheduledHours(m.id, cd.dayStr);
                  const totalHrs = loads.totalHours;

                  // Percentages for stacked bar
                  const rPct = Math.min(100, (loads.rHours / loads.availableHours) * 100);
                  const mPct = Math.min(100, (loads.mHours / loads.availableHours) * 100);

                  const dayCap = dailyCapacities?.[cd.dayStr];
                  const hasCustomCap = dayCap && (dayCap.setter !== 100 || dayCap.process !== 100);

                  return (
                    <td
                      key={idx}
                      onClick={() => onSelectDay(cd.dayStr)}
                      className="px-1 py-2 text-center border-r border-border/60 cursor-pointer font-mono font-medium transition-all hover:bg-secondary/40 relative h-12 align-middle"
                    >
                      {totalHrs > 0 ? (
                        <div className="flex flex-col items-center justify-center gap-1 h-full w-full">
                          {/* Mini stacked capacity bar */}
                          <div className="w-full h-2 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden flex shadow-inner">
                            <div
                              style={{ width: `${rPct}%` }}
                              className="bg-[#4A90D9] h-full"
                              title={`Setup: ${loads.rHours.toFixed(1)} hrs`}
                            />
                            <div
                              style={{ width: `${mPct}%` }}
                              className="bg-[#52C41A] h-full"
                              title={`Machine: ${loads.mHours.toFixed(1)} hrs`}
                            />
                          </div>
                          <span className="text-[10px] font-extrabold text-foreground">
                            {totalHrs.toFixed(1)} hrs
                          </span>
                          {hasCustomCap && (
                            <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-bold">
                              {dayCap.setter}%/{dayCap.process}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-muted-foreground/30 text-[9px] font-light font-sans">
                            —
                          </span>
                          {hasCustomCap && (
                            <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-bold">
                              {dayCap.setter}%/{dayCap.process}%
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
