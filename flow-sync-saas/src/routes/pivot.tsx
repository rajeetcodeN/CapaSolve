import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import {
  Table,
  LayoutGrid,
  CalendarRange,
  Clock,
  Settings2,
  Search,
  RotateCcw,
} from "lucide-react";
import { parseSOPDate } from "@/lib/scheduler";

export const Route = createFileRoute("/pivot")({
  head: () => ({
    meta: [
      { title: "Pivot — MFG Scheduler" },
      { name: "description", content: "Manufacturing scheduling load pivot grid." },
    ],
  }),
  component: PivotPage,
});

// FormatDate to dd-MM-yyyy
function formatPivotDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// FormatTime to HH:mm:ss
function formatPivotTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function PivotPage() {
  const { orders, processes, machines, machineGroups, slots, dailyCapacities, runScheduler } =
    useAppStore();
  const { t, language } = useTranslations();

  // Search & Filter state
  const [activeTab, setActiveTab] = useState<string>("raw");
  const [searchOrder, setSearchOrder] = useState<string>("");
  const [filterMachine, setFilterMachine] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const handleResetFilters = () => {
    setSearchOrder("");
    setFilterMachine("ALL");
    setStartDate("");
    setEndDate("");
  };

  // Auto-schedule if data exists but scheduler has not run yet
  useEffect(() => {
    if (processes.length > 0 && slots.length === 0) {
      useAppStore.getState().runScheduler();
    }
  }, [processes.length, slots.length]);

  // Helper map to quickly lookup Order IDs
  const orderMap = useMemo(() => {
    const map = new Map<string, (typeof orders)[0]>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  // View 1: Unique start times mapping (Filtered)
  const timePivotData = useMemo(() => {
    let scheduled = processes.filter((p) => p.status === "SCHEDULED" && p.scheduledStart);

    // Apply search filters
    if (searchOrder.trim()) {
      scheduled = scheduled.filter((p) => {
        const order = orderMap.get(p.orderId);
        return order?.orderId.toLowerCase().includes(searchOrder.toLowerCase());
      });
    }
    if (filterMachine !== "ALL") {
      scheduled = scheduled.filter((p) => p.machineId === filterMachine);
    }
    if (startDate) {
      scheduled = scheduled.filter((p) => formatDateStr(new Date(p.scheduledStart!)) >= startDate);
    }
    if (endDate) {
      scheduled = scheduled.filter((p) => formatDateStr(new Date(p.scheduledStart!)) <= endDate);
    }

    if (scheduled.length === 0) return null;

    const uniqueTimestamps = Array.from(new Set(scheduled.map((p) => p.scheduledStart!)));
    uniqueTimestamps.sort((a, b) => +new Date(a) - +new Date(b));

    const columns = uniqueTimestamps.map((ts) => ({
      raw: ts,
      date: formatPivotDate(ts),
      time: formatPivotTime(ts),
    }));

    const matrix: Record<string, Record<string, (typeof processes)[0]>> = {};
    machines.forEach((m) => {
      matrix[m.id] = {};
    });

    scheduled.forEach((p) => {
      if (p.scheduledStart && p.machineId) {
        if (!matrix[p.machineId]) {
          matrix[p.machineId] = {};
        }
        matrix[p.machineId][p.scheduledStart] = p;
      }
    });

    return { columns, matrix };
  }, [processes, machines, searchOrder, filterMachine, startDate, endDate, orderMap]);

  // View 2: Daily aggregated load (Filtered)
  const dailyPivotData = useMemo(() => {
    if (slots.length === 0) return null;

    let filteredSlots = [...slots];

    // Apply filters
    if (searchOrder.trim()) {
      filteredSlots = filteredSlots.filter((s) => {
        // processId format: "ord-1023811-40"
        const orderCode = s.processId.split("-")[1] || "";
        return orderCode.toLowerCase().includes(searchOrder.toLowerCase());
      });
    }
    if (filterMachine !== "ALL") {
      filteredSlots = filteredSlots.filter((s) => s.machineId === filterMachine);
    }
    if (startDate) {
      filteredSlots = filteredSlots.filter((s) => s.date >= startDate);
    }
    if (endDate) {
      filteredSlots = filteredSlots.filter((s) => s.date <= endDate);
    }

    if (filteredSlots.length === 0) return null;

    // Get all unique dates from scheduled slots
    const uniqueDates = Array.from(new Set(filteredSlots.map((s) => s.date)));
    uniqueDates.sort((a, b) => +new Date(a) - +new Date(b));

    const columns = uniqueDates.map((dStr) => ({
      raw: dStr,
      date: formatPivotDate(dStr),
    }));

    // Aggregate values per machine per date
    const matrix: Record<string, Record<string, { r: number; m: number; p: number }>> = {};

    machines.forEach((m) => {
      matrix[m.id] = {};
      uniqueDates.forEach((d) => {
        matrix[m.id][d] = { r: 0, m: 0, p: 0 };
      });
    });

    // Sum Setup R and Machining M minutes, and track operator minutes sum
    filteredSlots.forEach((s) => {
      const cell = matrix[s.machineId]?.[s.date];
      if (cell) {
        if (s.slotType === "R") {
          cell.r += s.minutesUsed;
        } else if (s.slotType === "M") {
          cell.m += s.minutesUsed;
          // Operator load in minutes = minutesUsed * manpowerPct
          cell.p += s.minutesUsed * (s.manpowerPct ?? 0);
        }
      }
    });

    // Divide cumulative operator minutes by 840 (14 hours * 60 minutes) to get utilization ratio
    machines.forEach((m) => {
      uniqueDates.forEach((d) => {
        const cell = matrix[m.id]?.[d];
        if (cell) {
          cell.p = cell.p / 840;
        }
      });
    });

    return { columns, matrix };
  }, [slots, machines, processes, searchOrder, filterMachine, startDate, endDate]);

  // Pre-calculate daily resource statistics for the table
  const dailyResourceStats = useMemo(() => {
    if (!dailyPivotData) return null;

    return dailyPivotData.columns.map((col) => {
      const dateStr = col.raw;
      const dayCap = dailyCapacities?.[dateStr] || { setter: 100, process: 200 };

      // Setter calculations
      const setterCapMinutes = (dayCap.setter / 100) * 14 * 60;
      let setterScheduledMinutes = 0;

      slots.forEach((s) => {
        if (s.date === dateStr && s.slotType === "R") {
          setterScheduledMinutes += s.minutesUsed;
        }
      });

      const setterUtilPct =
        setterCapMinutes > 0 ? (setterScheduledMinutes / setterCapMinutes) * 100 : 0;

      // Group operator calculations
      const groupData = machineGroups.map((g) => {
        const groupCapMinutes = (dayCap.process / 100) * 14 * 60;
        let groupScheduledMinutes = 0;

        slots.forEach((s) => {
          if (s.date === dateStr && s.slotType === "M") {
            const machine = machines.find((m) => m.id === s.machineId);
            if (machine && machine.machineGroupId === g.id) {
              groupScheduledMinutes += s.minutesUsed * (s.manpowerPct ?? 0);
            }
          }
        });

        const groupUtilPct =
          groupCapMinutes > 0 ? (groupScheduledMinutes / groupCapMinutes) * 100 : 0;

        return {
          groupId: g.id,
          groupName: g.name,
          capacityPct: dayCap.process,
          availableMin: groupCapMinutes,
          scheduledMin: groupScheduledMinutes,
          utilPct: groupUtilPct,
        };
      });

      // Total operator calculations (Global Pool)
      const totalAvailableMin = (dayCap.process / 100) * 14 * 60;
      const totalScheduledMin = groupData.reduce((acc, curr) => acc + curr.scheduledMin, 0);
      const totalUtilPct =
        totalAvailableMin > 0 ? (totalScheduledMin / totalAvailableMin) * 100 : 0;

      return {
        dateStr,
        displayDate: col.date,
        setter: {
          capacityPct: dayCap.setter,
          availableMin: setterCapMinutes,
          scheduledMin: setterScheduledMinutes,
          utilPct: setterUtilPct,
        },
        groups: groupData,
        totalOperators: {
          availableMin: totalAvailableMin,
          scheduledMin: totalScheduledMin,
          utilPct: totalUtilPct,
        },
      };
    });
  }, [dailyPivotData, slots, dailyCapacities, machineGroups, machines]);

  // View 3: Raw SOP un-optimized load
  const rawPivotData = useMemo(() => {
    if (processes.length === 0) return null;

    let filteredProcesses = [...processes];

    // Apply filters (same as other views)
    if (searchOrder.trim()) {
      filteredProcesses = filteredProcesses.filter((p) => {
        const order = orderMap.get(p.orderId);
        return order?.orderId.toLowerCase().includes(searchOrder.toLowerCase());
      });
    }
    if (filterMachine !== "ALL") {
      filteredProcesses = filteredProcesses.filter((p) => p.machineId === filterMachine);
    }

    // Helper to format Date to YYYY-MM-DD
    const getSopDateStr = (p: (typeof processes)[0]) => {
      const order = orderMap.get(p.orderId);
      if (!order) return "";
      try {
        const d = parseSOPDate(order.sopStartDate, order.sopStartTime);
        return formatDateStr(d);
      } catch (e) {
        return "";
      }
    };

    if (startDate) {
      filteredProcesses = filteredProcesses.filter((p) => getSopDateStr(p) >= startDate);
    }
    if (endDate) {
      filteredProcesses = filteredProcesses.filter((p) => getSopDateStr(p) <= endDate);
    }

    // Clean up empty date strings
    filteredProcesses = filteredProcesses.filter((p) => getSopDateStr(p) !== "");

    if (filteredProcesses.length === 0) return null;

    // Get all unique SOP start dates
    const uniqueDates = Array.from(new Set(filteredProcesses.map((p) => getSopDateStr(p))));
    uniqueDates.sort((a, b) => +new Date(a) - +new Date(b));

    const columns = uniqueDates.map((dStr) => ({
      raw: dStr,
      date: formatPivotDate(dStr),
    }));

    // Aggregate values per machine per date
    const matrix: Record<string, Record<string, { r: number; m: number; p: number }>> = {};

    machines.forEach((m) => {
      matrix[m.id] = {};
      uniqueDates.forEach((d) => {
        matrix[m.id][d] = { r: 0, m: 0, p: 0 };
      });
    });

    filteredProcesses.forEach((p) => {
      const dStr = getSopDateStr(p);
      const cell = matrix[p.machineId]?.[dStr];
      if (cell) {
        cell.r += p.setupTimeMin || 0;
        cell.m += p.sumV2 || 0;
        cell.p += p.manpowerPct || 0;
      }
    });

    return { columns, matrix };
  }, [processes, machines, searchOrder, filterMachine, startDate, endDate, orderMap]);

  const hasSchedule = slots.length > 0;

  if (!hasSchedule) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <LayoutGrid className="h-10 w-10 text-muted-foreground animate-pulse" />
        <h2 className="text-xl font-semibold">No Scheduled Loads Yet</h2>
        <p className="text-muted-foreground max-w-sm">
          Return to the Dashboard or Gantt page and generate a schedule to see pivoted loads.
        </p>
      </div>
    );
  }

  // Helpers to calculate sub-totals and grand-totals for time-based grid
  const getSubtotalTime = (machineGroupId: string, ts: string) => {
    const groupMachines = machines.filter((m) => m.machineGroupId === machineGroupId);
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;
    let hasData = false;

    groupMachines.forEach((m) => {
      const proc = timePivotData?.matrix[m.id]?.[ts];
      if (proc) {
        rSum += proc.setupTimeMin ?? 0;
        mSum += proc.sumV2 ?? 0;
        pSum += proc.manpowerPct ?? 0;
        hasData = true;
      }
    });

    return { rSum, mSum, pSum, hasData };
  };

  const getGrandTotalTime = (ts: string) => {
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;
    let hasData = false;

    machines.forEach((m) => {
      const proc = timePivotData?.matrix[m.id]?.[ts];
      if (proc) {
        rSum += proc.setupTimeMin ?? 0;
        mSum += proc.sumV2 ?? 0;
        pSum += proc.manpowerPct ?? 0;
        hasData = true;
      }
    });

    return { rSum, mSum, pSum, hasData };
  };

  // Helpers to calculate sub-totals and grand-totals for daily load grid
  const getSubtotalDaily = (machineGroupId: string, dateStr: string) => {
    const groupMachines = machines.filter((m) => m.machineGroupId === machineGroupId);
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;
    let hasData = false;

    groupMachines.forEach((m) => {
      const cell = dailyPivotData?.matrix[m.id]?.[dateStr];
      if (cell && (cell.r > 0 || cell.m > 0 || cell.p > 0)) {
        rSum += cell.r;
        mSum += cell.m;
        pSum += cell.p;
        hasData = true;
      }
    });

    return { rSum, mSum, pSum, hasData };
  };

  const getGrandTotalDaily = (dateStr: string) => {
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;
    let hasData = false;

    machines.forEach((m) => {
      const cell = dailyPivotData?.matrix[m.id]?.[dateStr];
      if (cell && (cell.r > 0 || cell.m > 0 || cell.p > 0)) {
        rSum += cell.r;
        mSum += cell.m;
        pSum += cell.p;
        hasData = true;
      }
    });

    return { rSum, mSum, pSum, hasData };
  };

  const getSubtotalRaw = (machineGroupId: string, dateStr: string) => {
    const groupMachines = machines.filter((m) => m.machineGroupId === machineGroupId);
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;
    let hasData = false;

    groupMachines.forEach((m) => {
      const cell = rawPivotData?.matrix[m.id]?.[dateStr];
      if (cell && (cell.r > 0 || cell.m > 0 || cell.p > 0)) {
        rSum += cell.r;
        mSum += cell.m;
        pSum += cell.p;
        hasData = true;
      }
    });

    return { rSum, mSum, pSum, hasData };
  };

  const getGrandTotalRaw = (dateStr: string) => {
    let rSum = 0;
    let mSum = 0;
    let pSum = 0;
    let hasData = false;

    machines.forEach((m) => {
      const cell = rawPivotData?.matrix[m.id]?.[dateStr];
      if (cell && (cell.r > 0 || cell.m > 0 || cell.p > 0)) {
        rSum += cell.r;
        mSum += cell.m;
        pSum += cell.p;
        hasData = true;
      }
    });

    return { rSum, mSum, pSum, hasData };
  };

  const getManpowerBgClass = (pct: number) => {
    if (pct > 1.0) return "bg-red-500 text-white font-bold";
    if (pct >= 0.8) return "bg-yellow-400 text-yellow-950 font-semibold";
    return "";
  };

  return (
    <div className="space-y-6">
      {/* 1. Streamlined Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <Table className="h-4 w-4" />
            </div>
            {language === "de" ? "Pivot-Kapazitätsmatrix" : "Pivot Worksheet Dashboard"}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {language === "de"
              ? "Analyse von Freigabedaten, Rüstminuten (R), Maschinenlaufzeiten (M) und Bedienerbelegung (P)."
              : "Analysis of release dates, setup minutes (R), machine runtime (M), and operator staffing (P)."}
          </p>
        </div>
      </div>

      {/* Premium Search & Filter Panel */}
      <Card className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs p-4 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <Label
              htmlFor="search-order"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
            >
              <Search className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />{" "}
              {language === "de" ? "Auftrags-ID suchen" : "Search Order ID"}
            </Label>
            <Input
              id="search-order"
              placeholder={language === "de" ? "z.B. 1024068" : "e.g. 1024068"}
              value={searchOrder}
              onChange={(e) => setSearchOrder(e.target.value)}
              className="h-8.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="machine-select"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              {language === "de" ? "Maschine filtern" : "Filter Workstation"}
            </Label>
            <Select value={filterMachine} onValueChange={setFilterMachine}>
              <SelectTrigger
                id="machine-select"
                className="h-8.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs"
              >
                <SelectValue placeholder={language === "de" ? "Alle Maschinen" : "All Machines"} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
                <SelectItem value="ALL" className="text-xs">
                  {language === "de" ? "Alle Arbeitsplätze" : "All Workstations"}
                </SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {language === "de"
                      ? `Maschine ${m.name} (Gruppe ${m.machineGroupId})`
                      : `Machine ${m.name} (Group ${m.machineGroupId})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DatePickerField
            value={startDate}
            onChange={setStartDate}
            label={language === "de" ? "Startdatum" : "Start Date"}
          />

          <div className="flex gap-2 items-end">
            <DatePickerField
              value={endDate}
              onChange={setEndDate}
              label={language === "de" ? "Enddatum" : "End Date"}
              className="flex-1"
            />
            {(searchOrder || filterMachine !== "ALL" || startDate || endDate) && (
              <Button
                variant="outline"
                onClick={handleResetFilters}
                className="h-8.5 px-2.5 text-rose-600 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer shadow-2xs"
                title={language === "de" ? "Filter zurücksetzen" : "Clear Filters"}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between border-b border-border/80 pb-2">
          <TabsList className="bg-muted/80">
            <TabsTrigger value="raw" className="text-xs font-semibold gap-1.5">
              <Table className="h-4 w-4" />
              {language === "de"
                ? "Rohe SOP-Belastung (Nicht optimiert)"
                : "Raw SOP Load (Un-optimized)"}
            </TabsTrigger>
            <TabsTrigger value="daily" className="text-xs font-semibold gap-1.5">
              <CalendarRange className="h-4 w-4" />
              {language === "de" ? "Tägliche aggregierte Belastung" : "Daily Aggregated Load"}
            </TabsTrigger>
            <TabsTrigger value="released" className="text-xs font-semibold gap-1.5">
              <Clock className="h-4 w-4" />
              {language === "de" ? "Freigegebene Startzeiten" : "Released Start Times"}
            </TabsTrigger>
          </TabsList>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-semibold bg-secondary/30 px-3 py-1 rounded-md border border-border/50">
            <Settings2 className="h-3.5 w-3.5 text-primary" />
            <span>
              {language === "de"
                ? "R = Rüstzeit | M = Maschinenlaufzeit | P = Bediener-Auslastung"
                : "R = Set Up | M = Machine-Running-time | P = Manpower Utilization"}
            </span>
          </div>
        </div>

        {/* Tab 1: Daily Aggregated Load */}
        <TabsContent value="daily" className="mt-4 animate-in fade-in duration-200">
          {dailyPivotData ? (
            <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Table className="h-5 w-5 text-primary" />
                  {language === "de"
                    ? "Aggregierte tägliche Belastung (Vorgabewert Einheit VGE02)"
                    : "Aggregated Daily Load (Target Unit VGE02)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th
                          colSpan={3}
                          className="px-4 py-3 border-r border-border text-left font-bold uppercase tracking-wider sticky left-0 bg-muted z-20 w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          {language === "de" ? "Maschinengruppe" : "Machine Group"}
                        </th>
                        {dailyPivotData.columns.map((col, idx) => (
                          <th
                            key={idx}
                            colSpan={3}
                            className="px-3 py-2 border-r border-border text-center font-bold text-foreground min-w-[150px] font-mono"
                          >
                            {col.date}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-muted border-b border-border font-medium text-muted-foreground">
                        <th className="px-4 py-2 text-left border-r border-border sticky left-0 bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          {language === "de" ? "Maschine" : "Machine"}
                        </th>
                        <th className="px-2 py-2 text-left border-r border-border sticky left-[100px] bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          {language === "de" ? "Arbeitsplatz" : "Workstation"}
                        </th>
                        <th className="px-2 py-2 text-left border-r border-border sticky left-[200px] bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          {language === "de" ? "Auftrag" : "Order"}
                        </th>

                        {dailyPivotData.columns.map((_, idx) => (
                          <Fragment key={idx}>
                            <th className="px-1 py-1.5 text-center font-mono border-r border-border/40 text-sky-600 bg-sky-50/45 w-[45px] min-w-[45px]">
                              R
                            </th>
                            <th className="px-1 py-1.5 text-center font-mono border-r border-border/40 text-emerald-600 bg-emerald-50/45 w-[45px] min-w-[45px]">
                              M
                            </th>
                            <th className="px-1 py-1.5 text-center font-mono border-r border-border text-orange-600 bg-orange-50/45 w-[60px] min-w-[60px]">
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
                            {/* Machine Group row header */}
                            <tr className="bg-muted/10 font-bold border-b border-border">
                              <td
                                colSpan={3}
                                className="px-4 py-2.5 border-r border-border text-primary sticky left-0 bg-background z-10 font-bold w-[300px] min-w-[300px] max-w-[300px]"
                              >
                                {g.name}
                              </td>
                              {dailyPivotData.columns.map((_, idx) => (
                                <td colSpan={3} key={idx} className="border-r border-border" />
                              ))}
                            </tr>

                            {/* Machine rows */}
                            {groupMachines.map((m) => {
                              return (
                                <tr
                                  key={m.id}
                                  className="border-b border-border hover:bg-muted/5 transition-colors"
                                >
                                  <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 text-muted-foreground pl-6 w-[100px] min-w-[100px] max-w-[100px]">
                                    {g.name}
                                  </td>
                                  <td className="px-2 py-2 border-r border-border sticky left-[100px] bg-background z-10 font-semibold font-mono text-foreground w-[100px] min-w-[100px] max-w-[100px]">
                                    {m.name}
                                  </td>
                                  <td className="px-2 py-2 border-r border-border sticky left-[200px] bg-background z-10 font-mono text-muted-foreground truncate w-[100px] min-w-[100px] max-w-[100px]">
                                    {slots
                                      .filter((s) => s.machineId === m.id)
                                      .slice(0, 1)
                                      .map((s) => s.processId.split("-")[1])
                                      .join("") || ""}
                                  </td>

                                  {dailyPivotData.columns.map((col, idx) => {
                                    const cell = dailyPivotData.matrix[m.id]?.[col.raw];
                                    const rVal = cell && cell.r > 0 ? cell.r.toFixed(0) : "";
                                    const mVal = cell && cell.m > 0 ? cell.m.toFixed(1) : "";
                                    const pVal =
                                      cell && cell.p > 0 ? `${Math.round(cell.p * 100)}%` : "";

                                    return (
                                      <Fragment key={idx}>
                                        <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-sky-700 bg-sky-50/5 font-medium">
                                          {rVal}
                                        </td>
                                        <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-emerald-700 bg-emerald-50/5 font-medium">
                                          {mVal}
                                        </td>
                                        <td
                                          className={cn(
                                            "px-1 py-2 text-center border-r border-border font-mono",
                                            cell && cell.p > 0 ? getManpowerBgClass(cell.p) : "",
                                          )}
                                        >
                                          {pVal}
                                        </td>
                                      </Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            })}

                            {/* Group subtotals (Ergebnis) row */}
                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-border/80">
                              <td
                                colSpan={3}
                                className="px-4 py-2 border-r border-border sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 font-bold text-foreground w-[300px] min-w-[300px] max-w-[300px]"
                              >
                                {g.name} {language === "de" ? "Ergebnis" : "Total"}
                              </td>
                              {dailyPivotData.columns.map((col, idx) => {
                                const sub = getSubtotalDaily(g.id, col.raw);
                                const rSum = sub.hasData ? sub.rSum.toFixed(0) : "";
                                const mSum = sub.hasData ? sub.mSum.toFixed(1) : "";
                                const pSum = sub.hasData ? `${Math.round(sub.pSum * 100)}%` : "";

                                return (
                                  <Fragment key={idx}>
                                    <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-sky-800 bg-sky-50/10">
                                      {rSum}
                                    </td>
                                    <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-emerald-800 bg-emerald-50/10">
                                      {mSum}
                                    </td>
                                    <td
                                      className={cn(
                                        "px-1 py-2 text-center border-r border-border font-mono",
                                        sub.hasData ? getManpowerBgClass(sub.pSum) : "",
                                      )}
                                    >
                                      {pSum}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          </Fragment>
                        );
                      })}

                      {/* Grand totals (Gesamtergebnis) row */}
                      <tr className="bg-slate-200 dark:bg-slate-700 font-bold border-b border-border/90 text-sm">
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 border-r border-border sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-primary w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          {language === "de" ? "Gesamtergebnis" : "Grand Total"}
                        </td>
                        {dailyPivotData.columns.map((col, idx) => {
                          const grand = getGrandTotalDaily(col.raw);
                          const rSum = grand.hasData ? grand.rSum.toFixed(0) : "";
                          const mSum = grand.hasData ? grand.mSum.toFixed(1) : "";
                          const pSum = grand.hasData ? `${Math.round(grand.pSum * 100)}%` : "";

                          return (
                            <Fragment key={idx}>
                              <td className="px-1 py-2.5 text-center border-r border-border/40 font-mono text-sky-900 bg-sky-100/10">
                                {rSum}
                              </td>
                              <td className="px-1 py-2.5 text-center border-r border-border/40 font-mono text-emerald-900 bg-emerald-100/10">
                                {mSum}
                              </td>
                              <td
                                className={cn(
                                  "px-1 py-2.5 text-center border-r border-border font-mono",
                                  grand.hasData ? getManpowerBgClass(grand.pSum) : "",
                                )}
                              >
                                {pSum}
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
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
              {language === "de"
                ? "Keine passenden Daten für die ausgewählten Filter gefunden. Filter zurücksetzen."
                : "No matching data found for the selected filters. Clear filter inputs to reset."}
            </div>
          )}

          {/* Daily Resource Capacity & Stacking Analysis Summary */}
          {dailyResourceStats && (
            <Card className="border border-border/80 shadow-md overflow-hidden bg-card mt-6">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Table className="h-5 w-5 text-primary" />
                  {language === "de"
                    ? "Ressourcen- & Auslastungsanalyse (Tägliche Gesamtwerte)"
                    : "Resource Stacking & Staging Utilization (Daily Totals)"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th className="px-4 py-3 border-r border-border text-left font-bold uppercase tracking-wider sticky left-0 bg-muted z-20 w-[300px] min-w-[300px] max-w-[300px]">
                          {language === "de" ? "Ressource & Kennzahl" : "Resource & Metric"}
                        </th>
                        {dailyResourceStats.map((stat, idx) => (
                          <th
                            key={idx}
                            className="px-3 py-2 border-r border-border text-center font-bold text-foreground min-w-[150px] font-mono"
                          >
                            {stat.displayDate}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 1. SETTER POOL */}
                      <tr className="bg-sky-500/5 font-semibold border-b border-border">
                        <td className="px-4 py-2 border-r border-border font-bold text-sky-850 sticky left-0 bg-sky-50 dark:bg-sky-950/20 z-10 w-[300px] min-w-[300px] max-w-[300px]">
                          {language === "de"
                            ? "Einrichter (Rüsten R) Kapazität %"
                            : "Setter (Setup R) Capacity %"}
                        </td>
                        {dailyResourceStats.map((stat, idx) => (
                          <td
                            key={idx}
                            className="px-3 py-2 border-r border-border text-center font-mono font-medium text-sky-700 bg-sky-50/5"
                          >
                            {stat.setter.capacityPct}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 w-[300px] min-w-[300px] max-w-[300px] pl-6 text-muted-foreground">
                          {language === "de"
                            ? "- Verfügbare Minuten (14h)"
                            : "- Available Minutes (14h)"}
                        </td>
                        {dailyResourceStats.map((stat, idx) => (
                          <td
                            key={idx}
                            className="px-3 py-2 border-r border-border text-center font-mono text-muted-foreground"
                          >
                            {stat.setter.availableMin.toFixed(0)} min
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border hover:bg-muted/5 transition-colors">
                        <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 w-[300px] min-w-[300px] max-w-[300px] pl-6 text-muted-foreground">
                          {language === "de"
                            ? "- Geplante Rüstminuten"
                            : "- Scheduled Setup Minutes"}
                        </td>
                        {dailyResourceStats.map((stat, idx) => (
                          <td
                            key={idx}
                            className="px-3 py-2 border-r border-border text-center font-mono text-foreground font-medium"
                          >
                            {stat.setter.scheduledMin.toFixed(0)} min
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border font-bold bg-muted/10">
                        <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 w-[300px] min-w-[300px] max-w-[300px] pl-6 text-foreground font-bold">
                          {language === "de"
                            ? "- Einrichter-Auslastung %"
                            : "- Setter Utilization %"}
                        </td>
                        {dailyResourceStats.map((stat, idx) => {
                          const val = stat.setter.utilPct;
                          const isOver = val > 100;
                          return (
                            <td
                              key={idx}
                              className={cn(
                                "px-3 py-2 border-r border-border text-center font-mono",
                                isOver
                                  ? "bg-red-500 text-white font-black"
                                  : val >= 80
                                    ? "bg-yellow-100 text-yellow-900"
                                    : "text-emerald-600",
                              )}
                            >
                              {Math.round(val)}%
                            </td>
                          );
                        })}
                      </tr>

                      {/* 2. GROUP OPERATORS */}
                      {machineGroups.map((g, gIdx) => (
                        <Fragment key={g.id}>
                          <tr className="bg-orange-500/5 font-semibold border-b border-border mt-2">
                            <td className="px-4 py-2 border-r border-border font-bold text-orange-850 sticky left-0 bg-orange-50 dark:bg-orange-950/20 z-10 w-[300px] min-w-[300px] max-w-[300px]">
                              {language === "de"
                                ? `Bedienergruppe ${g.name} Kapazität %`
                                : `Operator Group ${g.name} Capacity %`}
                            </td>
                            {dailyResourceStats.map((stat, idx) => (
                              <td
                                key={idx}
                                className="px-3 py-2 border-r border-border text-center font-mono font-medium text-orange-700 bg-orange-50/5"
                              >
                                {stat.groups[gIdx].capacityPct}%
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border hover:bg-muted/5 transition-colors">
                            <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 w-[300px] min-w-[300px] max-w-[300px] pl-6 text-muted-foreground">
                              {language === "de"
                                ? "- Verfügbare Minuten (14h)"
                                : "- Available Minutes (14h)"}
                            </td>
                            {dailyResourceStats.map((stat, idx) => (
                              <td
                                key={idx}
                                className="px-3 py-2 border-r border-border text-center font-mono text-muted-foreground"
                              >
                                {stat.groups[gIdx].availableMin.toFixed(0)} min
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border hover:bg-muted/5 transition-colors">
                            <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 w-[300px] min-w-[300px] max-w-[300px] pl-6 text-muted-foreground">
                              {language === "de"
                                ? "- Geplante Bedienerminuten"
                                : "- Scheduled Operator Minutes"}
                            </td>
                            {dailyResourceStats.map((stat, idx) => (
                              <td
                                key={idx}
                                className="px-3 py-2 border-r border-border text-center font-mono text-foreground font-medium"
                              >
                                {stat.groups[gIdx].scheduledMin.toFixed(0)} min
                              </td>
                            ))}
                          </tr>
                          <tr className="border-b border-border font-bold bg-muted/10">
                            <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 w-[300px] min-w-[300px] max-w-[300px] pl-6 text-foreground font-bold">
                              {language === "de"
                                ? `- Gruppe ${g.name} Auslastung %`
                                : `- Group ${g.name} Utilization %`}
                            </td>
                            {dailyResourceStats.map((stat, idx) => {
                              const val = stat.groups[gIdx].utilPct;
                              const isOver = val > 100;
                              return (
                                <td
                                  key={idx}
                                  className={cn(
                                    "px-3 py-2 border-r border-border text-center font-mono",
                                    isOver
                                      ? "bg-red-500 text-white font-black"
                                      : val >= 80
                                        ? "bg-yellow-100 text-yellow-900"
                                        : "text-emerald-600",
                                  )}
                                >
                                  {Math.round(val)}%
                                </td>
                              );
                            })}
                          </tr>
                        </Fragment>
                      ))}

                      {/* 3. TOTAL OPERATOR SUMMARY */}
                      <tr className="bg-slate-200 dark:bg-slate-700 font-bold border-b border-border text-sm">
                        <td className="px-4 py-2.5 border-r border-border sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-primary w-[300px] min-w-[300px] max-w-[300px]">
                          {language === "de"
                            ? "Gesamt-Bedienerauslastung %"
                            : "Total Operator Utilization %"}
                        </td>
                        {dailyResourceStats.map((stat, idx) => {
                          const val = stat.totalOperators.utilPct;
                          const isOver = val > 100;
                          return (
                            <td
                              key={idx}
                              className={cn(
                                "px-3 py-2.5 border-r border-border text-center font-mono font-bold",
                                isOver
                                  ? "bg-red-600 text-white"
                                  : val >= 80
                                    ? "bg-yellow-100 text-yellow-950"
                                    : "text-emerald-700 bg-emerald-50/10",
                              )}
                            >
                              {Math.round(val)}% ({stat.totalOperators.scheduledMin.toFixed(0)}/
                              {stat.totalOperators.availableMin.toFixed(0)}m)
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 2: Released Start Times */}
        <TabsContent value="released" className="mt-4 animate-in fade-in duration-200">
          {timePivotData ? (
            <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Table className="h-5 w-5 text-primary" />
                  Released Process SOP Start Timestamps
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th
                          colSpan={3}
                          className="px-4 py-2 border-r border-border text-left font-bold uppercase tracking-wider sticky left-0 bg-muted z-20 w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          Fr.term.St.dat.Durchf
                        </th>
                        {timePivotData.columns.map((col, idx) => (
                          <th
                            key={idx}
                            colSpan={3}
                            className="px-3 py-1.5 border-r border-border text-center font-bold text-foreground min-w-[150px]"
                          >
                            <div className="flex items-center justify-center gap-1">
                              <CalendarRange className="h-3.5 w-3.5 text-primary" />
                              {col.date}
                            </div>
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-muted border-b border-border">
                        <th
                          colSpan={3}
                          className="px-4 py-1.5 border-r border-border text-left font-bold tracking-wider sticky left-0 bg-muted z-20 w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          Eingepl.Startzeit
                        </th>
                        {timePivotData.columns.map((col, idx) => (
                          <th
                            key={idx}
                            colSpan={3}
                            className="px-3 py-1 border-r border-border text-center font-semibold text-muted-foreground font-mono"
                          >
                            {col.time}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-muted border-b border-border font-medium text-muted-foreground">
                        <th className="px-4 py-1.5 text-left border-r border-border sticky left-0 bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          Maschine
                        </th>
                        <th className="px-2 py-1.5 text-left border-r border-border sticky left-[100px] bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          Arbeitsplatz
                        </th>
                        <th className="px-2 py-1.5 text-left border-r border-border sticky left-[200px] bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          Vorgang
                        </th>

                        {timePivotData.columns.map((_, idx) => (
                          <Fragment key={idx}>
                            <th className="px-1.5 py-1.5 text-center font-mono border-r border-border/40 text-sky-600 bg-sky-50/20 w-[45px] min-w-[45px]">
                              R
                            </th>
                            <th className="px-1.5 py-1.5 text-center font-mono border-r border-border/40 text-emerald-600 bg-emerald-50/20 w-[45px] min-w-[45px]">
                              M
                            </th>
                            <th className="px-1.5 py-1.5 text-center font-mono border-r border-border text-orange-600 bg-orange-50/20 w-[60px] min-w-[60px]">
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
                            <tr className="bg-muted/15 font-bold border-b border-border">
                              <td
                                colSpan={3}
                                className="px-4 py-2 border-r border-border text-primary sticky left-0 bg-background z-10 font-bold w-[300px] min-w-[300px] max-w-[300px]"
                              >
                                {g.name}
                              </td>
                              {timePivotData.columns.map((col, idx) => (
                                <td colSpan={3} key={idx} className="border-r border-border" />
                              ))}
                            </tr>

                            {groupMachines.map((m) => {
                              return (
                                <tr
                                  key={m.id}
                                  className="border-b border-border hover:bg-muted/5 transition-colors"
                                >
                                  <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 text-muted-foreground pl-6 w-[100px] min-w-[100px] max-w-[100px]">
                                    {g.name}
                                  </td>
                                  <td className="px-2 py-2 border-r border-border sticky left-[100px] bg-background z-10 font-semibold font-mono text-foreground w-[100px] min-w-[100px] max-w-[100px]">
                                    {m.name}
                                  </td>
                                  <td className="px-2 py-2 border-r border-border sticky left-[200px] bg-background z-10 font-mono text-muted-foreground w-[100px] min-w-[100px] max-w-[100px]">
                                    {timePivotData.columns
                                      .map((col) => timePivotData.matrix[m.id]?.[col.raw])
                                      .find(Boolean)?.processId || ""}
                                  </td>

                                  {timePivotData.columns.map((col, idx) => {
                                    const proc = timePivotData.matrix[m.id]?.[col.raw];
                                    const rVal = proc ? (proc.setupTimeMin ?? 0).toFixed(0) : "";
                                    const mVal = proc ? (proc.sumV2 ?? 0).toFixed(1) : "";
                                    const pVal = proc
                                      ? `${Math.round((proc.manpowerPct ?? 0) * 100)}%`
                                      : "";

                                    return (
                                      <Fragment key={idx}>
                                        <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-sky-700 bg-sky-50/5 font-medium">
                                          {rVal}
                                        </td>
                                        <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-emerald-700 bg-emerald-50/5 font-medium">
                                          {mVal}
                                        </td>
                                        <td
                                          className={cn(
                                            "px-1 py-2 text-center border-r border-border font-mono",
                                            proc ? getManpowerBgClass(proc.manpowerPct) : "",
                                          )}
                                        >
                                          {pVal}
                                        </td>
                                      </Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            })}

                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-border/80">
                              <td
                                colSpan={3}
                                className="px-4 py-2 border-r border-border sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 font-bold text-foreground w-[300px] min-w-[300px] max-w-[300px]"
                              >
                                {g.name} Ergebnis
                              </td>
                              {timePivotData.columns.map((col, idx) => {
                                const sub = getSubtotalTime(g.id, col.raw);
                                const rSum = sub.hasData ? sub.rSum.toFixed(0) : "";
                                const mSum = sub.hasData ? sub.mSum.toFixed(1) : "";
                                const pSum = sub.hasData ? `${Math.round(sub.pSum * 100)}%` : "";

                                return (
                                  <Fragment key={idx}>
                                    <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-sky-800 bg-sky-50/10">
                                      {rSum}
                                    </td>
                                    <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-emerald-800 bg-emerald-50/10">
                                      {mSum}
                                    </td>
                                    <td
                                      className={cn(
                                        "px-1 py-2 text-center border-r border-border font-mono",
                                        sub.hasData ? getManpowerBgClass(sub.pSum) : "",
                                      )}
                                    >
                                      {pSum}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          </Fragment>
                        );
                      })}

                      <tr className="bg-slate-200 dark:bg-slate-700 font-bold border-b border-border/90 text-sm">
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 border-r border-border sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-primary w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          Gesamtergebnis
                        </td>
                        {timePivotData.columns.map((col, idx) => {
                          const grand = getGrandTotalTime(col.raw);
                          const rSum = grand.hasData ? grand.rSum.toFixed(0) : "";
                          const mSum = grand.hasData ? grand.mSum.toFixed(1) : "";
                          const pSum = grand.hasData ? `${Math.round(grand.pSum * 100)}%` : "";

                          return (
                            <Fragment key={idx}>
                              <td className="px-1 py-2.5 text-center border-r border-border/40 font-mono text-sky-900 bg-sky-100/10">
                                {rSum}
                              </td>
                              <td className="px-1 py-2.5 text-center border-r border-border/40 font-mono text-emerald-900 bg-emerald-100/10">
                                {mSum}
                              </td>
                              <td
                                className={cn(
                                  "px-1 py-2.5 text-center border-r border-border font-mono",
                                  grand.hasData ? getManpowerBgClass(grand.pSum) : "",
                                )}
                              >
                                {pSum}
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
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
              No matching data found for the selected filters. Clear filter inputs to reset.
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Raw SOP Load (Un-optimized) */}
        <TabsContent value="raw" className="mt-4 animate-in fade-in duration-200">
          {rawPivotData ? (
            <Card className="border border-border/80 shadow-md overflow-hidden bg-card">
              <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Table className="h-5 w-5 text-primary" />
                  Raw SOP Load — Un-optimized (Excel/CSV Baseline)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-w-full">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted border-b border-border">
                        <th
                          colSpan={3}
                          className="px-4 py-3 border-r border-border text-left font-bold uppercase tracking-wider sticky left-0 bg-muted z-20 w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          Maschinengruppe
                        </th>
                        {rawPivotData.columns.map((col, idx) => (
                          <th
                            key={idx}
                            colSpan={3}
                            className="px-3 py-2 border-r border-border text-center font-bold text-foreground min-w-[150px] font-mono"
                          >
                            {col.date}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-muted border-b border-border font-medium text-muted-foreground">
                        <th className="px-4 py-2 text-left border-r border-border sticky left-0 bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          Maschine
                        </th>
                        <th className="px-2 py-2 text-left border-r border-border sticky left-[100px] bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          Arbeitsplatz
                        </th>
                        <th className="px-2 py-2 text-left border-r border-border sticky left-[200px] bg-muted z-20 w-[100px] min-w-[100px] max-w-[100px]">
                          Auftrag
                        </th>

                        {rawPivotData.columns.map((_, idx) => (
                          <Fragment key={idx}>
                            <th className="px-1 py-1.5 text-center font-mono border-r border-border/40 text-sky-600 bg-sky-50/45 w-[45px] min-w-[45px]">
                              R
                            </th>
                            <th className="px-1 py-1.5 text-center font-mono border-r border-border/40 text-emerald-600 bg-emerald-50/45 w-[45px] min-w-[45px]">
                              M
                            </th>
                            <th className="px-1 py-1.5 text-center font-mono border-r border-border text-orange-600 bg-orange-50/45 w-[60px] min-w-[60px]">
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
                            {/* Machine Group row header */}
                            <tr className="bg-muted/10 font-bold border-b border-border">
                              <td
                                colSpan={3}
                                className="px-4 py-2.5 border-r border-border text-primary sticky left-0 bg-background z-10 font-bold w-[300px] min-w-[300px] max-w-[300px]"
                              >
                                {g.name}
                              </td>
                              {rawPivotData.columns.map((_, idx) => (
                                <td colSpan={3} key={idx} className="border-r border-border" />
                              ))}
                            </tr>

                            {/* Machine rows */}
                            {groupMachines.map((m) => {
                              return (
                                <tr
                                  key={m.id}
                                  className="border-b border-border hover:bg-muted/5 transition-colors"
                                >
                                  <td className="px-4 py-2 border-r border-border sticky left-0 bg-background z-10 text-muted-foreground pl-6 w-[100px] min-w-[100px] max-w-[100px]">
                                    {g.name}
                                  </td>
                                  <td className="px-2 py-2 border-r border-border sticky left-[100px] bg-background z-10 font-semibold font-mono text-foreground w-[100px] min-w-[100px] max-w-[100px]">
                                    {m.name}
                                  </td>
                                  <td className="px-2 py-2 border-r border-border sticky left-[200px] bg-background z-10 font-mono text-muted-foreground truncate w-[100px] min-w-[100px] max-w-[100px]">
                                    {processes
                                      .filter((p) => p.machineId === m.id)
                                      .slice(0, 1)
                                      .map((p) => p.id.split("-")[1])
                                      .join("") || ""}
                                  </td>

                                  {rawPivotData.columns.map((col, idx) => {
                                    const cell = rawPivotData.matrix[m.id]?.[col.raw];
                                    const rVal = cell && cell.r > 0 ? cell.r.toFixed(0) : "";
                                    const mVal = cell && cell.m > 0 ? cell.m.toFixed(1) : "";
                                    const pVal =
                                      cell && cell.p > 0 ? `${Math.round(cell.p * 100)}%` : "";

                                    return (
                                      <Fragment key={idx}>
                                        <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-sky-700 bg-sky-50/5 font-medium">
                                          {rVal}
                                        </td>
                                        <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-emerald-700 bg-emerald-50/5 font-medium">
                                          {mVal}
                                        </td>
                                        <td
                                          className={cn(
                                            "px-1 py-2 text-center border-r border-border font-mono",
                                            cell && cell.p > 0 ? getManpowerBgClass(cell.p) : "",
                                          )}
                                        >
                                          {pVal}
                                        </td>
                                      </Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            })}

                            {/* Group subtotals (Ergebnis) row */}
                            <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-border/80">
                              <td
                                colSpan={3}
                                className="px-4 py-2 border-r border-border sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 font-bold text-foreground w-[300px] min-w-[300px] max-w-[300px]"
                              >
                                {g.name} Ergebnis
                              </td>
                              {rawPivotData.columns.map((col, idx) => {
                                const sub = getSubtotalRaw(g.id, col.raw);
                                const rSum = sub.hasData ? sub.rSum.toFixed(0) : "";
                                const mSum = sub.hasData ? sub.mSum.toFixed(1) : "";
                                const pSum = sub.hasData ? `${Math.round(sub.pSum * 100)}%` : "";

                                return (
                                  <Fragment key={idx}>
                                    <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-sky-800 bg-sky-50/10">
                                      {rSum}
                                    </td>
                                    <td className="px-1 py-2 text-center border-r border-border/40 font-mono text-emerald-800 bg-emerald-50/10">
                                      {mSum}
                                    </td>
                                    <td
                                      className={cn(
                                        "px-1 py-2 text-center border-r border-border font-mono",
                                        sub.hasData ? getManpowerBgClass(sub.pSum) : "",
                                      )}
                                    >
                                      {pSum}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          </Fragment>
                        );
                      })}

                      {/* Grand totals (Gesamtergebnis) row */}
                      <tr className="bg-slate-200 dark:bg-slate-700 font-bold border-b border-border/90 text-sm">
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 border-r border-border sticky left-0 bg-slate-200 dark:bg-slate-700 z-10 font-bold text-primary w-[300px] min-w-[300px] max-w-[300px]"
                        >
                          Gesamtergebnis
                        </td>
                        {rawPivotData.columns.map((col, idx) => {
                          const grand = getGrandTotalRaw(col.raw);
                          const rSum = grand.hasData ? grand.rSum.toFixed(0) : "";
                          const mSum = grand.hasData ? grand.mSum.toFixed(1) : "";
                          const pSum = grand.hasData ? `${Math.round(grand.pSum * 100)}%` : "";

                          return (
                            <Fragment key={idx}>
                              <td className="px-1 py-2.5 text-center border-r border-border/40 font-mono text-sky-900 bg-sky-100/10">
                                {rSum}
                              </td>
                              <td className="px-1 py-2.5 text-center border-r border-border/40 font-mono text-emerald-900 bg-emerald-100/10">
                                {mSum}
                              </td>
                              <td
                                className={cn(
                                  "px-1 py-2.5 text-center border-r border-border font-mono",
                                  grand.hasData ? getManpowerBgClass(grand.pSum) : "",
                                )}
                              >
                                {pSum}
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
          ) : (
            <div className="py-12 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
              No matching data found for the selected filters. Clear filter inputs to reset.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Small helper function to format Date object into YYYY-MM-DD
function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
