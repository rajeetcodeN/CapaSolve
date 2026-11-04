import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { useTranslations } from "@/lib/translations";
import { useAppStore } from "@/lib/store";
import { Machine, ScheduleSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface YearViewProps {
  year: number;
  machines: Array<{ id: string; name: string }>;
  slots: ScheduleSlot[];
  onSelectMonth: (monthIdx: number) => void;
}

export function YearView({ year, machines, slots, onSelectMonth }: YearViewProps) {
  const { language } = useTranslations();
  const months =
    language === "de"
      ? ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const { machines: allMachines } = useAppStore();

  // Helper to count calendar days in a month of 2026
  const getDaysInMonth = (monthIdx: number, yr: number) => {
    return new Date(yr, monthIdx + 1, 0).getDate();
  };

  // Pre-aggregate scheduled minutes by machineId/groupId and monthIdx in O(slots) time
  const capacityMap = useMemo(() => {
    const map = new Map<string, number>();
    slots.forEach((s) => {
      if (s.slotType === "R" || s.slotType === "M") {
        const dateParts = s.date.split("-");
        if (dateParts.length === 3) {
          const monthIdx = parseInt(dateParts[1], 10) - 1; // 0-indexed month

          // Machine entry
          const mKey = `${s.machineId}_${monthIdx}`;
          map.set(mKey, (map.get(mKey) || 0) + s.minutesUsed);

          // Group entry
          const machine = allMachines.find((m) => m.id === s.machineId);
          if (machine) {
            const gKey = `${machine.machineGroupId}_${monthIdx}`;
            map.set(gKey, (map.get(gKey) || 0) + s.minutesUsed);
          }
        }
      }
    });
    return map;
  }, [slots, allMachines]);

  const getMonthCapacity = (mId: string, monthIdx: number) => {
    const daysCount = getDaysInMonth(monthIdx, year);

    // Check if mId is a group ID (M1 or M2)
    const isGroup = mId === "M1" || mId === "M2";
    const machinesCount = isGroup ? allMachines.filter((m) => m.machineGroupId === mId).length : 1;

    const totalWorkingHours = daysCount * 14 * machinesCount;

    const totalMinutes = capacityMap.get(`${mId}_${monthIdx}`) || 0;
    const scheduledHours = totalMinutes / 60;
    const ratio = totalWorkingHours > 0 ? scheduledHours / totalWorkingHours : 0;
    return {
      ratio,
      scheduledHours,
      totalWorkingHours,
    };
  };

  return (
    <Card className="border border-border/80 shadow-md bg-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
          <Calendar className="h-5 w-5 text-primary" />
          Yearly Capacity Loading Grid ({year})
        </CardTitle>
        <CardDescription>
          Capacity is the percentage of scheduled working hours (Setup R + Machining M) out of total
          available working hours. Click any cell to open Month view.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted border-b border-border text-slate-700">
              <th className="px-4 py-3 text-left font-bold w-[200px] border-r border-border sticky left-0 bg-muted z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                {machines.some((m) => m.id === "M1" || m.id === "M2")
                  ? "Machine Group"
                  : "Workstation"}
              </th>
              {months.map((mName, idx) => (
                <th
                  key={idx}
                  className="px-2 py-3 text-center font-bold border-r border-border min-w-[75px]"
                >
                  {mName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2 border-r border-border font-bold sticky left-0 bg-background z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  {m.name}
                </td>
                {months.map((_, mIdx) => {
                  const cap = getMonthCapacity(m.id, mIdx);
                  const pct = Math.round(cap.ratio * 100);

                  return (
                    <td
                      key={mIdx}
                      onClick={() => onSelectMonth(mIdx)}
                      className="px-2 py-2 text-center border-r border-border/60 cursor-pointer font-mono transition-all hover:bg-secondary/40 relative h-16 align-middle"
                      title={`Scheduled: ${cap.scheduledHours.toFixed(1)} hrs / Available: ${cap.totalWorkingHours} hrs`}
                    >
                      <div className="flex flex-col items-center justify-center gap-1.5 h-full w-full">
                        {/* Mini capacity load chart progress bar */}
                        <div className="w-full max-w-[55px] h-2 rounded bg-slate-200 dark:bg-slate-800 overflow-hidden flex shadow-inner border border-border/10">
                          <div
                            style={{ width: `${Math.min(100, pct)}%` }}
                            className={cn(
                              "h-full rounded-sm transition-all duration-300",
                              pct > 100
                                ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
                                : pct >= 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-[10px] font-extrabold font-mono",
                            pct > 100
                              ? "text-red-600 dark:text-red-400 animate-pulse font-black"
                              : pct >= 80
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {pct}%
                        </span>
                      </div>
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
