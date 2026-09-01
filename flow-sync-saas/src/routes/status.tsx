import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DatePickerField } from "@/components/ui/date-picker";
import { GanttTimelineView } from "@/components/GanttTimelineView";
import { MaterialInventoryModal } from "@/components/modals/MaterialInventoryModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  Sparkles,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  PauseCircle,
  AlertTriangle,
  Search,
  Filter,
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
  ListFilter,
  Grid,
  Maximize2,
  Package,
  RotateCcw,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  ArrowRight,
  MoreVertical,
  SlidersHorizontal,
  GitBranch,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { parseSOPDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Production Schedule & Shop Floor Status — MFG Scheduler" },
      {
        name: "description",
        content:
          "Interactive MRPeasy-style Production Schedule Calendar, Workstation Gantt Sequencer, and daily work dispatch tracker.",
      },
    ],
  }),
  component: ShopFloorStatusPage,
});

const MONTH_NAMES = [
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

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

function ShopFloorStatusPage() {
  const {
    orders,
    processes,
    machines,
    machineGroups,
    updateStepExecutionStatus,
    addWorkOrder,
    loadDefaultCSV,
  } = useAppStore();
  const { language } = useTranslations();

  // Navigation & View Mode:
  // 'calendar' (MRPeasy Production Calendar) | 'gantt' (Timeline Sequencer + Table) | 'list' (Dispatch Table)
  const [viewMode, setViewMode] = useState<"calendar" | "gantt" | "list">("gantt");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("week");
  const [ganttZoom, setGanttZoom] = useState<"compact" | "normal" | "wide">("normal");
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

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

  // Derive Workstation Subtitle map (e.g. L01 -> Slicer, L02 -> Filling, 603011 -> CNC Milling)
  const machineSubtitleMap: Record<string, string> = {
    L01: "Slicer / Prep",
    L02: "Filling Line",
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
    const map = new Map<
      string,
      { step: number; machineId: string; text: string; status: string }[]
    >();
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

  // Enriched processes with order & workstation metadata
  const enrichedProcesses = useMemo(() => {
    return processes.map((proc) => {
      const parentOrder = orders.find((o) => o.orderId === proc.orderId || o.id === proc.orderId);
      const machine = machines.find((m) => m.id === proc.machineId);
      const executionStatus =
        proc.executionStatus || (proc.status === "SCHEDULED" ? "PLANNED" : "PLANNED");
      const completedQty = proc.completedQty || 0;
      const orderQty = parentOrder?.orderQty || proc.baseQty * 100 || 500;
      const completionPct = Math.min(100, Math.round((completedQty / orderQty) * 100));

      const scheduledStart = proc.scheduledStart ? new Date(proc.scheduledStart) : null;
      const scheduledEnd = proc.scheduledEnd ? new Date(proc.scheduledEnd) : null;

      // Routing steps for this order
      const routing = orderRoutingMap.get(proc.orderId) || [
        {
          step: proc.processId,
          machineId: proc.machineId,
          text: proc.processText,
          status: executionStatus,
        },
      ];

      // Priority derivation
      let priority: "High" | "Med" | "Low" = "Med";
      if (orderQty >= 800 || executionStatus === "DELAYED") {
        priority = "High";
      } else if (orderQty <= 400 || executionStatus === "COMPLETED") {
        priority = "Low";
      }

      // Display clean WO code
      const displayWO = proc.orderId.startsWith("WO-") ? proc.orderId : `WO-${proc.orderId}`;
      const subtitle =
        machineSubtitleMap[proc.machineId] || machine?.machineGroupId || "Workstation";

      return {
        ...proc,
        displayWO,
        material: parentOrder?.material || "MAT-STANDARD-SKU",
        orderQty,
        sopStartDate: parentOrder?.sopStartDate || "2026-07-27",
        machineName: machine?.name || proc.machineId,
        machineSubtitle: subtitle,
        executionStatus,
        completedQty,
        scrapQty: proc.scrapQty || 0,
        completionPct,
        scheduledStart,
        scheduledEnd,
        routing,
        priority,
      };
    });
  }, [processes, orders, machines, orderRoutingMap]);

  // Unique list of machines for filter and swimlanes
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
      if (
        selectedMachine !== "ALL" &&
        proc.machineId !== selectedMachine &&
        proc.machineName !== selectedMachine
      ) {
        return false;
      }
      if (selectedStatus !== "ALL") {
        if (
          selectedStatus === "QUEUED" &&
          (proc.executionStatus !== "PLANNED" || proc.completionPct > 0)
        ) {
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
        const matchesOrder =
          proc.displayWO.toLowerCase().includes(query) ||
          proc.orderId.toLowerCase().includes(query);
        const matchesMaterial = proc.material.toLowerCase().includes(query);
        const matchesText = proc.processText.toLowerCase().includes(query);
        const matchesMachine =
          proc.machineName.toLowerCase().includes(query) ||
          proc.machineSubtitle.toLowerCase().includes(query);
        if (!matchesOrder && !matchesMaterial && !matchesText && !matchesMachine) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedProcesses, selectedMachine, selectedStatus, searchQuery]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = enrichedProcesses.length;
    const running = enrichedProcesses.filter((p) => p.executionStatus === "IN_PROGRESS").length;
    const done = enrichedProcesses.filter((p) => p.executionStatus === "COMPLETED").length;
    const hold = enrichedProcesses.filter((p) => p.executionStatus === "PAUSED").length;
    const delayed = enrichedProcesses.filter((p) => p.executionStatus === "DELAYED").length;
    const released = enrichedProcesses.filter(
      (p) => p.executionStatus === "PLANNED" && p.completedQty === 0,
    ).length;
    const queued = enrichedProcesses.filter(
      (p) => p.executionStatus === "PLANNED" || p.status === "UNSCHEDULED",
    ).length;

    const totalTargetUnits = enrichedProcesses.reduce((acc, p) => acc + p.orderQty, 0);
    const totalDoneUnits = enrichedProcesses.reduce((acc, p) => acc + p.completedQty, 0);

    return {
      total,
      running,
      done,
      hold,
      delayed,
      released,
      queued,
      totalTargetUnits,
      totalDoneUnits,
    };
  }, [enrichedProcesses]);

  // Days list for current active view period (Week / Month / Day)
  const timelineDays = useMemo(() => {
    if (granularity === "day") {
      const d = new Date(currentDate);
      return [
        {
          dayNum: d.getDate(),
          dateStr: formatDateStr(d),
          dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
          monthName: MONTH_NAMES_SHORT[d.getMonth()],
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          isToday: formatDateStr(d) === formatDateStr(new Date()),
          isNowCol: true,
        },
      ];
    }

    if (granularity === "week") {
      // Find Monday of the current week
      const d = new Date(currentDate);
      const dayOfWeek = d.getDay(); // 0 is Sun, 1 is Mon
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
          isNowCol: i === 2, // Highlight mid-week "Now" vertical line (matching screenshot)
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

  // Gantt column width in pixels based on zoom level & granularity
  const ganttColWidthPx = useMemo(() => {
    if (granularity === "week") {
      switch (ganttZoom) {
        case "compact":
          return 115;
        case "wide":
          return 185;
        default:
          return 145;
      }
    }
    switch (ganttZoom) {
      case "compact":
        return 45;
      case "wide":
        return 95;
      default:
        return 68;
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
    setCurrentDate(new Date(2026, 6, 27)); // Jul 27 2026
  };

  // Monthly Calendar Matrix calculation (MRPeasy style)
  const calendarDays = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIdx = new Date(currentYear, currentMonth, 1).getDay(); // Sunday=0
    const offset = firstDayIdx === 0 ? 6 : firstDayIdx - 1; // Monday = 0

    const list = [];
    // Padding
    for (let i = 0; i < offset; i++) {
      list.push({ dayStr: "", dayNum: 0, isPadding: true, dayProcs: [] });
    }

    // Days list
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dStr = formatDateStr(d);

      // Scheduled operations active on this date
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

    updateStepExecutionStatus(selectedProcessForLog.id, newStatus, completed, scrap, logNotes);

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
      Step: p.processId,
      Operation: p.processText,
      "Workstation ID": p.machineId,
      "Workstation Name": p.machineName,
      "Order Qty": p.orderQty,
      "Completed Qty": p.completedQty,
      "Scrap Qty": p.scrapQty,
      "Progress Pct": `${p.completionPct}%`,
      "Setup Time (min)": p.setupTimeMin,
      "Process Time (min)": p.processTimeMin,
      Status: p.executionStatus,
      "Planned Start": p.scheduledStart ? p.scheduledStart.toISOString() : "N/A",
      "Planned End": p.scheduledEnd ? p.scheduledEnd.toISOString() : "N/A",
      "Due Date": p.sopStartDate,
    }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ShopFloor_Schedule_${formatDateStr(new Date())}.csv`);
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

  // Helper for priority pill styling (Subtle semantic colors)
  const renderPriorityBadge = (priority: "High" | "Med" | "Low") => {
    switch (priority) {
      case "High":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/60">
            High
          </span>
        );
      case "Med":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60">
            Med
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200/80 dark:bg-slate-850 dark:text-slate-300 dark:border-slate-700">
            Low
          </span>
        );
    }
  };

  // Helper for status badge styling (Enterprise Semantic status system)
  const renderStatusBadge = (status: string, completionPct: number) => {
    if (status === "COMPLETED" || completionPct >= 100) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-700 text-white shadow-2xs">
          <Check className="h-3 w-3 text-white" />
          Done
        </span>
      );
    }
    if (status === "IN_PROGRESS") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-600 text-white shadow-2xs">
          <Play className="h-3 w-3 fill-current" />
          Running
        </span>
      );
    }
    if (status === "PAUSED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/70">
          <PauseCircle className="h-3 w-3 text-amber-600" />
          Hold
        </span>
      );
    }
    if (status === "DELAYED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/70">
          <AlertTriangle className="h-3 w-3 text-rose-600" />
          Behind
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/90 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/70">
        <Clock className="h-3 w-3 text-blue-500" />
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
      {/* 1. STREAMLINED TOP HEADER & MAIN ACTION BAR                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </div>
            Production Scheduling
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sequence work orders, balance lines, and track real-time machine execution.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Material Stock */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMaterialModalOpen(true)}
            className="h-8 px-3 text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-2xs rounded-lg cursor-pointer"
          >
            <Package className="h-3.5 w-3.5 text-slate-500" />
            Material Stock
          </Button>

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

          {/* Re-Optimize Schedule */}
          <Button
            size="sm"
            onClick={async () => {
              setIsOptimizing(true);
              try {
                await useAppStore.getState().runScheduler();
                toast.success("Production schedule re-optimized successfully!");
              } finally {
                setIsOptimizing(false);
              }
            }}
            disabled={isOptimizing}
            className="h-8 px-3.5 text-xs font-medium gap-1.5 bg-[#1e3f2e] hover:bg-[#27533d] text-white shadow-xs border border-[#27533d] rounded-lg cursor-pointer transition-all"
          >
            <RotateCcw className={cn("h-3.5 w-3.5", isOptimizing && "animate-spin")} />
            {isOptimizing ? "Optimizing..." : "Re-Optimize Schedule"}
          </Button>

          {/* Add Work Order */}
          <Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-3.5 text-xs font-medium gap-1.5 bg-[#1e3f2e] hover:bg-[#27533d] text-white shadow-xs border border-[#27533d] rounded-lg cursor-pointer transition-all"
              >
                <Plus className="h-4 w-4" />
                Add work order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Plus className="h-4 w-4 text-slate-500" />
                  Add New Work Order & Operation
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateOrder} className="space-y-4 pt-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-order-id"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Work Order ID *
                    </Label>
                    <Input
                      id="new-order-id"
                      value={newOrderId}
                      onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="e.g. WO-2826-9420"
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-step-id"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Step No (Vorgang)
                    </Label>
                    <Input
                      id="new-step-id"
                      type="number"
                      value={newStepId}
                      onChange={(e) => setNewStepId(e.target.value)}
                      placeholder="10"
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-material"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Material / Part ID *
                    </Label>
                    <Input
                      id="new-material"
                      value={newMaterial}
                      onChange={(e) => setNewMaterial(e.target.value)}
                      placeholder="e.g. MAT-100-840"
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Machine / Station
                    </Label>
                    <Select value={newMachineId} onValueChange={setNewMachineId}>
                      <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
                        <SelectValue placeholder="Select machine" />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
                        {uniqueMachines.map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.name} — {m.subtitle}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-qty"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Order Qty
                    </Label>
                    <Input
                      id="new-qty"
                      type="number"
                      value={newOrderQty}
                      onChange={(e) => setNewOrderQty(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-setup-time"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Setup (min)
                    </Label>
                    <Input
                      id="new-setup-time"
                      type="number"
                      value={newSetupMins}
                      onChange={(e) => setNewSetupMins(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-proc-time"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Process (min)
                    </Label>
                    <Input
                      id="new-proc-time"
                      type="number"
                      value={newProcessMins}
                      onChange={(e) => setNewProcessMins(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DatePickerField
                    value={newSopDate}
                    onChange={setNewSopDate}
                    label="SOP Start Date"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="new-text"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Operation Description
                    </Label>
                    <Input
                      id="new-text"
                      value={newProcessText}
                      onChange={(e) => setNewProcessText(e.target.value)}
                      placeholder="e.g. CNC Milling Pass"
                      className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddOrderOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-[#1e3f2e] hover:bg-[#27533d] text-white font-medium shadow-xs border border-[#27533d]"
                  >
                    Save Work Order
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <MaterialInventoryModal
            open={isMaterialModalOpen}
            onOpenChange={setIsMaterialModalOpen}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MODERN TOP SEGMENTED VIEW SWITCHER CAPSULE (IMAGE 1 & 2)               */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100/90 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1">
          {/* Segmented Pill 1: Production Schedule */}
          <button
            onClick={() => setViewMode("calendar")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer select-none",
              viewMode === "calendar"
                ? "bg-white dark:bg-slate-800 text-emerald-950 dark:text-emerald-100 shadow-xs border border-emerald-300/80 dark:border-emerald-700/80 font-semibold ring-1 ring-emerald-900/5"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60 font-medium",
            )}
          >
            <CalendarIcon
              className={cn(
                "h-3.5 w-3.5",
                viewMode === "calendar"
                  ? "text-emerald-800 dark:text-emerald-300"
                  : "text-slate-500",
              )}
            />
            Production Schedule
          </button>

          {/* Segmented Pill 2: Gantt Chart */}
          <button
            onClick={() => setViewMode("gantt")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer select-none",
              viewMode === "gantt"
                ? "bg-white dark:bg-slate-800 text-emerald-950 dark:text-emerald-100 shadow-xs border border-emerald-300/80 dark:border-emerald-700/80 font-semibold ring-1 ring-emerald-900/5"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60 font-medium",
            )}
          >
            <BarChart3
              className={cn(
                "h-3.5 w-3.5",
                viewMode === "gantt" ? "text-emerald-800 dark:text-emerald-300" : "text-slate-500",
              )}
            />
            Gantt Chart
          </button>

          {/* Segmented Pill 3: Dispatch List */}
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer select-none",
              viewMode === "list"
                ? "bg-white dark:bg-slate-800 text-emerald-950 dark:text-emerald-100 shadow-xs border border-emerald-300/80 dark:border-emerald-700/80 font-semibold ring-1 ring-emerald-900/5"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60 font-medium",
            )}
          >
            <ListOrdered
              className={cn(
                "h-3.5 w-3.5",
                viewMode === "list" ? "text-emerald-800 dark:text-emerald-300" : "text-slate-500",
              )}
            />
            Dispatch List
          </button>
        </div>

        {/* Quick Links: What-if Sandbox & Machines */}
        <div className="flex items-center gap-2 pr-1 text-xs">
          <Link
            to="/sandbox"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5 text-slate-500" />
            <span>What-If Sandbox</span>
          </Link>
          <Link
            to="/machines"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <Factory className="h-3.5 w-3.5 text-slate-500" />
            <span>Workcenters</span>
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONTROL & FILTER STRIP (CONSISTENT ACROSS ALL VIEWS)                  */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        {/* Left Section: Granularity & Period Navigation & Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Day / Week / Month Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-medium">
            <button
              onClick={() => setGranularity("day")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-colors cursor-pointer",
                granularity === "day"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
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
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
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
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
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

          {/* Gantt Zoom Switcher (Compact / 100% / Wide) */}
          {viewMode === "gantt" && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium ml-1">
              <button
                onClick={() => setGanttZoom("compact")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  ganttZoom === "compact"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                )}
              >
                Compact
              </button>
              <button
                onClick={() => setGanttZoom("normal")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  ganttZoom === "normal"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                )}
              >
                100%
              </button>
              <button
                onClick={() => setGanttZoom("wide")}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer",
                  ganttZoom === "wide"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200",
                )}
              >
                Wide
              </button>
            </div>
          )}
        </div>

        {/* Middle Section: Status Filter Pills with Live Counters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedStatus(selectedStatus === "QUEUED" ? "ALL" : "QUEUED")}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
              selectedStatus === "QUEUED"
                ? "bg-slate-800 text-white border-slate-900 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50",
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
                ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50",
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
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-2xs font-semibold"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50",
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
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-2xs font-semibold"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50",
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
                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-2xs font-semibold"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50",
            )}
          >
            <span>Done</span>
            <span className="text-[10px] opacity-70 font-mono">{stats.done}</span>
          </button>
        </div>

        {/* Right Section: Workstation Select & Search Input */}
        <div className="flex items-center gap-2">
          {/* Workstation Dropdown */}
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 text-xs text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-slate-900 min-w-[130px]"
          >
            <option value="ALL">All resources</option>
            {uniqueMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.subtitle}
              </option>
            ))}
          </select>

          {/* Search Box */}
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
      {/* 4. KPI SUMMARY CARDS (MINIMALIST ENTERPRISE STYLE)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Orders</span>
            <Layers className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">
            {stats.total}
          </p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <span>Running</span>
            <Play className="h-3 w-3 fill-current text-emerald-600" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-emerald-700 dark:text-emerald-400">
            {stats.running}
          </p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-xs font-semibold">
            <span>Done</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">
            {stats.done}
          </p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 text-xs font-semibold">
            <span>Hold</span>
            <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-amber-700 dark:text-amber-400">
            {stats.hold}
          </p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 text-xs font-semibold">
            <span>Behind Sched.</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-rose-700 dark:text-rose-400">
            {stats.delayed}
          </p>
        </div>

        <div className="p-3 border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Units Done</span>
            <Factory className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <p className="text-base font-bold mt-1 font-mono text-slate-900 dark:text-white">
            {stats.totalDoneUnits.toLocaleString()}{" "}
            <span className="text-[10px] font-normal text-slate-400">
              / {stats.totalTargetUnits.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MAIN CONTENT: GANTT SEQUENCER TIMELINE & WORK ORDERS TABLE             */}
      {/* ========================================================================= */}
      {viewMode === "gantt" ? (
        <div className="space-y-6">
          <GanttTimelineView
            timelineZoom={ganttZoom}
            granularity={granularity}
            onGranularityChange={setGranularity}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            selectedMachine={selectedMachine}
            selectedStatus={selectedStatus}
            searchQuery={searchQuery}
          />

          {/* B. INTEGRATED SHOP FLOOR WORK ORDERS TABLE (MATCHING REFERENCE IMAGE 2 BOTTOM) */}
          <div className="border border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Work Orders & Shop Floor Status
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time routing flow, progress tracking, and execution status
                </p>
              </div>
              <div className="text-xs font-mono text-slate-500">
                {filteredProcesses.length} Operations
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/90 dark:bg-slate-900/80 text-[11px] border-b border-slate-200 dark:border-slate-800">
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                      WO
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                      Item
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                      Resource
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                      Routing
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">
                      Qty
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 min-w-[130px]">
                      Progress
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                      Planned
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                      Due
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">
                      Priority
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">
                      Actions
                    </TableHead>
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
                        ? `${proc.scheduledStart.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledStart.getMonth()]} ${String(proc.scheduledStart.getHours()).padStart(2, "0")}:00`
                        : "27 Jul 08:00";
                      const endStr = proc.scheduledEnd
                        ? `${proc.scheduledEnd.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledEnd.getMonth()]} ${String(proc.scheduledEnd.getHours()).padStart(2, "0")}:00`
                        : "27 Jul 18:00";

                      return (
                        <TableRow
                          key={proc.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors text-xs border-b border-slate-100 dark:border-slate-800/60"
                        >
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
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded",
                                      r.machineId === proc.machineId
                                        ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 font-semibold"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                                    )}
                                  >
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
                                        ? "bg-slate-800 dark:bg-slate-200"
                                        : "bg-slate-300 dark:bg-slate-700",
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
                                <DropdownMenuItem
                                  onClick={() => updateStepExecutionStatus(proc.id, "PLANNED")}
                                >
                                  Mark as Released / Planned
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStepExecutionStatus(proc.id, "IN_PROGRESS")}
                                >
                                  Mark as Running
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStepExecutionStatus(proc.id, "PAUSED")}
                                >
                                  Mark as Hold / Paused
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStepExecutionStatus(proc.id, "COMPLETED")}
                                >
                                  Mark as Done / Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateStepExecutionStatus(proc.id, "DELAYED")}
                                >
                                  Mark as Behind Schedule
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
        /* 6. VIEW: PRODUCTION SCHEDULE CALENDAR (MRPEASY STYLE FULL MATRIX)         */
        /* ========================================================================= */
        <div className="border border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 overflow-hidden rounded-xl">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between flex-wrap gap-4 bg-slate-50/70 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Production Schedule Calendar
              </span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-xs font-medium">
                <span className="px-2 py-0.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold rounded">
                  Manufacturing Orders
                </span>
                <span className="px-2 py-0.5 text-slate-500">Operations</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handlePrevPeriod}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-semibold uppercase font-mono tracking-wider px-2">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleNextPeriod}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("gantt")}
                className="h-8 text-xs font-medium gap-1.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                <BarChart3 className="h-3.5 w-3.5 text-slate-500" />
                Gantt chart
              </Button>
            </div>
          </div>

          <div className="pt-4 px-4 pb-4">
            {/* Calendar Weekday Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Matrix with Multi-Day Spanning Cards */}
            <div className="grid grid-cols-7 gap-2 text-xs">
              {calendarDays.map((cd, idx) => {
                if (cd.isPadding) {
                  return (
                    <div
                      key={idx}
                      className="min-h-[130px] bg-slate-50/40 dark:bg-slate-950/20 rounded-lg border border-dashed border-slate-200/60 dark:border-slate-800/60"
                    />
                  );
                }

                const dayProcsList = cd.dayProcs || [];

                return (
                  <div
                    key={idx}
                    className="min-h-[130px] rounded-lg p-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between hover:border-slate-400 transition-colors shadow-2xs"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/70 pb-1 mb-1">
                      <span className="font-semibold text-xs font-mono text-slate-700 dark:text-slate-300">
                        {cd.dayNum}
                      </span>
                      {dayProcsList.length > 0 && (
                        <span className="text-[10px] font-medium font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                          {dayProcsList.length} Jobs
                        </span>
                      )}
                    </div>

                    {/* Multi-day Order Schedule Bars */}
                    <div className="space-y-1 flex-1 overflow-y-auto max-h-[100px]">
                      {dayProcsList.map((proc: any) => {
                        return (
                          <div
                            key={proc.id}
                            onClick={() => handleOpenLogModal(proc)}
                            className={cn(
                              "p-1.5 rounded border text-[10px] cursor-pointer transition-all hover:scale-[1.01] shadow-2xs group relative overflow-hidden",
                              proc.executionStatus === "COMPLETED"
                                ? "bg-slate-700 text-white border-slate-800"
                                : proc.executionStatus === "IN_PROGRESS"
                                  ? "bg-emerald-600 text-white font-semibold"
                                  : proc.executionStatus === "PAUSED"
                                    ? "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800"
                                    : proc.executionStatus === "DELAYED"
                                      ? "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800"
                                      : "bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700",
                            )}
                            title={`${proc.displayWO} - ${proc.material}`}
                          >
                            <div className="font-semibold font-mono flex items-center justify-between text-[9.5px]">
                              <span>{proc.displayWO}</span>
                              <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
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
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Queue & Dispatch List
              </h3>
              <p className="text-xs text-slate-500">
                Daily shop floor operations sequencing and progress tracking
              </p>
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
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                    WO
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                    Item
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                    Resource
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                    Routing
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">
                    Qty
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 min-w-[130px]">
                    Progress
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                    Planned
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">
                    Due
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">
                    Priority
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">
                    Status
                  </TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right">
                    Actions
                  </TableHead>
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
                      ? `${proc.scheduledStart.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledStart.getMonth()]} ${String(proc.scheduledStart.getHours()).padStart(2, "0")}:00`
                      : "27 Jul 08:00";
                    const endStr = proc.scheduledEnd
                      ? `${proc.scheduledEnd.getDate()} ${MONTH_NAMES_SHORT[proc.scheduledEnd.getMonth()]} ${String(proc.scheduledEnd.getHours()).padStart(2, "0")}:00`
                      : "27 Jul 18:00";

                    return (
                      <TableRow
                        key={proc.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors text-xs border-b border-slate-100 dark:border-slate-800/60"
                      >
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
                                <span
                                  className={cn(
                                    "px-1.5 py-0.5 rounded",
                                    r.machineId === proc.machineId
                                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                                  )}
                                >
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
                                      ? "bg-slate-800 dark:bg-slate-200"
                                      : "bg-slate-300 dark:bg-slate-700",
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
              <Edit3 className="h-4 w-4 text-slate-500" />
              Log Daily Progress — {selectedProcessForLog?.displayWO}
            </DialogTitle>
          </DialogHeader>

          {selectedProcessForLog && (
            <form onSubmit={handleSaveWorkDone} className="space-y-4 pt-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {selectedProcessForLog.material}
                </p>
                <p className="text-[11px] text-slate-500">
                  Workstation:{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedProcessForLog.machineName} ({selectedProcessForLog.machineSubtitle})
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Target Quantity:{" "}
                  <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                    {selectedProcessForLog.orderQty} units
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="log-completed"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Completed Units Done *
                  </Label>
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
                  <Label
                    htmlFor="log-scrap"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Scrap / Defect Units
                  </Label>
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
                <Label
                  htmlFor="log-notes"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Operator / Shop Floor Notes
                </Label>
                <Input
                  id="log-notes"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. Line running smoothly, tooling inspected."
                  className="h-9 text-xs bg-white dark:bg-slate-900"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLogWorkDoneOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-semibold shadow-2xs"
                >
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
