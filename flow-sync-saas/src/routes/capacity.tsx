import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { SHIFT_1_START, SHIFT_1_END, SHIFT_2_END, WORKING_HOURS_PER_DAY } from "@/lib/types";
import { parseSOPDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  CalendarDays,
  SlidersHorizontal,
  Activity,
  Table,
  BarChart3,
  Users,
  Settings,
  Plus,
  Info,
  ArrowLeft,
  ArrowRight,
  Factory,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/capacity")({
  head: () => ({
    meta: [
      { title: "Capacity Planner — MFG Scheduler" },
      {
        name: "description",
        content: "Dedicated daily capacity settings and resource summary dashboard.",
      },
    ],
  }),
  component: CapacityPage,
});

const HOUR_WIDTH = 55; // wider cells for daily view

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

function CapacityPage() {
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

  const { t, language } = useTranslations();

  const activeOptimizationMode =
    optimizationMode !== "pre" && optimizationMode !== "workstation" && optimizationMode !== "full"
      ? "full"
      : optimizationMode;

  // Selected Date State
  const [selectedDateStr, setSelectedDateStr] = useState<string>("2026-06-01");
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // 0-indexed: 5 = June
  const [chartRole, setChartRole] = useState<"operator" | "setter">("operator");
  const [chartMachineFilter, setChartMachineFilter] = useState<string>("ALL");
  const [showCapLimitLine, setShowCapLimitLine] = useState<boolean>(true);

  // Dynamic filter for machines in capacity load chart
  const filteredChartMachines = useMemo(() => {
    if (chartMachineFilter === "ALL") return machines;
    if (chartMachineFilter.startsWith("GROUP_")) {
      const groupId = chartMachineFilter.replace("GROUP_", "");
      return machines.filter((m) => m.machineGroupId === groupId);
    }
    return machines.filter((m) => m.id === chartMachineFilter);
  }, [machines, chartMachineFilter]);

  const getMachineLabel = (m: any, isSetup = false) => {
    const machineWord = language === "de" ? "Maschine" : "Machine";
    const baseLabel = `${machineWord} ${m.name || m.id}`;
    return isSetup ? `${baseLabel} (${language === "de" ? "Rüsten" : "Setup"})` : baseLabel;
  };

  const getMachineColor = (idx: number, isSetup = false) => {
    const opColors = [
      "#10b981",
      "#3b82f6",
      "#f59e0b",
      "#ec4899",
      "#8b5cf6",
      "#14b8a6",
      "#f97316",
      "#06b6d4",
    ];
    const setColors = [
      "#8b5cf6",
      "#6366f1",
      "#a855f7",
      "#db2777",
      "#ec4899",
      "#3b82f6",
      "#d97706",
      "#0284c7",
    ];
    const palette = isSetup ? setColors : opColors;
    if (idx < palette.length) return palette[idx];
    const hue = (idx * 137.5) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Panel Visibilities State
  const [visiblePanels, setVisiblePanels] = useState<string[]>([
    "settings",
    "gantt",
    "pivot",
    "chart",
    "sop",
  ]);

  const togglePanel = (panelId: string) => {
    setVisiblePanels((prev) =>
      prev.includes(panelId) ? prev.filter((p) => p !== panelId) : [...prev, panelId],
    );
  };

  // Rescheduling Drawer State
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  // Drag and Drop State
  const [activeDragProcessId, setActiveDragProcessId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ machineId: string; hour: number } | null>(
    null,
  );

  const selectedProcess = useMemo(() => {
    return processes.find((p) => p.id === selectedProcessId) || null;
  }, [selectedProcessId, processes]);

  const selectedOrder = useMemo(() => {
    if (!selectedProcess) return null;
    return orders.find((o) => o.id === selectedProcess.orderId) || null;
  }, [selectedProcess, orders]);

  // Rescheduling drop handler
  const handleDrop = (e: React.DragEvent, targetMachineId: string, hourStart: number) => {
    e.preventDefault();
    const dragProcessId = e.dataTransfer.getData("text/plain");
    setActiveDragProcessId(null);
    setDragOverCell(null);
    if (!dragProcessId) return;

    updateSlotSchedule(dragProcessId, targetMachineId, selectedDateStr, hourStart);
    toast.success(`Rescheduled step successfully to machine ${targetMachineId}!`);
  };

  // Day calculations
  const dayCap = useMemo(() => {
    const raw = dailyCapacities?.[selectedDateStr];
    return {
      setter: typeof raw?.setter === "number" && !isNaN(raw.setter) ? raw.setter : 100,
      process: typeof raw?.process === "number" && !isNaN(raw.process) ? raw.process : 100,
    };
  }, [dailyCapacities, selectedDateStr]);

  const sopOrdersForSelectedDay = useMemo(() => {
    return orders.filter((order) => {
      try {
        const sopDate = parseSOPDate(order.sopStartDate, order.sopStartTime || "00:00:00");
        return formatDateStr(sopDate) === selectedDateStr;
      } catch (e) {
        return false;
      }
    });
  }, [orders, selectedDateStr]);

  // Actual minutes scheduled on selected day
  const dayActualMinutes = useMemo(() => {
    let setterUsed = 0;
    let operatorUsed = 0;

    slots.forEach((s) => {
      if (s.date === selectedDateStr) {
        if (s.slotType === "R") {
          setterUsed += s.minutesUsed;
        } else if (s.slotType === "M") {
          operatorUsed += s.minutesUsed * (s.manpowerPct ?? 0);
        }
      }
    });

    const setterAvailable = (dayCap.setter / 100) * 14 * 60;
    const operatorAvailable = (dayCap.process / 100) * 14 * 60;

    return {
      setterUsed,
      setterAvailable,
      setterUtil: setterAvailable > 0 ? (setterUsed / setterAvailable) * 100 : 0,
      operatorUsed,
      operatorAvailable,
      operatorUtil: operatorAvailable > 0 ? (operatorUsed / operatorAvailable) * 100 : 0,
    };
  }, [slots, selectedDateStr, dayCap, machineGroups]);

  // Calendar view parameters
  const calendarDays = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay(); // Sunday=0, Monday=1 etc.
    // Shift index so Monday is 0
    const offset = firstDayIdx === 0 ? 6 : firstDayIdx - 1;

    const list: {
      dayStr: string;
      dayNum: number;
      isPadding: boolean;
      hasSchedules: boolean;
      hasCustomCap: boolean;
      isHoliday?: boolean;
    }[] = [];

    // Padding for previous month
    for (let i = 0; i < offset; i++) {
      list.push({
        dayStr: "",
        dayNum: 0,
        isPadding: true,
        hasSchedules: false,
        hasCustomCap: false,
      });
    }

    // Actual calendar days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dStr = formatDateStr(d);

      const hasSchedules = slots.some((s) => s.date === dStr);
      const cap = dailyCapacities?.[dStr];
      const hasCustomCap = cap && (cap.setter !== 100 || cap.process !== 100 || cap.isHoliday);
      const isHoliday = !!cap?.isHoliday;

      list.push({
        dayStr: dStr,
        dayNum: i,
        isPadding: false,
        hasSchedules,
        hasCustomCap: !!hasCustomCap,
        isHoliday,
      });
    }

    return list;
  }, [currentYear, currentMonth, slots, dailyCapacities]);

  const monthNames =
    language === "de"
      ? [
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
        ]
      : [
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

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Day hourly composed chart data
  const hourlyChartData = useMemo(() => {
    const list = [];

    for (let hIdx = 0; hIdx < WORKING_HOURS_PER_DAY; hIdx++) {
      const hr = SHIFT_1_START + hIdx;

      const operatorBreakdown: any[] = [];
      const setterBreakdown: any[] = [];

      const operatorMinutesByMachine: Record<string, number> = {};
      const setterMinutesByMachine: Record<string, number> = {};

      machines.forEach((m) => {
        operatorMinutesByMachine[m.id] = 0;
        setterMinutesByMachine[m.id] = 0;
      });

      slots.forEach((s) => {
        if (s.date === selectedDateStr && s.hourStart === hr) {
          const proc = processes.find((p) => p.id === s.processId);
          const order = proc ? orders.find((o) => o.id === proc.orderId) : null;
          const orderCode = order ? order.orderId : "Unknown";
          const stepId = proc ? proc.processId : "Unknown";

          if (s.slotType === "R") {
            setterMinutesByMachine[s.machineId] =
              (setterMinutesByMachine[s.machineId] || 0) + s.minutesUsed;

            setterBreakdown.push({
              orderCode,
              stepId,
              machineId: s.machineId,
              minutesUsed: s.minutesUsed,
              pct: (s.minutesUsed / 60) * 100,
            });
          } else if (s.slotType === "M") {
            const pct =
              typeof s.manpowerPct === "number" && !isNaN(s.manpowerPct) ? s.manpowerPct : 0;
            const opMins = s.minutesUsed * pct;
            operatorMinutesByMachine[s.machineId] =
              (operatorMinutesByMachine[s.machineId] || 0) + opMins;

            operatorBreakdown.push({
              orderCode,
              stepId,
              machineId: s.machineId,
              minutesUsed: s.minutesUsed,
              pct: (opMins / 60) * 100,
            });
          }
        }
      });

      const dataPoint: any = {
        hourLabel: `${String(hr).padStart(2, "0")}:00`,
        setterLimitPct: dayCap.setter,
        operatorLimitPct: dayCap.process,
        operatorBreakdown,
        setterBreakdown,
      };

      machines.forEach((m) => {
        dataPoint[`operatorScheduledPct_${m.id}`] = (operatorMinutesByMachine[m.id] / 60) * 100;
        dataPoint[`setterScheduledPct_${m.id}`] = (setterMinutesByMachine[m.id] / 60) * 100;
      });

      list.push(dataPoint);
    }
    return list;
  }, [slots, selectedDateStr, dayCap, machines, processes, orders]);

  // Day-scoped hourly pivot table data
  const dayPivotMatrix = useMemo(() => {
    const matrix: Record<string, Record<number, { r: number; m: number; p: number }>> = {};

    machines.forEach((m) => {
      matrix[m.id] = {};
      for (let hIdx = 0; hIdx < WORKING_HOURS_PER_DAY; hIdx++) {
        const hr = SHIFT_1_START + hIdx;
        matrix[m.id][hr] = { r: 0, m: 0, p: 0 };
      }
    });

    slots.forEach((s) => {
      if (s.date === selectedDateStr) {
        const cell = matrix[s.machineId]?.[s.hourStart];
        if (cell) {
          if (s.slotType === "R") {
            cell.r += s.minutesUsed;
          } else if (s.slotType === "M") {
            cell.m += s.minutesUsed;
            cell.p += s.minutesUsed * (s.manpowerPct ?? 0);
          }
        }
      }
    });

    return matrix;
  }, [slots, selectedDateStr, machines]);

  // Group subtotals helper for day hourly pivot
  const getGroupSubtotalHourly = (groupId: string, hr: number) => {
    const groupMachines = machines.filter((m) => m.machineGroupId === groupId);
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;

    groupMachines.forEach((m) => {
      const cell = dayPivotMatrix[m.id]?.[hr];
      if (cell) {
        rSum += cell.r;
        mSum += cell.m;
        pSum += cell.p;
      }
    });

    return { rSum, mSum, pSum };
  };

  const getGrandTotalHourly = (hr: number) => {
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;

    machines.forEach((m) => {
      const cell = dayPivotMatrix[m.id]?.[hr];
      if (cell) {
        rSum += cell.r;
        mSum += cell.m;
        pSum += cell.p;
      }
    });

    return { rSum, mSum, pSum };
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isOperator = chartRole === "operator";
      const limit = isOperator ? data.operatorLimitPct : data.setterLimitPct;
      const breakdown = isOperator ? data.operatorBreakdown : data.setterBreakdown;

      let totalLoad = 0;
      breakdown.forEach((item: any) => {
        totalLoad += item.pct;
      });

      return (
        <div className="bg-background border border-border p-3 rounded-md shadow-md text-xs space-y-2 max-w-sm">
          <p className="font-extrabold text-foreground border-b border-border/60 pb-1">
            {label} Uhr
          </p>
          <p className="font-semibold text-foreground">
            Total Load:{" "}
            <span className="font-mono text-primary font-extrabold">{totalLoad.toFixed(1)}%</span>{" "}
            (Limit: {limit}%)
          </p>
          {breakdown.length > 0 ? (
            <div className="space-y-1.5 border-t border-border/40 pt-1.5">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">
                Process Breakdown:
              </p>
              <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
                {breakdown.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex flex-col border-b border-border/10 pb-1.5 last:border-0 last:pb-0 last:border-none"
                  >
                    <div className="flex justify-between items-center gap-4 text-foreground font-semibold">
                      <span>
                        Order {item.orderCode} (Step {item.stepId})
                      </span>
                      <span className="font-mono text-primary font-bold">
                        {item.pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex justify-between">
                      <span>Machine: {item.machineId}</span>
                      <span>Duration: {item.minutesUsed}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">No processes scheduled</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Streamlined Header with page description */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            {language === "de"
              ? "Kapazitäts- & Ressourcenplaner"
              : "Daily Capacity & Resource Planner"}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {language === "de"
              ? "Konfigurieren Sie individuelle Ressourcenobergrenzen für bestimmte Tage und prüfen Sie stundengenaue Belegungen."
              : "Configure custom resource ceilings for specific days and review hour-by-hour line loading."}
          </p>
        </div>

        {/* Toggle selectors to display components */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-100/90 dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-2xs">
          <span className="text-muted-foreground flex items-center gap-1 uppercase tracking-wider text-[10.5px]">
            <Clock className="h-3.5 w-3.5" /> {language === "de" ? "Ansichten:" : "Panels:"}
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-all">
            <Checkbox
              checked={visiblePanels.includes("settings")}
              onCheckedChange={() => togglePanel("settings")}
            />
            {language === "de" ? "Einstellungen" : "Settings"}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-all">
            <Checkbox
              checked={visiblePanels.includes("gantt")}
              onCheckedChange={() => togglePanel("gantt")}
            />
            {language === "de" ? "Gantt-Diagramm" : "Gantt Chart"}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-all">
            <Checkbox
              checked={visiblePanels.includes("pivot")}
              onCheckedChange={() => togglePanel("pivot")}
            />
            {language === "de" ? "Pivot-Tabelle" : "Pivot Table"}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-all">
            <Checkbox
              checked={visiblePanels.includes("chart")}
              onCheckedChange={() => togglePanel("chart")}
            />
            {language === "de" ? "Auslastungsdiagramm" : "Composed Chart"}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-all">
            <Checkbox
              checked={visiblePanels.includes("sop")}
              onCheckedChange={() => togglePanel("sop")}
            />
            {language === "de" ? "SOP-Meldungen" : "SOP Panel"}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-all">
            <Checkbox
              checked={visiblePanels.includes("warnings")}
              onCheckedChange={() => togglePanel("warnings")}
            />
            {language === "de" ? "Warnungen" : "Warnings"}
          </label>
        </div>
      </div>

      {/* 2. Top layout: Date selector calendar, capacity input card, and metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Column 1: Mini Calendar picker */}
        <Card className="border border-border/80 shadow-md bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {language === "de" ? "Wähle ein Datum" : "Choose a Date"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-4 pb-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-extrabold uppercase font-mono tracking-wider">
                {monthNames[currentMonth]} {currentYear}
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground uppercase border-b border-border/30 pb-1.5 mb-1.5">
              {language === "de" ? (
                <>
                  <span>Mo</span>
                  <span>Di</span>
                  <span>Mi</span>
                  <span>Do</span>
                  <span>Fr</span>
                  <span>Sa</span>
                  <span>So</span>
                </>
              ) : (
                <>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1 font-mono text-xs">
              {calendarDays.map((cd, idx) => {
                if (cd.isPadding) {
                  return <div key={idx} />;
                }
                const isSelected = cd.dayStr === selectedDateStr;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDateStr(cd.dayStr)}
                    className={cn(
                      "h-8 rounded-md flex flex-col items-center justify-center relative cursor-pointer font-bold hover:bg-accent/70 transition-all",
                      isSelected
                        ? "shadow-md font-extrabold scale-105"
                        : cd.isHoliday
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                          : cd.hasSchedules
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "text-muted-foreground",
                    )}
                    style={
                      isSelected ? { backgroundColor: "#0f172a", color: "#f8fafc" } : undefined
                    }
                  >
                    <span>{cd.dayNum}</span>
                    {cd.isHoliday ? (
                      <span
                        className={cn(
                          "absolute bottom-0.5 h-1 w-1 rounded-full",
                          isSelected ? "bg-rose-300" : "bg-rose-500",
                        )}
                      />
                    ) : cd.hasCustomCap ? (
                      <span
                        className={cn(
                          "absolute bottom-0.5 h-1 w-1 rounded-full",
                          isSelected ? "bg-white" : "bg-indigo-500",
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Column 2: Capacity Inputs Card (Setter & Operator Settings) */}
        {visiblePanels.includes("settings") ? (
          <Card className="border border-border/80 shadow-md bg-card flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                {language === "de" ? "Kapazitätsobergrenzen" : "Capacity Settings Limits"}
              </CardTitle>
              <CardDescription>
                {language === "de"
                  ? `Ressourcen konfigurieren für ${new Date(selectedDateStr).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "short" })}`
                  : `Customize resources for ${new Date(selectedDateStr).toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "short" })}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 flex-1">
              {/* Holiday Toggle */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40">
                <Label
                  htmlFor="holiday-toggle"
                  className="font-bold text-foreground flex flex-col gap-0.5 cursor-pointer"
                >
                  <span>{language === "de" ? "Als Feiertag markieren" : "Mark as Holiday"}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {language === "de" ? "Setzt Kapazitäten auf 0%" : "Sets all capacities to 0%"}
                  </span>
                </Label>
                <input
                  id="holiday-toggle"
                  type="checkbox"
                  checked={!!dailyCapacities?.[selectedDateStr]?.isHoliday}
                  onChange={(e) => {
                    const isHoliday = e.target.checked;
                    setDailyCapacity(selectedDateStr, {
                      isHoliday,
                      setter: isHoliday ? 0 : 100,
                      process: isHoliday ? 0 : 100,
                    });
                    toast.success(
                      isHoliday
                        ? language === "de"
                          ? "Tag als Feiertag markiert!"
                          : "Day marked as Holiday!"
                        : language === "de"
                          ? "Feiertag entfernt!"
                          : "Holiday removed!",
                    );
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              <div
                className={cn(
                  "space-y-1.5 transition-opacity duration-200",
                  dailyCapacities?.[selectedDateStr]?.isHoliday ? "opacity-40" : "opacity-100",
                )}
              >
                <div className="flex justify-between items-center text-xs">
                  <Label
                    htmlFor="setter-limit-in"
                    className="font-bold text-muted-foreground uppercase"
                  >
                    {language === "de" ? "Einrichter-Kapazität %" : "Setter Setup Capacity %"}
                  </Label>
                  <span className="font-mono font-bold text-primary">{dayCap.setter}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="setter-limit-in"
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={dayCap.setter}
                    disabled={!!dailyCapacities?.[selectedDateStr]?.isHoliday}
                    onChange={(e) =>
                      setDailyCapacity(selectedDateStr, {
                        setter: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="h-8 text-xs font-mono w-[90px]"
                  />
                  <span className="text-xs font-bold text-muted-foreground font-mono">%</span>
                </div>
              </div>

              <div
                className={cn(
                  "space-y-1.5 transition-opacity duration-200",
                  dailyCapacities?.[selectedDateStr]?.isHoliday ? "opacity-40" : "opacity-100",
                )}
              >
                <div className="flex justify-between items-center text-xs">
                  <Label
                    htmlFor="operator-limit-in"
                    className="font-bold text-muted-foreground uppercase"
                  >
                    {language === "de" ? "Bediener-Kapazität %" : "Machining Operator Capacity %"}
                  </Label>
                  <span className="font-mono font-bold text-primary">{dayCap.process}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="operator-limit-in"
                    type="number"
                    min={0}
                    max={1000}
                    step={10}
                    value={dayCap.process}
                    disabled={!!dailyCapacities?.[selectedDateStr]?.isHoliday}
                    onChange={(e) =>
                      setDailyCapacity(selectedDateStr, {
                        process: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    className="h-8 text-xs font-mono w-[90px]"
                  />
                  <span className="text-xs font-bold text-muted-foreground font-mono">%</span>
                </div>
              </div>

              {dailyCapacities?.[selectedDateStr]?.isHoliday && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-md text-[11px] text-rose-600 dark:text-rose-400 font-medium animate-in fade-in duration-200">
                  {language === "de"
                    ? "Dieser Tag ist als Feiertag markiert. Keine Schichten oder Arbeiten werden eingeplant."
                    : "This day is marked as a Holiday. No shifts or setups will be scheduled."}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center border border-dashed rounded-lg bg-muted/10 text-muted-foreground text-xs font-medium">
            {language === "de"
              ? "Einstellungen-Panel ist ausgeblendet. Aktivieren Sie 'Einstellungen' oben."
              : "Settings panel is hidden. Check 'Settings' above."}
          </div>
        )}

        {/* Column 3: Live Utilization Stats */}
        <Card className="border border-border/80 shadow-md bg-card">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              {language === "de" ? "Tagesressourcen-Auslastung" : "Day Resource Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  {language === "de"
                    ? "Einrichter (Rüsten R) Tagesauslastung"
                    : "Setter (Setup R) Daily Utilization"}
                </span>
                <span
                  className={cn(
                    "font-bold text-sm font-mono",
                    dayActualMinutes.setterUtil > 100
                      ? "text-red-500 animate-pulse"
                      : "text-sky-600",
                  )}
                >
                  {dayActualMinutes.setterUtil.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-border/10">
                <div
                  style={{ width: `${Math.min(100, dayActualMinutes.setterUtil)}%` }}
                  className={cn(
                    "h-full",
                    dayActualMinutes.setterUtil > 100 ? "bg-red-500" : "bg-sky-500",
                  )}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {language === "de"
                  ? `Belegt: ${dayActualMinutes.setterUsed.toFixed(0)} Min / Verfügbar: ${dayActualMinutes.setterAvailable.toFixed(0)} Min`
                  : `Used: ${dayActualMinutes.setterUsed.toFixed(0)} min / Available: ${dayActualMinutes.setterAvailable.toFixed(0)} min`}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                  {language === "de"
                    ? "Bediener (Maschine M) Tagesauslastung"
                    : "Operator (Machining M) Daily Utilization"}
                </span>
                <span
                  className={cn(
                    "font-bold text-sm font-mono",
                    dayActualMinutes.operatorUtil > 100
                      ? "text-red-500 animate-pulse"
                      : "text-emerald-600",
                  )}
                >
                  {dayActualMinutes.operatorUtil.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-border/10">
                <div
                  style={{ width: `${Math.min(100, dayActualMinutes.operatorUtil)}%` }}
                  className={cn(
                    "h-full",
                    dayActualMinutes.operatorUtil > 100 ? "bg-red-500" : "bg-emerald-500",
                  )}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                {language === "de"
                  ? `Belegt: ${dayActualMinutes.operatorUsed.toFixed(0)} Min / Verfügbar: ${dayActualMinutes.operatorAvailable.toFixed(0)} Min`
                  : `Used: ${dayActualMinutes.operatorUsed.toFixed(0)} min / Available: ${dayActualMinutes.operatorAvailable.toFixed(0)} min`}
              </p>
            </div>

            {/* Local Optimizer presets */}
            <div className="border-t border-border pt-3 space-y-2">
              <span className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                {language === "de" ? "Optimierungsmodus" : "Optimization Mode"}
              </span>
              <div className="flex bg-muted p-0.5 rounded border border-border/60">
                {(["pre", "workstation", "full"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setOptimizationMode(mode);
                      toast.success(`Regenerating in ${mode} optimization mode!`);
                    }}
                    className={cn(
                      "flex-1 py-1 rounded text-[10px] font-bold cursor-pointer transition-all uppercase",
                      activeOptimizationMode === mode
                        ? "bg-background text-foreground shadow-sm font-extrabold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {activeOptimizationMode === "full" && (
              <div className="flex flex-col gap-3 pt-3 border-t border-border/40">
                <div className="flex items-start gap-2">
                  <input
                    id="process-overlap-checkbox-capacity"
                    type="checkbox"
                    checked={allowProcessOverlap}
                    onChange={(e) => {
                      setAllowProcessOverlap(e.target.checked);
                      toast.success(
                        e.target.checked ? "Process overlap enabled!" : "Process overlap disabled!",
                      );
                    }}
                    className="h-3.5 w-3.5 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Label
                    htmlFor="process-overlap-checkbox-capacity"
                    className="text-[10px] font-bold text-foreground cursor-pointer flex flex-col gap-0.5"
                  >
                    <span>
                      {language === "de" ? "Prozessüberlappung erlauben" : "Allow Process Overlap"}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-normal">
                      {language === "de"
                        ? "Gleichzeitige Bearbeitung in derselben Gruppe (Rüstvorgänge sequenziert)"
                        : "Concurrent machining in same group (sequenced setups)"}
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    id="sop-override-checkbox-capacity"
                    type="checkbox"
                    checked={allowSopOverride}
                    onChange={(e) => {
                      setAllowSopOverride(e.target.checked);
                      toast.success(
                        e.target.checked ? "SOP Override enabled!" : "SOP Override disabled!",
                      );
                    }}
                    className="h-3.5 w-3.5 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Label
                    htmlFor="sop-override-checkbox-capacity"
                    className="text-[10px] font-bold text-foreground cursor-pointer flex flex-col gap-0.5"
                  >
                    <span>
                      {language === "de" ? "SOP-Startdatum ignorieren" : "Allow SOP Override"}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-normal">
                      {language === "de"
                        ? "Prozesse vorziehen, SOP-Startdaten ignorieren"
                        : "Pull processes forward ignoring SOP start dates"}
                    </span>
                  </Label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    id="max-utilize-checkbox-capacity"
                    type="checkbox"
                    checked={maxUtilizeResources}
                    onChange={(e) => {
                      setMaxUtilizeResources(e.target.checked);
                      toast.success(
                        e.target.checked ? "Max Utilize enabled!" : "Max Utilize disabled!",
                      );
                    }}
                    className="h-3.5 w-3.5 mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <Label
                    htmlFor="max-utilize-checkbox-capacity"
                    className="text-[10px] font-bold text-foreground cursor-pointer flex flex-col gap-0.5"
                  >
                    <span>
                      {language === "de"
                        ? "Auslastung maximieren (Verschieben in Gruppe)"
                        : "Max Utilize (Shift in Group)"}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-normal">
                      {language === "de"
                        ? "Erlaubt das Verschieben von Prozessen innerhalb derselben Maschinengruppe"
                        : "Allows shifting processes within same machine group"}
                    </span>
                  </Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Render Schedule Alerts specifically for this day */}
      {visiblePanels.includes("warnings") && warnings.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5 p-4 text-xs shadow-sm">
          <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400 border-b border-red-500/15 pb-2 mb-2">
            <Info className="h-4 w-4" />
            {language === "de"
              ? "Kapazitätsüberschreitungen und Überlastungen im gewählten Zeitraum:"
              : "Scheduling & Stacking Overloads detected in selected range:"}
          </div>
          <ul className="list-inside list-disc text-muted-foreground font-mono space-y-1 max-h-[150px] overflow-y-auto pr-2">
            {warnings.map((w, i) => (
              <li key={i} className="whitespace-pre-line leading-relaxed">
                {w}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 4. Day-Scoped Gantt Chart Panel */}
      {visiblePanels.includes("gantt") && (
        <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
          <CardHeader className="border-b border-border/50 pb-3 flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                {language === "de"
                  ? `Stundengenaues Tages-Gantt (${new Date(selectedDateStr).toLocaleDateString("de-DE")})`
                  : `Hourly Day Gantt Chart (${new Date(selectedDateStr).toLocaleDateString("en-US")})`}
              </CardTitle>
              <CardDescription>
                {language === "de"
                  ? "Verschieben Sie Prozessschritte per Drag-and-Drop. R = Rüsten (Stahlblau), M = Bearbeitung (Grün)."
                  : "Drag and drop process steps across workstation lines to reschedule. R = Setup (steel blue), M = Machining (green)."}
              </CardDescription>
            </div>
            <Legend />
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div
              style={{ width: 220 + WORKING_HOURS_PER_DAY * HOUR_WIDTH }}
              className="flex flex-col relative select-none"
            >
              {/* Header row (Shifts) */}
              <div className="flex border-b border-border bg-muted/40 sticky top-0 z-20">
                <div className="w-[220px] shrink-0 border-r border-border px-4 py-2 bg-muted/95 sticky left-0 z-30 flex items-center font-bold text-xs uppercase tracking-wider text-muted-foreground shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  {language === "de" ? "Maschine" : "Machine"}
                </div>
                <div className="flex text-[9px] font-semibold text-muted-foreground">
                  <div
                    className="border-r border-border/30 px-3 py-1 bg-sky-500/5 text-center font-bold"
                    style={{ width: 7 * HOUR_WIDTH }}
                  >
                    {language === "de" ? "Schicht 1 (06:00–13:00)" : "Shift 1 (06:00–13:00)"}
                  </div>
                  <div
                    className="px-3 py-1 bg-orange-500/5 text-center font-bold"
                    style={{ width: 7 * HOUR_WIDTH }}
                  >
                    {language === "de" ? "Schicht 2 (13:00–20:00)" : "Shift 2 (13:00–20:00)"}
                  </div>
                </div>
              </div>

              {/* Hour labels row */}
              <div className="flex border-b border-border/60 bg-muted/20">
                <div className="w-[220px] shrink-0 border-r border-border bg-muted sticky left-0 z-20" />
                <div className="flex">
                  {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                    const hr = SHIFT_1_START + hIdx;
                    return (
                      <div
                        key={hr}
                        className="border-r border-border/20 text-[10px] font-mono text-muted-foreground flex items-center justify-center bg-background hover:bg-secondary/40 cursor-default"
                        style={{ width: HOUR_WIDTH, height: 24 }}
                      >
                        {String(hr).padStart(2, "0")}:00
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Workstation Rows */}
              {machines.map((m) => {
                const windowStart = new Date(`${selectedDateStr}T06:00:00`);
                const windowEnd = new Date(`${selectedDateStr}T20:00:00`);

                const dayProcesses = processes.filter((p) => {
                  if (
                    p.status !== "SCHEDULED" ||
                    p.machineId !== m.id ||
                    !p.scheduledStart ||
                    !p.scheduledEnd
                  ) {
                    return false;
                  }
                  const startD = new Date(p.scheduledStart);
                  const endD = new Date(p.scheduledEnd);
                  return startD < windowEnd && endD > windowStart;
                });

                return (
                  <div
                    key={m.id}
                    className="flex border-b border-border/60 hover:bg-muted/5 transition-colors"
                  >
                    {/* Workstation label cell */}
                    <div className="w-[220px] shrink-0 border-r border-border px-4 py-2.5 bg-background sticky left-0 z-20 flex items-center justify-between shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <div>
                        <div className="font-bold text-foreground text-sm flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {m.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {language === "de"
                            ? `Gruppe ${m.machineGroupId}`
                            : `Group ${m.machineGroupId}`}
                        </div>
                      </div>
                    </div>

                    {/* Timeline background cell dropzones */}
                    <div
                      className="relative flex items-center"
                      style={{ width: WORKING_HOURS_PER_DAY * HOUR_WIDTH, height: 48 }}
                    >
                      <div className="absolute inset-0 flex pointer-events-none">
                        {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                          const hr = SHIFT_1_START + hIdx;
                          const isShift1 = hr < SHIFT_1_END;
                          const isOver =
                            dragOverCell &&
                            dragOverCell.machineId === m.id &&
                            dragOverCell.hour === hr;

                          return (
                            <div
                              key={hr}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (
                                  !dragOverCell ||
                                  dragOverCell.machineId !== m.id ||
                                  dragOverCell.hour !== hr
                                ) {
                                  setDragOverCell({ machineId: m.id, hour: hr });
                                }
                              }}
                              onDragLeave={() => {
                                setDragOverCell((curr) =>
                                  curr && curr.machineId === m.id && curr.hour === hr ? null : curr,
                                );
                              }}
                              onDrop={(e) => handleDrop(e, m.id, hr)}
                              className={cn(
                                "h-full border-r border-border/10 pointer-events-auto cursor-crosshair transition-all duration-150",
                                isOver
                                  ? "bg-primary/25 ring-2 ring-primary/40 ring-inset"
                                  : isShift1
                                    ? "bg-sky-500/[0.015] hover:bg-sky-500/10"
                                    : "bg-orange-500/[0.015] hover:bg-orange-500/10",
                                hr === SHIFT_1_END ? "border-r-2 border-border/40" : "",
                              )}
                              style={{ width: HOUR_WIDTH }}
                            />
                          );
                        })}
                      </div>

                      {/* Process blocks */}
                      {dayProcesses.map((p) => {
                        const order = orders.find((o) => o.id === p.orderId);
                        if (!order || !p.scheduledStart || !p.scheduledEnd) return null;

                        const startD = new Date(p.scheduledStart);
                        const endD = new Date(p.scheduledEnd);

                        // Clamp process times to the selected day's working window
                        const renderStart = new Date(
                          Math.max(startD.getTime(), windowStart.getTime()),
                        );
                        const renderEnd = new Date(Math.min(endD.getTime(), windowEnd.getTime()));

                        // Calculate working hours offsets
                        const leftWorkingHours = getWorkingHoursBetween(windowStart, renderStart);
                        const durationHours = getWorkingHoursBetween(renderStart, renderEnd);

                        const leftOffset = leftWorkingHours * HOUR_WIDTH;
                        const widthVal = durationHours * HOUR_WIDTH;

                        const isOverloaded = slots.some(
                          (sl) => sl.processId === p.id && sl.overloaded,
                        );
                        const isColliding = slots.some(
                          (sl) => sl.processId === p.id && sl.collision,
                        );

                        const setupHours = Math.ceil(p.setupTimeMin / 60);
                        const setupEndD = new Date(startD.getTime() + setupHours * 60 * 60 * 1000);
                        let setupWidth = 0;
                        if (setupEndD > renderStart) {
                          const visibleSetupEnd = new Date(
                            Math.min(setupEndD.getTime(), renderEnd.getTime()),
                          );
                          const visibleSetupHours = getWorkingHoursBetween(
                            renderStart,
                            visibleSetupEnd,
                          );
                          setupWidth = visibleSetupHours * HOUR_WIDTH;
                        }

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
                              "absolute h-9 rounded-md shadow-sm border border-border/60 overflow-hidden flex cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary hover:shadow-md transition-all select-none z-10",
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
                            {setupWidth > 0 && (
                              <div
                                style={{ width: setupWidth }}
                                className="h-full bg-[#4A90D9] text-white flex items-center justify-center px-1 text-[10px] font-extrabold truncate shrink-0 border-r border-white/20"
                                title={`Setup R: ${p.setupTimeMin} min`}
                              >
                                R {order.orderId}
                              </div>
                            )}

                            <div
                              className={cn(
                                "h-full flex-1 text-white flex items-center justify-between px-1.5 text-[10px] font-bold truncate transition-colors",
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
                              <span className="truncate">M {order.orderId}</span>
                              <span className="text-[8px] opacity-90 border-l border-white/20 pl-1 font-mono font-bold">
                                {p.processId} ({Math.round((p.manpowerPct ?? 0) * 100)}% P)
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
          </CardContent>
        </Card>
      )}

      {/* 5. Day-Scoped Pivot Table Panel */}
      {visiblePanels.includes("pivot") && (
        <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Table className="h-5 w-5 text-primary" />
              Day Workstation Load Pivot Grid (
              {new Date(selectedDateStr).toLocaleDateString("de-DE")})
            </CardTitle>
            <CardDescription>
              Shows hourly loads per machine for R (Setup min), M (Machining min), and P (Manpower
              util load) in the selected day.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th
                      colSpan={3}
                      className="px-4 py-3 border-r border-border text-left font-bold uppercase tracking-wider sticky left-0 bg-muted z-20 w-[260px] min-w-[260px] max-w-[260px]"
                    >
                      Workstations / Hours
                    </th>
                    {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                      const hr = SHIFT_1_START + hIdx;
                      return (
                        <th
                          key={hr}
                          colSpan={3}
                          className="px-2 py-2 border-r border-border text-center font-bold text-foreground min-w-[100px] font-mono"
                        >
                          {String(hr).padStart(2, "0")}:00
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="bg-muted border-b border-border font-medium text-muted-foreground">
                    <th className="px-4 py-1.5 text-left border-r border-border sticky left-0 bg-muted z-20 w-[90px] min-w-[90px] max-w-[90px]">
                      Group
                    </th>
                    <th className="px-2 py-1.5 text-left border-r border-border sticky left-[90px] bg-muted z-20 w-[90px] min-w-[90px] max-w-[90px]">
                      Machine
                    </th>
                    <th className="px-2 py-1.5 text-left border-r border-border sticky left-[180px] bg-muted z-20 w-[80px] min-w-[80px] max-w-[80px]">
                      Auftrag
                    </th>

                    {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => (
                      <Fragment key={hIdx}>
                        <th className="px-0.5 py-1 text-center font-mono border-r border-border/20 text-sky-600 bg-sky-50/25 w-[30px] min-w-[30px]">
                          R
                        </th>
                        <th className="px-0.5 py-1 text-center font-mono border-r border-border/20 text-emerald-600 bg-emerald-50/25 w-[30px] min-w-[30px]">
                          M
                        </th>
                        <th className="px-0.5 py-1 text-center font-mono border-r border-border text-orange-600 bg-orange-50/25 w-[40px] min-w-[40px]">
                          P
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {machineGroups.map((g) => {
                    const groupMachines = machines.filter((m) => m.machineGroupId === g.id);
                    return (
                      <Fragment key={g.id}>
                        {/* Group Header Row */}
                        <tr className="bg-muted/10 font-bold border-b border-border">
                          <td
                            colSpan={3}
                            className="px-4 py-2 border-r border-border text-primary sticky left-0 bg-background z-10 font-bold w-[260px] min-w-[260px] max-w-[260px]"
                          >
                            {g.name}
                          </td>
                          {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => (
                            <td colSpan={3} key={hIdx} className="border-r border-border" />
                          ))}
                        </tr>

                        {/* Machine Rows */}
                        {groupMachines.map((m) => {
                          return (
                            <tr
                              key={m.id}
                              className="border-b border-border hover:bg-muted/5 transition-colors"
                            >
                              <td className="px-4 py-1.5 border-r border-border sticky left-0 bg-background z-10 text-muted-foreground pl-6 w-[90px]">
                                {g.name}
                              </td>
                              <td className="px-2 py-1.5 border-r border-border sticky left-[90px] bg-background z-10 font-semibold font-mono text-foreground w-[90px]">
                                {m.name}
                              </td>
                              <td className="px-2 py-1.5 border-r border-border sticky left-[180px] bg-background z-10 font-mono text-muted-foreground truncate w-[80px]">
                                {slots
                                  .filter((s) => s.machineId === m.id && s.date === selectedDateStr)
                                  .slice(0, 1)
                                  .map((s) => s.processId.split("-")[1])
                                  .join("") || ""}
                              </td>

                              {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                                const hr = SHIFT_1_START + hIdx;
                                const cell = dayPivotMatrix[m.id]?.[hr];
                                const rVal = cell && cell.r > 0 ? cell.r.toFixed(0) : "";
                                const mVal = cell && cell.m > 0 ? cell.m.toFixed(0) : "";
                                const pVal = cell && cell.p > 0 ? `${Math.round(cell.p)}m` : "";

                                return (
                                  <Fragment key={hr}>
                                    <td className="px-0.5 py-1 text-center border-r border-border/25 font-mono text-sky-700 bg-sky-50/5">
                                      {rVal}
                                    </td>
                                    <td className="px-0.5 py-1 text-center border-r border-border/25 font-mono text-emerald-700 bg-emerald-50/5">
                                      {mVal}
                                    </td>
                                    <td className="px-0.5 py-1 text-center border-r border-border font-mono text-orange-700">
                                      {pVal}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          );
                        })}

                        {/* Group Subtotals Row */}
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-border/80">
                          <td
                            colSpan={3}
                            className="px-4 py-2 border-r border-border sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 font-bold text-foreground w-[260px]"
                          >
                            {g.name} Ergebnis
                          </td>
                          {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                            const hr = SHIFT_1_START + hIdx;
                            const sub = getGroupSubtotalHourly(g.id, hr);
                            const rVal = sub.rSum > 0 ? sub.rSum.toFixed(0) : "";
                            const mVal = sub.mSum > 0 ? sub.mSum.toFixed(0) : "";
                            const pVal = sub.pSum > 0 ? `${Math.round(sub.pSum)}m` : "";

                            return (
                              <Fragment key={hr}>
                                <td className="px-0.5 py-2 text-center border-r border-border/25 font-mono text-sky-800 bg-sky-50/10">
                                  {rVal}
                                </td>
                                <td className="px-0.5 py-2 text-center border-r border-border/25 font-mono text-emerald-800 bg-emerald-50/10">
                                  {mVal}
                                </td>
                                <td className="px-0.5 py-2 text-center border-r border-border font-mono text-orange-850 bg-orange-50/10">
                                  {pVal}
                                </td>
                              </Fragment>
                            );
                          })}
                        </tr>
                      </Fragment>
                    );
                  })}

                  {/* Grand Total Row */}
                  <tr className="bg-slate-200 dark:bg-slate-700 font-bold border-b border-border/90 text-sm">
                    <td
                      colSpan={3}
                      className="px-4 py-2.5 border-r border-border sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-primary w-[260px]"
                    >
                      Grand Total
                    </td>
                    {Array.from({ length: WORKING_HOURS_PER_DAY }).map((_, hIdx) => {
                      const hr = SHIFT_1_START + hIdx;
                      const grand = getGrandTotalHourly(hr);
                      const rVal = grand.rSum > 0 ? grand.rSum.toFixed(0) : "";
                      const mVal = grand.mSum > 0 ? grand.mSum.toFixed(0) : "";
                      const pVal = grand.pSum > 0 ? `${Math.round(grand.pSum)}m` : "";

                      return (
                        <Fragment key={hr}>
                          <td className="px-0.5 py-2.5 text-center border-r border-border/20 font-mono text-sky-900 bg-sky-100/10">
                            {rVal}
                          </td>
                          <td className="px-0.5 py-2.5 text-center border-r border-border/20 font-mono text-emerald-900 bg-emerald-100/10">
                            {mVal}
                          </td>
                          <td className="px-0.5 py-2.5 text-center border-r border-border font-mono text-orange-900 bg-orange-100/10">
                            {pVal}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SOP Orders Panel */}
      {visiblePanels.includes("sop") && (
        <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 flex-wrap gap-4 border-b border-border/40 bg-muted/10">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                SOP Start Orders ({new Date(selectedDateStr).toLocaleDateString("en-US")})
              </CardTitle>
              <CardDescription>
                Manufacturing orders and their associated process steps scheduled to start
                production on this date.
              </CardDescription>
            </div>
            <div className="bg-indigo-500/10 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold border border-indigo-500/20">
              {sopOrdersForSelectedDay.length} Orders Starting
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {sopOrdersForSelectedDay.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No orders scheduled for SOP start on this day.
              </div>
            ) : (
              <div className="space-y-6">
                {sopOrdersForSelectedDay.map((order) => {
                  const orderProcs = processes.filter((p) => p.orderId === order.id);
                  return (
                    <div
                      key={order.id}
                      className="border border-border/80 rounded-lg overflow-hidden bg-muted/5"
                    >
                      <div className="bg-muted/30 px-4 py-3 border-b border-border/60 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <span className="font-extrabold text-sm text-foreground">
                            Order: {order.orderId}
                          </span>
                          <span className="ml-3 font-mono text-xs text-muted-foreground">
                            Material: {order.material}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground font-semibold">
                            Qty:{" "}
                            <span className="font-mono text-foreground font-bold">
                              {order.orderQty}
                            </span>
                          </span>
                          <span className="text-muted-foreground font-semibold">
                            SOP Time:{" "}
                            <span className="font-mono text-foreground font-bold">
                              {order.sopStartTime}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/10 text-muted-foreground uppercase font-bold text-[10px] tracking-wider">
                              <th className="px-4 py-2">Step</th>
                              <th className="px-4 py-2">Workstation</th>
                              <th className="px-4 py-2">Description</th>
                              <th className="px-4 py-2 text-center">Setup (R)</th>
                              <th className="px-4 py-2 text-center">Process (M)</th>
                              <th className="px-4 py-2">Status</th>
                              <th className="px-4 py-2">Scheduled Window</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderProcs.map((proc) => {
                              const isScheduled = proc.status === "SCHEDULED";
                              return (
                                <tr
                                  key={proc.id}
                                  className="border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors"
                                >
                                  <td className="px-4 py-2.5 font-mono font-bold text-foreground">
                                    {proc.processId}
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-muted-foreground">
                                    {proc.machineId}
                                  </td>
                                  <td
                                    className="px-4 py-2.5 text-foreground max-w-[200px] truncate"
                                    title={proc.processText}
                                  >
                                    {proc.processText}
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono text-muted-foreground">
                                    {proc.setupTimeMin}m
                                  </td>
                                  <td className="px-4 py-2.5 text-center font-mono text-muted-foreground">
                                    {Math.round(proc.sumV2)}m
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        isScheduled
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                          : "bg-amber-100 text-amber-800 border border-amber-200"
                                      }`}
                                    >
                                      {isScheduled ? "Scheduled" : "Unscheduled"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono text-xs">
                                    {isScheduled && proc.scheduledStart && proc.scheduledEnd ? (
                                      <span className="text-foreground font-semibold">
                                        {new Date(proc.scheduledStart).toLocaleDateString("en-US", {
                                          day: "2-digit",
                                          month: "short",
                                        })}
                                        :{" "}
                                        {new Date(proc.scheduledStart).toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })}{" "}
                                        -{" "}
                                        {new Date(proc.scheduledEnd).toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          hour12: false,
                                        })}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground italic">
                                        Pending scheduling
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. Day-Scoped Capacity Load Chart Panel */}
      {visiblePanels.includes("chart") && (
        <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-4 flex-wrap gap-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" />
                {language === "de"
                  ? "Stündliche Auslastung vs. Kapazitätsgrenze"
                  : "Hourly Load vs Capacity Limit"}{" "}
                (
                {new Date(selectedDateStr).toLocaleDateString(
                  language === "de" ? "de-DE" : "en-US",
                )}
                )
              </CardTitle>
              <CardDescription>
                {language === "de"
                  ? "Stündliche Kapazitätsauslastung (Balken) gegen konfigurierte Grenzen (Linien) filtern und analysieren."
                  : "Review hourly capacity loads (bars) against configured capacity limits (lines) for the selected date."}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dynamic Machine Filter Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground font-medium">
                  {language === "de" ? "Maschine:" : "Workstation:"}
                </span>
                <Select value={chartMachineFilter} onValueChange={setChartMachineFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-xs bg-background">
                    <SelectValue
                      placeholder={language === "de" ? "Alle Maschinen" : "All Workstations"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">
                      {language === "de" ? "Alle Arbeitsplätze" : "All Workstations"}
                    </SelectItem>
                    {machineGroups.map((g) => (
                      <SelectItem key={`group-${g.id}`} value={`GROUP_${g.id}`}>
                        {language === "de" ? `Gruppe ${g.name}` : `Group ${g.name}`}
                      </SelectItem>
                    ))}
                    {machines.map((m) => (
                      <SelectItem key={`m-${m.id}`} value={m.id}>
                        {language === "de"
                          ? `Maschine ${m.name || m.id}`
                          : `Machine ${m.name || m.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cap Limit Line Toggle */}
              <button
                onClick={() => setShowCapLimitLine((v) => !v)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded border transition-all cursor-pointer font-medium",
                  showCapLimitLine
                    ? "border-primary/50 text-primary bg-primary/10 shadow-sm"
                    : "border-border text-muted-foreground bg-muted hover:bg-accent",
                )}
                title={
                  language === "de" ? "Kapazitätsgrenzen-Linie ein/ausblenden" : "Toggle limit line"
                }
              >
                {language === "de" ? "Grenze-Linie" : "Limit Line"}
              </button>

              {/* Operator vs Setter Role Selector */}
              <div className="flex bg-muted p-1 rounded-md border border-border text-xs shrink-0 font-medium">
                <button
                  onClick={() => setChartRole("operator")}
                  className={cn(
                    "px-3 py-1 rounded transition-all cursor-pointer",
                    chartRole === "operator"
                      ? "bg-background font-bold text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {language === "de" ? "Bediener" : "Operators"}
                </button>
                <button
                  onClick={() => setChartRole("setter")}
                  className={cn(
                    "px-3 py-1 rounded transition-all cursor-pointer",
                    chartRole === "setter"
                      ? "bg-background font-bold text-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {language === "de" ? "Einrichter" : "Setters"}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart
                data={hourlyChartData}
                margin={{ top: 10, right: 10, bottom: 5, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  dataKey="hourLabel"
                  className="text-[10px] font-mono text-muted-foreground"
                />
                <YAxis
                  label={{
                    value: language === "de" ? "Auslastung / Kapazität (%)" : "Load / Capacity (%)",
                    angle: -90,
                    position: "insideLeft",
                    className: "text-[10px] fill-muted-foreground font-sans font-semibold",
                  }}
                  className="text-[10px] font-mono text-muted-foreground"
                  tickFormatter={(val) => `${val}%`}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <RechartsLegend wrapperStyle={{ fontSize: "11px" }} />

                {chartRole === "operator" &&
                  filteredChartMachines.map((m, idx) => (
                    <Bar
                      key={`op-bar-${m.id}`}
                      dataKey={`operatorScheduledPct_${m.id}`}
                      stackId="a"
                      name={getMachineLabel(m, false)}
                      fill={getMachineColor(idx, false)}
                    />
                  ))}
                {chartRole === "operator" && showCapLimitLine && (
                  <Line
                    type="linear"
                    dataKey="operatorLimitPct"
                    name={language === "de" ? "Bediener-Grenze (%)" : "Operator Cap Limit (%)"}
                    stroke="#d97706"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                )}

                {chartRole === "setter" &&
                  filteredChartMachines.map((m, idx) => (
                    <Bar
                      key={`set-bar-${m.id}`}
                      dataKey={`setterScheduledPct_${m.id}`}
                      stackId="a"
                      name={getMachineLabel(m, true)}
                      fill={getMachineColor(idx, true)}
                    />
                  ))}
                {chartRole === "setter" && showCapLimitLine && (
                  <Line
                    type="linear"
                    dataKey="setterLimitPct"
                    name={language === "de" ? "Einrichter-Grenze (%)" : "Setter Cap Limit (%)"}
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 7. Slide-over Details Drawer (just like Gantt view for manual rescheduling) */}
      {selectedProcess && selectedOrder && (
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
                  <span className="text-muted-foreground uppercase tracking-wider font-semibold text-[10px]">
                    Order ID
                  </span>
                  <p className="font-bold text-primary text-sm mt-0.5">{selectedOrder.orderId}</p>
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
                <p className="font-mono text-foreground font-semibold mt-0.5">
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

              <div className="grid grid-cols-2 gap-2 mt-2">
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
                        selectedDateStr,
                        startD.getHours(),
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
                          selectedDateStr,
                          val,
                        );
                        toast.success("Rescheduled start hour!");
                      }}
                      className="h-9 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {selectedProcess.isManual && (
            <Button
              variant="outline"
              onClick={() => {
                resetProcessToAuto(selectedProcess.id);
                setSelectedProcessId(null);
                toast.success("Reset process to automatic scheduling!");
              }}
              className="w-full border-destructive/30 hover:bg-destructive/10 text-destructive text-xs font-semibold mt-4"
            >
              {language === "de" ? "Auf Automatik zurücksetzen" : "Reset to Automatic"}
            </Button>
          )}

          <Button
            onClick={() => setSelectedProcessId(null)}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-4"
          >
            Save & Close
          </Button>
        </div>
      )}
    </div>
  );
}

function Legend() {
  const { columnMapping } = useAppStore();
  const setupLabel = columnMapping?.setupTime || "Setup R";
  const machLabel = columnMapping?.processTime || "Machining M";

  const items = [
    { label: setupLabel, bg: "bg-[#4A90D9]" },
    { label: machLabel, bg: "bg-[#52C41A]" },
    { label: "Overlap / Collision", bg: "bg-red-500" },
  ];
  return (
    <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-sm shadow-sm", i.bg)} />
          {i.label}
        </div>
      ))}
    </div>
  );
}
