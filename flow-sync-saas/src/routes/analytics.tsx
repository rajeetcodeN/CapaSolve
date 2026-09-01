import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Activity, AlertTriangle, Clock, Users, Wrench } from "lucide-react";
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
      { title: "Analytics — MFG Scheduler" },
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
    warnings,
    globalSetterCapacity,
    globalOperatorCapacity,
    dailyCapacities,
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

  // Summary Metrics
  const summaryStats = useMemo(() => {
    let totalSetup = 0;
    let totalMachining = 0;
    let totalOeeSum = 0;
    let totalManpowerMin = 0;

    machineMetrics.forEach((m) => {
      totalSetup += m.setupMin;
      totalMachining += m.machiningMin;
      totalOeeSum += m.oee;
    });

    slots.forEach((s) => {
      if (s.slotType === "M") {
        totalManpowerMin += s.minutesUsed * s.manpowerPct;
      } else {
        totalManpowerMin += s.minutesUsed * 1.0;
      }
    });

    const avgOee = machineMetrics.length > 0 ? totalOeeSum / machineMetrics.length : 0;

    return {
      totalScheduledHours: parseFloat(((totalSetup + totalMachining) / 60).toFixed(1)),
      avgOee: parseFloat(avgOee.toFixed(1)),
      warningsCount: warnings.length,
      totalManpowerHours: parseFloat((totalManpowerMin / 60).toFixed(1)),
    };
  }, [machineMetrics, slots, warnings]);

  // 4. Daily Manpower Loading Trends
  const dailyManpowerData = useMemo(() => {
    return activeDates.map((dateStr) => {
      let setupMin = 0;
      let operatorMin = 0;

      // Sum minutes used for this specific date
      slots.forEach((s) => {
        if (s.date !== dateStr) return;
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
  }, [activeDates, slots, dailyCapacities, globalSetterCapacity, globalOperatorCapacity, t]);

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

        {/* Machine Group Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
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
                {summaryStats.avgOee}%
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
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
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
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
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
        <Card className="col-span-1 lg:col-span-2 shadow-sm">
          <CardHeader>
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
    </div>
  );
}
