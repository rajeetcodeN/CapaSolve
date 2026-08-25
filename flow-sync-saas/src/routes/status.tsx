import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import Papa from "papaparse";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  Search,
  Layers,
  Factory,
  BarChart3,
  Edit3,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  ListOrdered,
  ArrowRight,
  MoreVertical,
  GitBranch,
  Check,
  X
} from "lucide-react";
import { parseSOPDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Production Schedule & Shop Floor Status — CapaSolve" },
      { name: "description", content: "Production Schedule Calendar, Workstation Gantt Sequencer, and Shop Floor dispatch tracking." },
    ],
  }),
  component: ShopFloorStatusPage,
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getISOWeekNumber(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function ShopFloorStatusPage() {
  const { 
    orders, 
    processes, 
    machines, 
    updateStepExecutionStatus, 
    addWorkOrder
  } = useAppStore();
  const { language } = useTranslations();

  // View Mode: 'calendar' (Production Calendar) | 'gantt' (Gantt Sequencer + Table) | 'list' (Dispatch Table)
  const [viewMode, setViewMode] = useState<"calendar" | "gantt" | "list">("gantt");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("week");
  const [ganttZoom, setGanttZoom] = useState<"compact" | "normal" | "wide">("normal");

  // Date Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date(2026, 6, 27)); // Default July 27, 2026 (W31)
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Filter & Search states
  const [selectedMachine, setSelectedMachine] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states for New Order
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [newOrderId, setNewOrderId] = useState("");
  const [newStepId, setNewStepId] = useState("10");
  const [newMaterial, setNewMaterial] = useState("");
  const [newMachineId, setNewMachineId] = useState("");
  const [newSopDate, setNewSopDate] = useState("2026-07-27");
  const [newOrderQty, setNewOrderQty] = useState("500");
  const [newProcessText, setNewProcessText] = useState("");
  const [newSetupMins, setNewSetupMins] = useState("30");
  const [newProcessMins, setNewProcessMins] = useState("5");
  const [newManpower, setNewManpower] = useState("1");

  // Modal states for Work Done logging
  const [isLogWorkDoneOpen, setIsLogWorkDoneOpen] = useState(false);
  const [selectedProcessForLog, setSelectedProcessForLog] = useState<any>(null);
  const [logCompletedQty, setLogCompletedQty] = useState("0");
  const [logScrapQty, setLogScrapQty] = useState("0");
  const [logNotes, setLogNotes] = useState("");

  // File import ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Derive Workstation Subtitle map
  const machineSubtitleMap: Record<string, string> = {
    "L01": "Slicer / Prep",
    "L02": "Filling Line",
    "L05-LBL": "Labeling 114",
    "L04-OVEN": "Turbo Oven",
    "L03-PACK": "Wrapping 1st",
    "603012": "CNC 5-Axis Milling",
    "605001": "Precision Drilling",
    "603010": "High-Speed Milling",
    "603011": "Deburring & Polish",
  };

  // Group processes by orderId to compute full routing sequences
  const orderRoutingMap = useMemo(() => {
    const map = new Map<string, { step: number; machineId: string; text: string; status: string }[]>();
    processes.forEach((proc) => {
      const list = map.get(proc.orderId) || [];
      list.push({
        step: proc.processId,
        machineId: proc.machineId,
        text: proc.processText,
        status: proc.executionStatus || "PLANNED",
      });
      map.set(proc.orderId, list);
    });

    // Sort steps numerically
    map.forEach((list) => {
      list.sort((a, b) => a.step - b.step);
    });

    return map;
  }, [processes]);

  // Days list for current active view period (Week / Month / Day)
  const timelineDays = useMemo(() => {
    if (granularity === "day") {
      const d = new Date(currentDate);
      return [{
        dayNum: d.getDate(),
        dateStr: formatDateStr(d),
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        monthName: MONTH_NAMES_SHORT[d.getMonth()],
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: formatDateStr(d) === formatDateStr(new Date()),
        isNowCol: true,
      }];
    }

    if (granularity === "week") {
      // Find Monday of the current week
      const d = new Date(currentDate);
      const dayOfWeek = d.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);

      const days = [];
      for (let i = 0; i < 7; i++) {
        const cur = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        days.push({
          dayNum: cur.getDate(),
          dateStr: formatDateStr(cur),
          dayName: cur.toLocaleDateString("en-US", { weekday: "short" }),
          monthName: MONTH_NAMES_SHORT[cur.getMonth()],
          isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
          isToday: formatDateStr(cur) === formatDateStr(new Date()),
          isNowCol: i === 2, // Highlight mid-week Now line
        });
      }
      return days;
    }

    // Month mode
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      days.push({
        dayNum: d,
        dateStr: formatDateStr(dateObj),
        dayName: dateObj.toLocaleDateString("en-US", { weekday: "short" }),
        monthName: MONTH_NAMES_SHORT[dateObj.getMonth()],
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
        isToday: formatDateStr(dateObj) === formatDateStr(new Date()),
        isNowCol: d === 29,
      });
    }
    return days;
  }, [currentDate, granularity, currentYear, currentMonth]);

  // Week header label (e.g. "W31: 27 Jul - 2 Aug")
  const periodLabel = useMemo(() => {
    if (timelineDays.length === 0) return "";
    const first = timelineDays[0];
    const last = timelineDays[timelineDays.length - 1];
    const weekNo = getISOWeekNumber(currentDate);

    if (granularity === "day") {
      return `${first.dayNum} ${first.monthName} ${currentYear}`;
    }
    if (granularity === "month") {
      return `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    }
    return `W${weekNo}: ${first.dayNum} ${first.monthName} - ${last.dayNum} ${last.monthName}`;
  }, [timelineDays, currentDate, granularity, currentMonth, currentYear]);

  // Enriched processes with order & workstation metadata + multi-day workload distribution
  const enrichedProcesses = useMemo(() => {
    const machineDayOffsetMap = new Map<string, number>();

    return processes.map((proc) => {
      const parentOrder = orders.find((o) => o.orderId === proc.orderId || o.id === proc.orderId);
      const machine = machines.find((m) => m.id === proc.machineId);
      const executionStatus = proc.executionStatus || (proc.status === "SCHEDULED" ? "PLANNED" : "PLANNED");
      const completedQty = proc.completedQty || 0;
      const orderQty = parentOrder?.orderQty || proc.baseQty * 100 || 500;
      const completionPct = Math.min(100, Math.round((completedQty / orderQty) * 100));

      // Calculate realistic distributed dates across the timeline days
      const currentOffset = machineDayOffsetMap.get(proc.machineId) || 0;
      const dayIndex = currentOffset % Math.max(1, timelineDays.length - 1);
      
      const durationDays = proc.totalTimeMin > 600 ? 2 : 1;
      machineDayOffsetMap.set(proc.machineId, currentOffset + durationDays);

      const baseDate = timelineDays[dayIndex] || timelineDays[0];
      const endDayIndex = Math.min(timelineDays.length - 1, dayIndex + durationDays - 1);
      const endBaseDate = timelineDays[endDayIndex] || baseDate;

      const plannedStart = proc.scheduledStart 
        ? new Date(proc.scheduledStart) 
        : new Date(`${baseDate.dateStr}T08:00:00`);
      
      const plannedEnd = proc.scheduledEnd 
        ? new Date(proc.scheduledEnd) 
        : new Date(`${endBaseDate.dateStr}T17:00:00`);

      // Routing steps for this order
      const routing = orderRoutingMap.get(proc.orderId) || [
        { step: proc.processId, machineId: proc.machineId, text: proc.processText, status: executionStatus }
      ];

      // Priority derivation
      let priority: "High" | "Med" | "Low" = "Med";
      if (orderQty >= 800 || executionStatus === "DELAYED") {
        priority = "High";
      } else if (orderQty <= 400 || executionStatus === "COMPLETED") {
        priority = "Low";
      }

      const displayWO = proc.orderId.startsWith("WO-") ? proc.orderId : `WO-${proc.orderId}`;
      const subtitle = machineSubtitleMap[proc.machineId] || machine?.machineGroupId || "Workstation";

      return {
        ...proc,
        displayWO,
        material: parentOrder?.material || "MAT-STANDARD-SKU",
        orderQty,
        sopStartDate: parentOrder?.sopStartDate || baseDate.dateStr,
        machineName: machine?.name || proc.machineId,
        machineSubtitle: subtitle,
        executionStatus,
        completedQty,
        scrapQty: proc.scrapQty || 0,
        completionPct,
        scheduledStart: plannedStart,
        scheduledEnd: plannedEnd,
        dayIndex,
        durationDays,
        routing,
        priority,
      };
    });
  }, [processes, orders, machines, orderRoutingMap, timelineDays]);

  // Unique list of machines
  const uniqueMachines = useMemo(() => {
    const list: { id: string; name: string; subtitle: string }[] = [];
    const seen = new Set<string>();

    enrichedProcesses.forEach((p) => {
      if (!seen.has(p.machineId)) {
        seen.add(p.machineId);
        list.push({
          id: p.machineId,
          name: p.machineName,
          subtitle: p.machineSubtitle,
        });
      }
    });

    machines.forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push({
          id: m.id,
          name: m.name,
          subtitle: machineSubtitleMap[m.id] || m.machineGroupId,
        });
      }
    });

    if (list.length === 0) {
      return [
        { id: "L01", name: "L01", subtitle: "Slicer / Prep" },
        { id: "L02", name: "L02", subtitle: "Filling Line" },
        { id: "L05-LBL", name: "L05-LBL", subtitle: "Labeling 114" },
        { id: "L04-OVEN", name: "L04-OVEN", subtitle: "Turbo Oven" },
        { id: "L03-PACK", name: "L03-PACK", subtitle: "Wrapping 1st" },
      ];
    }

    return list;
  }, [enrichedProcesses, machines]);

  // Filtered processes
  const filteredProcesses = useMemo(() => {
    return enrichedProcesses.filter((proc) => {
      if (selectedMachine !== "ALL" && proc.machineId !== selectedMachine && proc.machineName !== selectedMachine) {
        return false;
      }
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "QUEUED" && (proc.executionStatus !== "PLANNED" || proc.completionPct > 0)) {
          return false;
        }
        if (selectedStatus === "HOLD" && proc.executionStatus !== "PAUSED") {
          return false;
        }
        if (selectedStatus === "RELEASED" && proc.executionStatus !== "PLANNED") {
          return false;
        }
        if (selectedStatus === "RUNNING" && proc.executionStatus !== "IN_PROGRESS") {
          return false;
        }
        if (selectedStatus === "DONE" && proc.executionStatus !== "COMPLETED") {
          return false;
        }
        if (selectedStatus === "DELAYED" && proc.executionStatus !== "DELAYED") {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesOrder = proc.displayWO.toLowerCase().includes(query) || proc.orderId.toLowerCase().includes(query);
        const matchesMaterial = proc.material.toLowerCase().includes(query);
        const matchesText = proc.processText.toLowerCase().includes(query);
        const matchesMachine = proc.machineName.toLowerCase().includes(query) || proc.machineSubtitle.toLowerCase().includes(query);
        if (!matchesOrder && !matchesMaterial && !matchesText && !matchesMachine) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedProcesses, selectedMachine, selectedStatus, searchQuery]);

  // Aggregate Stats (Neutral KPIs without distracting colors)
  const stats = useMemo(() => {
    const total = enrichedProcesses.length;
    const running = enrichedProcesses.filter((p) => p.executionStatus === "IN_PROGRESS").length;
    const done = enrichedProcesses.filter((p) => p.executionStatus === "COMPLETED").length;
    const hold = enrichedProcesses.filter((p) => p.executionStatus === "PAUSED").length;
    const delayed = enrichedProcesses.filter((p) => p.executionStatus === "DELAYED").length;
    const released = enrichedProcesses.filter((p) => p.executionStatus === "PLANNED" && p.completedQty === 0).length;
    const queued = enrichedProcesses.filter((p) => p.executionStatus === "PLANNED" || p.status === "UNSCHEDULED").length;

    const totalTargetUnits = enrichedProcesses.reduce((acc, p) => acc + p.orderQty, 0);
    const totalDoneUnits = enrichedProcesses.reduce((acc, p) => acc + p.completedQty, 0);

    return { total, running, done, hold, delayed, released, queued, totalTargetUnits, totalDoneUnits };
  }, [enrichedProcesses]);

  // Gantt column width in pixels based on zoom level & granularity
  const ganttColWidthPx = useMemo(() => {
    if (granularity === "week") {
      switch (ganttZoom) {
        case "compact": return 120;
        case "wide": return 190;
        default: return 150;
      }
    }
    switch (ganttZoom) {
      case "compact": return 45;
      case "wide": return 95;
      default: return 68;
    }
  }, [ganttZoom, granularity]);

  // Navigation handlers
  const handlePrevPeriod = () => {
    if (granularity === "day") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
    } else if (granularity === "week") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  };

  const handleNextPeriod = () => {
    if (granularity === "day") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    } else if (granularity === "week") {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  };

  const handleThisWeek = () => {
    setCurrentDate(new Date(2026, 6, 27));
  };

  // Monthly Calendar Matrix calculation
  const calendarDays = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay();
    const offset = firstDayIdx === 0 ? 6 : firstDayIdx - 1;

    const list = [];
    for (let i = 0; i < offset; i++) {
      list.push({ dayStr: "", dayNum: 0, isPadding: true, dayProcs: [] });
    }

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dStr = formatDateStr(d);

      const dayProcs = filteredProcesses.filter((proc) => {
        if (!proc.scheduledStart) return false;
        const startStr = formatDateStr(proc.scheduledStart);
        const endStr = proc.scheduledEnd ? formatDateStr(proc.scheduledEnd) : startStr;
        return dStr >= startStr && dStr <= endStr;
      });

      list.push({
        dayStr: dStr,
        dayNum: i,
        isPadding: false,
        dayProcs,
      });
    }

    return list;
  }, [currentYear, currentMonth, filteredProcesses]);

  // Handle Add Work Order Submit
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderId.trim()) {
      toast.error("Order ID is required.");
      return;
    }
    if (!newMaterial.trim()) {
      toast.error("Material / SKU is required.");
      return;
    }

    const targetMachine = newMachineId || uniqueMachines[0]?.id || "L01";

    addWorkOrder({
      orderId: newOrderId.trim(),
      processId: Number(newStepId) || 10,
      material: newMaterial.trim(),
      machineId: targetMachine,
      sopStartDate: newSopDate,
      orderQty: Number(newOrderQty) || 500,
      processText: newProcessText.trim() || "MANUFACTURING PASS",
      setupTimeMin: Number(newSetupMins) || 30,
      processTimeMin: Number(newProcessMins) || 5,
      manpowerUtilizationMin: Number(newManpower) || 1,
    });

    toast.success(`Work Order ${newOrderId} added successfully!`);
    setIsAddOrderOpen(false);
    setNewOrderId("");
    setNewMaterial("");
    setNewProcessText("");
  };

  // Open Work Done Logger Modal
  const handleOpenLogModal = (proc: any) => {
    setSelectedProcessForLog(proc);
    setLogCompletedQty(String(proc.completedQty || 0));
    setLogScrapQty(String(proc.scrapQty || 0));
    setLogNotes(proc.operatorNotes || "");
    setIsLogWorkDoneOpen(true);
  };

  // Save Work Done Log
  const handleSaveWorkDone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcessForLog) return;

    const completed = Number(logCompletedQty) || 0;
    const scrap = Number(logScrapQty) || 0;

    let newStatus = selectedProcessForLog.executionStatus;
    if (completed >= selectedProcessForLog.orderQty) {
      newStatus = "COMPLETED";
    } else if (completed > 0 && (newStatus === "PLANNED" || newStatus === "QUEUED")) {
      newStatus = "IN_PROGRESS";
    }

    updateStepExecutionStatus(
      selectedProcessForLog.id,
      newStatus,
      completed,
      scrap,
      logNotes
    );

    toast.success(`Progress saved for ${selectedProcessForLog.displayWO}!`);
    setIsLogWorkDoneOpen(false);
    setSelectedProcessForLog(null);
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (enrichedProcesses.length === 0) {
      toast.error("No schedule data available to export.");
      return;
    }

    const exportRows = enrichedProcesses.map((p) => ({
      "Work Order": p.displayWO,
      "Material / SKU": p.material,
      "Step": p.processId,
      "Operation": p.processText,
      "Workstation ID": p.machineId,
      "Workstation Name": p.machineName,
      "Order Qty": p.orderQty,
      "Completed Qty": p.completedQty,
      "Scrap Qty": p.scrapQty,
      "Progress Pct": `${p.completionPct}%`,
      "Setup Time (min)": p.setupTimeMin,
      "Process Time (min)": p.processTimeMin,
      "Status": p.executionStatus,
      "Planned Start": p.scheduledStart ? p.scheduledStart.toISOString() : "N/A",
      "Planned End": p.scheduledEnd ? p.scheduledEnd.toISOString() : "N/A",
      "Due Date": p.sopStartDate,
    }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `CapaSolve_Schedule_${formatDateStr(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Schedule exported successfully to CSV!");
  };

  // CSV Import Trigger
  const handleTriggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          toast.success(`Imported ${results.data.length} rows successfully!`);
        } catch (err) {
          toast.error("Failed to parse CSV file format.");
        }
      },
      error: () => toast.error("Error reading file."),
    });
  };

  // Priority badge styling (Restrained, subtle corporate badges)
  const renderPriorityBadge = (priority: "High" | "Med" | "Low") => {
    switch (priority) {
      case "High":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/60">High</span>;
      case "Med":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60">Med</span>;
      case "Low":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Low</span>;
    }
  };

  // Status badge styling (Clear operational colors: Running=Green, Released=Blue, Hold=Orange, Done=Dark Gray, Behind=Red)
  const renderStatusBadge = (status: string, completionPct: number) => {
    if (status === "COMPLETED" || completionPct >= 100) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
          <Check className="h-3 w-3 text-slate-600 dark:text-slate-400" />
          Done
        </span>
      );
    }
    if (status === "IN_PROGRESS") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white shadow-2xs">
          <Play className="h-2.5 w-2.5 fill-current" />
          Running
        </span>
      );
    }
    if (status === "PAUSED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-500 text-white shadow-2xs">
          <PauseCircle className="h-3 w-3" />
          Hold
        </span>
      );
    }
    if (status === "DELAYED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-rose-600 text-white shadow-2xs">
          <AlertTriangle className="h-3 w-3" />
          Behind
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-600 text-white shadow-2xs">
        <Clock className="h-3 w-3" />
        Released
      </span>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200 max-w-[1700px] mx-auto pb-12 text-slate-900 dark:text-slate-100 font-sans">
      {/* Hidden File Input for CSV Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv"
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & MAIN ACTION BAR (MATCHING REFERENCE IMAGE 1 & 2)           */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span className="cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
              Scheduling
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Scheduling
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sequence work orders, balance lines, run what-ifs
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Import CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerImport}
            className="h-8 px-3 text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs rounded-lg cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" />
            Import CSV
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 px-3 text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs rounded-lg cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </Button>

          {/* Add Work Order (Primary Blue Action) */}
          <Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-3.5 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs rounded-lg cursor-pointer transition-all"
              >
                <Plus className="h-4 w-4" />
                Add work order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Plus className="h-4 w-4 text-blue-600" />
                  Add New Work Order & Operation
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateOrder} className="space-y-4 pt-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-order-id" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Work Order ID *</Label>
                    <Input
                      id="new-order-id"
                      value={newOrderId}
                      onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="e.g. WO-2826-9420"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-step-id" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Step No (Vorgang) *</Label>
                    <Input
                      id="new-step-id"
                      type="number"
                      value={newStepId}
                      onChange={(e) => setNewStepId(e.target.value)}
                      placeholder="10, 20, 30"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-material" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Material / SKU / Product *</Label>
                  <Input
                    id="new-material"
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    placeholder="e.g. Basil Carbonara 350g"
                    className="h-9 text-xs bg-white dark:bg-slate-900"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-machine" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Assigned Workstation *</Label>
                    <select
                      id="new-machine"
                      value={newMachineId}
                      onChange={(e) => setNewMachineId(e.target.value)}
                      className="w-full h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 text-xs focus:ring-1 focus:ring-blue-600"
                    >
                      {uniqueMachines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.subtitle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-sop-date" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target SOP Date *</Label>
                    <Input
                      id="new-sop-date"
                      type="date"
                      value={newSopDate}
                      onChange={(e) => setNewSopDate(e.target.value)}
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-qty" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Order Quantity (Units) *</Label>
                    <Input
                      id="new-qty"
                      type="number"
                      value={newOrderQty}
                      onChange={(e) => setNewOrderQty(e.target.value)}
                      placeholder="500"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-setup" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Setup Time (Mins)</Label>
                    <Input
                      id="new-setup"
                      type="number"
                      value={newSetupMins}
                      onChange={(e) => setNewSetupMins(e.target.value)}
                      placeholder="30"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-process-mins" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Process Time / Unit (Mins)</Label>
                    <Input
                      id="new-process-mins"
                      type="number"
                      value={newProcessMins}
                      onChange={(e) => setNewProcessMins(e.target.value)}
                      placeholder="5.0"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-manpower" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Operators Needed</Label>
                    <Input
                      id="new-manpower"
                      type="number"
                      value={newManpower}
                      onChange={(e) => setNewManpower(e.target.value)}
                      placeholder="1"
                      className="h-9 text-xs bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-text" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Operation Description</Label>
                  <Input
                    id="new-text"
                    value={newProcessText}
                    onChange={(e) => setNewProcessText(e.target.value)}
                    placeholder="e.g. MIXING & PREPARATION PASS"
                    className="h-9 text-xs bg-white dark:bg-slate-900"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOrderOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                    Save Work Order
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RESTRAINED TOP SEGMENTED VIEW SWITCHER (IMAGE 1 & SPEC)                */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/80 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1">
          {/* Segmented Pill 1: Production Schedule */}
          <button
            onClick={() => setViewMode("calendar")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
              viewMode === "calendar"
                ? "bg-blue-600 text-white shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Production Schedule
          </button>

          {/* Segmented Pill 2: Gantt Chart */}
          <button
            onClick={() => setViewMode("gantt")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
              viewMode === "gantt"
                ? "bg-blue-600 text-white shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Gantt Chart
          </button>

          {/* Segmented Pill 3: Dispatch List */}
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
              viewMode === "list"
                ? "bg-blue-600 text-white shadow-2xs font-bold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
            )}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Dispatch List
          </button>
        </div>

        {/* Quick Links: What-if Sandbox & Workcenters */}
        <div className="flex items-center gap-2 pr-1 text-xs">
          <Link
            to="/sandbox"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5 text-slate-400" />
            <span>What-If Sandbox</span>
          </Link>
          <Link
            to="/machines"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Factory className="h-3.5 w-3.5 text-slate-400" />
            <span>Workcenters</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONTROL & FILTER STRIP (MATCHING REFERENCE IMAGE 2)                    */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        {/* Left Section: Granularity & Period Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day / Week / Month Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-medium">
            <button
              onClick={() => setGranularity("day")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors cursor-pointer",
                granularity === "day"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Day
            </button>
            <button
              onClick={() => setGranularity("week")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors cursor-pointer",
                granularity === "week"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setGranularity("month")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors cursor-pointer",
                granularity === "month"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              Month
            </button>
          </div>

          {/* Navigation: [<] [This week] [>] */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevPeriod}
              className="h-6 w-6 p-0 hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleThisWeek}
              className="h-6 px-2 text-xs font-medium hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer flex items-center gap-1 text-slate-700 dark:text-slate-200"
            >
              <CalendarIcon className="h-3 w-3 text-slate-400" />
              <span>This week</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextPeriod}
              className="h-6 w-6 p-0 hover:bg-white dark:hover:bg-slate-700 rounded-md cursor-pointer text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Current Period Badge */}
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 px-2 py-1 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200 dark:border-slate-700">
            {periodLabel}
          </div>
        </div>

        {/* Middle Section: Status Filter Chips with Operational Colors when Active */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedStatus(selectedStatus === "QUEUED" ? "ALL" : "QUEUED")}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
              selectedStatus === "QUEUED"
                ? "bg-slate-800 text-white border-slate-900 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            )}
          >
            <span>Queued</span>
            <span className="text-[10px] opacity-70 font-mono">{stats.queued}</span>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === "HOLD" ? "ALL" : "HOLD")}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
              selectedStatus === "HOLD"
                ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            )}
          >
            <span>Hold</span>
            <span className="text-[10px] opacity-70 font-mono">{stats.hold}</span>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === "RELEASED" ? "ALL" : "RELEASED")}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
              selectedStatus === "RELEASED"
                ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            )}
          >
            <span>Released</span>
            <span className="text-[10px] opacity-70 font-mono">{stats.released}</span>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === "RUNNING" ? "ALL" : "RUNNING")}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
              selectedStatus === "RUNNING"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            )}
          >
            <span>Running</span>
            <span className="text-[10px] opacity-70 font-mono">{stats.running}</span>
          </button>

          <button
            onClick={() => setSelectedStatus(selectedStatus === "DONE" ? "ALL" : "DONE")}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
              selectedStatus === "DONE"
                ? "bg-slate-800 text-white border-slate-900 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
            )}
          >
            <span>Done</span>
            <span className="text-[10px] opacity-70 font-mono">{stats.done}</span>
          </button>
        </div>

        {/* Right Section: Workstation Select & Search Input */}
        <div className="flex items-center gap-2">
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 text-xs text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-blue-600 min-w-[130px]"
          >
            <option value="ALL">All resources</option>
            {uniqueMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.subtitle}
              </option>
            ))}
          </select>

          <div className="relative w-44 sm:w-52">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search WO or item..."
              className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. RESTRAINED NEUTRAL KPI CARDS (NO COMPETING RAINBOWS)                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Orders</span>
            <Layers className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">{stats.total}</p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-medium">
            <span>Running</span>
            <Play className="h-3 w-3 fill-current text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">{stats.running}</p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-medium">
            <span>Done</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">{stats.done}</p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-medium">
            <span>Hold</span>
            <PauseCircle className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">{stats.hold}</p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 text-xs font-medium">
            <span>Behind Sched.</span>
            <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">{stats.delayed}</p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Units Done</span>
            <Factory className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">
            {stats.totalDoneUnits.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">/ {stats.totalTargetUnits.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MAIN CONTENT: GANTT SEQUENCER TIMELINE & WORK ORDERS TABLE             */}
      {/* ========================================================================= */}
      {viewMode === "gantt" ? (
        <div className="space-y-4">
          {/* A. WORKSTATION GANTT TIMELINE */}
          <div className="border border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
            {/* Timeline Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-row items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Timeline</h3>
                <p className="text-xs text-slate-500 font-mono">{periodLabel}</p>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 text-xs font-medium">
                  <button
                    onClick={() => setGanttZoom("compact")}
                    className={cn("px-2 py-0.5 rounded transition-colors cursor-pointer", ganttZoom === "compact" ? "bg-slate-900 text-white dark:bg-slate-700 font-semibold" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                  >
                    Compact
                  </button>
                  <button
                    onClick={() => setGanttZoom("normal")}
                    className={cn("px-2 py-0.5 rounded transition-colors cursor-pointer", ganttZoom === "normal" ? "bg-slate-900 text-white dark:bg-slate-700 font-semibold" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                  >
                    100%
                  </button>
                  <button
                    onClick={() => setGanttZoom("wide")}
                    className={cn("px-2 py-0.5 rounded transition-colors cursor-pointer", ganttZoom === "wide" ? "bg-slate-900 text-white dark:bg-slate-700 font-semibold" : "text-slate-500 hover:text-slate-900 dark:hover:text-white")}
                  >
                    Wide
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline Swimlane Grid */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: `${200 + timelineDays.length * ganttColWidthPx}px` }}>
                {/* Timeline Days Header Row */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/80 text-xs font-semibold text-slate-500 sticky top-0 z-20">
                  <div className="w-52 shrink-0 p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 sticky left-0 z-30 font-semibold uppercase tracking-wider text-[10px] text-slate-500">
                    Resource
                  </div>

                  <div className="flex-1 flex">
                    {timelineDays.map((day) => (
                      <div
                        key={day.dateStr}
                        style={{ width: `${ganttColWidthPx}px` }}
                        className={cn(
                          "shrink-0 p-2 border-r border-slate-200/70 dark:border-slate-800/70 text-center flex flex-col justify-center select-none relative",
                          day.isWeekend ? "bg-slate-100/40 dark:bg-slate-950/40 text-slate-400" : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        <span className="text-xs font-semibold">
                          {day.dayNum} {day.monthName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Swimlane Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {uniqueMachines.map((machine, mIdx) => {
                    const machineProcs = filteredProcesses.filter(
                      (p) => p.machineId === machine.id || p.machineName === machine.name
                    );

                    // Group processes into non-overlapping horizontal tracks on this machine swimlane
                    const tracks: any[][] = [];
                    machineProcs.forEach((proc) => {
                      const procStartCol = proc.dayIndex !== undefined ? proc.dayIndex : 0;
                      const procEndCol = procStartCol + (proc.durationDays || 1) - 1;

                      let placed = false;
                      for (let t = 0; t < tracks.length; t++) {
                        const hasOverlap = tracks[t].some((p) => {
                          const pStart = p.dayIndex !== undefined ? p.dayIndex : 0;
                          const pEnd = pStart + (p.durationDays || 1) - 1;
                          return !(procEndCol < pStart || procStartCol > pEnd);
                        });
                        if (!hasOverlap) {
                          tracks[t].push(proc);
                          placed = true;
                          break;
                        }
                      }
                      if (!placed) {
                        tracks.push([proc]);
                      }
                    });

                    if (tracks.length === 0) tracks.push([]);

                    return (
                      <div key={machine.id} className={cn("flex transition-colors", mIdx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/30 dark:bg-slate-900/30")}>
                        {/* Workstation Swimlane Title */}
                        <div className="w-52 shrink-0 p-3 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-10 flex flex-col justify-center">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">{machine.name}</span>
                          <span className="text-[11px] text-slate-500 truncate mt-0.5">{machine.subtitle}</span>
                        </div>

                        {/* Tracks Area: The Gantt carries the key operational status colors */}
                        <div className="flex-1 flex flex-col divide-y divide-slate-100 dark:divide-slate-800/40 relative">
                          {tracks.map((trackProcs, tIdx) => (
                            <div key={tIdx} className="h-14 flex relative items-center">
                              {/* Vertical Grid Day Guides */}
                              <div className="absolute inset-0 flex pointer-events-none">
                                {timelineDays.map((day, dIdx) => (
                                  <div
                                    key={day.dateStr}
                                    style={{ width: `${ganttColWidthPx}px` }}
                                    className={cn(
                                      "shrink-0 border-r border-slate-200/40 dark:border-slate-800/40 h-full relative",
                                      day.isWeekend && "bg-slate-50/60 dark:bg-slate-950/20"
                                    )}
                                  >
                                    {/* Dashed Now Line Indicator on the middle column */}
                                    {day.isNowCol && (
                                      <div className="absolute top-0 bottom-0 right-0 border-r-2 border-dashed border-emerald-500/70 z-10" />
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* Positioned Process Gantt Pills */}
                              {trackProcs.map((proc) => {
                                const colStart = proc.dayIndex !== undefined ? proc.dayIndex : 0;
                                const colSpan = proc.durationDays || 1;

                                const leftPx = colStart * ganttColWidthPx + 4;
                                const widthPx = Math.max(ganttColWidthPx - 8, colSpan * ganttColWidthPx - 8);

                                // Operational colors strictly following the recommended approach:
                                // Running: Green
                                // Released: Blue
                                // Hold: Orange/Yellow
                                // Done: Dark Gray
                                // Behind schedule: Red/Pink
                                // Everything else: Neutral Gray
                                let barBgClass = "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
                                if (proc.executionStatus === "IN_PROGRESS") {
                                  barBgClass = "bg-emerald-600 text-white border-emerald-700 font-semibold shadow-xs";
                                } else if (proc.executionStatus === "COMPLETED" || proc.completionPct >= 100) {
                                  barBgClass = "bg-slate-700 text-white border-slate-800 font-medium";
                                } else if (proc.executionStatus === "DELAYED") {
                                  barBgClass = "bg-rose-600 text-white border-rose-700 font-semibold shadow-xs";
                                } else if (proc.executionStatus === "PAUSED") {
                                  barBgClass = "bg-amber-500 text-white border-amber-600 font-semibold shadow-xs";
                                } else if (proc.executionStatus === "PLANNED" && proc.status === "SCHEDULED") {
                                  barBgClass = "bg-blue-600 text-white border-blue-700 font-semibold shadow-xs";
                                }

                                return (
                                  <div
                                    key={proc.id}
                                    onClick={() => handleOpenLogModal(proc)}
                                    style={{
                                      left: `${leftPx}px`,
                                      width: `${widthPx}px`,
                                    }}
                                    className={cn(
                                      "absolute h-10 rounded-md border text-xs cursor-pointer transition-all hover:scale-[1.01] hover:shadow-sm z-10 px-2.5 py-1 flex flex-col justify-between overflow-hidden group select-none shadow-2xs",
                                      barBgClass
                                    )}
                                    title={`${proc.displayWO} - ${proc.material} (${proc.processText})`}
                                  >
                                    {/* Progress bar overlay on bottom */}
                                    {proc.executionStatus !== "IN_PROGRESS" && proc.executionStatus !== "COMPLETED" && (
                                      <div
                                        className="absolute bottom-0 left-0 h-0.5 bg-white/70 transition-all"
                                        style={{ width: `${proc.completionPct}%` }}
                                      />
                                    )}

                                    <div className="font-semibold text-[11px] truncate flex items-center justify-between">
                                      <span className="truncate">{proc.material}</span>
                                      <span className="text-[10px] opacity-90 font-mono ml-1 shrink-0">{proc.orderQty}</span>
                                    </div>

                                    <div className="text-[9.5px] opacity-80 truncate font-mono">
                                      {proc.displayWO}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Timeline Bottom Legend */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center flex-wrap gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                <span>Running</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span>Released</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Hold</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span>Queued</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-700 dark:bg-slate-300" />
                <span>Done</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                <span>Behind schedule</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
                <span className="border-r-2 border-dashed border-emerald-500 h-3 inline-block" />
                <span>Now line</span>
              </div>
            </div>
          </div>

          {/* B. INTEGRATED SHOP FLOOR WORK ORDERS TABLE */}
          <div className="border border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Work Orders & Shop Floor Status</h3>
                <p className="text-xs text-slate-500">Real-time routing flow, progress tracking, and execution status</p>
              </div>
              <div className="text-xs font-mono text-slate-500">
                {filteredProcesses.length} Operations
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/90 dark:bg-slate-900/80 text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">WO</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Item</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Resource</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Routing</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">Qty</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 min-w-[130px]">Progress</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Planned</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Due</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">Priority</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">Status</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProcesses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-slate-500 text-xs">
                        No work orders found matching the filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProcesses.map((proc) => {
                      const startStr = proc.scheduledStart
                        ? `${proc.scheduledStart.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledStart.getMonth()]} 08:00`
                        : "27 Jul 08:00";
                      const endStr = proc.scheduledEnd
                        ? `${proc.scheduledEnd.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledEnd.getMonth()]} 17:00`
                        : "27 Jul 18:00";

                      return (
                        <TableRow key={proc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors text-xs border-b border-slate-100 dark:border-slate-800/60">
                          {/* WO Column */}
                          <TableCell className="font-semibold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {proc.displayWO}
                          </TableCell>

                          {/* Item Column */}
                          <TableCell className="font-medium text-slate-900 dark:text-white max-w-[180px] truncate">
                            {proc.material}
                          </TableCell>

                          {/* Resource Column */}
                          <TableCell>
                            <span className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">
                              {proc.machineId}
                            </span>
                          </TableCell>

                          {/* Routing Breadcrumb Sequence */}
                          <TableCell>
                            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 flex-wrap">
                              {proc.routing.map((r, rIdx) => (
                                <div key={rIdx} className="flex items-center gap-1">
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded",
                                    r.machineId === proc.machineId
                                      ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                  )}>
                                    {r.machineId}
                                  </span>
                                  {rIdx < proc.routing.length - 1 && (
                                    <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>

                          {/* Qty Column */}
                          <TableCell className="text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {proc.orderQty.toLocaleString()}
                          </TableCell>

                          {/* Progress Bar + Pct */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full transition-all duration-200",
                                    proc.completionPct >= 100
                                      ? "bg-emerald-500"
                                      : proc.completionPct > 0
                                      ? "bg-blue-600"
                                      : "bg-slate-300 dark:bg-slate-700"
                                  )}
                                  style={{ width: `${proc.completionPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 w-8 text-right font-medium">
                                {proc.completionPct}%
                              </span>
                            </div>
                          </TableCell>

                          {/* Planned Start / End Range */}
                          <TableCell className="font-mono text-[11px] whitespace-nowrap text-slate-500">
                            <div>{startStr}</div>
                            <div className="text-slate-700 dark:text-slate-300">{endStr}</div>
                          </TableCell>

                          {/* Due Date */}
                          <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            {proc.sopStartDate}
                          </TableCell>

                          {/* Priority Badge */}
                          <TableCell className="text-center">
                            {renderPriorityBadge(proc.priority)}
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="cursor-pointer outline-none">
                                {renderStatusBadge(proc.executionStatus, proc.completionPct)}
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs">
                                <DropdownMenuItem onClick={() => updateStepExecutionStatus(proc.id, "PLANNED")}>
                                  Mark as Released (Blue)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStepExecutionStatus(proc.id, "IN_PROGRESS")}>
                                  Mark as Running (Green)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStepExecutionStatus(proc.id, "PAUSED")}>
                                  Mark as Hold (Orange)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStepExecutionStatus(proc.id, "COMPLETED")}>
                                  Mark as Done (Dark Gray)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateStepExecutionStatus(proc.id, "DELAYED")}>
                                  Mark as Behind Schedule (Red)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenLogModal(proc)}
                              className="h-7 w-7 p-0 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              title="Log progress & details"
                            >
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : viewMode === "calendar" ? (
        /* ========================================================================= */
        /* 6. VIEW: PRODUCTION SCHEDULE CALENDAR                                      */
        /* ========================================================================= */
        <div className="border border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-4 bg-slate-50/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Production Schedule Calendar</span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-xs font-medium">
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold rounded">Manufacturing Orders</span>
                <span className="px-2 py-0.5 text-slate-500">Operations</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handlePrevPeriod}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-semibold uppercase font-mono tracking-wider px-2">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleNextPeriod}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("gantt")}
                className="h-8 text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                Gantt chart
              </Button>
            </div>
          </div>

          <div className="pt-4 px-4 pb-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>

            <div className="grid grid-cols-7 gap-2 text-xs">
              {calendarDays.map((cd, idx) => {
                if (cd.isPadding) {
                  return <div key={idx} className="min-h-[130px] bg-slate-50/40 dark:bg-slate-950/20 rounded-lg border border-dashed border-slate-200/60 dark:border-slate-800/60" />;
                }

                const dayProcsList = cd.dayProcs || [];

                return (
                  <div
                    key={idx}
                    className="min-h-[130px] rounded-lg p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:border-blue-500/50 transition-colors shadow-2xs"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/70 pb-1 mb-1">
                      <span className="font-semibold text-xs font-mono text-slate-700 dark:text-slate-300">{cd.dayNum}</span>
                      {dayProcsList.length > 0 && (
                        <span className="text-[10px] font-medium font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                          {dayProcsList.length} Jobs
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[100px]">
                      {dayProcsList.map((proc: any) => {
                        let barBg = "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
                        if (proc.executionStatus === "IN_PROGRESS") barBg = "bg-emerald-600 text-white font-semibold";
                        else if (proc.executionStatus === "COMPLETED") barBg = "bg-slate-700 text-white font-medium";
                        else if (proc.executionStatus === "PAUSED") barBg = "bg-amber-500 text-white font-medium";
                        else if (proc.executionStatus === "DELAYED") barBg = "bg-rose-600 text-white font-medium";
                        else if (proc.executionStatus === "PLANNED") barBg = "bg-blue-600 text-white font-medium";

                        return (
                          <div
                            key={proc.id}
                            onClick={() => handleOpenLogModal(proc)}
                            className={cn(
                              "p-1.5 rounded border text-[10px] cursor-pointer transition-all hover:scale-[1.01] shadow-2xs group relative overflow-hidden",
                              barBg
                            )}
                            title={`${proc.displayWO} - ${proc.material}`}
                          >
                            <div className="font-semibold font-mono flex items-center justify-between text-[9.5px]">
                              <span>{proc.displayWO}</span>
                              <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
                            </div>
                            <div className="truncate font-medium text-[9px] mt-0.5">
                              {proc.material} ({proc.orderQty} pcs)
                            </div>
                            <div className="text-[8.5px] opacity-75 font-mono">
                              {proc.machineName}
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
      ) : (
        /* ========================================================================= */
        /* 7. VIEW: FULL DISPATCH LIST TABLE                                         */
        /* ========================================================================= */
        <div className="border border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Queue & Dispatch List</h3>
              <p className="text-xs text-slate-500">Daily shop floor operations sequencing and progress tracking</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/90 dark:bg-slate-900/80 text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">WO</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Item</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Resource</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Routing</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">Qty</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 min-w-[130px]">Progress</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Planned</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Due</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">Priority</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-slate-500 text-xs">
                      No operations found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcesses.map((proc) => {
                    const startStr = proc.scheduledStart
                      ? `${proc.scheduledStart.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledStart.getMonth()]} 08:00`
                      : "27 Jul 08:00";
                    const endStr = proc.scheduledEnd
                      ? `${proc.scheduledEnd.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledEnd.getMonth()]} 17:00`
                      : "27 Jul 18:00";

                    return (
                      <TableRow key={proc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors text-xs border-b border-slate-100 dark:border-slate-800/60">
                        <TableCell className="font-semibold font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {proc.displayWO}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900 dark:text-white max-w-[180px] truncate">
                          {proc.material}
                        </TableCell>
                        <TableCell>
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {proc.machineId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500 flex-wrap">
                            {proc.routing.map((r, rIdx) => (
                              <div key={rIdx} className="flex items-center gap-1">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded",
                                  r.machineId === proc.machineId
                                    ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                  )}>
                                    {r.machineId}
                                  </span>
                                {rIdx < proc.routing.length - 1 && (
                                  <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {proc.orderQty.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-200",
                                  proc.completionPct >= 100
                                    ? "bg-emerald-500"
                                    : proc.completionPct > 0
                                    ? "bg-blue-600"
                                    : "bg-slate-300 dark:bg-slate-700"
                                )}
                                style={{ width: `${proc.completionPct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 w-8 text-right font-medium">
                              {proc.completionPct}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] whitespace-nowrap text-slate-500">
                          <div>{startStr}</div>
                          <div className="text-slate-700 dark:text-slate-300">{endStr}</div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {proc.sopStartDate}
                        </TableCell>
                        <TableCell className="text-center">
                          {renderPriorityBadge(proc.priority)}
                        </TableCell>
                        <TableCell className="text-center">
                          {renderStatusBadge(proc.executionStatus, proc.completionPct)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenLogModal(proc)}
                            className="text-[11px] h-7 px-2.5 gap-1 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3 text-slate-500" />
                            Log Progress
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: LOG WORK DONE & OPERATOR PROGRESS                                */}
      {/* ========================================================================= */}
      <Dialog open={isLogWorkDoneOpen} onOpenChange={setIsLogWorkDoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Edit3 className="h-4 w-4 text-blue-600" />
              Log Daily Progress — {selectedProcessForLog?.displayWO}
            </DialogTitle>
          </DialogHeader>

          {selectedProcessForLog && (
            <form onSubmit={handleSaveWorkDone} className="space-y-4 pt-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">{selectedProcessForLog.material}</p>
                <p className="text-[11px] text-slate-500">
                  Workstation: <span className="font-medium text-slate-800 dark:text-slate-200">{selectedProcessForLog.machineName} ({selectedProcessForLog.machineSubtitle})</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Target Quantity: <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{selectedProcessForLog.orderQty} units</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="log-completed" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Completed Units Done *</Label>
                  <Input
                    id="log-completed"
                    type="number"
                    value={logCompletedQty}
                    onChange={(e) => setLogCompletedQty(e.target.value)}
                    className="h-9 text-xs font-mono font-bold bg-white dark:bg-slate-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="log-scrap" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Scrap / Defect Units</Label>
                  <Input
                    id="log-scrap"
                    type="number"
                    value={logScrapQty}
                    onChange={(e) => setLogScrapQty(e.target.value)}
                    className="h-9 text-xs font-mono bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="log-notes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Operator / Shop Floor Notes</Label>
                <Input
                  id="log-notes"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. Line running smoothly, tooling inspected."
                  className="h-9 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsLogWorkDoneOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  Save Progress
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
