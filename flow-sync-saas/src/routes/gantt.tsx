import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SHIFT_1_START, SHIFT_1_END, SHIFT_2_END, WORKING_HOURS_PER_DAY } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play,
  RotateCcw,
  Factory,
  Layers,
  Calendar,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight,
  Info,
  ArrowLeft,
  CalendarDays,
  Pin,
  Unlock,
} from "lucide-react";
import { ExportButton } from "@/components/ExportButton";

export const Route = createFileRoute("/gantt")({
  head: () => ({
    meta: [
      { title: "Gantt — MFG Scheduler" },
      { name: "description", content: "Interactive drag-and-drop production Gantt chart." },
    ],
  }),
  component: GanttPage,
});

const HOUR_WIDTH = 45; // pixel width per hour cell

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Counts working hours (06:00 to 20:00) between two dates mathematically in O(1) constant time
function getWorkingHoursBetween(start: Date, end: Date): number {
  if (start >= end) return 0;

  const dStart = new Date(start.getTime());
  const dEnd = new Date(end.getTime());

  // Set to midnight to find the difference in calendar days
  const startDay = new Date(dStart.getFullYear(), dStart.getMonth(), dStart.getDate());
  const endDay = new Date(dEnd.getFullYear(), dEnd.getMonth(), dEnd.getDate());

  const diffDays = Math.round((endDay.getTime() - startDay.getTime()) / 86400000);

  if (diffDays === 0) {
    // Same calendar day: count hours within the working range
    const h1 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dStart.getHours()));
    const h2 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dEnd.getHours()));
    return Math.max(0, h2 - h1);
  } else {
    // Different calendar days
    // 1. Working hours on the first day
    const h1 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dStart.getHours()));
    const firstDayHours = Math.max(0, SHIFT_2_END - h1);

    // 2. Working hours on the last day
    const h2 = Math.max(SHIFT_1_START, Math.min(SHIFT_2_END, dEnd.getHours()));
    const lastDayHours = Math.max(0, h2 - SHIFT_1_START);

    // 3. Working hours for full days in between
    const middleDaysHours = (diffDays - 1) * WORKING_HOURS_PER_DAY;

    return firstDayHours + middleDaysHours + lastDayHours;
  }
}

