import { Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SHIFT_1_START, SHIFT_1_END, SHIFT_2_END, WORKING_HOURS_PER_DAY } from "@/lib/types";
import { parseSOPDate } from "@/lib/scheduler";
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
  ChevronLeft,
  Info,
  ArrowLeft,
  CalendarDays,
  Pin,
  Unlock,
  Package,
  Pause,
  CheckCircle2,
  Activity,
  Check,
} from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { MaterialInventoryModal } from "@/components/modals/MaterialInventoryModal";
import { HoldReasonModal } from "@/components/modals/HoldReasonModal";
import { LogScrapModal } from "@/components/modals/LogScrapModal";

import {
  formatDateStr,
  getWorkingHoursBetween,
  MONTH_NAMES,
  getLocalizedMonthName,
  getWeekNumber,
} from "@/lib/dateUtils";
import { ScheduleLegend } from "@/components/common/ScheduleLegend";
import { YearView } from "@/components/gantt/YearView";
import { WeekView } from "@/components/gantt/WeekView";
import { HourView } from "@/components/gantt/HourView";

interface GanttTimelineViewProps {
  timelineZoom?: "compact" | "normal" | "wide";
  granularity?: "day" | "week" | "month";
  onGranularityChange?: (g: "day" | "week" | "month") => void;
  currentDate?: Date;
  onDateChange?: (d: Date) => void;
  selectedMachine?: string;
  selectedStatus?: string;
  searchQuery?: string;
}

