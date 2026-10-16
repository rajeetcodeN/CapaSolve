import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft } from "lucide-react";
import { Machine, OrderProcess, Order, ScheduleSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface HourViewProps {
  dateStr: string;
  targetHour: number;
  machines: Machine[];
  processes: OrderProcess[];
  orders: Order[];
  slots: ScheduleSlot[];
  onBack: () => void;
}

export function HourView({
  dateStr,
  targetHour,
  machines,
  processes,
  slots,
  onBack,
}: HourViewProps) {
  // Show exact minute allocation (0 to 59 minutes)
  const minutes = Array.from({ length: 60 });
  const timeLabel = `${String(targetHour).padStart(2, "0")}:00 – ${String(targetHour + 1).padStart(2, "0")}:00`;

  // Helper to map what runs at what minute
  const getMinuteAllocations = (mId: string) => {
    // Find slot of type R or M for this hour and machine
    const hourSlots = slots.filter(
      (s) => s.machineId === mId && s.date === dateStr && s.hourStart === targetHour,
    );

    const minsData = Array.from({ length: 60 }).map(() => ({
      type: "empty",
      processId: "",
      manpowerPct: 0,
      orderCode: "",
    }));

    let currentPtr = 0;
    hourSlots.forEach((s) => {
      const runMins = Math.min(60 - currentPtr, s.minutesUsed);
      const orderCode = s.processId.split("-")[1] || "";

      for (let i = 0; i < runMins; i++) {
        minsData[currentPtr + i] = {
          type: s.slotType,
          processId: s.processId,
          manpowerPct: s.manpowerPct ?? 0,
          orderCode,
        };
      }
      currentPtr += runMins;
    });

    return minsData;
  };

  return (
    <Card className="border border-border/80 shadow-md bg-card">
      <CardHeader className="border-b border-border/50 pb-4 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Clock className="h-5 w-5 text-primary animate-spin-slow" />
            Detailed Minute-Level Zoom —{" "}
            {new Date(dateStr).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "2-digit",
              year: "numeric",
            })}{" "}
            ({timeLabel})
          </CardTitle>
          <CardDescription>
            Visualizes exact minute placement (0 to 59) of Setup R (steel blue) and Machining M
            (green). Secondary bar shows P (manpower pct ratio) below M.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1 bg-background">
          <ArrowLeft className="h-4 w-4" /> Back to Day Timeline
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div
          style={{ width: 220 + 60 * 12 }}
          className="flex flex-col relative select-none text-[9px] font-mono"
        >
          {/* Header Row: Minute Ticks */}
          <div className="flex border-b border-border bg-muted/30">
            <div className="w-[220px] shrink-0 border-r border-border bg-muted/60" />
            <div className="flex">
              {minutes.map((_, idx) => (
                <div
                  key={idx}
                  className="border-r border-border/10 text-center text-muted-foreground flex items-center justify-center font-bold"
                  style={{ width: 12, height: 24 }}
                >
                  {idx % 5 === 0 ? String(idx).padStart(2, "0") : "."}
                </div>
              ))}
            </div>
          </div>

          {/* Workstation Rows */}
          {machines.map((m) => {
            const allocations = getMinuteAllocations(m.id);
            const activeAllocation = allocations.find((a) => a.type !== "empty");

            return (
              <div
                key={m.id}
                className="flex border-b border-border/50 py-1 hover:bg-muted/5 transition-colors"
              >
                <div className="w-[220px] shrink-0 px-4 flex flex-col justify-center border-r border-border font-sans font-bold bg-background">
                  <span className="text-sm font-semibold">{m.name}</span>
                  {activeAllocation?.orderCode && (
                    <span className="text-[10px] text-primary">
                      Running Order: {activeAllocation.orderCode}
                    </span>
                  )}
                </div>

                {/* 60 Minute Cells */}
                <div className="flex relative h-16 items-center">
                  <div className="absolute inset-x-0 top-1.5 h-6 flex border border-slate-100 rounded bg-slate-50 dark:bg-slate-900 overflow-hidden shadow-inner">
                    {allocations.map((a, mIdx) => {
                      let bgClass = "bg-transparent";
                      if (a.type === "R") bgClass = "bg-[#4A90D9]";
                      else if (a.type === "M") bgClass = "bg-[#52C41A]";

                      return (
                        <div
                          key={mIdx}
                          style={{ width: 12 }}
                          className={cn("h-full shrink-0 border-r border-white/5", bgClass)}
                          title={
                            a.type !== "empty"
                              ? `Min ${mIdx}: Order ${a.orderCode} (${a.type === "R" ? "Setup" : "Machining"})`
                              : `Min ${mIdx}: Idle`
                          }
                        />
                      );
                    })}
                  </div>

                  {/* Secondary bar below M: manpowerPct */}
                  <div className="absolute inset-x-0 bottom-1.5 h-4 flex items-end">
                    {allocations.map((a, mIdx) => {
                      const heightPct =
                        a.type === "M" ? a.manpowerPct * 100 : a.type === "R" ? 100 : 0;
                      return (
                        <div
                          key={mIdx}
                          style={{ width: 12 }}
                          className="h-full flex items-end justify-center shrink-0"
                        >
                          {heightPct > 0 && (
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={cn(
                                "w-[60%] shrink-0 shadow-sm",
                                a.type === "R" ? "bg-sky-700/60" : "bg-orange-500/80",
                              )}
                              title={`Min ${mIdx}: Manpower Ratio ${Math.round(heightPct)}%`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
