import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { parseSOPDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Calendar,
  CalendarDays,
  ArrowRight,
  Info,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  ArrowRightLeft,
  Pin,
  PinOff,
  CalendarOff,
  Settings,
  Download,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/monthly")({
  head: () => ({
    meta: [
      { title: "Monthly Planner — MFG Scheduler" },
      {
        name: "description",
        content: "Monthly capacity scheduler and post-optimization evaluation dashboard.",
      },
    ],
  }),
  component: MonthlyPlannerPage,
});

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MonthlyPlannerPage() {
  const {
    orders,
    processes,
    machines,
    slots,
    dailyCapacities,
    setDailyCapacity,
    language,
    globalSetterCapacity,
    globalOperatorCapacity,
    allowProcessOverlap,
    allowSopOverride,
    maxUtilizeResources,
    setAllowProcessOverlap,
    setAllowSopOverride,
    setMaxUtilizeResources,
    optimizationMode,
    setOptimizationMode,
    pinProcessSchedule,
    resetProcessToAuto,
    maxPreponeWeeks,
    setMaxPreponeWeeks,
  } = useAppStore();
  const { t } = useTranslations();

  const machineGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    machines.forEach((m) => {
      map.set(m.id, m.machineGroupId);
    });
    return map;
  }, [machines]);

  const getMachineDisplay = (id: string) => {
    const label = language === "de" ? "Maschine" : "Machine";
    const grp = machineGroupMap.get(id);
    return grp ? `${label} ${id} (${grp})` : `${label} ${id}`;
  };

  // Auto-detect initial year and month from processes or fallback to current date / 2026
  const initialDate = useMemo(() => {
    const validStart =
      processes.find((p) => p.scheduledStart)?.scheduledStart || orders[0]?.sopStartDate;
    if (validStart) {
      try {
        const d = new Date(validStart);
        if (!isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth() };
        }
      } catch (_) {}
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [processes, orders]);

  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // June

  // Selected Day Details Modal
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    dayStr: string;
    dayNum: number;
    dayProcs: any[];
    isHoliday: boolean;
  } | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [machineFilter, setMachineFilter] = useState<string>("ALL");
  const [strategyFilter, setStrategyFilter] = useState<string>("ALL");

  // Dialog state for editing a day's capacity/holiday status
  const [editingDay, setEditingDay] = useState<{
    dayStr: string;
    dayNum: number;
    setterCap: number;
    operatorCap: number;
    isHoliday: boolean;
  } | null>(null);

  // Export Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [exportStartDate, setExportStartDate] = useState<string>("2026-06-01");
  const [exportEndDate, setExportEndDate] = useState<string>("2026-06-30");

  const handleExportCSV = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const rangeComparisons = comparisons.filter((c) => {
      if (!c.scheduledStart) return false;
      const t = c.scheduledStart.getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });

    if (rangeComparisons.length === 0) {
      toast.warning(
        language === "de"
          ? "Keine Belegungsdaten im gewählten Zeitraum gefunden."
          : "No scheduled processes found in the selected date range.",
      );
      return;
    }

    const headers = [
      "Order ID",
      "Step ID",
      "Material",
      "Process Text",
      "Original Workstation",
      "Scheduled Workstation",
      "Planned SOP Start",
      "Scheduled Start",
      "Scheduled End",
      "Duration (min)",
      "Manpower %",
      "Status",
      "Delay Reason",
    ];

    const rows = rangeComparisons.map((c) => {
      const proc = processes.find((p) => p.id === c.id);
      return [
        c.orderId,
        c.processId,
        `"${c.material.replace(/"/g, '""')}"`,
        `"${c.processText.replace(/"/g, '""')}"`,
        c.originalMachineId,
        c.scheduledMachineId,
        c.plannedStart ? c.plannedStart.toISOString() : "",
        c.scheduledStart ? c.scheduledStart.toISOString() : "",
        c.scheduledEnd ? c.scheduledEnd.toISOString() : "",
        proc ? proc.totalTimeMin : 0,
        proc ? (proc.manpowerPct * 100).toFixed(0) : 0,
        c.status,
        `"${(c.delayReason || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `production_plan_${start}_to_${end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(
      language === "de"
        ? "CSV-Datei erfolgreich heruntergeladen!"
        : "CSV plan exported successfully!",
    );
  };

  const handleExportHTMLReport = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const rangeComparisons = comparisons.filter((c) => {
      if (!c.scheduledStart) return false;
      const t = c.scheduledStart.getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });

    const daysList = [];
    const tempPtr = new Date(startDate.getTime());
    while (tempPtr <= endDate) {
      const dStr = formatDateStr(tempPtr);
      const daySlots = slots.filter((s) => s.date === dStr);
      const processesCount = new Set(daySlots.map((s) => s.processId)).size;
      const cap = dailyCapacities?.[dStr] || {
        setter: globalSetterCapacity,
        process: globalOperatorCapacity,
      };
      const isHoliday = !!cap?.isHoliday;

      const setterAvail = isHoliday ? 0 : (cap.setter / 100) * 14 * 60;
      const operatorAvail = isHoliday ? 0 : (cap.process / 100) * 14 * 60;
      const totalAvail = setterAvail + operatorAvail;

      let setterUsed = 0;
      let operatorUsed = 0;
      daySlots.forEach((s) => {
        if (s.slotType === "R") {
          setterUsed += s.minutesUsed;
        } else if (s.slotType === "M") {
          operatorUsed += s.minutesUsed * (s.manpowerPct ?? 0);
        }
      });
      const totalUsed = setterUsed + operatorUsed;
      const resourceUtilPct = totalAvail > 0 ? (totalUsed / totalAvail) * 100 : 0;

      daysList.push({
        dateStr: dStr,
        dayNum: tempPtr.getDate(),
        monthNum: tempPtr.getMonth() + 1,
        isHoliday,
        resourceUtilPct,
        processesCount,
        setterCap: cap.setter,
        operatorCap: cap.process,
      });

      tempPtr.setDate(tempPtr.getDate() + 1);
    }

    const totalScheduled = rangeComparisons.length;
    const pushedCount = rangeComparisons.filter((c) => c.status === "PUSHED_FORWARD").length;
    const onTimeCount = rangeComparisons.filter((c) => c.status === "ON_TIME").length;
    const delayedCount = rangeComparisons.filter((c) => c.status === "DELAYED").length;

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      toast.error("Popup blocked! Please allow popups to export the plan report.");
      return;
    }

    const titleLabel = language === "de" ? "Fertigungsplan-Report" : "Production Plan Report";
    const rangeLabel =
      language === "de" ? `Zeitraum: ${start} bis ${end}` : `Date Range: ${start} to ${end}`;
    const statsLabel = language === "de" ? "Planungsstatistiken" : "Plan Summary Metrics";
    const chartLabel =
      language === "de"
        ? "Kapazitätsauslastung (Kalenderübersicht)"
        : "Capacity Workload Distribution Chart";
    const detailsLabel =
      language === "de" ? "Detaillierte Prozessschritte" : "Detailed Scheduled Processes";

    reportWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${titleLabel}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #1e293b;
            padding: 40px;
            margin: 0;
            background: #fff;
          }
          h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 800; color: #0f172a; }
          .subtitle { margin: 0 0 30px 0; font-size: 14px; color: #64748b; font-weight: 500; }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .metric-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            background: #f8fafc;
          }
          .metric-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
          .metric-value { font-size: 22px; font-weight: 800; margin-top: 5px; color: #0f172a; font-family: monospace; }
          
          .section-title { font-size: 16px; font-weight: 700; margin: 30px 0 15px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 8px;
            margin-bottom: 30px;
          }
          .day-cell {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 10px;
            min-height: 50px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            font-size: 11px;
            background: #fff;
            position: relative;
          }
          .day-num { font-weight: 800; font-size: 12px; margin-bottom: 4px; }
          .day-cell.holiday { background: #fff1f2; border-color: #fca5a5; color: #b91c1c; }
          .day-cell.empty { background: #f8fafc; color: #94a3b8; }
          .util-bar { height: 4px; border-radius: 2px; width: 100%; margin-top: 6px; background: #e2e8f0; overflow: hidden; }
          .util-fill { height: 100%; border-radius: 2px; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; text-align: left; }
          th { background: #f1f5f9; color: #475569; font-weight: 700; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; }
          td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tr:hover { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .badge-pushed { background: #dcfce7; color: #15803d; }
          .badge-ontime { background: #fef3c7; color: #b45309; }
          .badge-delayed { background: #fee2e2; color: #b91c1c; }
          
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
            .day-cell { page-break-inside: avoid; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1>${titleLabel}</h1>
            <div class="subtitle">${rangeLabel}</div>
          </div>
          <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
            ${language === "de" ? "Drucken / PDF Speichern" : "Print / Save PDF"}
          </button>
        </div>

        <div class="section-title">${statsLabel}</div>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-title">${language === "de" ? "Gesamtzahl Eingeplant" : "Total Scheduled"}</div>
            <div class="metric-value">${totalScheduled}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">${language === "de" ? "Vorgezogen" : "Pushed Forward"}</div>
            <div class="metric-value" style="color: #15803d;">${pushedCount}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">${language === "de" ? "Pünktlich" : "On Time"}</div>
            <div class="metric-value" style="color: #b45309;">${onTimeCount}</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">${language === "de" ? "Verzögert" : "Delayed"}</div>
            <div class="metric-value" style="color: #b91c1c;">${delayedCount}</div>
          </div>
        </div>

        <div class="section-title">${chartLabel}</div>
        <div class="calendar-grid">
          ${daysList
            .map((d) => {
              if (d.isHoliday) {
                return `
                <div class="day-cell holiday">
                  <div>
                    <span class="day-num">${d.dayNum}.${d.monthNum}.</span>
                    <div style="font-weight: 700; font-size: 9px; margin-top: 4px;">HOLIDAY</div>
                  </div>
                </div>
              `;
              }
              if (d.processesCount === 0) {
                return `
                <div class="day-cell empty">
                  <div>
                    <span class="day-num">${d.dayNum}.${d.monthNum}.</span>
                    <div style="font-size: 9px; margin-top: 4px;">No Processes</div>
                  </div>
                </div>
              `;
              }
              const barColor =
                d.resourceUtilPct > 90 ? "#ef4444" : d.resourceUtilPct > 50 ? "#f59e0b" : "#10b981";
              return `
              <div class="day-cell">
                <div style="display: flex; justify-content: space-between; width: 100%;">
                  <span class="day-num">${d.dayNum}.${d.monthNum}.</span>
                  <span style="font-weight: 800; font-size: 9px; color: #4f46e5;">${d.processesCount} Proc</span>
                </div>
                <div style="width: 100%;">
                  <div style="font-weight: 700; font-size: 10px;">${d.resourceUtilPct.toFixed(0)}% Util</div>
                  <div class="util-bar">
                    <div class="util-fill" style="width: ${Math.min(100, d.resourceUtilPct)}%; background: ${barColor};"></div>
                  </div>
                  <div style="font-size: 8px; color: #64748b; margin-top: 4px;">
                    Cap: ${(d.setterCap / 100).toFixed(0)}S | ${(d.operatorCap / 100).toFixed(0)}W
                  </div>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>

        <div class="section-title">${detailsLabel}</div>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Step</th>
              <th>Material</th>
              <th>Original Machine</th>
              <th>Scheduled Machine</th>
              <th>Start Date / Time</th>
              <th>End Date / Time</th>
              <th>Status</th>
              <th>Delay Reason</th>
            </tr>
          </thead>
          <tbody>
            ${rangeComparisons
              .map((c) => {
                const badgeClass =
                  c.status === "PUSHED_FORWARD"
                    ? "badge-pushed"
                    : c.status === "ON_TIME"
                      ? "badge-ontime"
                      : "badge-delayed";
                const formattedStart = c.scheduledStart
                  ? c.scheduledStart.toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—";
                const formattedEnd = c.scheduledEnd
                  ? c.scheduledEnd.toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—";
                return `
                <tr>
                  <td style="font-weight: 700; font-family: monospace;">${c.orderId}</td>
                  <td>${c.processId}</td>
                  <td style="max-width: 150px; font-weight: 600;">${c.material}</td>
                  <td>Machine ${c.originalMachineId}</td>
                  <td style="font-weight: 700;">Machine ${c.scheduledMachineId}</td>
                  <td>${formattedStart}</td>
                  <td>${formattedEnd}</td>
                  <td><span class="badge ${badgeClass}">${c.status.replace("_", " ")}</span></td>
                  <td style="color: #64748b; max-width: 200px;">${c.delayReason || "—"}</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
        
        <script>
          setTimeout(() => {
            window.print();
          }, 500);
        </script>
      </body>
      </html>
    `);
    reportWindow.document.close();
  };

  const [inputSetterCap, setInputSetterCap] = useState<number>(100);
  const [inputOperatorCap, setInputOperatorCap] = useState<number>(200);
  const [inputIsHoliday, setInputIsHoliday] = useState<boolean>(false);

  const handleOpenEditDialog = (cd: any) => {
    setEditingDay(cd);
    setInputSetterCap(cd.setterCap);
    setInputOperatorCap(cd.operatorCap);
    setInputIsHoliday(cd.isHoliday);
  };

  const handleSaveDayConfig = () => {
    if (!editingDay) return;
    setDailyCapacity(editingDay.dayStr, {
      setter: inputSetterCap,
      process: inputOperatorCap,
      isHoliday: inputIsHoliday,
    });
    toast.success(
      language === "de"
        ? `Kapazität für den ${editingDay.dayNum}. erfolgreich aktualisiert!`
        : `Capacity for day ${editingDay.dayNum} successfully updated!`,
    );
    setEditingDay(null);
  };

  const handleToggleHolidayDirectly = (dayStr: string, isHoliday: boolean, dayNum: number) => {
    const targetIsHoliday = !isHoliday;
    setDailyCapacity(dayStr, {
      isHoliday: targetIsHoliday,
      setter: targetIsHoliday ? 0 : globalSetterCapacity,
      process: targetIsHoliday ? 0 : globalOperatorCapacity,
    });
    toast.success(
      targetIsHoliday
        ? language === "de"
          ? `Tag ${dayNum} als Feiertag markiert`
          : `Day ${dayNum} marked as Holiday`
        : language === "de"
          ? `Feiertag für Tag ${dayNum} aufgehoben`
          : `Holiday removed for Day ${dayNum}`,
    );
  };

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

  const orderMap = useMemo(() => {
    const map = new Map<string, (typeof orders)[0]>();
    orders.forEach((o) => map.set(o.id, o));
    return map;
  }, [orders]);

  // Comprehensive list of processes with original planned (SOP) vs post-optimized schedule
  const comparisons = useMemo(() => {
    // 1. Group processes by orderId
    const orderProcessesMap = new Map<string, typeof processes>();
    processes.forEach((p) => {
      if (!orderProcessesMap.has(p.orderId)) {
        orderProcessesMap.set(p.orderId, []);
      }
      orderProcessesMap.get(p.orderId)!.push(p);
    });

    // 2. Pre-calculate unoptimized sequential SOP dates for each process step
    const unoptimizedSOPMap = new Map<string, { plannedStart: Date; plannedEnd: Date }>();

    orders.forEach((order) => {
      const ops = orderProcessesMap.get(order.id) || [];
      const sortedOps = [...ops].sort((a, b) => a.processId - b.processId);

      let currentPointer: Date;
      try {
        currentPointer = parseSOPDate(order.sopStartDate, order.sopStartTime || "00:00:00");
      } catch (_) {
        currentPointer = new Date();
      }

      sortedOps.forEach((proc) => {
        // Align pointer to working hours (06:00 to 20:00)
        let h = currentPointer.getHours();
        if (h < 6) {
          currentPointer.setHours(6, 0, 0, 0);
        } else if (h >= 20) {
          currentPointer.setDate(currentPointer.getDate() + 1);
          currentPointer.setHours(6, 0, 0, 0);
        }

        const plannedStart = new Date(currentPointer.getTime());

        let remainingMin = proc.totalTimeMin || 0;
        while (remainingMin > 0) {
          const hr = currentPointer.getHours();
          if (hr < 6) {
            currentPointer.setHours(6, 0, 0, 0);
          } else if (hr >= 20) {
            currentPointer.setDate(currentPointer.getDate() + 1);
            currentPointer.setHours(6, 0, 0, 0);
            continue;
          }

          const currentMinutes = currentPointer.getMinutes();
          const currentSeconds = currentPointer.getSeconds();
          const minutesLeftInHour = 60 - currentMinutes - currentSeconds / 60;

          const minutesToConsume = Math.min(remainingMin, minutesLeftInHour);
          currentPointer.setTime(currentPointer.getTime() + minutesToConsume * 60 * 1000);
          remainingMin -= minutesToConsume;
        }

        const plannedEnd = new Date(currentPointer.getTime());
        unoptimizedSOPMap.set(proc.id, { plannedStart, plannedEnd });
      });
    });

    return processes
      .map((p) => {
        const order = orderMap.get(p.orderId);
        if (!order) return null;

        // Get calculated sequential plannedStart instead of order's general SOP start date
        const unoptimized = unoptimizedSOPMap.get(p.id);
        const plannedStart = unoptimized ? unoptimized.plannedStart : null;

        const scheduledStart = p.scheduledStart ? new Date(p.scheduledStart) : null;
        const scheduledEnd = p.scheduledEnd ? new Date(p.scheduledEnd) : null;

        let diffHours = 0;
        let status: "PENDING" | "ON_TIME" | "PUSHED_FORWARD" | "DELAYED" = "PENDING";
        let diffText = "";

        if (plannedStart && scheduledStart) {
          const diffMs = scheduledStart.getTime() - plannedStart.getTime();
          diffHours = diffMs / 3600000;

          if (diffHours < -0.1) {
            status = "PUSHED_FORWARD";
            const absHours = Math.abs(diffHours);
            if (absHours >= 24) {
              diffText = `${(absHours / 24).toFixed(1)} ${language === "de" ? "Tage früher" : "days early"}`;
            } else {
              diffText = `${absHours.toFixed(1)} ${language === "de" ? "Std früher" : "hrs early"}`;
            }
          } else if (diffHours > 0.1) {
            status = "DELAYED";
            const absHours = Math.abs(diffHours);
            if (absHours >= 24) {
              diffText = `${(absHours / 24).toFixed(1)} ${language === "de" ? "Tage später" : "days late"}`;
            } else {
              diffText = `${absHours.toFixed(1)} ${language === "de" ? "Std später" : "hrs late"}`;
            }
          } else {
            status = "ON_TIME";
            diffText = language === "de" ? "Pünktlich" : "On Time";
          }
        }

        // Compute delay reason if delayed
        let delayReason = "";
        if (status === "DELAYED" && plannedStart && scheduledStart) {
          // 1. Check sequence dependency (waiting for prior step of same order)
          const orderProcesses = processes.filter((op) => op.orderId === p.orderId);
          const priorSteps = orderProcesses.filter((op) => op.processId < p.processId);
          let immediatePredecessor: (typeof processes)[0] | null = null;
          if (priorSteps.length > 0) {
            priorSteps.sort((a, b) => b.processId - a.processId);
            immediatePredecessor = priorSteps[0];
          }

          if (immediatePredecessor && immediatePredecessor.scheduledEnd) {
            const predEnd = new Date(immediatePredecessor.scheduledEnd);
            if (predEnd.getTime() > plannedStart.getTime() + 60000) {
              delayReason =
                language === "de"
                  ? `Wartet auf Vorgänger-Schritt ${immediatePredecessor.processId}`
                  : `Waiting for predecessor Step ${immediatePredecessor.processId}`;
            }
          }

          // 2. Check shift hours alignment
          if (!delayReason) {
            const plannedHour = plannedStart.getHours();
            if (plannedHour < 6 || plannedHour >= 20) {
              delayReason =
                language === "de"
                  ? "Verschiebung durch Arbeitszeitfenster (06:00 - 20:00)"
                  : "Shifted to align with working hours (06:00 - 20:00)";
            }
          }

          // 3. Check workstation occupancy (which process was occupying it?)
          if (!delayReason) {
            const targetMachineId = p.originalMachineId || p.machineId;
            const blockingProcess = processes.find((op) => {
              if (
                op.id === p.id ||
                op.machineId !== targetMachineId ||
                !op.scheduledStart ||
                !op.scheduledEnd
              )
                return false;
              const opStart = new Date(op.scheduledStart).getTime();
              const opEnd = new Date(op.scheduledEnd).getTime();
              return opStart <= plannedStart!.getTime() && opEnd > plannedStart!.getTime();
            });

            if (blockingProcess) {
              const blockingOrder = orders.find((o) => o.id === blockingProcess.orderId);
              const blockingCode = blockingOrder ? blockingOrder.orderId : "Unknown";
              delayReason =
                language === "de"
                  ? `Maschine belegt durch Auftrag ${blockingCode} (Schritt ${blockingProcess.processId})`
                  : `Machine occupied by Order ${blockingCode} (Step ${blockingProcess.processId})`;
            }
          }

          // 4. Check if holiday is the reason
          if (!delayReason) {
            const plannedDateStr = formatDateStr(plannedStart);
            if (dailyCapacities?.[plannedDateStr]?.isHoliday) {
              delayReason =
                language === "de"
                  ? "Geplantes SOP-Datum fällt auf Feiertag"
                  : "Planned SOP date falls on a Holiday";
            }
          }

          // 5. Fallback (Resource Stacking bottleneck)
          if (!delayReason) {
            delayReason =
              language === "de"
                ? "Kapazitäts- oder Einrichter-Engpass an diesem Tag"
                : "Resource capacity or setup pool bottleneck";
          }
        }

        return {
          id: p.id,
          processId: p.processId,
          processText: p.processText,
          orderId: order.orderId,
          material: order.material,
          originalMachineId: p.originalMachineId || p.machineId,
          scheduledMachineId: p.machineId,
          plannedStart,
          scheduledStart,
          scheduledEnd,
          diffHours,
          diffText,
          status,
          delayReason,
          hasMachineShift: (p.originalMachineId || p.machineId) !== p.machineId,
          isManual: p.isManual,
        };
      })
      .filter(Boolean) as Array<NonNullable<ReturnType<(typeof processes)[number] | any>>>;
  }, [processes, orders, orderMap, language, dailyCapacities]);

  // Calendar day cells calculations
  const calendarDays = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay(); // Sunday=0
    const offset = firstDayIdx === 0 ? 6 : firstDayIdx - 1; // Align to Monday = 0

    const list = [];
    // Previous month padding
    for (let i = 0; i < offset; i++) {
      list.push({
        dayStr: "",
        dayNum: 0,
        isPadding: true,
        totalHours: 0,
        pushedCount: 0,
        processesCount: 0,
        isHoliday: false,
        resourceUtilPct: 0,
        setterCap: 100,
        operatorCap: 200,
      });
    }

    // Days list
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dStr = formatDateStr(d);

      // Total scheduled hours in this day
      const daySlots = slots.filter((s) => s.date === dStr);
      let totalMins = 0;
      daySlots.forEach((s) => {
        totalMins += s.minutesUsed;
      });
      const totalHours = totalMins / 60;

      // Count processes scheduled on this day that are pushed forward
      const pushedCount = comparisons.filter(
        (c) =>
          c.scheduledStart &&
          formatDateStr(c.scheduledStart) === dStr &&
          c.status === "PUSHED_FORWARD",
      ).length;

      // Count total unique processes active on this day
      const processesCount = new Set(daySlots.map((s) => s.processId)).size;

      const cap = dailyCapacities?.[dStr] || {
        setter: globalSetterCapacity,
        process: globalOperatorCapacity,
      };
      const isHoliday = !!cap?.isHoliday;

      // Resource capacity limits calculations
      const setterAvail = isHoliday ? 0 : (cap.setter / 100) * 14 * 60;
      const operatorAvail = isHoliday ? 0 : (cap.process / 100) * 14 * 60;
      const totalAvail = setterAvail + operatorAvail;

      let setterUsed = 0;
      let operatorUsed = 0;
      daySlots.forEach((s) => {
        if (s.slotType === "R") {
          setterUsed += s.minutesUsed;
        } else if (s.slotType === "M") {
          operatorUsed += s.minutesUsed * (s.manpowerPct ?? 0);
        }
      });
      const totalUsed = setterUsed + operatorUsed;
      const resourceUtilPct = totalAvail > 0 ? (totalUsed / totalAvail) * 100 : 0;

      // Scheduled processes active on this specific date
      const dayProcs = comparisons.filter((c) => {
        if (!c.scheduledStart) return false;
        return formatDateStr(c.scheduledStart) === dStr;
      });

      list.push({
        dayStr: dStr,
        dayNum: i,
        isPadding: false,
        totalHours,
        pushedCount,
        processesCount: dayProcs.length || processesCount,
        isHoliday,
        resourceUtilPct,
        setterCap: cap.setter,
        operatorCap: cap.process,
        dayProcs,
      });
    }

    return list;
  }, [
    currentYear,
    currentMonth,
    slots,
    comparisons,
    dailyCapacities,
    globalSetterCapacity,
    globalOperatorCapacity,
  ]);

  // Aggregated Monthly Optimization Rollups
  const rollupStats = useMemo(() => {
    const totalScheduled = comparisons.filter((c) => c.scheduledStart).length;
    const pushedCount = comparisons.filter((c) => c.status === "PUSHED_FORWARD").length;
    const onTimeCount = comparisons.filter((c) => c.status === "ON_TIME").length;
    const delayedCount = comparisons.filter((c) => c.status === "DELAYED").length;
    const machineShiftCount = comparisons.filter((c) => c.hasMachineShift).length;

    return {
      totalScheduled,
      pushedCount,
      onTimeCount,
      delayedCount,
      machineShiftCount,
      pushedPct: totalScheduled > 0 ? (pushedCount / totalScheduled) * 100 : 0,
      delayedPct: totalScheduled > 0 ? (delayedCount / totalScheduled) * 100 : 0,
    };
  }, [comparisons]);

  // Filtered comparison list
  const filteredComparisons = useMemo(() => {
    return comparisons.filter((c) => {
      // 1. Search Query
      const matchesSearch =
        c.orderId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.processText.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Status Filter
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PUSHED_FORWARD" && c.status === "PUSHED_FORWARD") ||
        (statusFilter === "ON_TIME" && c.status === "ON_TIME") ||
        (statusFilter === "DELAYED" && c.status === "DELAYED");

      // 3. Machine Filter
      const matchesMachine = machineFilter === "ALL" || c.scheduledMachineId === machineFilter;

      // 4. Strategy Filter
      let matchesStrategy = true;
      const isOptimized = c.status === "PUSHED_FORWARD" || c.hasMachineShift;
      const isNonOptimized = !isOptimized;
      const isSopOverride = c.status === "PUSHED_FORWARD";
      const isGroupShift = c.hasMachineShift;

      if (strategyFilter === "NON_OPTIMIZED") {
        matchesStrategy = isNonOptimized;
      } else if (strategyFilter === "OPTIMIZED") {
        matchesStrategy = isOptimized;
      } else if (strategyFilter === "SOP_OVERRIDE") {
        matchesStrategy = isSopOverride;
      } else if (strategyFilter === "GROUP_SHIFT") {
        matchesStrategy = isGroupShift;
      }

      return matchesSearch && matchesStatus && matchesMachine && matchesStrategy;
    });
  }, [comparisons, searchQuery, statusFilter, machineFilter, strategyFilter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Streamlined Header */}
      <div className="border-b border-border/60 pb-3">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
          {language === "de" ? "Monatliche Planungsanalyse" : "Monthly Planner & Post-Optimization"}
        </h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {language === "de"
            ? "Analysieren Sie die monatliche Auslastung und vergleichen Sie den ursprünglichen SOP-Plan mit den Optimierungen."
            : "Review monthly workload distributions, pushed-forward opportunities, and post-optimization overrides."}
        </p>
      </div>

      {/* 1.5. Live Strategy Control Center */}
      <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-slate-500/[0.02]">
          <div className="flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Zap className="h-4 w-4 text-primary animate-pulse" />
                {language === "de"
                  ? "Live-Optimierungsstrategien"
                  : "Live Optimization Strategy Dashboard"}
              </CardTitle>
              <CardDescription>
                {language === "de"
                  ? "Aktivieren Sie Strategien, um die Auswirkungen auf die Fertigungskapazitäten und Durchlaufzeiten in Echtzeit zu berechnen."
                  : "Toggle strategy parameters below to run the scheduling engine and see impacts on delays and timelines instantly."}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setAllowProcessOverlap(false);
                  setAllowSopOverride(false);
                  setMaxUtilizeResources(false);
                  setOptimizationMode("pre");
                }}
              >
                {language === "de"
                  ? "Alle deaktivieren (Nicht Optimiert)"
                  : "Disable All (Non-Optimized)"}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-white font-medium shadow-xs border border-slate-700/60 cursor-pointer"
                onClick={() => {
                  setAllowProcessOverlap(true);
                  setAllowSopOverride(true);
                  setMaxUtilizeResources(true);
                  setOptimizationMode("full");
                }}
              >
                {language === "de"
                  ? "Alle aktivieren (Voll Optimiert)"
                  : "Enable All (Fully Optimized)"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Allow Process Overlap */}
            <div
              className={cn(
                "p-3 rounded-xl border transition-all flex flex-col justify-between",
                allowProcessOverlap
                  ? "bg-white dark:bg-slate-850 border-slate-300 dark:border-slate-700 shadow-2xs"
                  : "bg-white/60 dark:bg-slate-900 border-slate-200 dark:border-slate-800",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {language === "de" ? "Prozessüberlappung erlauben" : "Allow Process Overlap"}
                  </span>
                  <input
                    type="checkbox"
                    checked={allowProcessOverlap}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAllowProcessOverlap(val);
                      if (!val && !allowSopOverride && !maxUtilizeResources) {
                        setOptimizationMode("pre");
                      } else {
                        setOptimizationMode("full");
                      }
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4 cursor-pointer accent-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {language === "de"
                    ? "Gleichzeitige Bearbeitung in derselben Maschinengruppe (sequenzierte Rüstvorgänge)."
                    : "Concurrent machining in the same machine group with sequenced setups."}
                </p>
              </div>
              <div className="mt-2 text-[10.5px] font-mono flex items-center gap-1">
                <span
                  className={
                    allowProcessOverlap
                      ? "text-slate-900 dark:text-white font-semibold"
                      : "text-slate-400"
                  }
                >
                  {allowProcessOverlap
                    ? "Active (Optimizing Capacity)"
                    : "Inactive (Strict Sequential)"}
                </span>
              </div>
            </div>

            {/* Allow SOP Override */}
            <div
              className={cn(
                "p-3 rounded-xl border transition-all flex flex-col justify-between",
                allowSopOverride
                  ? "bg-white dark:bg-slate-850 border-slate-300 dark:border-slate-700 shadow-2xs"
                  : "bg-white/60 dark:bg-slate-900 border-slate-200 dark:border-slate-800",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {language === "de" ? "SOP-Override zulassen" : "Allow SOP Override"}
                  </span>
                  <input
                    type="checkbox"
                    checked={allowSopOverride}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAllowSopOverride(val);
                      if (!allowProcessOverlap && !val && !maxUtilizeResources) {
                        setOptimizationMode("pre");
                      } else {
                        setOptimizationMode("full");
                      }
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4 cursor-pointer accent-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {language === "de"
                    ? "Prozesse vorziehen und den geplanten Soll-Starttermin (SOP) ignorieren."
                    : "Pull processes forward ignoring SOP start dates to fill empty capacity slots."}
                </p>
                {allowSopOverride && (
                  <div className="mt-2 space-y-1 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                    <Label
                      htmlFor="max-prepone-monthly"
                      className="text-[10px] font-semibold text-slate-500 uppercase"
                    >
                      {t("gantt.maxPreponeLimit")}
                    </Label>
                    <Select
                      value={String(maxPreponeWeeks)}
                      onValueChange={(val) => setMaxPreponeWeeks(parseInt(val, 10))}
                    >
                      <SelectTrigger
                        id="max-prepone-monthly"
                        className="h-7 text-[11px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{t("gantt.maxPreponeNoLimit")}</SelectItem>
                        <SelectItem value="1">
                          {language === "de" ? "1 Woche" : "1 Week"}
                        </SelectItem>
                        <SelectItem value="2">
                          {language === "de" ? "2 Wochen" : "2 Weeks"}
                        </SelectItem>
                        <SelectItem value="3">
                          {language === "de" ? "3 Wochen" : "3 Weeks"}
                        </SelectItem>
                        <SelectItem value="4">
                          {language === "de" ? "4 Wochen (1 Monat)" : "4 Weeks (1 Month)"}
                        </SelectItem>
                        <SelectItem value="8">
                          {language === "de" ? "8 Wochen (2 Monate)" : "8 Weeks (2 Months)"}
                        </SelectItem>
                        <SelectItem value="12">
                          {language === "de" ? "12 Wochen (3 Monate)" : "12 Weeks (3 Months)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="mt-2 text-[10.5px] font-mono flex items-center gap-1">
                <span
                  className={
                    allowSopOverride
                      ? "text-slate-900 dark:text-white font-semibold"
                      : "text-slate-400"
                  }
                >
                  {allowSopOverride
                    ? "Active (Pulling Orders Forward)"
                    : "Inactive (Respect SOP Date)"}
                </span>
              </div>
            </div>

            {/* Max Utilize Shift */}
            <div
              className={cn(
                "p-3 rounded-xl border transition-all flex flex-col justify-between",
                maxUtilizeResources
                  ? "bg-white dark:bg-slate-850 border-slate-300 dark:border-slate-700 shadow-2xs"
                  : "bg-white/60 dark:bg-slate-900 border-slate-200 dark:border-slate-800",
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {language === "de"
                      ? "Maximal Auslasten (Gruppe)"
                      : "Max Utilize (Shift in Group)"}
                  </span>
                  <input
                    type="checkbox"
                    checked={maxUtilizeResources}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setMaxUtilizeResources(val);
                      if (!allowProcessOverlap && !allowSopOverride && !val) {
                        setOptimizationMode("pre");
                      } else {
                        setOptimizationMode("full");
                      }
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4 cursor-pointer accent-slate-900"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {language === "de"
                    ? "Arbeitsgänge flexibel auf freie Maschinen innerhalb derselben Gruppe verteilen."
                    : "Shift process steps to alternate machines in group to prevent bottlenecks."}
                </p>
              </div>
              <div className="mt-2 text-[10.5px] font-mono flex items-center gap-1">
                <span
                  className={
                    maxUtilizeResources
                      ? "text-slate-900 dark:text-white font-semibold"
                      : "text-slate-400"
                  }
                >
                  {maxUtilizeResources
                    ? "Active (Flexible Group Shifting)"
                    : "Inactive (Strict Routing)"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Stat Widgets */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase">
              {language === "de" ? "Eingeplante Schritte" : "Scheduled Processes"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {rollupStats.totalScheduled}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {language === "de"
                ? "Gesamtzahl optimierter Arbeitsschritte"
                : "Total allocation processes"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-slate-400" />
              {language === "de" ? "Vorgezogene Schritte" : "Pushed Forward Steps"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {rollupStats.pushedCount}{" "}
              <span className="text-xs font-medium text-slate-500">
                ({rollupStats.pushedPct.toFixed(0)}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {language === "de"
                ? "Früher als geplant (SOP) beendet"
                : "Scheduled earlier than original SOP"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
              {language === "de" ? "Pünktlich Geplant" : "On-Time Scheduled"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {rollupStats.onTimeCount}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {language === "de"
                ? "Genau zum SOP-Termin eingeplant"
                : "Scheduled exactly on SOP release"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400" />
              {language === "de" ? "Maschinenwechsel" : "Machine Switches"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {rollupStats.machineShiftCount}
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {language === "de"
                ? "Zuweisung auf Alternativmaschinen"
                : "Rescheduled to alternative workstations"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Plan Dialog */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-[425px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {language === "de" ? "Produktionsplan exportieren" : "Export Production Plan"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "de"
                ? "Wählen Sie den Datumsbereich und das gewünschte Format für den Export des Belegungsplans."
                : "Select the date range and format to export the production schedule plan."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-xs">
            {/* Start Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="export-start-date"
                className="text-right font-bold text-muted-foreground"
              >
                {language === "de" ? "Startdatum" : "Start Date"}
              </Label>
              <Input
                id="export-start-date"
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="col-span-3 h-8 text-xs font-mono"
              />
            </div>
            {/* End Date */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="export-end-date"
                className="text-right font-bold text-muted-foreground"
              >
                {language === "de" ? "Enddatum" : "End Date"}
              </Label>
              <Input
                id="export-end-date"
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="col-span-3 h-8 text-xs font-mono"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportModalOpen(false)}
              className="w-full sm:w-auto"
            >
              {language === "de" ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                handleExportCSV(exportStartDate, exportEndDate);
                setIsExportModalOpen(false);
              }}
              className="w-full sm:w-auto gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {language === "de" ? "CSV herunterladen" : "Download CSV"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                handleExportHTMLReport(exportStartDate, exportEndDate);
                setIsExportModalOpen(false);
              }}
              className="w-full sm:w-auto gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95"
            >
              {language === "de" ? "PDF exportieren" : "Export PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Grid: Calendar Loading & Chart */}
      <div className="grid gap-6 md:grid-cols-5">
        {/* Month Calendar Card (5 cols) */}
        <Card className="border border-border/80 shadow-md bg-card md:col-span-5">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                {language === "de"
                  ? "Monatliche Kapazitätsauslastung"
                  : "Monthly Workload Distribution"}
              </CardTitle>
              <CardDescription>
                {language === "de"
                  ? "Tägliche Ressourcenauslastung, Kapazitäten und Anzahl aktiver Prozesse"
                  : "Daily resource utilization, capacities, and active processes count"}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs border-primary/30 hover:border-primary/60 hover:bg-primary/[0.02]"
                onClick={() => {
                  const firstDay = new Date(currentYear, currentMonth, 1);
                  const lastDay = new Date(currentYear, currentMonth + 1, 0);
                  setExportStartDate(formatDateStr(firstDay));
                  setExportEndDate(formatDateStr(lastDay));
                  setIsExportModalOpen(true);
                }}
              >
                <Download className="h-4 w-4 text-primary" />
                {language === "de" ? "Plan exportieren" : "Export Plan"}
              </Button>

              {/* Jump to Active Data Month */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-primary font-bold hover:bg-primary/10"
                onClick={() => {
                  setCurrentYear(initialDate.year);
                  setCurrentMonth(initialDate.month);
                  toast.info(
                    `Jumped to active data: ${monthNames[initialDate.month]} ${initialDate.year}`,
                  );
                }}
              >
                Active Data Month
              </Button>

              {/* Month & Year Selectors */}
              <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/60">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Month Dropdown */}
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                  className="bg-background border border-border/70 rounded px-2 py-0.5 text-xs font-bold font-mono uppercase focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {monthNames.map((mName, mIdx) => (
                    <option key={mIdx} value={mIdx}>
                      {mName}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
                  className="bg-background border border-border/70 rounded px-2 py-0.5 text-xs font-bold font-mono focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((yNum) => (
                    <option key={yNum} value={yNum}>
                      {yNum}
                    </option>
                  ))}
                </select>

                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 px-4 pb-4">
            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-muted-foreground uppercase border-b border-border/30 pb-2 mb-2">
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

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2 font-mono text-xs">
              {calendarDays.map((cd, idx) => {
                if (cd.isPadding) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[110px] bg-slate-50/20 dark:bg-slate-900/10 rounded-md border border-dashed border-border/20"
                    />
                  );
                }

                const dayProcsList = cd.dayProcs || [];

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (dayProcsList.length > 0) {
                        setSelectedDayDetails({
                          dayStr: cd.dayStr,
                          dayNum: cd.dayNum,
                          dayProcs: dayProcsList,
                          isHoliday: cd.isHoliday,
                        });
                      } else {
                        handleOpenEditDialog(cd);
                      }
                    }}
                    className={cn(
                      "min-h-[110px] rounded-md p-1.5 flex flex-col justify-between border relative transition-all group hover:bg-accent/40 cursor-pointer select-none",
                      cd.isHoliday
                        ? "bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                        : cd.processesCount > 0
                          ? "bg-background border-border/70 text-foreground"
                          : "bg-muted/10 border-border/30 text-muted-foreground",
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-[11px]">{cd.dayNum}</span>
                      <div className="flex items-center gap-1">
                        {cd.isHoliday && (
                          <span className="text-[8px] bg-rose-500 text-rose-50 px-1 py-0.2 rounded font-sans uppercase font-bold scale-90">
                            H
                          </span>
                        )}
                        {/* Hover Actions Overlay */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleHolidayDirectly(cd.dayStr, cd.isHoliday, cd.dayNum);
                            }}
                            className={cn(
                              "p-0.5 rounded bg-background dark:bg-slate-800 shadow-sm border border-border/40 hover:bg-muted text-muted-foreground",
                              cd.isHoliday
                                ? "text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/20"
                                : "hover:text-rose-500",
                            )}
                            title={
                              cd.isHoliday
                                ? language === "de"
                                  ? "Feiertag entfernen"
                                  : "Remove Holiday"
                                : language === "de"
                                  ? "Als Feiertag markieren"
                                  : "Mark as Holiday"
                            }
                          >
                            <CalendarOff className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditDialog(cd);
                            }}
                            className="p-0.5 rounded bg-background dark:bg-slate-800 shadow-sm border border-border/40 hover:bg-muted text-muted-foreground hover:text-primary"
                            title={language === "de" ? "Kapazität ändern" : "Change Capacity"}
                          >
                            <Settings className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Live Operations & Tasks inside day cell */}
                    {dayProcsList.length > 0 && !cd.isHoliday ? (
                      <div className="space-y-1 my-1">
                        {dayProcsList.slice(0, 2).map((proc: any) => {
                          const startTimeStr = proc.scheduledStart
                            ? new Date(proc.scheduledStart).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";
                          const endTimeStr = proc.scheduledEnd
                            ? new Date(proc.scheduledEnd).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "";

                          return (
                            <div
                              key={proc.id}
                              className={cn(
                                "p-1 rounded text-[9.5px] border flex items-center justify-between gap-1 transition-all",
                                proc.isManual
                                  ? "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold"
                                  : proc.status === "PUSHED_FORWARD"
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                    : "bg-muted/50 border-border/50 text-foreground",
                              )}
                              title={`Order ${proc.orderId} Step ${proc.processId} (${proc.scheduledMachineId}): ${startTimeStr} - ${endTimeStr}`}
                            >
                              <div className="truncate flex-1">
                                <span className="font-bold">
                                  {proc.orderId}-{proc.processId}
                                </span>
                                <span className="text-[8.5px] opacity-80 block truncate">
                                  {startTimeStr} ({proc.scheduledMachineId})
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (proc.isManual) {
                                    resetProcessToAuto(proc.id);
                                    toast.info(
                                      `Unpinned Order ${proc.orderId} Step ${proc.processId}`,
                                    );
                                  } else {
                                    pinProcessSchedule(proc.id);
                                    toast.success(
                                      `Pinned Order ${proc.orderId} Step ${proc.processId}`,
                                    );
                                  }
                                }}
                                className="shrink-0 p-0.5 hover:text-primary transition-colors cursor-pointer"
                                title={proc.isManual ? "Unpin Schedule" : "Pin Schedule"}
                              >
                                {proc.isManual ? (
                                  <Pin className="h-3 w-3 text-amber-500 fill-current" />
                                ) : (
                                  <PinOff className="h-3 w-3 opacity-40 hover:opacity-100" />
                                )}
                              </button>
                            </div>
                          );
                        })}
                        {dayProcsList.length > 2 && (
                          <div className="text-[8.5px] text-primary font-bold text-center">
                            +{dayProcsList.length - 2} more tasks
                          </div>
                        )}
                      </div>
                    ) : null}

                    {(cd.processesCount > 0 ||
                      cd.setterCap !== globalSetterCapacity ||
                      cd.operatorCap !== globalOperatorCapacity) &&
                    !cd.isHoliday ? (
                      <div className="space-y-0.5 w-full mt-auto">
                        <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex border border-border/10">
                          <div
                            style={{ width: `${Math.min(100, cd.resourceUtilPct)}%` }}
                            className={cn(
                              "h-full",
                              cd.resourceUtilPct > 90
                                ? "bg-red-500"
                                : cd.resourceUtilPct > 50
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[8.5px] text-muted-foreground font-mono">
                          <span className="font-bold text-foreground">
                            {cd.resourceUtilPct.toFixed(0)}% Util
                          </span>
                          <span>{cd.processesCount} Jobs</span>
                        </div>
                      </div>
                    ) : (
                      cd.isHoliday && (
                        <div className="text-[8.5px] text-rose-500 dark:text-rose-400 font-bold uppercase font-sans tracking-wide text-right mt-auto">
                          {language === "de" ? "Feiertag" : "Holiday"}
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog for Selected Day Operations Details */}
      <Dialog
        open={!!selectedDayDetails}
        onOpenChange={(open) => !open && setSelectedDayDetails(null)}
      >
        <DialogContent className="sm:max-w-xl font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Day Operations Details — {selectedDayDetails?.dayStr}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review live scheduled start/end times, workstation assignments, and pin/unpin process
              steps.
            </DialogDescription>
          </DialogHeader>

          {selectedDayDetails && (
            <div className="space-y-3 py-2 text-xs max-h-[400px] overflow-y-auto">
              {selectedDayDetails.dayProcs.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No processes scheduled on this day.
                </p>
              ) : (
                selectedDayDetails.dayProcs.map((proc: any) => {
                  const startTimeStr = proc.scheduledStart
                    ? new Date(proc.scheduledStart).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A";
                  const endTimeStr = proc.scheduledEnd
                    ? new Date(proc.scheduledEnd).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A";

                  return (
                    <div
                      key={proc.id}
                      className={cn(
                        "p-3 rounded-xl border flex items-center justify-between gap-3 transition-all",
                        proc.isManual
                          ? "bg-amber-500/10 border-amber-500/40 text-foreground"
                          : proc.status === "PUSHED_FORWARD"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                            : "bg-card border-border/70 text-foreground",
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold font-mono text-primary text-xs">
                            Order {proc.orderId} (Step {proc.processId})
                          </span>
                          {proc.isManual && (
                            <span className="text-[9px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded uppercase">
                              PINNED
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold">
                          {proc.material} — {proc.processText}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                          <span>
                            Workstation:{" "}
                            <strong className="text-foreground">{proc.scheduledMachineId}</strong>
                          </span>
                          <span>
                            Time:{" "}
                            <strong className="text-foreground">
                              {startTimeStr} - {endTimeStr}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={proc.isManual ? "default" : "outline"}
                        onClick={() => {
                          if (proc.isManual) {
                            resetProcessToAuto(proc.id);
                            toast.info(`Unpinned Order ${proc.orderId} Step ${proc.processId}`);
                          } else {
                            pinProcessSchedule(proc.id);
                            toast.success(`Pinned Order ${proc.orderId} Step ${proc.processId}`);
                          }
                          setSelectedDayDetails(null);
                        }}
                        className="text-xs h-8 gap-1.5 cursor-pointer shrink-0"
                      >
                        {proc.isManual ? (
                          <>
                            <PinOff className="h-3.5 w-3.5" />
                            Unpin Step
                          </>
                        ) : (
                          <>
                            <Pin className="h-3.5 w-3.5" />
                            Pin Schedule
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setSelectedDayDetails(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Comparison Table List */}
      <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
        <CardHeader className="border-b border-border/50 pb-3 flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <ArrowRight className="h-5 w-5 text-primary" />
              {language === "de"
                ? "Abgleich: Soll-Planung vs. Ist-Planung (Post-Optimiert)"
                : "SOP Planned vs. Scheduled Post-Optimized Comparison"}
            </CardTitle>
            <CardDescription>
              {language === "de"
                ? "Vergleich der ursprünglichen Freigabetermine und Maschinen mit dem optimierten Plan."
                : "Live ledger evaluating planned SOP start dates and target workstations against scheduled optimization outputs."}
            </CardDescription>
          </div>
        </CardHeader>

        {/* Filter controls */}
        <div className="bg-muted/30 border-b border-border p-4 grid gap-4 grid-cols-1 sm:grid-cols-4">
          <div className="space-y-1">
            <Label
              htmlFor="search-cmp"
              className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"
            >
              <Search className="h-3 w-3 text-primary" />
              {language === "de" ? "Nach Auftrag / Material suchen" : "Search Order / Spec"}
            </Label>
            <Input
              id="search-cmp"
              type="text"
              placeholder={language === "de" ? "z.B. Material-Bez, ID" : "e.g. Spec, Order ID"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="filter-status"
              className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"
            >
              <Filter className="h-3 w-3 text-primary" />
              {language === "de" ? "Optimierungsstatus" : "Optimization Status"}
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="filter-status" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {language === "de" ? "Alle Planungszustände" : "All Statuses"}
                </SelectItem>
                <SelectItem value="PUSHED_FORWARD">
                  {language === "de" ? "Vorgezogen" : "Pushed Forward"}
                </SelectItem>
                <SelectItem value="ON_TIME">
                  {language === "de" ? "Pünktlich" : "On Time"}
                </SelectItem>
                <SelectItem value="DELAYED">
                  {language === "de" ? "Verzögert" : "Delayed"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="filter-machine-monthly"
              className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"
            >
              <Clock className="h-3 w-3 text-primary" />
              {language === "de" ? "Zugeordnete Maschine" : "Assigned Workstation"}
            </Label>
            <Select value={machineFilter} onValueChange={setMachineFilter}>
              <SelectTrigger id="filter-machine-monthly" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {language === "de" ? "Alle Maschinen" : "All Workstations"}
                </SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {getMachineDisplay(m.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="filter-strategy"
              className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"
            >
              <Zap className="h-3 w-3 text-primary" />
              {language === "de" ? "Angewandte Strategie" : "Strategy Applied"}
            </Label>
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger id="filter-strategy" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  {language === "de" ? "Alle Strategien" : "All Strategies"}
                </SelectItem>
                <SelectItem value="NON_OPTIMIZED">
                  {language === "de" ? "Nicht optimiert" : "Non-Optimized"}
                </SelectItem>
                <SelectItem value="OPTIMIZED">
                  {language === "de" ? "Optimiert" : "Optimized"}
                </SelectItem>
                <SelectItem value="SOP_OVERRIDE">
                  {language === "de"
                    ? "SOP Override (Vorgezogen)"
                    : "SOP Override (Pushed Forward)"}
                </SelectItem>
                <SelectItem value="GROUP_SHIFT">
                  {language === "de"
                    ? "Group Shift (Alt. Maschine)"
                    : "Group Shift (Alt. Workstation)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table content */}
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
                <th className="px-4 py-3">{language === "de" ? "Auftrag" : "Order"}</th>
                <th className="px-4 py-3">{language === "de" ? "Schritt" : "Step"}</th>
                <th className="px-4 py-3">
                  {language === "de" ? "Material / Vorgangstext" : "Material & Work description"}
                </th>
                <th className="px-4 py-3 border-l border-border bg-slate-500/[0.02]">
                  {language === "de" ? "Soll-Start (Planned SOP)" : "Soll-Start (Planned SOP)"}
                </th>
                <th className="px-4 py-3 bg-slate-500/[0.02]">
                  {language === "de" ? "Soll-Maschine" : "Soll-Machine"}
                </th>
                <th className="px-4 py-3 border-l border-border bg-primary/[0.01]">
                  {language === "de" ? "Optimiertes Ist-Start" : "Optimized Scheduled Start"}
                </th>
                <th className="px-4 py-3 bg-primary/[0.01]">
                  {language === "de" ? "Optimierte Maschine" : "Optimized Machine"}
                </th>
                <th className="px-4 py-3 border-l border-border text-center">
                  {language === "de" ? "Abweichung / Effekt" : "Deviation / Effect"}
                </th>
                <th className="px-4 py-3 border-l border-border">
                  {language === "de" ? "Ursache für Verzögerung" : "Delay Reason"}
                </th>
                <th className="px-4 py-3 border-l border-border text-center">
                  {language === "de" ? "Sichern" : "Pin/Lock"}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredComparisons.length > 0 ? (
                filteredComparisons.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border hover:bg-muted/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-foreground font-mono">{c.orderId}</td>
                    <td className="px-4 py-3 font-mono font-medium text-muted-foreground">
                      {c.processId}
                    </td>
                    <td className="px-4 py-3 max-w-[280px] truncate">
                      <div className="font-semibold text-foreground truncate">{c.material}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.processText}
                      </div>
                    </td>

                    {/* Planned SOP */}
                    <td className="px-4 py-3 font-mono border-l border-border bg-slate-500/[0.01] text-muted-foreground">
                      {c.plannedStart
                        ? c.plannedStart.toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold bg-slate-500/[0.01] text-muted-foreground">
                      {getMachineDisplay(c.originalMachineId)}
                    </td>

                    {/* Post-Optimized */}
                    <td className="px-4 py-3 font-mono border-l border-border bg-primary/[0.005] font-semibold text-foreground">
                      {c.scheduledStart
                        ? c.scheduledStart.toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "Unscheduled"}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 font-mono font-bold bg-primary/[0.005]",
                        c.hasMachineShift
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-500/[0.04]"
                          : "text-foreground",
                      )}
                    >
                      {getMachineDisplay(c.scheduledMachineId)}
                      {c.hasMachineShift && (
                        <span className="text-[9px] block text-muted-foreground font-normal">
                          {language === "de"
                            ? `(zuvor Maschine ${c.originalMachineId})`
                            : `(was Machine ${c.originalMachineId})`}
                        </span>
                      )}
                    </td>

                    {/* Status Deviation Badge */}
                    <td className="px-4 py-3 border-l border-border text-center font-mono align-middle">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase",
                            c.status === "PUSHED_FORWARD"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : c.status === "ON_TIME"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : c.status === "DELAYED"
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {c.status === "PUSHED_FORWARD" &&
                            (language === "de" ? "Vorgezogen" : "Pushed Forward")}
                          {c.status === "ON_TIME" && (language === "de" ? "Pünktlich" : "On Time")}
                          {c.status === "DELAYED" && (language === "de" ? "Verzögert" : "Delayed")}
                          {c.status === "PENDING" && (language === "de" ? "Ausstehend" : "Pending")}
                        </span>
                        {c.diffText && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {c.diffText}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 border-l border-border text-muted-foreground font-medium max-w-[200px] truncate"
                      title={c.delayReason || undefined}
                    >
                      {c.delayReason ? (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{c.delayReason}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-l border-border text-center align-middle font-mono">
                      {c.scheduledStart ? (
                        c.isManual ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              resetProcessToAuto(c.id);
                              toast.success(
                                language === "de" ? "Pin aufgehoben!" : "Schedule unpinned!",
                              );
                            }}
                            className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 p-1.5"
                            title={language === "de" ? "Pin aufheben" : "Unpin Schedule"}
                          >
                            <PinOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              pinProcessSchedule(c.id);
                              toast.success(
                                language === "de" ? "Planung gesichert!" : "Schedule pinned!",
                              );
                            }}
                            className="h-8 text-muted-foreground hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5"
                            title={language === "de" ? "Planung sichern" : "Pin Schedule"}
                          >
                            <Pin className="h-4 w-4" />
                          </Button>
                        )
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-muted-foreground font-medium bg-muted/10"
                  >
                    {language === "de"
                      ? "Keine vergleichenden Datensätze für die ausgewählten Filter gefunden."
                      : "No comparative scheduling logs found for the selected filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Daily Capacity & Holiday Edit Dialog */}
      <Dialog open={!!editingDay} onOpenChange={(open) => !open && setEditingDay(null)}>
        <DialogContent className="sm:max-w-[425px] font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              {language === "de" ? "Tageskapazität bearbeiten" : "Edit Daily Capacity"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "de"
                ? `Konfigurieren Sie die Ressourcen und den Status für den ${editingDay?.dayNum}. ${monthNames[currentMonth]} ${currentYear}.`
                : `Configure resource capacities and working status for ${monthNames[currentMonth]} ${editingDay?.dayNum}, ${currentYear}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 text-xs">
            {/* Holiday Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/80 p-3 bg-muted/10 shadow-sm">
              <div className="space-y-0.5">
                <Label
                  htmlFor="dialog-holiday"
                  className="text-xs font-bold text-foreground cursor-pointer"
                >
                  {language === "de" ? "Feiertag / Schließung" : "Holiday / Closure"}
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  {language === "de"
                    ? "Keine Fertigung an diesem Tag (Kapazitäten werden auf 0 gesetzt)."
                    : "No production on this day (capacities set to 0%)."}
                </p>
              </div>
              <input
                id="dialog-holiday"
                type="checkbox"
                checked={inputIsHoliday}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setInputIsHoliday(checked);
                  if (checked) {
                    setInputSetterCap(0);
                    setInputOperatorCap(0);
                  } else {
                    setInputSetterCap(globalSetterCapacity);
                    setInputOperatorCap(globalOperatorCapacity);
                  }
                }}
                className="rounded border-border text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
              />
            </div>

            {/* Setter Capacity */}
            <div
              className={cn(
                "space-y-2 transition-all duration-200",
                inputIsHoliday && "opacity-40 pointer-events-none",
              )}
            >
              <div className="flex justify-between items-center">
                <Label htmlFor="dialog-setter-slider" className="text-xs font-bold text-foreground">
                  {language === "de" ? "Rüsttechniker-Kapazität (%)" : "Setup Tech Capacity (%)"}
                </Label>
                <span className="font-mono font-bold text-primary">{inputSetterCap}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="dialog-setter-slider"
                  type="range"
                  min="0"
                  max="300"
                  step="10"
                  value={inputSetterCap}
                  disabled={inputIsHoliday}
                  onChange={(e) => setInputSetterCap(parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <Input
                  id="dialog-setter-input"
                  type="number"
                  min="0"
                  max="300"
                  step="10"
                  value={inputSetterCap}
                  disabled={inputIsHoliday}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setInputSetterCap(isNaN(val) ? 0 : Math.min(300, Math.max(0, val)));
                  }}
                  className="w-16 h-8 text-xs font-mono text-center"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {language === "de"
                  ? `Standardwert: ${globalSetterCapacity}% (100% entspricht 1 FTE)`
                  : `Default value: ${globalSetterCapacity}% (100% equals 1 FTE)`}
              </p>
            </div>

            {/* Operator Capacity */}
            <div
              className={cn(
                "space-y-2 transition-all duration-200",
                inputIsHoliday && "opacity-40 pointer-events-none",
              )}
            >
              <div className="flex justify-between items-center">
                <Label
                  htmlFor="dialog-operator-slider"
                  className="text-xs font-bold text-foreground"
                >
                  {language === "de" ? "Bediener-Kapazität (%)" : "Operator Capacity (%)"}
                </Label>
                <span className="font-mono font-bold text-primary">{inputOperatorCap}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="dialog-operator-slider"
                  type="range"
                  min="0"
                  max="600"
                  step="10"
                  value={inputOperatorCap}
                  disabled={inputIsHoliday}
                  onChange={(e) => setInputOperatorCap(parseInt(e.target.value, 10))}
                  className="flex-1 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <Input
                  id="dialog-operator-input"
                  type="number"
                  min="0"
                  max="600"
                  step="10"
                  value={inputOperatorCap}
                  disabled={inputIsHoliday}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setInputOperatorCap(isNaN(val) ? 0 : Math.min(600, Math.max(0, val)));
                  }}
                  className="w-16 h-8 text-xs font-mono text-center"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {language === "de"
                  ? `Standardwert: ${globalOperatorCapacity}% (100% entspricht 1 FTE)`
                  : `Default value: ${globalOperatorCapacity}% (100% equals 1 FTE)`}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setEditingDay(null)}>
              {language === "de" ? "Abbrechen" : "Cancel"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveDayConfig}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {language === "de" ? "Speichern" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