function GanttPage() {
  const store = useAppStore();
  const {
    orders,
    processes,
    machines,
    machineGroups,
    slots,
    warnings,
    loadDefaultCSV,
    optimizationMode,
    dailyCapacities,
    allowProcessOverlap,
    allowSopOverride,
    maxUtilizeResources,
    globalSetterCapacity,
    globalOperatorCapacity,
    maxPreponeWeeks,
    role,
    plan,
  } = store;

  // Wrapped actions that enforce role permission:
  const checkDev = <T extends (...args: any[]) => any>(action: T, errorMsg: string): T => {
    return ((...args: Parameters<T>) => {
      if (role !== "DEVELOPER" && role !== "ADMIN") {
        toast.error(`Access Denied: ${errorMsg}`);
        return;
      }
      return action(...args);
    }) as unknown as T;
  };

  const runScheduler = checkDev(store.runScheduler, "Only Developers can run optimization.");
  const updateSlotSchedule = checkDev(store.updateSlotSchedule, "Only Developers can reschedule slots.");
  const setOptimizationMode = checkDev(store.setOptimizationMode, "Only Developers can change optimization modes.");
  const setDailyCapacity = checkDev(store.setDailyCapacity, "Only Developers can override daily capacity.");
  const setAllowProcessOverlap = checkDev(store.setAllowProcessOverlap, "Only Developers can adjust scheduling parameters.");
  const setAllowSopOverride = checkDev(store.setAllowSopOverride, "Only Developers can adjust scheduling parameters.");
  const setMaxUtilizeResources = checkDev(store.setMaxUtilizeResources, "Only Developers can adjust scheduling parameters.");
  const resetProcessToAuto = checkDev(store.resetProcessToAuto, "Only Developers can reset process overrides.");
  const pinProcessSchedule = checkDev(store.pinProcessSchedule, "Only Developers can pin overrides.");
  const setGlobalSetterCapacity = checkDev(store.setGlobalSetterCapacity, "Only Developers can edit capacity ceilings.");
  const setGlobalOperatorCapacity = checkDev(store.setGlobalOperatorCapacity, "Only Developers can edit capacity ceilings.");
  const setMaxPreponeWeeks = checkDev(store.setMaxPreponeWeeks, "Only Developers can adjust scheduling parameters.");

  const { t, language } = useTranslations();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeOptimizationMode = (optimizationMode !== "pre" && optimizationMode !== "workstation" && optimizationMode !== "full") ? "full" : optimizationMode;

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"workstation" | "group">("workstation");

  const filteredGroups = useMemo(() => {
    const groups = machineGroups || [
      { id: "M1", name: "M1" },
      { id: "M2", name: "M2" }
    ];
    return groups.filter((g) => {
      if (filterGroup === "ALL") return true;
      return g.id === filterGroup;
    });
  }, [machineGroups, filterGroup]);

  // Zoom Level State Chain: YEAR -> WEEK -> DAY -> HOUR
  const [zoomLevel, setZoomLevel] = useState<"YEAR" | "WEEK" | "DAY" | "HOUR">("DAY");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(5); // 0-indexed: 5 = Juni
  const [selectedDayStr, setSelectedDayStr] = useState<string>("2026-06-01");
  const [selectedHour, setSelectedHour] = useState<number>(10);
  const [showAllAlerts, setShowAllAlerts] = useState<boolean>(false);

  // Advanced Drag and Drop States
  const [activeDragProcessId, setActiveDragProcessId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ machineId: string; dateStr: string; hour: number } | null>(null);

  // Auto-schedule if data exists but scheduler has not run yet
  useEffect(() => {
    if (processes.length > 0 && slots.length === 0) {
      useAppStore.getState().runScheduler();
    }
  }, [processes.length, slots.length]);



  const [isOptimizing, setIsOptimizing] = useState(false);

  const onGenerate = async () => {
    setIsOptimizing(true);
    const start = Date.now();
    try {
      await runScheduler();
      const duration = Date.now() - start;
      const slotCount = useAppStore.getState().slots.length;
      const warnCount = useAppStore.getState().warnings.length;

      toast.success(
        language === "de"
          ? `Server-Optimierung abgeschlossen in ${duration} ms (${slotCount} Slots geplant)`
          : `Server Optimization Complete in ${duration} ms (${slotCount} slots scheduled)`
      );

      if (warnCount > 0) {
        toast.warning(
          language === "de"
            ? `${warnCount} Kapazitäts-Überlastungsmeldungen gefunden.`
            : `${warnCount} capacity overload warnings detected.`
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Optimization failed.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const selectedProcess = useMemo(() => {
    return processes.find((p) => p.id === selectedProcessId) || null;
  }, [selectedProcessId, processes]);

  const selectedOrder = useMemo(() => {
    if (!selectedProcess) return null;
    return orders.find((o) => o.id === selectedProcess.orderId) || null;
  }, [selectedProcess, orders]);

  // Handle HTML5 Drag and Drop Drops
  const handleDrop = (e: React.DragEvent, targetMachineId: string, dateStr: string, hourStart: number) => {
    e.preventDefault();
    const dragProcessId = e.dataTransfer.getData("text/plain");
    setActiveDragProcessId(null);
    setDragOverCell(null);
    if (!dragProcessId) return;

    updateSlotSchedule(dragProcessId, targetMachineId, dateStr, hourStart);
    toast.success(t("gantt.toastResched", { machine: targetMachineId }));
  };

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (filterGroup === "ALL") return true;
      return m.machineGroupId === filterGroup;
    });
  }, [machines, filterGroup]);

  // Helper to get Month name based on active language
  const getLocalizedMonthName = (monthIdx: number) => {
    const monthsDe = [
      "Januar", "Februar", "März", "April", "Mai", "Juni",
      "Juli", "August", "September", "Oktober", "November", "Dezember"
    ];
    const monthsEn = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return language === "de" ? (monthsDe[monthIdx] || "Juni") : (monthsEn[monthIdx] || "June");
  };

  // Helper to get Week number
  const getWeekNumber = (dateVal: Date) => {
    const date = new Date(dateVal.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  // 1. Calculate scheduling timeline date range
  const timelineRange = useMemo(() => {
    const scheduled = processes.filter((p) => p.status === "SCHEDULED" && p.scheduledStart);
    if (scheduled.length === 0) return null;

    let minDate = new Date(scheduled[0].scheduledStart!);
    let maxDate = new Date(scheduled[0].scheduledEnd!);

    scheduled.forEach((p) => {
      const start = new Date(p.scheduledStart!);
      const end = new Date(p.scheduledEnd!);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    });

    // Expand by 1 day on both sides for safety margin
    minDate.setDate(minDate.getDate() - 1);
    minDate.setHours(SHIFT_1_START, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + 2);
    maxDate.setHours(SHIFT_2_END, 0, 0, 0);

    const daysList: string[] = [];
    const ptr = new Date(minDate.getTime());
    while (ptr < maxDate) {
      daysList.push(formatDateStr(ptr));
      ptr.setDate(ptr.getDate() + 1);
    }

    return {
      start: minDate,
      end: maxDate,
      days: daysList,
      totalHours: daysList.length * WORKING_HOURS_PER_DAY,
    };
  }, [processes]);

  // Scroll to selected date on timeline
  useEffect(() => {
    if (scrollContainerRef.current && timelineRange) {
      const dayIdx = timelineRange.days.indexOf(selectedDayStr);
      if (dayIdx !== -1) {
        const offset = dayIdx * WORKING_HOURS_PER_DAY * HOUR_WIDTH;
        scrollContainerRef.current.scrollTo({
          left: offset,
          behavior: "smooth"
        });
      }
    }
  }, [selectedDayStr, timelineRange]);

  const activeDragProcess = useMemo(() => {
    if (!activeDragProcessId) return null;
    return processes.find((p) => p.id === activeDragProcessId) || null;
  }, [activeDragProcessId, processes]);

  const dragProjection = useMemo(() => {
    if (!activeDragProcess || !dragOverCell || !timelineRange) return null;
    
    // Create a start pointer based on hovered cell
    const startD = new Date(`${dragOverCell.dateStr}T${String(dragOverCell.hour).padStart(2, "0")}:00:00`);
    
    // Simulate schedule slots just like allocateSlotsForProcess to compute the correct endD (handling shift boundaries!)
    let ptr = new Date(startD.getTime());
    let remainingMin = activeDragProcess.totalTimeMin;
    
    const localAlignToWorkingHours = (d: Date) => {
      const h = d.getHours();
      if (h < SHIFT_1_START) {
        d.setHours(SHIFT_1_START, 0, 0, 0);
      } else if (h >= SHIFT_2_END) {
        d.setDate(d.getDate() + 1);
        d.setHours(SHIFT_1_START, 0, 0, 0);
      }
    };

    while (remainingMin > 0) {
      localAlignToWorkingHours(ptr);
      const hour = ptr.getHours();
      const minutesInSlot = Math.min(60, remainingMin);
      remainingMin -= minutesInSlot;
      ptr.setHours(ptr.getHours() + 1);
    }
    const endD = new Date(ptr.getTime());

    // Calculate offsets
    const leftWorkingHours = getWorkingHoursBetween(timelineRange.start, startD);
    const durationHours = getWorkingHoursBetween(startD, endD);
    const leftOffset = leftWorkingHours * HOUR_WIDTH;
    const widthVal = durationHours * HOUR_WIDTH;

    return {
      machineId: dragOverCell.machineId,
      leftOffset,
      widthVal,
      setupTimeMin: activeDragProcess.setupTimeMin,
      sumV2: activeDragProcess.sumV2,
      manpowerPct: activeDragProcess.manpowerPct,
      processId: activeDragProcess.processId,
      orderCode: activeDragProcess.id.split("-")[1] || "",
    };
  }, [activeDragProcess, dragOverCell, timelineRange]);

  if (orders.length === 0 || !timelineRange) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Factory className="h-10 w-10 text-muted-foreground animate-bounce" />
        <h2 className="text-xl font-semibold">Generate Production Plan</h2>
        <p className="text-muted-foreground max-w-sm">
          Seeded process steps must be scheduled to visualize the hourly Gantt timeline.
        </p>
        <Button onClick={onGenerate} className="gap-2 bg-primary text-primary-foreground">
          <Play className="h-4 w-4" /> Run Scheduler
        </Button>
      </div>
    );
  }

  const { start: timelineStart, days, totalHours } = timelineRange;

  return (
    <div className="space-y-6 relative pb-10 animate-in fade-in duration-200">

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interactive Gantt Timeline</h1>
          <p className="text-muted-foreground text-sm">
            Zoom down from high-level yearly capacity grids all the way down into minute-level scheduling.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="view-mode" className="text-xs font-semibold text-muted-foreground">Timeline View:</Label>
            <Select value={viewMode} onValueChange={(val: any) => setViewMode(val)}>
              <SelectTrigger id="view-mode" className="w-[125px] h-8 text-xs bg-background">
                <SelectValue placeholder="View Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workstation">Workstations</SelectItem>
                <SelectItem value="group">Machine Groups</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="group-filter" className="text-xs font-semibold text-muted-foreground">Machine Group:</Label>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger id="group-filter" className="w-[110px] h-8 text-xs bg-background">
                <SelectValue placeholder="Filter Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Groups</SelectItem>
                <SelectItem value="M1">Group M1</SelectItem>
                <SelectItem value="M2">Group M2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="date-select" className="text-xs font-semibold text-muted-foreground">Go to Date:</Label>
            <Input
              id="date-select"
              type="date"
              value={selectedDayStr}
              onChange={(e) => {
                if (e.target.value) {
                  const parts = e.target.value.split("-");
                  if (parts.length === 3) {
                    const yr = parseInt(parts[0], 10);
                    const mo = parseInt(parts[1], 10) - 1;
                    setSelectedDayStr(e.target.value);
                    setSelectedMonth(mo);
                    setSelectedYear(yr);
                    setZoomLevel("DAY");
                    toast.success(`Jumped to date: ${e.target.value}`);
                  }
                }
              }}
              className="w-[130px] h-8 text-xs bg-background font-mono px-2 py-1"
            />
          </div>
          <Legend />
          <ExportButton size="sm" />
          <Button onClick={onGenerate} disabled={isOptimizing} size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 min-w-[150px]">
            <RotateCcw className={cn("h-4 w-4", isOptimizing && "animate-spin")} />
            {isOptimizing ? (language === "de" ? "Optimieren..." : "Optimizing...") : (language === "de" ? "Neu Optimieren" : "Re-Optimize Schedule")}
          </Button>
        </div>
      </div>

      {/* Schedule Optimization Mode & Comparison Summary */}
      <div className="grid gap-6 md:grid-cols-4 animate-in fade-in duration-300">
        <Card className="md:col-span-2 border border-border/80 shadow-sm bg-card flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              Production Schedule Optimizer
            </CardTitle>
            <CardDescription>
              Compare the raw, un-optimized overlapping SOP schedule against our machine-resolved and staff-optimized configurations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex bg-muted p-1 rounded-lg border border-border shadow-sm flex-wrap gap-1">
                <Button
                  variant={activeOptimizationMode === "pre" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setOptimizationMode("pre")}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 h-8 transition-all duration-200",
                    activeOptimizationMode === "pre" ? "bg-red-500 hover:bg-red-600 text-white font-extrabold shadow" : "text-muted-foreground"
                  )}
                >
                  Pre-Optimization
                </Button>
                <Button
                  variant={activeOptimizationMode === "workstation" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setOptimizationMode("workstation")}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 h-8 transition-all duration-200",
                    activeOptimizationMode === "workstation" ? "bg-sky-600 hover:bg-sky-700 text-white font-extrabold shadow" : "text-muted-foreground"
                  )}
                >
                  Workstation-Optimized
                </Button>
                <Button
                  variant={activeOptimizationMode === "full" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setOptimizationMode("full")}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 h-8 transition-all duration-200",
                    activeOptimizationMode === "full" ? "bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow" : "text-muted-foreground"
                  )}
                >
                  Fully-Optimized
                </Button>
              </div>
              
              <div className="text-xs leading-snug max-w-sm">
                {activeOptimizationMode === "pre" ? (
                  <span className="text-red-500 font-semibold flex items-center gap-1">
                    ⚠ Warning: active machine overlaps and employee conflicts displayed.
                  </span>
                ) : activeOptimizationMode === "workstation" ? (
                  <span className="text-sky-600 font-semibold flex items-center gap-1">
                    ℹ Workstation overlaps resolved. Stacking manpower spikes may remain.
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    ✔ Fully Optimized: both machine overlaps and staffing overloads resolved!
                  </span>
                )}
              </div>
            </div>
            {activeOptimizationMode === "full" && (
              <div className="flex flex-col gap-2.5 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <input
                    id="process-overlap-checkbox"
                    type="checkbox"
                    checked={allowProcessOverlap}
                    onChange={(e) => {
                      setAllowProcessOverlap(e.target.checked);
                      toast.success(e.target.checked ? "Process overlap enabled! Concurrency allowed in machine groups." : "Process overlap disabled! Machine groups serialized.");
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Label htmlFor="process-overlap-checkbox" className="text-xs font-bold text-foreground cursor-pointer flex flex-col md:flex-row md:items-center gap-x-2 gap-y-0.5">
                    <span>Allow Process Overlap in Group</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(Allows concurrent machining in same group while sequencing setups based on resources)</span>
                  </Label>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="sop-override-checkbox"
                      type="checkbox"
                      checked={allowSopOverride}
                      onChange={(e) => {
                        setAllowSopOverride(e.target.checked);
                        toast.success(e.target.checked ? "SOP Override enabled! Orders can be scheduled earlier than their SOP dates." : "SOP Override disabled! SOP start dates strictly enforced.");
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <Label htmlFor="sop-override-checkbox" className="text-xs font-bold text-foreground cursor-pointer flex flex-col md:flex-row md:items-center gap-x-2 gap-y-0.5">
                      <span>Allow SOP Start Date Override</span>
                      <span className="text-[10px] text-muted-foreground font-normal">(Bypasses parent order SOP start date constraint to schedule processes earlier when resources are free)</span>
                    </Label>
                  </div>
                  {allowSopOverride && (
                    <div className="ml-6 space-y-1 bg-slate-500/[0.03] dark:bg-slate-900/40 p-2 rounded border border-border/40 max-w-sm animate-in fade-in duration-200">
                      <Label htmlFor="max-prepone-gantt" className="text-[10px] font-bold text-muted-foreground uppercase">
                        {t("gantt.maxPreponeLimit")}
                      </Label>
                      <Select
                        value={String(maxPreponeWeeks)}
                        onValueChange={(val) => setMaxPreponeWeeks(parseInt(val, 10))}
                      >
                        <SelectTrigger id="max-prepone-gantt" className="h-7 text-[11px] bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">{t("gantt.maxPreponeNoLimit")}</SelectItem>
                          <SelectItem value="1">{language === "de" ? "1 Woche" : "1 Week"}</SelectItem>
                          <SelectItem value="2">{language === "de" ? "2 Wochen" : "2 Weeks"}</SelectItem>
                          <SelectItem value="3">{language === "de" ? "3 Wochen" : "3 Weeks"}</SelectItem>
                          <SelectItem value="4">{language === "de" ? "4 Wochen (1 Monat)" : "4 Weeks (1 Month)"}</SelectItem>
                          <SelectItem value="8">{language === "de" ? "8 Wochen (2 Monate)" : "8 Weeks (2 Months)"}</SelectItem>
                          <SelectItem value="12">{language === "de" ? "12 Wochen (3 Monate)" : "12 Weeks (3 Months)"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="max-utilize-checkbox"
                    type="checkbox"
                    checked={maxUtilizeResources}
                    onChange={(e) => {
                      setMaxUtilizeResources(e.target.checked);
                      toast.success(e.target.checked ? "Max Utilize enabled! Shifting within the same machine group is allowed." : "Max Utilize disabled! Shifting within group is disallowed.");
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Label htmlFor="max-utilize-checkbox" className="text-xs font-bold text-foreground cursor-pointer flex flex-col md:flex-row md:items-center gap-x-2 gap-y-0.5">
                    <span>Max Utilize (Shift in Group)</span>
                    <span className="text-[10px] text-muted-foreground font-normal">(Allows shifting processes to other machines in same group, strictly respecting capacities)</span>
                  </Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
                {/* Capacity Limits Editor */}
        <Card className="border border-border/80 shadow-sm bg-card flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              Capacity Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="grid grid-cols-2 h-7 p-0.5 bg-muted">
                <TabsTrigger value="global" className="text-[10px] py-1 h-6">Global Defaults</TabsTrigger>
                <TabsTrigger value="daily" className="text-[10px] py-1 h-6">Daily Overrides</TabsTrigger>
              </TabsList>
              
              <TabsContent value="global" className="space-y-2 mt-2">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10.5px]">
                    <Label htmlFor="global-setter-cap" className="font-semibold text-muted-foreground uppercase">Global Setter Cap</Label>
                    <span className="font-mono font-bold text-primary">{globalSetterCapacity}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="global-setter-cap"
                      type="number"
                      min={0}
                      max={1000}
                      step={10}
                      value={globalSetterCapacity}
                      onChange={(e) => setGlobalSetterCapacity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-7 text-xs font-mono w-[80px]"
                    />
                    <span className="text-xs font-bold text-muted-foreground font-mono">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10.5px]">
                    <Label htmlFor="global-operator-cap" className="font-semibold text-muted-foreground uppercase">Global Worker Cap</Label>
                    <span className="font-mono font-bold text-primary">{globalOperatorCapacity}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="global-operator-cap"
                      type="number"
                      min={0}
                      max={1000}
                      step={10}
                      value={globalOperatorCapacity}
                      onChange={(e) => setGlobalOperatorCapacity(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-7 text-xs font-mono w-[80px]"
                    />
                    <span className="text-xs font-bold text-muted-foreground font-mono">%</span>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="daily" className="space-y-2 mt-2">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10.5px]">
                    <Label htmlFor="setter-cap-input" className="font-semibold text-muted-foreground uppercase">Setter (Setup) Cap</Label>
                    <span className="font-mono font-bold text-primary">{(dailyCapacities?.[selectedDayStr]?.setter ?? globalSetterCapacity)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="setter-cap-input"
                      type="number"
                      min={0}
                      max={1000}
                      step={10}
                      value={dailyCapacities?.[selectedDayStr]?.setter ?? globalSetterCapacity}
                      onChange={(e) => setDailyCapacity(selectedDayStr, { setter: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 text-xs font-mono w-[80px]"
                    />
                    <span className="text-xs font-bold text-muted-foreground font-mono">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10.5px]">
                    <Label htmlFor="operator-cap-input" className="font-semibold text-muted-foreground uppercase">Operator (Worker) Cap</Label>
                    <span className="font-mono font-bold text-primary">{(dailyCapacities?.[selectedDayStr]?.process ?? globalOperatorCapacity)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="operator-cap-input"
                      type="number"
                      min={0}
                      max={1000}
                      step={10}
                      value={dailyCapacities?.[selectedDayStr]?.process ?? globalOperatorCapacity}
                      onChange={(e) => setDailyCapacity(selectedDayStr, { process: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-7 text-xs font-mono w-[80px]"
                    />
                    <span className="text-xs font-bold text-muted-foreground font-mono">%</span>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Optimization Summary Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Workstation Collisions</span>
              <div className="flex items-baseline gap-1.5">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  slots.filter((s) => s.collision).length > 0 ? "text-red-500 animate-pulse" : "text-emerald-600"
                )}>
                  {slots.filter((s) => s.collision).length}
                </span>
                <span className="text-[9px] text-muted-foreground">total collisions</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Staffing Alerts</span>
              <div className="flex items-baseline gap-1.5">
                <span className={cn(
                  "text-xl font-bold font-mono",
                  warnings.filter(w => w.includes("Operator overload")).length > 5 ? "text-red-500" : "text-amber-500"
                )}>
                  {warnings.filter(w => w.includes("Operator overload")).length}
                </span>
                <span className="text-[9px] text-muted-foreground">total overloads</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breadcrumb Navigation Bar */}
      <div className="flex items-center gap-1.5 text-xs bg-muted/40 border border-border/50 px-4 py-2.5 rounded-lg font-medium shadow-sm w-full overflow-x-auto whitespace-nowrap">
        <span 
          className={cn("cursor-pointer hover:text-primary transition-colors text-muted-foreground font-semibold uppercase", zoomLevel === "YEAR" ? "text-foreground font-extrabold underline decoration-2 decoration-primary underline-offset-4" : "")}
          onClick={() => setZoomLevel("YEAR")}
        >
          {selectedYear}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span 
          className={cn("cursor-pointer hover:text-primary transition-colors text-muted-foreground font-semibold uppercase", zoomLevel === "WEEK" ? "text-foreground font-extrabold underline decoration-2 decoration-primary underline-offset-4" : "")}
          onClick={() => {
            setSelectedMonth(new Date(selectedDayStr).getMonth());
            setZoomLevel("WEEK");
          }}
        >
          {getLocalizedMonthName(selectedMonth)}
        </span>
        {(zoomLevel === "DAY" || zoomLevel === "HOUR") && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span 
              className={cn("cursor-pointer hover:text-primary transition-colors text-muted-foreground font-semibold", zoomLevel === "DAY" ? "text-foreground font-extrabold underline decoration-2 decoration-primary underline-offset-4" : "")}
              onClick={() => setZoomLevel("DAY")}
            >
              Woche {getWeekNumber(new Date(selectedDayStr))}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span 
              className={cn("cursor-pointer hover:text-primary transition-colors text-muted-foreground font-semibold", zoomLevel === "DAY" ? "text-foreground font-extrabold underline decoration-2 decoration-primary underline-offset-4" : "")}
              onClick={() => setZoomLevel("DAY")}
            >
              {new Date(selectedDayStr).toLocaleDateString("de-DE", { weekday: 'long', day: '2-digit', month: 'short' })}
            </span>
          </>
        )}
        {zoomLevel === "HOUR" && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground font-extrabold underline decoration-2 decoration-primary underline-offset-4 font-mono">
              {String(selectedHour).padStart(2, "0")}:00
            </span>
          </>
        )}
      </div>

      {warnings.length > 0 && zoomLevel === "DAY" && (
        <Card className="border-red-500/20 bg-red-500/5 p-4 text-xs shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-red-500/15 pb-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400">
              <Info className="h-4 w-4 shrink-0" />
              Scheduling & Stacking Alerts ({warnings.length})
            </div>
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowAllAlerts(!showAllAlerts)}
              className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 h-auto p-0"
            >
              {showAllAlerts ? "Show Less" : `View Full Details (${warnings.length})`}
            </Button>
          </div>
          
          <div className={cn("overflow-y-auto pr-2", showAllAlerts ? "max-h-[320px] space-y-2" : "")}>
            <ul className="list-inside list-disc text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 font-mono">
              {(showAllAlerts ? warnings : warnings.slice(0, 4)).map((w, i) => (
                <li key={i} className="whitespace-pre-line leading-relaxed border-b border-red-500/10 pb-2">{w}</li>
              ))}
              {!showAllAlerts && warnings.length > 4 && (
                <li className="font-bold text-primary list-none mt-1">
                  …and {warnings.length - 4} more staffing/collision overlaps. Click "View Full Details" to see all.
                </li>
              )}
            </ul>
          </div>
        </Card>
      )}

      {/* Conditionally Render Drill-Down ZOOM Views */}
      
      {/* 1. YEAR VIEW */}
      {zoomLevel === "YEAR" && (
        <YearView
          year={selectedYear}
          machines={viewMode === "group" ? filteredGroups : filteredMachines}
          slots={slots}
          onSelectMonth={(mIdx) => {
            setSelectedMonth(mIdx);
            // Default select first day of that month
            const defaultDateStr = `2026-${String(mIdx + 1).padStart(2, "0")}-01`;
            setSelectedDayStr(defaultDateStr);
            setZoomLevel("WEEK");
          }}
        />
      )}

      {/* 2. WEEK VIEW */}
      {zoomLevel === "WEEK" && (
        <WeekView
          year={selectedYear}
          month={selectedMonth}
          getLocalizedMonthName={getLocalizedMonthName}
          machines={viewMode === "group" ? filteredGroups : filteredMachines}
          slots={slots}
          onSelectDay={(dayStr) => {
            setSelectedDayStr(dayStr);
            setZoomLevel("DAY");
          }}
        />
      )}

      {/* 3. DAY VIEW (Main Draggable Hourly Timeline) */}
      {zoomLevel === "DAY" && (
        <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
          <div ref={scrollContainerRef} className="overflow-x-auto max-w-full">
            <div style={{ width: 220 + totalHours * HOUR_WIDTH }} className="flex flex-col relative select-none">
              
              {/* Header block (Days & Shifts) */}
              <div className="flex border-b border-border bg-muted/60 sticky top-0 z-20">
                <div className="w-[220px] shrink-0 border-r border-border px-4 py-3 bg-muted/95 sticky left-0 z-30 flex items-center font-bold text-xs uppercase tracking-wider text-muted-foreground shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  {viewMode === "group" ? "Machine Group" : "Workstation / Line"}
                </div>
                <div className="flex">
                  {days.map((dayStr) => {
                    const displayDate = new Date(dayStr).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });
                    const dayCap = dailyCapacities?.[dayStr] || { setter: 100, process: 200 };

                    const setterAvail = (dayCap.setter / 100) * 14 * 60;
                    const operatorAvail = (dayCap.process / 100) * 14 * 60;

                    let setterUsed = 0;
                    let operatorUsed = 0;

                    slots.forEach((s) => {
                      if (s.date === dayStr) {
                        if (s.slotType === "R") {
                          setterUsed += s.minutesUsed;
                        } else if (s.slotType === "M") {
                          operatorUsed += s.minutesUsed * (s.manpowerPct ?? 0);
                        }
                      }
                    });

                    const setterUtil = setterAvail > 0 ? Math.round((setterUsed / setterAvail) * 100) : 0;
                    const operatorUtil = operatorAvail > 0 ? Math.round((operatorUsed / operatorAvail) * 100) : 0;

                    return (
                      <div
                        key={dayStr}
                        className={cn(
                          "flex flex-col border-r border-border/70 cursor-pointer hover:bg-muted/90 transition-colors",
                          dayStr === selectedDayStr ? "bg-primary/[0.02] ring-1 ring-primary/20 ring-inset" : ""
                        )}
                        style={{ width: WORKING_HOURS_PER_DAY * HOUR_WIDTH }}
                        onClick={() => {
                          setSelectedDayStr(dayStr);
                          const d = new Date(dayStr);
                          setSelectedMonth(d.getMonth());
                          setSelectedYear(d.getFullYear());
                        }}
                      >
                        <div className={cn(
                          "border-b border-border/40 px-3 py-1 text-[11px] font-bold text-foreground bg-muted/30 flex flex-col gap-0.5",
                          dayStr === selectedDayStr ? "bg-primary/5 text-primary" : ""
                        )}>
                          <div className="flex items-center gap-1.5 justify-between">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3 w-3 text-primary" />
                              {displayDate}
                            </div>
                            {dayStr === selectedDayStr && (
                              <span className="text-[8px] bg-primary text-primary-foreground px-1.2 py-0.2 rounded font-sans uppercase font-extrabold scale-95">Sel</span>
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono flex gap-x-2 flex-wrap">
                            <span title={`Setup R Used: ${setterUsed.toFixed(0)}m / Avail: ${setterAvail.toFixed(0)}m`}>
                              S: {dayCap.setter}% ({setterUtil}% U)
                            </span>
                            <span title={`Machining M Operator Used: ${operatorUsed.toFixed(0)}m / Avail: ${operatorAvail.toFixed(0)}m`}>
                              P: {dayCap.process}% ({operatorUtil}% U)
                            </span>
                          </div>
                        </div>
                        <div className="flex text-[9px] font-semibold text-muted-foreground">
                          <div
                            className="border-r border-border/30 px-2 py-0.5 bg-sky-500/5 text-center"
                            style={{ width: 7 * HOUR_WIDTH }}
                          >
                            Shift 1 (06:00–13:00)
                          </div>
                          <div
                            className="px-2 py-0.5 bg-orange-500/5 text-center"
                            style={{ width: 7 * HOUR_WIDTH }}
                          >
                            Shift 2 (13:00–20:00)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Header block (Individual Hours 6 - 19) */}
              <div className="flex border-b border-border/60 bg-muted/30">
                <div className="w-[220px] shrink-0 border-r border-border bg-muted sticky left-0 z-20" />
                <div className="flex">
                  {days.map((dayStr) => (
                    <div key={dayStr} className={cn("flex", dayStr === selectedDayStr ? "bg-primary/[0.015]" : "")}>
                      {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                        const hr = SHIFT_1_START + hIdx;
                        return (
                          <div
                            key={hr}
                            onClick={() => {
                              setSelectedDayStr(dayStr);
                              setSelectedHour(hr);
                              setZoomLevel("HOUR");
                            }}
                            className={cn(
                              "border-r border-border/20 text-[9px] font-mono text-muted-foreground flex items-center justify-center bg-background hover:bg-secondary cursor-pointer transition-colors",
                              dayStr === selectedDayStr ? "bg-primary/[0.04] text-primary font-bold" : ""
                            )}
                            style={{ width: HOUR_WIDTH, height: 20 }}
                          >
                            {String(hr).padStart(2, "0")}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Workstations or Group Grid Rows */}
              {viewMode === "workstation" ? (
                filteredMachines.map((m) => {
                  const machineProcesses = processes.filter(
                    (p) => p.status === "SCHEDULED" && p.machineId === m.id && p.scheduledStart
                  );

                  return (
                    <div key={m.id} className="flex border-b border-border/60 hover:bg-muted/5 transition-colors">
                      {/* Frozen workstation selector cell */}
                      <div className="w-[220px] shrink-0 border-r border-border px-4 py-2.5 bg-background sticky left-0 z-20 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div>
                          <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {m.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Group {m.machineGroupId}</div>
                        </div>
                      </div>

                      {/* Hourly background grid dropzone */}
                      <div
                        className="relative flex items-center"
                        style={{
                          width: totalHours * HOUR_WIDTH,
                          height: 48,
                        }}
                      >
                        {/* Background hour grid dividers */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {days.map((dayStr) => (
                            <div key={dayStr} className={cn("flex h-full", dayStr === selectedDayStr ? "bg-primary/[0.015]" : "")}>
                              {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                                const hr = SHIFT_1_START + hIdx;
                                const isShift1 = hr < SHIFT_1_END;
                                const isOver = dragOverCell && dragOverCell.machineId === m.id && dragOverCell.dateStr === dayStr && dragOverCell.hour === hr;
                                return (
                                  <div
                                    key={hr}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      if (!dragOverCell || dragOverCell.machineId !== m.id || dragOverCell.dateStr !== dayStr || dragOverCell.hour !== hr) {
                                        setDragOverCell({ machineId: m.id, dateStr: dayStr, hour: hr });
                                      }
                                    }}
                                    onDragLeave={() => {
                                      setDragOverCell((curr) => curr && curr.machineId === m.id && curr.dateStr === dayStr && curr.hour === hr ? null : curr);
                                    }}
                                    onDrop={(e) => handleDrop(e, m.id, dayStr, hr)}
                                    className={cn(
                                      "h-full border-r border-border/10 pointer-events-auto cursor-crosshair transition-all duration-150",
                                      isOver ? "bg-primary/25 ring-2 ring-primary/40 ring-inset" : (
                                        isShift1 ? "bg-sky-500/[0.015] hover:bg-sky-500/10" : "bg-orange-500/[0.015] hover:bg-orange-500/10"
                                      ),
                                      hr === SHIFT_1_END ? "border-r-2 border-border/40" : "",
                                      dayStr === selectedDayStr ? "bg-primary/[0.03]" : ""
                                    )}
                                    style={{ width: HOUR_WIDTH }}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        {/* Process draggable block overlays */}
                        {machineProcesses.map((p) => {
                          const order = orders.find((o) => o.id === p.orderId);
                          if (!order || !p.scheduledStart || !p.scheduledEnd) return null;

                          const startD = new Date(p.scheduledStart);
                          const endD = new Date(p.scheduledEnd);

                          // Calculate absolute offsets in working hours
                          const leftWorkingHours = getWorkingHoursBetween(timelineStart, startD);
                          const durationHours = getWorkingHoursBetween(startD, endD);

                          const leftOffset = leftWorkingHours * HOUR_WIDTH;
                          const widthVal = durationHours * HOUR_WIDTH;

                          // Check if this process has any overloaded hour slots or machine collisions
                          const isOverloaded = slots.some((sl) => sl.processId === p.id && sl.overloaded);
                          const isColliding = slots.some((sl) => sl.processId === p.id && sl.collision);

                          // Draw Setup portion vs Machining portion visually inside the block
                          const setupHours = Math.ceil(p.setupTimeMin / 60);
                          const setupWidth = Math.min(setupHours * HOUR_WIDTH, widthVal);

                          return (
                            <div
                              key={p.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", p.id);
                                e.dataTransfer.effectAllowed = "move";
                                setActiveDragProcessId(p.id);
                              }}
                              onDragEnd={() => {
                                setActiveDragProcessId(null);
                                setDragOverCell(null);
                              }}
                              onClick={() => setSelectedProcessId(p.id)}
                              className={cn(
                                "absolute h-9 rounded-md shadow-sm border border-border/60 overflow-hidden flex cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary hover:shadow-md transition-all select-none z-10 group",
                                activeDragProcessId === p.id ? "opacity-20 border-dashed bg-muted shadow-none border-slate-400" : (
                                  isColliding ? "border-red-600 ring-2 ring-red-500/40 bg-red-50/20" : isOverloaded ? "border-red-500 ring-2 ring-red-500/30" : ""
                                ),
                                selectedProcessId === p.id && activeDragProcessId !== p.id ? "ring-2 ring-primary ring-offset-1 border-primary" : ""
                              )}
                              style={{
                                left: leftOffset + 2,
                                width: widthVal - 4,
                              }}
                            >
                              {/* Setup portion (Steel blue R block) */}
                              {setupWidth > 0 && (
                                <div
                                  style={{ width: setupWidth }}
                                  className="h-full bg-[#4A90D9] text-white flex items-center justify-center px-1.5 text-[10px] font-extrabold truncate shrink-0 border-r border-white/20"
                                  title={`Setup R: ${p.setupTimeMin} min (100% Operator)`}
                                >
                                  R {order.orderId}
                                </div>
                              )}

                              {/* Machining portion (Emerald green by default, RED on collision/overload) */}
                              <div
                                className={cn(
                                  "h-full flex-1 text-white flex items-center justify-between px-2 text-[10px] font-bold truncate transition-colors",
                                  (isColliding || isOverloaded) ? "bg-red-500 animate-pulse font-extrabold" : "bg-[#52C41A]"
                                )}
                                title={(isColliding || isOverloaded) ? `OVERLOAD / COLLISION! Run: ${(p.sumV2 ?? 0).toFixed(1)} min` : `Run: ${(p.sumV2 ?? 0).toFixed(1)} min`}
                              >
                                <span className="truncate flex items-center gap-1">
                                  {p.isManual && <Pin className="h-3 w-3 shrink-0 text-yellow-300 fill-yellow-300" />}
                                  M {order.orderId}
                                </span>

                                <div className="hidden group-hover:flex items-center shrink-0 z-20 ml-1">
                                  {p.isManual ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        resetProcessToAuto(p.id);
                                        toast.success(language === "de" ? "Pin aufgehoben!" : "Reset to automatic scheduling!");
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                      title={language === "de" ? "Pin aufheben" : "Unpin Schedule"}
                                    >
                                      <Unlock className="h-3 w-3" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        pinProcessSchedule(p.id);
                                        toast.success(language === "de" ? "Planung gesichert!" : "Pinned current schedule!");
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                      title={language === "de" ? "Planung sichern" : "Pin Schedule"}
                                    >
                                      <Pin className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>

                                <span className="text-[8px] opacity-90 border-l border-white/20 pl-1 font-mono font-bold shrink-0">
                                  {p.processId} ({Math.round((p.manpowerPct ?? 0) * 100)}% P)
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Projected drag shadow preview */}
                        {dragProjection && dragProjection.machineId === m.id && (
                          <div
                            className="absolute h-9 rounded-md border-2 border-dashed border-primary bg-primary/20 opacity-60 overflow-hidden flex select-none pointer-events-none z-30 shadow-lg scale-105 transition-all duration-75 animate-pulse"
                            style={{
                              left: dragProjection.leftOffset + 2,
                              width: dragProjection.widthVal - 4,
                            }}
                          >
                            {/* Setup portion */}
                            {dragProjection.setupTimeMin > 0 && (
                              <div
                                style={{ width: Math.min(Math.ceil(dragProjection.setupTimeMin / 60) * HOUR_WIDTH, dragProjection.widthVal) }}
                                className="h-full bg-[#4A90D9]/80 text-white flex items-center justify-center px-1.5 text-[10px] font-extrabold truncate shrink-0 border-r border-white/20"
                              >
                                R {dragProjection.orderCode} (Proj)
                              </div>
                            )}

                            {/* Machining portion */}
                            <div className="h-full flex-1 bg-[#52C41A]/80 text-white flex items-center justify-between px-2 text-[10px] font-bold truncate">
                              <span className="truncate">M {dragProjection.orderCode} (Proj)</span>
                              <span className="text-[8px] opacity-90 border-l border-white/20 pl-1 font-mono font-bold">
                                {dragProjection.processId}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                filteredGroups.map((g) => {
                  const groupProcesses = processes.filter((p) => {
                    const machine = machines.find((m) => m.id === p.machineId);
                    return p.status === "SCHEDULED" && machine?.machineGroupId === g.id && p.scheduledStart;
                  });

                  return (
                    <div key={g.id} className="flex border-b border-border/60 hover:bg-muted/5 transition-colors">
                      {/* Frozen group cell */}
                      <div className="w-[220px] shrink-0 border-r border-border px-4 py-2.5 bg-background sticky left-0 z-20 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <div>
                          <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Group {g.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                            {machines.filter((m) => m.machineGroupId === g.id).map((m) => m.name).join(", ")}
                          </div>
                        </div>
                      </div>

                      {/* Hourly background grid dropzone */}
                      <div
                        className="relative flex items-center"
                        style={{
                          width: totalHours * HOUR_WIDTH,
                          height: 48,
                        }}
                      >
                        {/* Background hour grid dividers */}
                        <div className="absolute inset-0 flex pointer-events-none">
                          {days.map((dayStr) => (
                            <div key={dayStr} className="flex h-full">
                              {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                                const hr = SHIFT_1_START + hIdx;
                                const isShift1 = hr < SHIFT_1_END;
                                return (
                                  <div
                                    key={hr}
                                    className={cn(
                                      "h-full border-r border-border/10",
                                      isShift1 ? "bg-sky-500/[0.015]" : "bg-orange-500/[0.015]"
                                    )}
                                    style={{ width: HOUR_WIDTH }}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        {/* Process blocks (readonly in group view, but clickable!) */}
                        {groupProcesses.map((p) => {
                          const order = orders.find((o) => o.id === p.orderId);
                          if (!order || !p.scheduledStart || !p.scheduledEnd) return null;

                          const startD = new Date(p.scheduledStart);
                          const endD = new Date(p.scheduledEnd);

                          const leftWorkingHours = getWorkingHoursBetween(timelineStart, startD);
                          const durationHours = getWorkingHoursBetween(startD, endD);

                          const leftOffset = leftWorkingHours * HOUR_WIDTH;
                          const widthVal = durationHours * HOUR_WIDTH;

                          const isOverloaded = slots.some((sl) => sl.processId === p.id && sl.overloaded);
                          const isColliding = slots.some((sl) => sl.processId === p.id && sl.collision);

                          const setupHours = Math.ceil(p.setupTimeMin / 60);
                          const setupWidth = Math.min(setupHours * HOUR_WIDTH, widthVal);

                          return (
                            <div
                              key={p.id}
                              onClick={() => setSelectedProcessId(p.id)}
                              className={cn(
                                "absolute h-9 rounded-md shadow-sm border border-border/60 overflow-hidden flex cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-md transition-all select-none z-10 group",
                                isColliding ? "border-red-600 ring-2 ring-red-500/40 bg-red-50/20" : isOverloaded ? "border-red-500 ring-2 ring-red-500/30" : "",
                                selectedProcessId === p.id ? "ring-2 ring-primary ring-offset-1 border-primary" : ""
                              )}
                              style={{
                                left: leftOffset + 2,
                                width: widthVal - 4,
                              }}
                            >
                              {/* Setup portion */}
                              {setupWidth > 0 && (
                                <div
                                  style={{ width: setupWidth }}
                                  className="h-full bg-[#4A90D9] text-white flex items-center justify-center px-1.5 text-[10px] font-extrabold truncate shrink-0 border-r border-white/20"
                                  title={`Setup R: ${p.setupTimeMin} min`}
                                >
                                  R {order.orderId}
                                </div>
                              )}

                              {/* Machining portion */}
                              <div
                                className={cn(
                                  "h-full flex-1 text-white flex items-center justify-between px-2 text-[10px] font-bold truncate transition-colors",
                                  (isColliding || isOverloaded) ? "bg-red-500 animate-pulse font-extrabold" : "bg-[#52C41A]"
                                )}
                                title={(isColliding || isOverloaded) ? `OVERLOAD / COLLISION! Machine: ${p.machineId} | Run: ${(p.sumV2 ?? 0).toFixed(1)} min` : `Machine: ${p.machineId} | Run: ${(p.sumV2 ?? 0).toFixed(1)} min`}
                              >
                                <span className="truncate font-sans font-bold flex items-center gap-1">
                                  {p.isManual && <Pin className="h-3 w-3 shrink-0 text-yellow-300 fill-yellow-300" />}
                                  M {order.orderId} ({p.machineId})
                                </span>

                                <div className="hidden group-hover:flex items-center shrink-0 z-20 ml-1">
                                  {p.isManual ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        resetProcessToAuto(p.id);
                                        toast.success(language === "de" ? "Pin aufgehoben!" : "Reset to automatic scheduling!");
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                      title={language === "de" ? "Pin aufheben" : "Unpin Schedule"}
                                    >
                                      <Unlock className="h-3 w-3" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        pinProcessSchedule(p.id);
                                        toast.success(language === "de" ? "Planung gesichert!" : "Pinned current schedule!");
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                      title={language === "de" ? "Planung sichern" : "Pin Schedule"}
                                    >
                                      <Pin className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>

                                <span className="text-[8px] opacity-90 border-l border-white/20 pl-1 font-mono font-bold shrink-0">
                                  {p.processId}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 4. HOUR VIEW */}
      {zoomLevel === "HOUR" && (
        <HourView
          dateStr={selectedDayStr}
          targetHour={selectedHour}
          machines={filteredMachines}
          processes={processes}
          orders={orders}
          slots={slots}
          onBack={() => setZoomLevel("DAY")}
        />
      )}

      {/* Slide-over Details & Rescheduling Drawer (only on Day View) */}
      {selectedProcess && selectedOrder && zoomLevel === "DAY" && (
        <div className="fixed inset-y-0 right-0 w-[380px] bg-background border-l border-border shadow-2xl p-6 z-50 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-bold text-lg text-foreground">Order Process Step</h3>
                <span className="text-xs text-muted-foreground">ID: {selectedProcess.id}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProcessId(null)}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                &times;
              </Button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Order ID</span>
                  <p className="font-bold text-primary text-sm mt-0.5">{selectedOrder.orderId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Step / Vorgang</span>
                  <p className="font-mono font-bold text-foreground text-sm mt-0.5">{selectedProcess.processId}</p>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Material Spec</span>
                <p className="font-mono text-foreground font-semibold mt-0.5">{selectedOrder.material}</p>
              </div>

              <div>
                <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">Process Text</span>
                <p className="text-foreground font-medium bg-muted/50 p-2 rounded border border-border/50 mt-0.5 leading-relaxed">
                  {selectedProcess.processText}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                <div className="text-center bg-sky-50 dark:bg-sky-950/20 p-2 rounded">
                  <span className="text-sky-600 font-bold text-[10px]">Setup R</span>
                  <p className="font-bold text-foreground mt-0.5">{(selectedProcess.setupTimeMin ?? 0)}m</p>
                </div>
                <div className="text-center bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded">
                  <span className="text-emerald-600 font-bold text-[10px]">Machining M (SumV2)</span>
                  <p className="font-bold text-foreground mt-0.5">{(selectedProcess.sumV2 ?? 0).toFixed(1)}m</p>
                </div>
                <div className="text-center bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                  <span className="text-orange-600 font-bold text-[10px]">Manpower (Pct)</span>
                  <p className="font-bold text-foreground mt-0.5">{Math.round((selectedProcess.manpowerPct ?? 0) * 100)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-center bg-purple-50 dark:bg-purple-950/20 p-2 rounded">
                  <span className="text-purple-600 font-bold text-[10px]">Operator Util Min</span>
                  <p className="font-bold text-foreground mt-0.5">{(selectedProcess.manpowerUtilizationMin ?? 0).toFixed(3)}m</p>
                </div>
                <div className="text-center bg-indigo-50 dark:bg-indigo-950/20 p-2 rounded">
                  <span className="text-indigo-600 font-bold text-[10px]">Total Operator Min (SumV3)</span>
                  <p className="font-bold text-foreground mt-0.5">{(selectedProcess.sumV3 ?? 0).toLocaleString(undefined, {maximumFractionDigits: 1})}m</p>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-1">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Manual Schedule Override
                </h4>
                
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Target Workstation / Machine</Label>
                  <Select
                    value={selectedProcess.machineId}
                    onValueChange={(val) => {
                      const startD = new Date(selectedProcess.scheduledStart!);
                      updateSlotSchedule(
                        selectedProcess.id,
                        val,
                        formatDateStr(startD),
                        startD.getHours()
                      );
                      toast.success("Updated assigned machine!");
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          Machine {m.name} ({m.machineGroupId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Start Date</Label>
                    <Input
                      type="date"
                      value={formatDateStr(new Date(selectedProcess.scheduledStart!))}
                      onChange={(e) => {
                        const startD = new Date(selectedProcess.scheduledStart!);
                        updateSlotSchedule(
                          selectedProcess.id,
                          selectedProcess.machineId,
                          e.target.value,
                          startD.getHours()
                        );
                        toast.success("Rescheduled start date!");
                      }}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Start Hour (6-19)</Label>
                    <Input
                      type="number"
                      min={6}
                      max={19}
                      value={new Date(selectedProcess.scheduledStart!).getHours()}
                      onChange={(e) => {
                        const startD = new Date(selectedProcess.scheduledStart!);
                        const val = Math.max(6, Math.min(19, parseInt(e.target.value, 10) || 6));
                        updateSlotSchedule(
                          selectedProcess.id,
                          selectedProcess.machineId,
                          formatDateStr(startD),
                          val
                        );
                        toast.success("Rescheduled start hour!");
                      }}
                      className="h-9 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-2 bg-muted/30 p-2.5 rounded text-xs">
                <div className="space-y-1 pb-2 border-b border-border/50">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Original Planned SOP</div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">SOP Date:</span>
                    <span className="font-bold text-foreground">{selectedOrder.sopStartDate}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">SOP Time:</span>
                    <span className="font-bold text-foreground">{selectedOrder.sopStartTime || "00:00:00"}</span>
                  </div>
                </div>
                
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">Optimized Schedule</div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Scheduled Start:</span>
                    <span className="font-bold text-foreground">{new Date(selectedProcess.scheduledStart!).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Scheduled End:</span>
                    <span className="font-bold text-foreground">{new Date(selectedProcess.scheduledEnd!).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedProcess.isManual ? (
            <Button
              variant="outline"
              onClick={() => {
                resetProcessToAuto(selectedProcess.id);
                setSelectedProcessId(null);
                toast.success(language === "de" ? "Pin aufgehoben (Automatisch)!" : "Reset process to automatic scheduling!");
              }}
              className="w-full border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold mt-4 flex items-center justify-center gap-1.5"
            >
              <Unlock className="h-4 w-4" />
              {language === "de" ? "Pin aufheben (Automatisch)" : "Unpin Schedule (Automatic)"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                pinProcessSchedule(selectedProcess.id);
                setSelectedProcessId(null);
                toast.success(language === "de" ? "Planung angepinnt / gesichert!" : "Pinned/saved current schedule!");
              }}
              className="w-full border-primary/30 hover:bg-primary/10 text-primary text-xs font-semibold mt-4 flex items-center justify-center gap-1.5"
            >
              <Pin className="h-4 w-4" />
              {language === "de" ? "Planung anpinnen / sichern" : "Pin / Save Schedule"}
            </Button>
          )}

          <Button onClick={() => setSelectedProcessId(null)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
            Save & Close
          </Button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1. YEAR CAPACITY GRID COMPONENT
// ==========================================
// ==========================================
// 1. YEAR CAPACITY GRID COMPONENT
// ==========================================
interface YearViewProps {
  year: number;
  machines: any[];
  slots: any[];
  onSelectMonth: (monthIdx: number) => void;
}

function YearView({ year, machines, slots, onSelectMonth }: YearViewProps) {
  const { t, language } = useTranslations();
  const months = language === "de"
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
    const machinesCount = isGroup 
      ? allMachines.filter((m) => m.machineGroupId === mId).length 
      : 1;

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
          Capacity is the percentage of scheduled working hours (Setup R + Machining M) out of total available working hours. Click any cell to open Month view.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted border-b border-border text-slate-700">
              <th className="px-4 py-3 text-left font-bold w-[200px] border-r border-border sticky left-0 bg-muted z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                {machines.some((m) => m.id === "M1" || m.id === "M2") ? "Machine Group" : "Workstation"}
              </th>
              {months.map((mName, idx) => (
                <th key={idx} className="px-2 py-3 text-center font-bold border-r border-border min-w-[75px]">
                  {mName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2 border-r border-border font-bold sticky left-0 bg-background z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{m.name}</td>
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
                              pct > 100 ? "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" :
                              pct >= 80 ? "bg-amber-500" :
                              "bg-emerald-500"
                            )}
                          />
                        </div>
                        <span className={cn(
                          "text-[10px] font-extrabold font-mono",
                          pct > 100 ? "text-red-600 dark:text-red-400 animate-pulse font-black" :
                          pct >= 80 ? "text-amber-600 dark:text-amber-400" :
                          "text-emerald-600 dark:text-emerald-400"
                        )}>
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

// ==========================================
// 2. WEEK CAPACITY COMPONENT
// ==========================================
interface WeekViewProps {
  year: number;
  month: number;
  getLocalizedMonthName: (idx: number) => string;
  machines: any[];
  slots: any[];
  onSelectDay: (dayStr: string) => void;
}

function WeekView({ year, month, getLocalizedMonthName, machines, slots, onSelectDay }: WeekViewProps) {
  const { machines: allMachines, dailyCapacities } = useAppStore();
  const { language } = useTranslations();

  // Generate all days in selected month
  const calendarDays = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const list: { dayStr: string; label: string; weekday: string }[] = [];
    const weekdayNames = language === "de"
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

  const getDayScheduledHours = (mId: string, dayStr: string) => {
    const entry = dailyCapacityMap.get(`${mId}_${dayStr}`) || { rMin: 0, mMin: 0 };
    
    const rHours = entry.rMin / 60;
    const mHours = entry.mMin / 60;
    const totalHours = rHours + mHours;

    // Check if mId is a group ID (M1 or M2)
    const isGroup = mId === "M1" || mId === "M2";
    const machinesCount = isGroup 
      ? allMachines.filter((m) => m.machineGroupId === mId).length 
      : 1;

    const availableHours = 14 * machinesCount;

    return { rHours, mHours, totalHours, availableHours };
  };

  return (
    <Card className="border border-border/80 shadow-md bg-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
          <CalendarDays className="h-5 w-5 text-primary" />
          Month Calendar Loading — {getLocalizedMonthName(month)} ({year})
        </CardTitle>
        <CardDescription>
          Shows R hours (blue) + M hours (green) stacked out of shift hours. Displays total scheduled hours inside each day. Click cell to zoom into that Day timeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted border-b border-border text-slate-700">
              <th className="px-4 py-3 text-left font-bold w-[180px] border-r border-border sticky left-0 bg-muted z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                {machines.some((m) => m.id === "M1" || m.id === "M2") ? "Machine Group" : "Workstation"}
              </th>
              {calendarDays.map((cd, idx) => (
                <th key={idx} className="px-1.5 py-2 text-center font-bold border-r border-border min-w-[65px] font-sans">
                  <div className="text-[10px] text-muted-foreground">{cd.weekday}</div>
                  <div className="text-xs font-bold font-mono">{cd.label.split(".")[0]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-b border-border hover:bg-muted/5 transition-colors">
                <td className="px-4 py-2 border-r border-border font-bold bg-background sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{m.name}</td>
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
                            <div style={{ width: `${rPct}%` }} className="bg-[#4A90D9] h-full" title={`Setup: ${loads.rHours.toFixed(1)} hrs`} />
                            <div style={{ width: `${mPct}%` }} className="bg-[#52C41A] h-full" title={`Machine: ${loads.mHours.toFixed(1)} hrs`} />
                          </div>
                          <span className="text-[10px] font-extrabold text-foreground">{totalHrs.toFixed(1)} hrs</span>
                          {hasCustomCap && (
                            <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-bold">
                              {dayCap.setter}%/{dayCap.process}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-muted-foreground/30 text-[9px] font-light font-sans">—</span>
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

// ==========================================
// 4. MINUTE-LEVEL HOUR ZOOM VIEW COMPONENT
// ==========================================
interface HourViewProps {
  dateStr: string;
  targetHour: number;
  machines: any[];
  processes: any[];
  orders: any[];
  slots: any[];
  onBack: () => void;
}

function HourView({ dateStr, targetHour, machines, processes, orders, slots, onBack }: HourViewProps) {
  // Show exact minute allocation (0 to 59 minutes)
  const minutes = Array.from({ length: 60 });
  const timeLabel = `${String(targetHour).padStart(2, "0")}:00 – ${String(targetHour + 1).padStart(2, "0")}:00`;

  // Helper to map what runs at what minute
  // Since we know the duration and where it resides in the hour, let's map it cleanly
  const getMinuteAllocations = (mId: string) => {
    // Find slot of type R or M for this hour and machine
    const hourSlots = slots.filter(
      (s) => s.machineId === mId && s.date === dateStr && s.hourStart === targetHour
    );

    // Each slot has: minutesUsed, slotType, processId
    const minsData = Array.from({ length: 60 }).map(() => ({
      type: "empty",
      processId: "",
      manpowerPct: 0,
      orderCode: "",
    }));

    let currentPtr = 0;
    hourSlots.forEach((s) => {
      const runMins = Math.min(60 - currentPtr, s.minutesUsed);
      const proc = processes.find((p) => p.id === s.processId);
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
            Detailed Minute-Level Zoom — {new Date(dateStr).toLocaleDateString("de-DE")} ({timeLabel})
          </CardTitle>
          <CardDescription>
            Visualizes exact minute placement (0 to 59) of Setup R (steel blue) and Machining M (green). Secondary bar shows P (manpower pct ratio) below M.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1 bg-background">
          <ArrowLeft className="h-4 w-4" /> Back to Day Timeline
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <div style={{ width: 220 + 60 * 12 }} className="flex flex-col relative select-none text-[9px] font-mono">
          
          {/* Header Row: Minute Ticks */}
          <div className="flex border-b border-border bg-muted/30">
            <div className="w-[220px] shrink-0 border-r border-border bg-muted/60" />
            <div className="flex">
              {minutes.map((_, idx) => (
                <div key={idx} className="border-r border-border/10 text-center text-muted-foreground flex items-center justify-center font-bold" style={{ width: 12, height: 24 }}>
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
              <div key={m.id} className="flex border-b border-border/50 py-1 hover:bg-muted/5 transition-colors">
                <div className="w-[220px] shrink-0 px-4 flex flex-col justify-center border-r border-border font-sans font-bold bg-background">
                  <span className="text-sm font-semibold">{m.name}</span>
                  {activeAllocation?.orderCode && (
                    <span className="text-[10px] text-primary">Running Order: {activeAllocation.orderCode}</span>
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
                          title={a.type !== "empty" ? `Min ${mIdx}: Order ${a.orderCode} (${a.type === "R" ? "Setup" : "Machining"})` : `Min ${mIdx}: Idle`}
                        />
                      );
                    })}
                  </div>

                  {/* Secondary bar below M: manpowerPct */}
                  <div className="absolute inset-x-0 bottom-1.5 h-4 flex items-end">
                    {allocations.map((a, mIdx) => {
                      const heightPct = a.type === "M" ? (a.manpowerPct * 100) : a.type === "R" ? 100 : 0;
                      return (
                        <div key={mIdx} style={{ width: 12 }} className="h-full flex items-end justify-center shrink-0">
                          {heightPct > 0 && (
                            <div 
                              style={{ height: `${heightPct}%` }} 
                              className={cn("w-[60%] shrink-0 shadow-sm", a.type === "R" ? "bg-sky-700/60" : "bg-orange-500/80")} 
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

// Legend Helper Component
function Legend() {
  const { columnMapping } = useAppStore();
  const setupLabel = columnMapping?.setupTime || "Setup R";
  const machLabel = columnMapping?.processTime || "Machining M";
  const manpowerLabel = columnMapping?.manpower || "Manpower P";

  const items = [
    { label: `${setupLabel} (Steel Blue)`, bg: "bg-[#4A90D9]" },
    { label: `${machLabel} (Green)`, bg: "bg-[#52C41A]" },
    { label: "Machine Overlap (Pulsing Red)", bg: "bg-red-500 animate-pulse" },
    { label: `${manpowerLabel} (Orange)`, bg: "bg-orange-500" },
    { label: "Overloaded Stack (Red Outline)", bg: "bg-red-500" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-muted-foreground">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-sm shadow-sm", i.bg)} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