export function GanttTimelineView({
  timelineZoom = "normal",
  granularity = "week",
  onGranularityChange,
  currentDate,
  onDateChange,
  selectedMachine = "ALL",
  selectedStatus = "ALL",
  searchQuery = "",
}: GanttTimelineViewProps) {
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
  const updateSlotSchedule = checkDev(
    store.updateSlotSchedule,
    "Only Developers can reschedule slots.",
  );
  const setOptimizationMode = checkDev(
    store.setOptimizationMode,
    "Only Developers can change optimization modes.",
  );
  const setDailyCapacity = checkDev(
    store.setDailyCapacity,
    "Only Developers can override daily capacity.",
  );
  const setAllowProcessOverlap = checkDev(
    store.setAllowProcessOverlap,
    "Only Developers can adjust scheduling parameters.",
  );
  const setAllowSopOverride = checkDev(
    store.setAllowSopOverride,
    "Only Developers can adjust scheduling parameters.",
  );
  const setMaxUtilizeResources = checkDev(
    store.setMaxUtilizeResources,
    "Only Developers can adjust scheduling parameters.",
  );
  const resetProcessToAuto = checkDev(
    store.resetProcessToAuto,
    "Only Developers can reset process overrides.",
  );
  const pinProcessSchedule = checkDev(
    store.pinProcessSchedule,
    "Only Developers can pin overrides.",
  );
  const setGlobalSetterCapacity = checkDev(
    store.setGlobalSetterCapacity,
    "Only Developers can edit capacity ceilings.",
  );
  const setGlobalOperatorCapacity = checkDev(
    store.setGlobalOperatorCapacity,
    "Only Developers can edit capacity ceilings.",
  );
  const setMaxPreponeWeeks = checkDev(
    store.setMaxPreponeWeeks,
    "Only Developers can adjust scheduling parameters.",
  );

  const { t, language } = useTranslations();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const activeOptimizationMode =
    optimizationMode !== "pre" && optimizationMode !== "workstation" && optimizationMode !== "full"
      ? "full"
      : optimizationMode;

  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"workstation" | "group">("workstation");
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [scrapModalOpen, setScrapModalOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const groups = machineGroups || [
      { id: "M1", name: "M1" },
      { id: "M2", name: "M2" },
    ];
    return groups.filter((g) => {
      if (filterGroup === "ALL") return true;
      return g.id === filterGroup;
    });
  }, [machineGroups, filterGroup]);

  // Zoom Level State Chain: YEAR (Month view) -> WEEK -> DAY -> HOUR
  const [zoomLevel, setZoomLevel] = useState<"YEAR" | "WEEK" | "DAY" | "HOUR">(() => {
    if (granularity === "day") return "DAY";
    if (granularity === "week") return "WEEK";
    if (granularity === "month") return "YEAR";
    return "DAY";
  });

  // Sync zoomLevel when granularity prop changes from top bar (Day / Week / Month)
  useEffect(() => {
    if (granularity === "day") {
      setZoomLevel("DAY");
    } else if (granularity === "week") {
      setZoomLevel("WEEK");
    } else if (granularity === "month") {
      setZoomLevel("YEAR");
    }
  }, [granularity]);

  // Dynamic Horizon Detection: Find the earliest order/scheduled date so we never land on an empty month!
  const earliestScheduledDate = useMemo(() => {
    if (slots && slots.length > 0) {
      const dates = slots
        .map((s) => s.date)
        .filter(Boolean)
        .sort();
      if (dates.length > 0) {
        const p = dates[0].split("-");
        if (p.length === 3) {
          return { year: parseInt(p[0], 10), month: parseInt(p[1], 10) - 1, dayStr: dates[0] };
        }
      }
    }
    if (processes && processes.length > 0) {
      const scheduled = processes.filter((p) => p.scheduledStart);
      if (scheduled.length > 0) {
        const d = new Date(scheduled[0].scheduledStart!);
        if (!isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth(), dayStr: formatDateStr(d) };
        }
      }
    }
    if (orders && orders.length > 0) {
      const orderStarts = orders
        .map((o) => parseSOPDate(o.sopStartDate, o.sopStartTime).getTime())
        .filter((t) => !isNaN(t));
      if (orderStarts.length > 0) {
        orderStarts.sort((a, b) => a - b);
        const d = new Date(orderStarts[0]);
        return { year: d.getFullYear(), month: d.getMonth(), dayStr: formatDateStr(d) };
      }
    }
    return { year: 2026, month: 5, dayStr: "2026-06-01" }; // Default June 2026
  }, [slots, processes, orders]);

  // Date states synced with currentDate or earliestScheduledDate
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    currentDate ? currentDate.getFullYear() : earliestScheduledDate.year,
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(() =>
    currentDate ? currentDate.getMonth() : earliestScheduledDate.month,
  );
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() =>
    currentDate ? formatDateStr(currentDate) : earliestScheduledDate.dayStr,
  );
  const [selectedHour, setSelectedHour] = useState<number>(10);
  const [showAllAlerts, setShowAllAlerts] = useState<boolean>(false);

  useEffect(() => {
    if (currentDate) {
      const yr = currentDate.getFullYear();
      const mo = currentDate.getMonth();
      const dayStr = formatDateStr(currentDate);
      setSelectedYear(yr);
      setSelectedMonth(mo);
      setSelectedDayStr(dayStr);
    } else if (earliestScheduledDate) {
      setSelectedYear(earliestScheduledDate.year);
      setSelectedMonth(earliestScheduledDate.month);
      setSelectedDayStr(earliestScheduledDate.dayStr);
    }
  }, [currentDate, earliestScheduledDate]);

  // Dynamic hour width based on zoom switcher
  const HOUR_WIDTH = timelineZoom === "compact" ? 36 : timelineZoom === "wide" ? 104 : 64;

  // Advanced Drag and Drop States
  const [activeDragProcessId, setActiveDragProcessId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    machineId: string;
    dateStr: string;
    hour: number;
  } | null>(null);

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
          : `Server Optimization Complete in ${duration} ms (${slotCount} slots scheduled)`,
      );

      if (warnCount > 0) {
        toast.warning(
          language === "de"
            ? `${warnCount} Kapazitäts-Überlastungsmeldungen gefunden.`
            : `${warnCount} capacity overload warnings detected.`,
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
    return (
      orders.find(
        (o) => o.id === selectedProcess.orderId || o.orderId === selectedProcess.orderId,
      ) || null
    );
  }, [selectedProcess, orders]);

  // Handle HTML5 Drag and Drop Drops
  const handleDrop = (
    e: React.DragEvent,
    targetMachineId: string,
    dateStr: string,
    hourStart: number,
  ) => {
    e.preventDefault();
    const dragProcessId = e.dataTransfer.getData("text/plain");
    setActiveDragProcessId(null);
    setDragOverCell(null);
    if (!dragProcessId) return;

    updateSlotSchedule(dragProcessId, targetMachineId, dateStr, hourStart);
    toast.success(t("gantt.toastResched", { machine: targetMachineId }));
  };

  // Check if a process matches current search & status filters
  const isProcessFiltered = (p: any, order?: any) => {
    if (selectedStatus && selectedStatus !== "ALL") {
      const execStatus = p.executionStatus || (p.status === "SCHEDULED" ? "PLANNED" : "PLANNED");
      if (
        selectedStatus === "QUEUED" &&
        (execStatus !== "PLANNED" || (p.completedQty && p.completedQty > 0))
      )
        return false;
      if (selectedStatus === "HOLD" && execStatus !== "PAUSED") return false;
      if (selectedStatus === "RELEASED" && execStatus !== "PLANNED") return false;
      if (selectedStatus === "RUNNING" && execStatus !== "IN_PROGRESS") return false;
      if (selectedStatus === "DONE" && execStatus !== "COMPLETED") return false;
      if (selectedStatus === "DELAYED" && execStatus !== "DELAYED") return false;
    }
    if (searchQuery && searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      const matchWO = (order?.orderId || p.orderId || "").toLowerCase().includes(q);
      const matchMat = (order?.material || "").toLowerCase().includes(q);
      const matchText = (p.processText || "").toLowerCase().includes(q);
      const matchMachine = (p.machineId || "").toLowerCase().includes(q);
      if (!matchWO && !matchMat && !matchText && !matchMachine) return false;
    }
    return true;
  };

  // Filter machines based on workstation selection from top bar and group filter
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (selectedMachine && selectedMachine !== "ALL") {
        if (m.id !== selectedMachine && m.name !== selectedMachine) return false;
      }
      if (filterGroup !== "ALL" && m.machineGroupId !== filterGroup) {
        return false;
      }
      return true;
    });
  }, [machines, selectedMachine, filterGroup]);

  // Helper to get Month name based on active language
  const getLocalizedMonthName = (monthIdx: number) => {
    const monthsDe = [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ];
    const monthsEn = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return language === "de" ? monthsDe[monthIdx] || "Juni" : monthsEn[monthIdx] || "June";
  };

  // Helper to get Week number
  const getWeekNumber = (dateVal: Date) => {
    const date = new Date(dateVal.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7,
      )
    );
  };

  // 1. Calculate scheduling timeline date range (encompassing currentDate)
  const timelineRange = useMemo(() => {
    const scheduled = processes.filter((p) => p.status === "SCHEDULED" && p.scheduledStart);

    let minDate = currentDate ? new Date(currentDate) : new Date(2026, selectedMonth, 1);
    let maxDate = currentDate ? new Date(currentDate) : new Date(2026, selectedMonth + 1, 0);

    if (scheduled.length > 0) {
      scheduled.forEach((p) => {
        const start = new Date(p.scheduledStart!);
        const end = new Date(p.scheduledEnd!);
        if (start < minDate) minDate = start;
        if (end > maxDate) maxDate = end;
      });
    }

    // Expand margin by 3 days on each side
    const startRange = new Date(minDate);
    startRange.setDate(startRange.getDate() - 3);
    startRange.setHours(SHIFT_1_START, 0, 0, 0);

    const endRange = new Date(maxDate);
    endRange.setDate(endRange.getDate() + 4);
    endRange.setHours(SHIFT_2_END, 0, 0, 0);

    const daysList: string[] = [];
    const ptr = new Date(startRange.getTime());
    while (ptr <= endRange) {
      daysList.push(formatDateStr(ptr));
      ptr.setDate(ptr.getDate() + 1);
    }

    return {
      start: startRange,
      end: endRange,
      days: daysList,
      totalHours: daysList.length * WORKING_HOURS_PER_DAY,
    };
  }, [processes, selectedMonth, currentDate]);

  // Dynamic SVG Precedence Routing Curves connecting sequential steps of selected work order
  const routingPrecedenceCurves = useMemo(() => {
    if (!selectedOrder || viewMode !== "workstation" || !timelineRange) return [];

    const orderSteps = processes
      .filter((p) => p.orderId === selectedOrder.orderId || p.orderId === selectedOrder.id)
      .filter((p) => p.status === "SCHEDULED" && p.scheduledStart && p.scheduledEnd)
      .sort((a, b) => a.processId - b.processId);

    if (orderSteps.length < 2) return [];

    const curves: {
      path: string;
      isViolation: boolean;
      midX: number;
      midY: number;
      fromStep: number;
      toStep: number;
    }[] = [];

    for (let i = 0; i < orderSteps.length - 1; i++) {
      const stepA = orderSteps[i];
      const stepB = orderSteps[i + 1];

      const mIdxA = filteredMachines.findIndex((m) => m.id === stepA.machineId);
      const mIdxB = filteredMachines.findIndex((m) => m.id === stepB.machineId);

      if (mIdxA === -1 || mIdxB === -1) continue;

      const dateAEnd = new Date(stepA.scheduledEnd!);
      const dateBStart = new Date(stepB.scheduledStart!);

      const endHoursA = getWorkingHoursBetween(timelineRange.start, dateAEnd);
      const startHoursB = getWorkingHoursBetween(timelineRange.start, dateBStart);

      const x1 = 220 + endHoursA * HOUR_WIDTH;
      const y1 = mIdxA * 49 + 24;

      const x2 = 220 + startHoursB * HOUR_WIDTH;
      const y2 = mIdxB * 49 + 24;

      const isViolation = dateBStart < dateAEnd;

      const dx = Math.max(30, Math.abs(x2 - x1) / 2);
      const c1x = x1 + (x2 >= x1 ? dx : -dx);
      const c1y = y1;
      const c2x = x2 - (x2 >= x1 ? dx : -dx);
      const c2y = y2;

      const path = `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      curves.push({
        path,
        isViolation,
        midX,
        midY,
        fromStep: stepA.processId,
        toStep: stepB.processId,
      });
    }

    return curves;
  }, [selectedOrder, processes, filteredMachines, viewMode, timelineRange, HOUR_WIDTH]);

  // Scroll to selected date on timeline
  useEffect(() => {
    if (scrollContainerRef.current && timelineRange && selectedDayStr) {
      const dayIdx = timelineRange.days.indexOf(selectedDayStr);
      if (dayIdx !== -1) {
        const offset = dayIdx * WORKING_HOURS_PER_DAY * HOUR_WIDTH;
        scrollContainerRef.current.scrollTo({
          left: Math.max(0, offset - 10),
          behavior: "smooth",
        });
      }
    }
  }, [selectedDayStr, timelineRange, HOUR_WIDTH]);

  const activeDragProcess = useMemo(() => {
    if (!activeDragProcessId) return null;
    return processes.find((p) => p.id === activeDragProcessId) || null;
  }, [activeDragProcessId, processes]);

  const dragProjection = useMemo(() => {
    if (!activeDragProcess || !dragOverCell || !timelineRange) return null;

    // Create a start pointer based on hovered cell
    const startD = new Date(
      `${dragOverCell.dateStr}T${String(dragOverCell.hour).padStart(2, "0")}:00:00`,
    );

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

          <div
            className={cn("overflow-y-auto pr-2", showAllAlerts ? "max-h-[320px] space-y-2" : "")}
          >
            <ul className="list-inside list-disc text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 font-mono">
              {(showAllAlerts ? warnings : warnings.slice(0, 4)).map((w, i) => (
                <li
                  key={i}
                  className="whitespace-pre-line leading-relaxed border-b border-red-500/10 pb-2"
                >
                  {w}
                </li>
              ))}
              {!showAllAlerts && warnings.length > 4 && (
                <li className="font-bold text-primary list-none mt-1">
                  …and {warnings.length - 4} more staffing/collision overlaps. Click "View Full
                  Details" to see all.
                </li>
              )}
            </ul>
          </div>
        </Card>
      )}

      {/* 1. YEAR VIEW (Month Capacity Matrix) */}
      {zoomLevel === "YEAR" && (
        <YearView
          year={selectedYear}
          machines={viewMode === "group" ? filteredGroups : filteredMachines}
          slots={slots}
          onSelectMonth={(mIdx) => {
            setSelectedMonth(mIdx);
            const defaultDate = new Date(selectedYear, mIdx, 1);
            setSelectedDayStr(formatDateStr(defaultDate));
            onDateChange?.(defaultDate);
            setZoomLevel("WEEK");
            onGranularityChange?.("week");
          }}
        />
      )}

      {/* 2. WEEK VIEW (Weekly Matrix) */}
      {zoomLevel === "WEEK" && (
        <WeekView
          year={selectedYear}
          month={selectedMonth}
          getLocalizedMonthName={getLocalizedMonthName}
          machines={viewMode === "group" ? filteredGroups : filteredMachines}
          slots={slots}
          onSelectDay={(dayStr) => {
            setSelectedDayStr(dayStr);
            onDateChange?.(new Date(dayStr));
            setZoomLevel("DAY");
            onGranularityChange?.("day");
          }}
          onMonthChange={(mIdx, y) => {
            setSelectedMonth(mIdx);
            setSelectedYear(y);
            const defaultDate = new Date(y, mIdx, 1);
            setSelectedDayStr(formatDateStr(defaultDate));
            onDateChange?.(defaultDate);
          }}
        />
      )}

      {/* 3. DAY VIEW (Main Draggable Hourly Timeline) */}
      {zoomLevel === "DAY" && (
        <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
          <div ref={scrollContainerRef} className="overflow-x-auto max-w-full">
            <div
              style={{ width: 220 + totalHours * HOUR_WIDTH }}
              className="flex flex-col relative select-none"
            >
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

                    const setterUtil =
                      setterAvail > 0 ? Math.round((setterUsed / setterAvail) * 100) : 0;
                    const operatorUtil =
                      operatorAvail > 0 ? Math.round((operatorUsed / operatorAvail) * 100) : 0;

                    return (
                      <div
                        key={dayStr}
                        className={cn(
                          "flex flex-col border-r border-border/70 cursor-pointer hover:bg-muted/90 transition-colors",
                          dayStr === selectedDayStr
                            ? "bg-primary/[0.02] ring-1 ring-primary/20 ring-inset"
                            : "",
                        )}
                        style={{ width: WORKING_HOURS_PER_DAY * HOUR_WIDTH }}
                        onClick={() => {
                          setSelectedDayStr(dayStr);
                          const d = new Date(dayStr);
                          setSelectedMonth(d.getMonth());
                          setSelectedYear(d.getFullYear());
                        }}
                      >
                        <div
                          className={cn(
                            "border-b border-border/40 px-3 py-1 text-[11px] font-bold text-foreground bg-muted/30 flex flex-col gap-0.5",
                            dayStr === selectedDayStr ? "bg-primary/5 text-primary" : "",
                          )}
                        >
                          <div className="flex items-center gap-1.5 justify-between">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3 w-3 text-primary" />
                              {displayDate}
                            </div>
                            {dayStr === selectedDayStr && (
                              <span className="text-[8px] bg-primary text-primary-foreground px-1.2 py-0.2 rounded font-sans uppercase font-extrabold scale-95">
                                Sel
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono flex gap-x-2 flex-wrap">
                            <span
                              title={`Setup R Used: ${setterUsed.toFixed(0)}m / Avail: ${setterAvail.toFixed(0)}m`}
                            >
                              S: {dayCap.setter}% ({setterUtil}% U)
                            </span>
                            <span
                              title={`Machining M Operator Used: ${operatorUsed.toFixed(0)}m / Avail: ${operatorAvail.toFixed(0)}m`}
                            >
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
                    <div
                      key={dayStr}
                      className={cn("flex", dayStr === selectedDayStr ? "bg-primary/[0.015]" : "")}
                    >
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
                              dayStr === selectedDayStr
                                ? "bg-primary/[0.04] text-primary font-bold"
                                : "",
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
              <div className="relative">
                {/* SVG Precedence Routing Curves Overlay */}
                {routingPrecedenceCurves.length > 0 && (
                  <svg
                    className="absolute inset-0 pointer-events-none z-30 overflow-visible"
                    style={{
                      width: 220 + totalHours * HOUR_WIDTH,
                      height: filteredMachines.length * 49,
                    }}
                  >
                    <defs>
                      <marker
                        id="precedence-arrow-valid"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 8 5 L 0 9 z" fill="#10B981" />
                      </marker>
                      <marker
                        id="precedence-arrow-violation"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 8 5 L 0 9 z" fill="#EF4444" />
                      </marker>
                    </defs>
                    {routingPrecedenceCurves.map((curve, idx) => (
                      <g key={idx}>
                        <path
                          d={curve.path}
                          fill="none"
                          stroke={curve.isViolation ? "#EF4444" : "#10B981"}
                          strokeWidth={2.5}
                          strokeDasharray={curve.isViolation ? "5 3" : undefined}
                          markerEnd={
                            curve.isViolation
                              ? "url(#precedence-arrow-violation)"
                              : "url(#precedence-arrow-valid)"
                          }
                          className="transition-all duration-300"
                        />
                        {curve.isViolation && (
                          <text
                            x={curve.midX}
                            y={curve.midY - 8}
                            fill="#EF4444"
                            fontSize={10}
                            fontWeight="bold"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            ⚠ Precedence Conflict
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                )}

                {viewMode === "workstation"
                  ? filteredMachines.map((m) => {
                      const machineProcesses = processes.filter(
                        (p) => p.status === "SCHEDULED" && p.machineId === m.id && p.scheduledStart,
                      );

                      return (
                        <div
                          key={m.id}
                          className="flex border-b border-border/60 hover:bg-muted/5 transition-colors"
                        >
                          {/* Frozen workstation selector cell */}
                          <div className="w-[220px] shrink-0 border-r border-border px-4 py-2.5 bg-background sticky left-0 z-20 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div>
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                {m.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                                Group {m.machineGroupId}
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
                                <div
                                  key={dayStr}
                                  className={cn(
                                    "flex h-full",
                                    dayStr === selectedDayStr ? "bg-primary/[0.015]" : "",
                                  )}
                                >
                                  {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                                    const hr = SHIFT_1_START + hIdx;
                                    const isShift1 = hr < SHIFT_1_END;
                                    const isOver =
                                      dragOverCell &&
                                      dragOverCell.machineId === m.id &&
                                      dragOverCell.dateStr === dayStr &&
                                      dragOverCell.hour === hr;
                                    return (
                                      <div
                                        key={hr}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          if (
                                            !dragOverCell ||
                                            dragOverCell.machineId !== m.id ||
                                            dragOverCell.dateStr !== dayStr ||
                                            dragOverCell.hour !== hr
                                          ) {
                                            setDragOverCell({
                                              machineId: m.id,
                                              dateStr: dayStr,
                                              hour: hr,
                                            });
                                          }
                                        }}
                                        onDragLeave={() => {
                                          setDragOverCell((curr) =>
                                            curr &&
                                            curr.machineId === m.id &&
                                            curr.dateStr === dayStr &&
                                            curr.hour === hr
                                              ? null
                                              : curr,
                                          );
                                        }}
                                        onDrop={(e) => handleDrop(e, m.id, dayStr, hr)}
                                        className={cn(
                                          "h-full border-r border-border/10 pointer-events-auto cursor-crosshair transition-all duration-150",
                                          isOver
                                            ? "bg-primary/25 ring-2 ring-primary/40 ring-inset"
                                            : isShift1
                                              ? "bg-sky-500/[0.015] hover:bg-sky-500/10"
                                              : "bg-orange-500/[0.015] hover:bg-orange-500/10",
                                          hr === SHIFT_1_END ? "border-r-2 border-border/40" : "",
                                          dayStr === selectedDayStr ? "bg-primary/[0.03]" : "",
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
                              const leftWorkingHours = getWorkingHoursBetween(
                                timelineStart,
                                startD,
                              );
                              const durationHours = getWorkingHoursBetween(startD, endD);

                              const leftOffset = leftWorkingHours * HOUR_WIDTH;
                              const widthVal = durationHours * HOUR_WIDTH;

                              // Check if this process has any overloaded hour slots or machine collisions
                              const isOverloaded = slots.some(
                                (sl) => sl.processId === p.id && sl.overloaded,
                              );
                              const isColliding = slots.some(
                                (sl) => sl.processId === p.id && sl.collision,
                              );

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
                                    activeDragProcessId === p.id
                                      ? "opacity-20 border-dashed bg-muted shadow-none border-slate-400"
                                      : isColliding
                                        ? "border-red-600 ring-2 ring-red-500/40 bg-red-50/20"
                                        : isOverloaded
                                          ? "border-red-500 ring-2 ring-red-500/30"
                                          : "",
                                    selectedProcessId === p.id && activeDragProcessId !== p.id
                                      ? "ring-2 ring-primary ring-offset-1 border-primary"
                                      : "",
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
                                      isColliding || isOverloaded
                                        ? "bg-red-500 animate-pulse font-extrabold"
                                        : "bg-[#52C41A]",
                                    )}
                                    title={
                                      isColliding || isOverloaded
                                        ? `OVERLOAD / COLLISION! Run: ${(p.sumV2 ?? 0).toFixed(1)} min`
                                        : `Run: ${(p.sumV2 ?? 0).toFixed(1)} min`
                                    }
                                  >
                                    <span className="truncate flex items-center gap-1">
                                      {p.isManual && (
                                        <Pin className="h-3 w-3 shrink-0 text-yellow-300 fill-yellow-300" />
                                      )}
                                      M {order.orderId}
                                    </span>

                                    <div className="hidden group-hover:flex items-center shrink-0 z-20 ml-1">
                                      {p.isManual ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            resetProcessToAuto(p.id);
                                            toast.success(
                                              language === "de"
                                                ? "Pin aufgehoben!"
                                                : "Reset to automatic scheduling!",
                                            );
                                          }}
                                          className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                          title={
                                            language === "de" ? "Pin aufheben" : "Unpin Schedule"
                                          }
                                        >
                                          <Unlock className="h-3 w-3" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            pinProcessSchedule(p.id);
                                            toast.success(
                                              language === "de"
                                                ? "Planung gesichert!"
                                                : "Pinned current schedule!",
                                            );
                                          }}
                                          className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                          title={
                                            language === "de" ? "Planung sichern" : "Pin Schedule"
                                          }
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
                                    style={{
                                      width: Math.min(
                                        Math.ceil(dragProjection.setupTimeMin / 60) * HOUR_WIDTH,
                                        dragProjection.widthVal,
                                      ),
                                    }}
                                    className="h-full bg-[#4A90D9]/80 text-white flex items-center justify-center px-1.5 text-[10px] font-extrabold truncate shrink-0 border-r border-white/20"
                                  >
                                    R {dragProjection.orderCode} (Proj)
                                  </div>
                                )}

                                {/* Machining portion */}
                                <div className="h-full flex-1 bg-[#52C41A]/80 text-white flex items-center justify-between px-2 text-[10px] font-bold truncate">
                                  <span className="truncate">
                                    M {dragProjection.orderCode} (Proj)
                                  </span>
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
                  : filteredGroups.map((g) => {
                      const groupProcesses = processes.filter((p) => {
                        const machine = machines.find((m) => m.id === p.machineId);
                        return (
                          p.status === "SCHEDULED" &&
                          machine?.machineGroupId === g.id &&
                          p.scheduledStart
                        );
                      });

                      return (
                        <div
                          key={g.id}
                          className="flex border-b border-border/60 hover:bg-muted/5 transition-colors"
                        >
                          {/* Frozen group cell */}
                          <div className="w-[220px] shrink-0 border-r border-border px-4 py-2.5 bg-background sticky left-0 z-20 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div>
                              <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                Group {g.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                                {machines
                                  .filter((m) => m.machineGroupId === g.id)
                                  .map((m) => m.name)
                                  .join(", ")}
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
                                          isShift1 ? "bg-sky-500/[0.015]" : "bg-orange-500/[0.015]",
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

                              const leftWorkingHours = getWorkingHoursBetween(
                                timelineStart,
                                startD,
                              );
                              const durationHours = getWorkingHoursBetween(startD, endD);

                              const leftOffset = leftWorkingHours * HOUR_WIDTH;
                              const widthVal = durationHours * HOUR_WIDTH;

                              const isOverloaded = slots.some(
                                (sl) => sl.processId === p.id && sl.overloaded,
                              );
                              const isColliding = slots.some(
                                (sl) => sl.processId === p.id && sl.collision,
                              );
                              const isMatch = isProcessFiltered(p, order);

                              const setupHours = Math.ceil(p.setupTimeMin / 60);
                              const setupWidth = Math.min(setupHours * HOUR_WIDTH, widthVal);

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => setSelectedProcessId(p.id)}
                                  className={cn(
                                    "absolute h-9 rounded-md shadow-sm border border-border/60 overflow-hidden flex cursor-pointer hover:ring-2 hover:ring-primary hover:shadow-md transition-all select-none z-10 group",
                                    isColliding
                                      ? "border-red-600 ring-2 ring-red-500/40 bg-red-50/20"
                                      : isOverloaded
                                        ? "border-red-500 ring-2 ring-red-500/30"
                                        : "",
                                    selectedProcessId === p.id
                                      ? "ring-2 ring-primary ring-offset-1 border-primary"
                                      : "",
                                    !isMatch && "opacity-25 saturate-50 hover:opacity-100",
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
                                      isColliding || isOverloaded
                                        ? "bg-red-500 animate-pulse font-extrabold"
                                        : "bg-[#52C41A]",
                                    )}
                                    title={
                                      isColliding || isOverloaded
                                        ? `OVERLOAD / COLLISION! Machine: ${p.machineId} | Run: ${(p.sumV2 ?? 0).toFixed(1)} min`
                                        : `Machine: ${p.machineId} | Run: ${(p.sumV2 ?? 0).toFixed(1)} min`
                                    }
                                  >
                                    <span className="truncate font-sans font-bold flex items-center gap-1">
                                      {p.isManual && (
                                        <Pin className="h-3 w-3 shrink-0 text-yellow-300 fill-yellow-300" />
                                      )}
                                      M {order.orderId} ({p.machineId})
                                    </span>

                                    <div className="hidden group-hover:flex items-center shrink-0 z-20 ml-1">
                                      {p.isManual ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            resetProcessToAuto(p.id);
                                            toast.success(
                                              language === "de"
                                                ? "Pin aufgehoben!"
                                                : "Reset to automatic scheduling!",
                                            );
                                          }}
                                          className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                          title={
                                            language === "de" ? "Pin aufheben" : "Unpin Schedule"
                                          }
                                        >
                                          <Unlock className="h-3 w-3" />
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            pinProcessSchedule(p.id);
                                            toast.success(
                                              language === "de"
                                                ? "Planung gesichert!"
                                                : "Pinned current schedule!",
                                            );
                                          }}
                                          className="h-5 w-5 flex items-center justify-center rounded bg-black/30 hover:bg-black/60 text-white border border-white/20 transition-all cursor-pointer"
                                          title={
                                            language === "de" ? "Planung sichern" : "Pin Schedule"
                                          }
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
                    })}
              </div>
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
      {selectedProcess &&
        selectedOrder &&
        zoomLevel === "DAY" &&
        (() => {
          const currentExecStatus =
            selectedProcess.executionStatus ||
            (selectedProcess.status === "SCHEDULED" ? "PLANNED" : "QUEUED");
          const orderQty = selectedOrder.orderQty || selectedProcess.baseQty * 100 || 100;
          const completedUnits = selectedProcess.completedQty ?? 0;
          const completionRate = Math.min(100, Math.round((completedUnits / orderQty) * 100));

          return (
            <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-background border-l border-border shadow-2xl z-50 flex flex-col h-full animate-in slide-in-from-right duration-200">
              {/* Fixed Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-sm">
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground">
                    Order Process Step
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    ID: {selectedProcess.id}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProcessId(null)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  &times;
                </Button>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs overscroll-contain">
                {/* Order & Step Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">
                      Order ID
                    </span>
                    <p className="font-bold text-primary text-sm mt-0.5 font-mono">
                      {selectedOrder.orderId}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">
                      Step / Vorgang
                    </span>
                    <p className="font-mono font-bold text-foreground text-sm mt-0.5">
                      {selectedProcess.processId}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">
                    Material Spec
                  </span>
                  <p
                    className="font-mono text-foreground font-semibold mt-0.5 truncate"
                    title={selectedOrder.material}
                  >
                    {selectedOrder.material}
                  </p>
                </div>

                <div>
                  <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">
                    Process Text
                  </span>
                  <p className="text-foreground font-medium bg-muted/50 p-2 rounded border border-border/50 mt-0.5 leading-relaxed">
                    {selectedProcess.processText}
                  </p>
                </div>

                {/* Shop Floor Execution Status & 1-Click Action Controls */}
                <div className="border border-border/80 rounded-lg p-3 bg-slate-50/70 dark:bg-slate-900/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Shop Floor Status
                    </span>
                    {/* Current status badge */}
                    {currentExecStatus === "IN_PROGRESS" && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        Running
                      </span>
                    )}
                    {currentExecStatus === "PAUSED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                        <Pause className="w-3 h-3" /> On Hold
                      </span>
                    )}
                    {currentExecStatus === "COMPLETED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                      </span>
                    )}
                    {currentExecStatus === "PLANNED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-300 dark:bg-sky-950/40 dark:text-sky-300">
                        <Clock className="w-3 h-3 text-sky-600" /> Released
                      </span>
                    )}
                    {(currentExecStatus === "QUEUED" || currentExecStatus === "DELAYED") && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300">
                        Queued
                      </span>
                    )}
                  </div>

                  {/* 1-Click Status Controls */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={currentExecStatus === "IN_PROGRESS" ? "default" : "outline"}
                      onClick={() => {
                        store.updateStepExecutionStatus(selectedProcess.id, "IN_PROGRESS");
                        toast.success("Operation dispatched: RUNNING on shop floor!");
                      }}
                      className={cn(
                        "cursor-pointer text-[11px] h-8 px-1.5 gap-1 font-semibold",
                        currentExecStatus === "IN_PROGRESS"
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          : "text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300",
                      )}
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Start / Run
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={currentExecStatus === "PAUSED" ? "default" : "outline"}
                      onClick={() => setHoldModalOpen(true)}
                      className={cn(
                        "cursor-pointer text-[11px] h-8 px-1.5 gap-1 font-semibold",
                        currentExecStatus === "PAUSED"
                          ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                          : "text-amber-700 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300",
                      )}
                    >
                      <Pause className="h-3 w-3" />
                      Hold
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={currentExecStatus === "COMPLETED" ? "default" : "outline"}
                      onClick={() => {
                        store.updateStepExecutionStatus(selectedProcess.id, "COMPLETED", orderQty);
                        toast.success("Operation marked DONE!");
                      }}
                      className={cn(
                        "cursor-pointer text-[11px] h-8 px-1.5 gap-1 font-semibold",
                        currentExecStatus === "COMPLETED"
                          ? "bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                          : "text-slate-700 border-slate-300 hover:bg-slate-100 dark:text-slate-300 dark:border-slate-700",
                      )}
                    >
                      <Check className="h-3 w-3" />
                      Done
                    </Button>
                  </div>

                  {/* Secondary Status Options */}
                  <div className="flex items-center justify-between pt-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        store.updateStepExecutionStatus(selectedProcess.id, "PLANNED", 0);
                        toast.info("Operation reset to Released queue.");
                      }}
                      className={cn(
                        "cursor-pointer text-[10px] h-6 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200",
                        currentExecStatus === "PLANNED" &&
                          "font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/40",
                      )}
                    >
                      Set Released
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        store.updateStepExecutionStatus(selectedProcess.id, "QUEUED", 0);
                        toast.info("Operation moved to Backlog queue.");
                      }}
                      className={cn(
                        "cursor-pointer text-[10px] h-6 px-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200",
                        currentExecStatus === "QUEUED" &&
                          "font-bold text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800",
                      )}
                    >
                      Set Queued
                    </Button>
                  </div>

                  {/* Units Progress & Quick Input */}
                  <div className="pt-2 border-t border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground font-medium">Produced Units:</span>
                      <span className="font-mono font-bold text-foreground">
                        {completedUnits} / {orderQty} ({completionRate}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          currentExecStatus === "COMPLETED"
                            ? "bg-emerald-500"
                            : currentExecStatus === "IN_PROGRESS"
                              ? "bg-emerald-600"
                              : currentExecStatus === "PAUSED"
                                ? "bg-amber-500"
                                : "bg-slate-400",
                        )}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Label className="text-[10px] text-muted-foreground shrink-0">
                        Log Units:
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={orderQty}
                        value={selectedProcess.completedQty ?? 0}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            Math.min(orderQty, parseInt(e.target.value, 10) || 0),
                          );
                          store.updateStepExecutionStatus(
                            selectedProcess.id,
                            val >= orderQty
                              ? "COMPLETED"
                              : selectedProcess.executionStatus || "IN_PROGRESS",
                            val,
                          );
                        }}
                        className="h-7 text-xs font-mono w-24"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        of {orderQty} target
                      </span>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setScrapModalOpen(true)}
                        className="h-7 text-[10px] text-rose-600 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 ml-auto cursor-pointer"
                      >
                        Log Scrap
                      </Button>
                      {(selectedProcess.scrapQty || 0) > 0 && (
                        <span className="text-[10px] text-rose-600 font-bold font-mono">
                          ({selectedProcess.scrapQty} scrap)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Time Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <div className="text-center bg-sky-50 dark:bg-sky-950/20 p-2 rounded">
                    <span className="text-sky-600 font-bold text-[10px]">Setup R</span>
                    <p className="font-bold text-foreground mt-0.5">
                      {selectedProcess.setupTimeMin ?? 0}m
                    </p>
                  </div>
                  <div className="text-center bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded">
                    <span className="text-emerald-600 font-bold text-[10px]">
                      Machining M (SumV2)
                    </span>
                    <p className="font-bold text-foreground mt-0.5">
                      {(selectedProcess.sumV2 ?? 0).toFixed(1)}m
                    </p>
                  </div>
                  <div className="text-center bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                    <span className="text-orange-600 font-bold text-[10px]">Manpower (Pct)</span>
                    <p className="font-bold text-foreground mt-0.5">
                      {Math.round((selectedProcess.manpowerPct ?? 0) * 100)}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center bg-purple-50 dark:bg-purple-950/20 p-2 rounded">
                    <span className="text-purple-600 font-bold text-[10px]">Operator Util Min</span>
                    <p className="font-bold text-foreground mt-0.5">
                      {(selectedProcess.manpowerUtilizationMin ?? 0).toFixed(3)}m
                    </p>
                  </div>
                  <div className="text-center bg-indigo-50 dark:bg-indigo-950/20 p-2 rounded">
                    <span className="text-indigo-600 font-bold text-[10px]">
                      Total Operator Min (SumV3)
                    </span>
                    <p className="font-bold text-foreground mt-0.5">
                      {(selectedProcess.sumV3 ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                      m
                    </p>
                  </div>
                </div>

                {/* Manual Schedule Override */}
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
                          startD.getHours(),
                        );
                        toast.success("Updated assigned machine!");
                      }}
                    >
                      <SelectTrigger className="h-9 cursor-pointer">
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
                            startD.getHours(),
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
                            val,
                          );
                          toast.success("Rescheduled start hour!");
                        }}
                        className="h-9 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Schedule Windows (Planned vs Optimized) */}
                <div className="border-t border-border pt-3 space-y-2 bg-muted/30 p-2.5 rounded text-xs">
                  <div className="space-y-1 pb-2 border-b border-border/50">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Original Planned SOP
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">SOP Date:</span>
                      <span className="font-bold text-foreground">
                        {selectedOrder.sopStartDate}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">SOP Time:</span>
                      <span className="font-bold text-foreground">
                        {selectedOrder.sopStartTime || "00:00:00"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                      Optimized Schedule
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Scheduled Start:</span>
                      <span className="font-bold text-foreground">
                        {new Date(selectedProcess.scheduledStart!).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">Scheduled End:</span>
                      <span className="font-bold text-foreground">
                        {new Date(selectedProcess.scheduledEnd!).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Sticky Footer - Never Chopped */}
              <div className="p-4 sm:p-5 border-t border-border bg-background/95 backdrop-blur-sm shrink-0 flex flex-col gap-2 shadow-sm">
                {selectedProcess.isManual ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetProcessToAuto(selectedProcess.id);
                      setSelectedProcessId(null);
                      toast.success(
                        language === "de"
                          ? "Pin aufgehoben (Automatisch)!"
                          : "Reset process to automatic scheduling!",
                      );
                    }}
                    className="w-full border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer h-9"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    {language === "de"
                      ? "Pin aufheben (Automatisch)"
                      : "Unpin Schedule (Automatic)"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      pinProcessSchedule(selectedProcess.id);
                      setSelectedProcessId(null);
                      toast.success(
                        language === "de"
                          ? "Planung angepinnt / gesichert!"
                          : "Pinned/saved current schedule!",
                      );
                    }}
                    className="w-full border-primary/30 hover:bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer h-9"
                  >
                    <Pin className="h-3.5 w-3.5" />
                    {language === "de" ? "Planung anpinnen / sichern" : "Pin / Save Schedule"}
                  </Button>
                )}

                <Button
                  onClick={() => setSelectedProcessId(null)}
                  className="w-full bg-[#1e3f2e] hover:bg-[#27533d] text-white text-xs font-semibold h-9 cursor-pointer shadow-xs"
                >
                  Save & Close
                </Button>
              </div>
            </div>
          );
        })()}

      {/* Bottom Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>Timeline Color Indicators & Allocation Rules</span>
        </div>
        <ScheduleLegend />
      </div>

      {/* Raw Material Inventory & Shortage Engine Modal */}
      <MaterialInventoryModal open={isMaterialModalOpen} onOpenChange={setIsMaterialModalOpen} />

      {/* Hold Reason Code Modal */}
      {selectedProcess && (
        <HoldReasonModal
          open={holdModalOpen}
          onOpenChange={setHoldModalOpen}
          orderId={selectedProcess.orderId}
          processId={selectedProcess.processId}
          machineId={selectedProcess.machineId}
          onConfirm={(reason, notes) => {
            store.updateStepExecutionStatus(
              selectedProcess.id,
              "PAUSED",
              undefined,
              undefined,
              notes,
              reason,
            );
            toast.info(`Operation placed on HOLD (${reason}).`);
          }}
        />
      )}

      {/* Log Scrap Defect Modal */}
      {selectedProcess && (
        <LogScrapModal
          open={scrapModalOpen}
          onOpenChange={setScrapModalOpen}
          orderId={selectedProcess.orderId}
          processId={selectedProcess.processId}
          machineId={selectedProcess.machineId}
          totalOrderQty={selectedOrder?.orderQty || 100}
          onConfirm={(qty, reason, notes) => {
            store.logScrap(selectedProcess.id, qty, reason, notes);
          }}
        />
      )}
    </div>
  );
}
