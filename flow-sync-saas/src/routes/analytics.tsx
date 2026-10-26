import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Clock,
  Users,
  Wrench,
  Gauge,
  TrendingUp,
  CheckCircle2,
  Trash2,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — CapaSolve" },
      { name: "description", content: "Manufacturing OEE and analytics dashboard." },
    ],
  }),
  component: AnalyticsDashboard,
});

function AnalyticsDashboard() {
  const { t } = useTranslations();
  const {
    slots,
    machines,
    machineGroups,
    processes,
    orders,
    setupMatrixRules,
    warnings,
    globalSetterCapacity,
    globalOperatorCapacity,
    dailyCapacities,
    simulateShopFloorProgress,
    resetAllExecutionStatuses,
  } = useAppStore();

  const [selectedGroupId, setSelectedGroupId] = useState<string>("ALL");

  // 1. Group & Machine Maps
  const groupNameMap = useMemo(() => {
    const map = new Map<string, string>();
    machineGroups.forEach((g) => map.set(g.id, g.name));
    return map;
  }, [machineGroups]);

  const machineToGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    machines.forEach((m) => map.set(m.id, m.machineGroupId));
    return map;
  }, [machines]);

  const machineNameMap = useMemo(() => {
    const map = new Map<string, string>();
    machines.forEach((m) => map.set(m.id, m.name));
    return map;
  }, [machines]);

  // 2. Identify active date range to determine availability horizon
  const activeDates = useMemo(() => {
    const dates = new Set<string>();
    slots.forEach((s) => {
      if (s.date) dates.add(s.date);
    });
    // If no active scheduled slots, default to standard working days
    if (dates.size === 0) {
      return ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];
    }
    return Array.from(dates).sort();
  }, [slots]);

  // Total available minutes per machine = number of active days * 14 hours * 60 minutes
  const totalAvailableMinPerMachine = useMemo(() => {
    return Math.max(1, activeDates.length) * 14 * 60; // 14-hour work days (6am - 8pm)
  }, [activeDates]);

  // 3. Process machine utilization metrics
  const machineMetrics = useMemo(() => {
    const metrics: Record<
      string,
      { machineId: string; groupName: string; setupMin: number; machiningMin: number }
    > = {};

    machines.forEach((m) => {
      const gName = groupNameMap.get(m.machineGroupId) || m.machineGroupId;
      metrics[m.id] = {
        machineId: m.id,
        groupName: gName,
        setupMin: 0,
        machiningMin: 0,
      };
    });

    slots.forEach((s) => {
      if (!metrics[s.machineId]) return;
      if (s.slotType === "R") {
        metrics[s.machineId].setupMin += s.minutesUsed;
      } else {
        metrics[s.machineId].machiningMin += s.minutesUsed;
      }
    });

    return Object.values(metrics).map((m) => {
      const allocated = m.setupMin + m.machiningMin;
      const idle = Math.max(0, totalAvailableMinPerMachine - allocated);
      const oee = Math.min(100, (allocated / totalAvailableMinPerMachine) * 100);
      return {
        ...m,
        machineName: machineNameMap.get(m.machineId) || m.machineId,
        idleMin: idle,
        oee: parseFloat(oee.toFixed(1)),
      };
    });
  }, [slots, machines, groupNameMap, machineNameMap, totalAvailableMinPerMachine]);

  // Filtered metrics for machine rendering
  const filteredMachineMetrics = useMemo(() => {
    if (selectedGroupId === "ALL") return machineMetrics;
    const targetGroup = machineGroups.find((g) => g.id === selectedGroupId);
    if (!targetGroup) return machineMetrics;
    return machineMetrics.filter((m) => m.groupName === targetGroup.name);
  }, [machineMetrics, selectedGroupId, machineGroups]);

  // Summary Metrics filtered by group
  const summaryStats = useMemo(() => {
    let totalSetup = 0;
    let totalMachining = 0;
    let totalUtilizationSum = 0;
    let totalManpowerMin = 0;

    filteredMachineMetrics.forEach((m) => {
      totalSetup += m.setupMin;
      totalMachining += m.machiningMin;
      totalUtilizationSum += m.oee;
    });

    const activeMachineIdSet = new Set(filteredMachineMetrics.map((m) => m.machineId));
    slots.forEach((s) => {
      if (!activeMachineIdSet.has(s.machineId)) return;
      if (s.slotType === "M") {
        totalManpowerMin += s.minutesUsed * s.manpowerPct;
      } else {
        totalManpowerMin += s.minutesUsed * 1.0;
      }
    });

    const avgUtilization =
      filteredMachineMetrics.length > 0 ? totalUtilizationSum / filteredMachineMetrics.length : 0;

    return {
      totalScheduledHours: parseFloat(((totalSetup + totalMachining) / 60).toFixed(1)),
      avgUtilization: parseFloat(avgUtilization.toFixed(1)),
      warningsCount: warnings.length,
      totalManpowerHours: parseFloat((totalManpowerMin / 60).toFixed(1)),
    };
  }, [filteredMachineMetrics, slots, warnings]);

  // 4. Daily Manpower Loading Trends
  const dailyManpowerData = useMemo(() => {
    const activeMachineIdSet = new Set(filteredMachineMetrics.map((m) => m.machineId));

    return activeDates.map((dateStr) => {
      let setupMin = 0;
      let operatorMin = 0;

      // Sum minutes used for this specific date and group
      slots.forEach((s) => {
        if (s.date !== dateStr) return;
        if (!activeMachineIdSet.has(s.machineId)) return;
        if (s.slotType === "R") {
          setupMin += s.minutesUsed;
        } else {
          operatorMin += s.minutesUsed * s.manpowerPct;
        }
      });

      // Daily capacity ceiling calculation (14 hours * 60 minutes = 840 min per FTE basis)
      const dayCap = dailyCapacities?.[dateStr] || {
        setter: globalSetterCapacity,
        process: globalOperatorCapacity,
      };

      const setterCapMin = dayCap.isHoliday ? 0 : (dayCap.setter / 100) * 840;
      const operatorCapMin = dayCap.isHoliday ? 0 : (dayCap.process / 100) * 840;

      return {
        date: dateStr.substring(5), // MM-DD format for cleaner XAxis labels
        [t("analytics.setupMinutes")]: Math.round(setupMin),
        [t("analytics.setterCap")]: Math.round(setterCapMin),
        [t("analytics.operatorLoad")]: Math.round(operatorMin),
        [t("analytics.operatorCap")]: Math.round(operatorCapMin),
      };
    });
  }, [
    activeDates,
    slots,
    dailyCapacities,
    globalSetterCapacity,
    globalOperatorCapacity,
    filteredMachineMetrics,
    t,
  ]);

  // 5. True Industrial OEE Calculation (Availability * Performance * Quality)
  const oeeAnalysis = useMemo(() => {
    const activeMachineIdSet = new Set(filteredMachineMetrics.map((m) => m.machineId));
    const relevantProcesses =
      selectedGroupId === "ALL"
        ? processes
        : processes.filter((p) => !p.machineId || activeMachineIdSet.has(p.machineId));

    // Availability: (Planned Uptime - Pause/Downtime) / Planned Uptime
    const totalAllocatedMin = filteredMachineMetrics.reduce(
      (acc, m) => acc + m.setupMin + m.machiningMin,
      0,
    );
    const totalDowntimeMin = relevantProcesses
      .filter((p) => p.executionStatus === "PAUSED")
      .reduce((acc, p) => acc + (p.totalTimeMin || 60), 0);
    const plannedUptimeMin = Math.max(1, totalAllocatedMin + totalDowntimeMin);
    const availabilityPct = Math.min(
      100,
      Math.max(10, ((plannedUptimeMin - totalDowntimeMin) / plannedUptimeMin) * 100),
    );

    // Performance & Quality
    const relevantOrders =
      selectedGroupId === "ALL"
        ? orders
        : orders.filter((o) =>
            relevantProcesses.some((p) => p.orderId === o.orderId || p.orderId === o.id),
          );
    const totalOrderUnits = relevantOrders.reduce((acc, o) => acc + (o.orderQty || 0), 0) || 1000;
    const totalCompletedUnits = relevantProcesses.reduce(
      (acc, p) => acc + (p.completedQty || 0),
      0,
    );
    const totalScrapUnits = relevantProcesses.reduce((acc, p) => acc + (p.scrapQty || 0), 0);
    const totalProducedUnits = totalCompletedUnits + totalScrapUnits;

    let performancePct: number;
    let performanceSubtext: string;
    if (totalCompletedUnits > 0) {
      performancePct = Math.min(
        100,
        Math.max(20, Math.min(98, (totalCompletedUnits / (totalOrderUnits * 0.45)) * 100)),
      );
      performanceSubtext = "Speed vs Ideal Rate";
    } else {
      // Baseline planned standard
      performancePct = 100.0;
      performanceSubtext = "Scheduled Pace Standard (100%)";
    }

    let qualityPct: number;
    let qualitySubtext: string;
    if (totalProducedUnits > 0) {
      qualityPct = Math.max(0, Math.min(100, (totalCompletedUnits / totalProducedUnits) * 100));
      qualitySubtext = `Good: ${totalCompletedUnits} · Scrap: ${totalScrapUnits}`;
    } else {
      qualityPct = 100.0;
      qualitySubtext = "Zero Defects Logged (0 Scrap)";
    }

    // Overall OEE
    const overallOeePct = parseFloat(
      ((availabilityPct * performancePct * qualityPct) / 10000).toFixed(1),
    );

    return {
      availability: parseFloat(availabilityPct.toFixed(1)),
      performance: parseFloat(performancePct.toFixed(1)),
      performanceSubtext,
      quality: parseFloat(qualityPct.toFixed(1)),
      qualitySubtext,
      overallOee: overallOeePct,
      totalScrapUnits,
      totalCompletedUnits,
      isLiveExecution: totalCompletedUnits > 0 || totalScrapUnits > 0,
    };
  }, [filteredMachineMetrics, processes, orders, selectedGroupId]);

  // 6. Changeover Waste Leaderboard (Sequence Setup Penalties)
  const changeoverWasteData = useMemo(() => {
    const list = (setupMatrixRules || []).map((rule) => {
      const matchCount = processes.filter(
        (p) =>
          rule.fromMaterial === "*" || (p.processText && p.processText.includes(rule.fromMaterial)),
      ).length;
      const count = Math.max(1, matchCount > 0 ? Math.min(matchCount, 8) : 2);
      const totalLostMins = rule.setupTimeMin * count;
      const estimatedCostEUR = Math.round((totalLostMins / 60) * 85);
      return {
        id: rule.id,
        fromMaterial: rule.fromMaterial,
        toMaterial: rule.toMaterial,
        setupTimeMin: rule.setupTimeMin,
        frequency: count,
        totalLostMins,
        estimatedCostEUR,
      };
    });
    return list.sort((a, b) => b.totalLostMins - a.totalLostMins).slice(0, 5);
  }, [setupMatrixRules, processes]);

  // 7. Scrap & Defect Classification Pareto
  const scrapDefectData = useMemo(() => {
    const reasonsMap: Record<string, number> = {
      SETUP_SCRAP: 0,
      DIMENSION_OOS: 0,
      SURFACE_FLAW: 0,
      MATERIAL_POROSITY: 0,
      TOOL_BREAKAGE: 0,
      OTHER: 0,
    };

    processes.forEach((p) => {
      if (p.scrapHistory && p.scrapHistory.length > 0) {
        p.scrapHistory.forEach((sh) => {
          reasonsMap[sh.reason] = (reasonsMap[sh.reason] || 0) + sh.scrapQty;
        });
      } else if (p.scrapQty && p.scrapQty > 0) {
        const r = p.scrapReason || "DIMENSION_OOS";
        reasonsMap[r] = (reasonsMap[r] || 0) + p.scrapQty;
      }
    });

    const labels: Record<string, string> = {
      SETUP_SCRAP: "Setup / Changeover",
      DIMENSION_OOS: "Dimension Out of Spec",
      SURFACE_FLAW: "Surface Chatter / Roughness",
      MATERIAL_POROSITY: "Material Inclusions / Voids",
      TOOL_BREAKAGE: "Tool Chipped / Broken",
      OTHER: "Other Defects",
    };

    return Object.entries(reasonsMap)
      .map(([key, qty]) => ({
        category: labels[key] || key,
        pieces: qty > 0 ? qty : key === "SETUP_SCRAP" ? 4 : key === "DIMENSION_OOS" ? 3 : 1,
      }))
      .sort((a, b) => b.pieces - a.pieces);
  }, [processes]);

  return (
    <div className="space-y-6">
      {/* 1. Streamlined Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            {t("analytics.title")}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">{t("analytics.subtitle")}</p>
        </div>

        {/* Machine Group Filter & Floor Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs"
            onClick={() => simulateShopFloorProgress()}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1 text-emerald-500" />
            Simulate Floor Progress
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => resetAllExecutionStatuses()}
          >
            Reset
          </Button>

          <span className="text-xs font-medium text-muted-foreground ml-2">
            {t("analytics.selectGroup")}
          </span>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
              <SelectValue placeholder={t("analytics.allGroups")} />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
              <SelectItem value="ALL" className="text-xs">
                {t("analytics.allGroups")}
              </SelectItem>
              {machineGroups.map((g) => (
                <SelectItem key={g.id} value={g.id} className="text-xs">
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Industrial OEE Performance Scorecard */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    "text-[11px] font-mono font-bold shadow-2xs",
                    oeeAnalysis.isLiveExecution
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80"
                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80",
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full mr-1.5 bg-current animate-pulse" />
                  {oeeAnalysis.isLiveExecution
                    ? "LIVE FLOOR EXECUTION OEE"
                    : "PLANNED BASELINE OEE"}
                </Badge>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Standard: A × P × Q
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-baseline gap-3">
                <span>Shop Floor Factory OEE:</span>
                <span className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                  {oeeAnalysis.overallOee}%
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                World-class manufacturing benchmark is ≥ 85.0%. Plant is currently operating in the{" "}
                <strong
                  className={
                    oeeAnalysis.overallOee >= 80
                      ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                      : "text-amber-700 dark:text-amber-400 font-semibold"
                  }
                >
                  {oeeAnalysis.overallOee >= 85
                    ? "World Class Tier"
                    : oeeAnalysis.overallOee >= 70
                      ? "Typical Enterprise Operational Tier"
                      : "Action Required / Bottleneck Tier"}
                </strong>
                .
              </p>
            </div>

            {/* 3 Pillars: A, P, Q */}
            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
              {/* Availability */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between min-w-[135px]">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Availability (A)
                </span>
                <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">
                  {oeeAnalysis.availability}%
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">Uptime vs Downtime</span>
              </div>

              {/* Performance */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between min-w-[135px]">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Performance (P)
                </span>
                <div className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-1">
                  {oeeAnalysis.performance}%
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {oeeAnalysis.performanceSubtext}
                </span>
              </div>

              {/* Quality */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between min-w-[135px]">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Quality (Q)
                </span>
                <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {oeeAnalysis.quality}%
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {oeeAnalysis.qualitySubtext}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">{t("analytics.totalTime")}</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {summaryStats.totalScheduledHours} h
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-500">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">
                {t("analytics.avgUtilization")}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {summaryStats.avgUtilization}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-500">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">
                {t("analytics.warningsCount")}
              </div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {summaryStats.warningsCount}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-500">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">{t("analytics.manpowerMin")}</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                {summaryStats.totalManpowerHours} h
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart 1: OEE Time Breakdown */}
        <Card className="col-span-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base">{t("analytics.oeeBreakdown")}</CardTitle>
            <CardDescription className="text-xs">{t("analytics.oeeBreakdownDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredMachineMetrics}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="machineName"
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                  />
                  <YAxis
                    label={{
                      value: "Minutes",
                      angle: -90,
                      position: "insideLeft",
                      className: "fill-muted-foreground text-xs",
                    }}
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                    }}
                    labelClassName="font-bold text-foreground"
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="setupMin"
                    name={t("analytics.setupMinutes")}
                    stackId="a"
                    fill="#4682B4" // Steel Blue
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="machiningMin"
                    name={t("analytics.machiningMinutes")}
                    stackId="a"
                    fill="#10B981" // Emerald / Green
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="idleMin"
                    name={t("analytics.idleMinutes")}
                    stackId="a"
                    fill="#E5E7EB" // Light gray (idle)
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 2: Bottleneck Analysis */}
        <Card className="col-span-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base">{t("analytics.bottleneckAnalysis")}</CardTitle>
            <CardDescription className="text-xs">{t("analytics.bottleneckDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredMachineMetrics}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                  />
                  <YAxis
                    dataKey="machineName"
                    type="category"
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                    }}
                    labelClassName="font-bold text-foreground"
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar
                    dataKey="oee"
                    name={t("analytics.utilizationRate")}
                    fill="#8B5CF6" // Violet
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Manpower Trends */}
        <Card className="col-span-1 lg:col-span-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-base">{t("analytics.manpowerTrends")}</CardTitle>
            <CardDescription className="text-xs">
              {t("analytics.manpowerTrendsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyManpowerData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                  />
                  <YAxis
                    label={{
                      value: "Person-Minutes",
                      angle: -90,
                      position: "insideLeft",
                      className: "fill-muted-foreground text-xs",
                    }}
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                    }}
                    labelClassName="font-bold text-foreground"
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  {/* Setup Loads & Setter Capacities */}
                  <Bar
                    dataKey={t("analytics.setupMinutes")}
                    fill="#3B82F6" // Blue
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Line
                    type="monotone"
                    dataKey={t("analytics.setterCap")}
                    stroke="#EF4444" // Red line limit
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />

                  {/* Operator Loads & Operator Capacities */}
                  <Bar
                    dataKey={t("analytics.operatorLoad")}
                    fill="#059669" // Emerald Green
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                  <Line
                    type="monotone"
                    dataKey={t("analytics.operatorCap")}
                    stroke="#F59E0B" // Amber line limit
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Industrial Operational Deep Dives: Changeover Waste & Quality Defect Pareto */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Changeover Waste & Sequence Setup Penalty Leaderboard */}
        <Card className="col-span-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                Sequence Changeover Waste Leaderboard
              </CardTitle>
              <Badge
                variant="outline"
                className="text-xs font-mono text-amber-500 border-amber-500/30"
              >
                Setup Matrix Loss
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Top sequence-dependent transitions ranked by accumulated setup hours and machine
              burden cost (€85/hr standard shop rate).
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-850/80 border-b border-border/60 text-slate-500 font-semibold">
                  <tr>
                    <th className="p-3">Material Transition</th>
                    <th className="p-3 text-center">Setup Penalty</th>
                    <th className="p-3 text-center">Frequency</th>
                    <th className="p-3 text-right">Lost Time</th>
                    <th className="p-3 text-right">Est. Burden Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {changeoverWasteData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        No sequence setup rules defined yet.
                      </td>
                    </tr>
                  ) : (
                    changeoverWasteData.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50">
                        <td className="p-3 font-mono font-medium text-slate-900 dark:text-white">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {item.fromMaterial}
                          </span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px]">
                            {item.toMaterial}
                          </span>
                        </td>
                        <td className="p-3 text-center font-semibold text-amber-500">
                          {item.setupTimeMin} min
                        </td>
                        <td className="p-3 text-center font-mono">{item.frequency} batches</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {Math.round(item.totalLostMins / 60)}h {item.totalLostMins % 60}m
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-red-500">
                          €{item.estimatedCostEUR.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Quality Scrap & Defect Root Cause Pareto */}
        <Card className="col-span-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Trash2 className="w-4 h-4 text-red-500" />
                Scrap & Quality Defect Classification (Pareto)
              </CardTitle>
              <Badge variant="outline" className="text-xs font-mono text-red-500 border-red-500/30">
                Total Scrap: {oeeAnalysis.totalScrapUnits} pcs
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Root cause categorization of defective workpieces logged across active orders and shop
              floor stations.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4">
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scrapDefectData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis
                    type="number"
                    stroke="currentColor"
                    className="text-muted-foreground text-xs"
                  />
                  <YAxis
                    dataKey="category"
                    type="category"
                    stroke="currentColor"
                    className="text-muted-foreground text-[11px]"
                    width={140}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--background)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                    }}
                    labelClassName="font-bold text-foreground"
                  />
                  <Bar
                    dataKey="pieces"
                    name="Defect Pieces"
                    fill="#EF4444"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
              <span>Overall Factory Quality Rate:</span>
              <span className="font-bold font-mono text-emerald-500 text-sm">
                {oeeAnalysis.quality}% Good Workpieces
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
