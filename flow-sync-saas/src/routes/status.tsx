import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
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
  List,
  Grid,
  Maximize2,
  RefreshCw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { parseSOPDate } from "@/lib/scheduler";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Shop Floor Status & Production Schedule — CapaSolve SaaS" },
      { name: "description", content: "Interactive MRPeasy-style Production Schedule Calendar, Workstation Gantt Chart, and daily work dispatch tracker." },
    ],
  }),
  component: ShopFloorStatusPage,
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ShopFloorStatusPage() {
  const { orders, processes, machines, updateStepExecutionStatus, addWorkOrder } = useAppStore();
  const { language } = useTranslations();

  // View Mode: 'calendar' (MRPeasy Calendar) | 'gantt' (MRPeasy Gantt Chart) | 'list' (Dispatch Table)
  const [viewMode, setViewMode] = useState<"calendar" | "gantt" | "list">("gantt");
  const [calendarGranularity, setCalendarGranularity] = useState<"month" | "week" | "day">("month");
  const [ganttZoom, setGanttZoom] = useState<"compact" | "normal" | "wide">("normal");

  // Calendar Month & Year
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // June

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
  const [newSopDate, setNewSopDate] = useState("01-06-2026");
  const [newOrderQty, setNewOrderQty] = useState("100");
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

  // Enriched processes with order & workstation metadata
  const enrichedProcesses = useMemo(() => {
    return processes.map((proc) => {
      const parentOrder = orders.find((o) => o.orderId === proc.orderId);
      const machine = machines.find((m) => m.id === proc.machineId);
      const executionStatus = proc.executionStatus || (proc.status === "SCHEDULED" ? "PLANNED" : "PLANNED");
      const completedQty = proc.completedQty || 0;
      const orderQty = parentOrder?.orderQty || 100;
      const completionPct = Math.min(100, Math.round((completedQty / orderQty) * 100));

      const scheduledStart = proc.scheduledStart ? new Date(proc.scheduledStart) : null;
      const scheduledEnd = proc.scheduledEnd ? new Date(proc.scheduledEnd) : null;

      return {
        ...proc,
        material: parentOrder?.material || "N/A",
        orderQty,
        sopStartDate: parentOrder?.sopStartDate || "01-06-2026",
        machineName: machine?.name || proc.machineId,
        executionStatus,
        completedQty,
        scrapQty: proc.scrapQty || 0,
        completionPct,
        scheduledStart,
        scheduledEnd,
      };
    });
  }, [processes, orders, machines]);

  // Filtered processes
  const filteredProcesses = useMemo(() => {
    return enrichedProcesses.filter((proc) => {
      if (selectedMachine !== "ALL" && proc.machineId !== selectedMachine && proc.machineName !== selectedMachine) {
        return false;
      }
      if (selectedStatus !== "ALL" && proc.executionStatus !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesOrder = proc.orderId.toLowerCase().includes(query);
        const matchesMaterial = proc.material.toLowerCase().includes(query);
        const matchesText = proc.processText.toLowerCase().includes(query);
        const matchesMachine = proc.machineName.toLowerCase().includes(query);
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
    const inProgress = enrichedProcesses.filter((p) => p.executionStatus === "IN_PROGRESS").length;
    const completed = enrichedProcesses.filter((p) => p.executionStatus === "COMPLETED").length;
    const delayed = enrichedProcesses.filter((p) => p.executionStatus === "DELAYED").length;
    const paused = enrichedProcesses.filter((p) => p.executionStatus === "PAUSED").length;
    const planned = enrichedProcesses.filter((p) => p.executionStatus === "PLANNED").length;

    const totalTargetUnits = enrichedProcesses.reduce((acc, p) => acc + p.orderQty, 0);
    const totalDoneUnits = enrichedProcesses.reduce((acc, p) => acc + p.completedQty, 0);

    return { total, inProgress, completed, delayed, paused, planned, totalTargetUnits, totalDoneUnits };
  }, [enrichedProcesses]);

  // Unique list of machines for filter
  const uniqueMachines = useMemo(() => {
    const set = new Set<string>();
    enrichedProcesses.forEach((p) => set.add(p.machineName));
    return Array.from(set);
  }, [enrichedProcesses]);

  // Month navigation
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

  // Days list for current month in Gantt view
  const daysInCurrentMonth = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(currentYear, currentMonth, d);
      days.push({
        dayNum: d,
        dateStr: formatDateStr(dateObj),
        dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short' }),
        isWeekend: dateObj.getDay() === 0 || dateObj.getDay() === 6,
      });
    }
    return days;
  }, [currentYear, currentMonth]);

  // Gantt column width in pixels based on zoom level
  const ganttColWidthPx = useMemo(() => {
    switch (ganttZoom) {
      case "compact": return 48;
      case "wide": return 110;
      default: return 75;
    }
  }, [ganttZoom]);

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

    const targetMachine = newMachineId || uniqueMachines[0] || "603011";

    addWorkOrder({
      orderId: newOrderId,
      processId: Number(newStepId) || 10,
      material: newMaterial,
      machineId: targetMachine,
      sopStartDate: newSopDate,
      orderQty: Number(newOrderQty) || 100,
      processText: newProcessText || "NEW OPERATION",
      setupTimeMin: Number(newSetupMins) || 30,
      processTimeMin: Number(newProcessMins) || 5,
      manpowerUtilizationMin: Number(newManpower) || 1,
    });

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
    } else if (completed > 0 && newStatus === "PLANNED") {
      newStatus = "IN_PROGRESS";
    }

    updateStepExecutionStatus(
      selectedProcessForLog.id,
      newStatus,
      completed,
      scrap,
      logNotes
    );

    setIsLogWorkDoneOpen(false);
    setSelectedProcessForLog(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Activity className="h-7 w-7 text-primary" />
            Production Schedule & Shop Floor Status
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            MRPeasy-style multi-day production calendar, Workstation Gantt Timeline, and daily work dispatch tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={cn("h-8 text-xs font-bold gap-1.5 rounded-lg", viewMode === "calendar" && "bg-primary text-primary-foreground shadow-xs")}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Production Schedule
            </Button>
            <Button
              variant={viewMode === "gantt" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("gantt")}
              className={cn("h-8 text-xs font-bold gap-1.5 rounded-lg", viewMode === "gantt" && "bg-primary text-primary-foreground shadow-xs")}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Gantt Chart
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={cn("h-8 text-xs font-bold gap-1.5 rounded-lg", viewMode === "list" && "bg-primary text-primary-foreground shadow-xs")}
            >
              <List className="h-3.5 w-3.5" />
              Dispatch List
            </Button>
          </div>

          <Dialog open={isAddOrderOpen} onOpenChange={setIsAddOrderOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/95 font-bold shadow-md cursor-pointer text-xs gap-2">
                <Plus className="h-4 w-4" />
                Add Work Order
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Add New Work Order & Operation Step
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateOrder} className="space-y-4 pt-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-order-id" className="text-xs font-semibold">Order ID *</Label>
                    <Input
                      id="new-order-id"
                      value={newOrderId}
                      onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="e.g. 100901"
                      className="h-9 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-step-id" className="text-xs font-semibold">Step No (Vorgang) *</Label>
                    <Input
                      id="new-step-id"
                      type="number"
                      value={newStepId}
                      onChange={(e) => setNewStepId(e.target.value)}
                      placeholder="10, 20, 30"
                      className="h-9 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-material" className="text-xs font-semibold">Material / SKU *</Label>
                  <Input
                    id="new-material"
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    placeholder="e.g. MAT-TURBO-V6"
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-machine" className="text-xs font-semibold">Assigned Workstation *</Label>
                    <select
                      id="new-machine"
                      value={newMachineId}
                      onChange={(e) => setNewMachineId(e.target.value)}
                      className="w-full h-9 bg-background border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Workstation</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.machineGroupId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-sop-date" className="text-xs font-semibold">SOP Start Date *</Label>
                    <Input
                      id="new-sop-date"
                      value={newSopDate}
                      onChange={(e) => setNewSopDate(e.target.value)}
                      placeholder="01-06-2026"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-qty" className="text-xs font-semibold">Order Quantity *</Label>
                    <Input
                      id="new-qty"
                      type="number"
                      value={newOrderQty}
                      onChange={(e) => setNewOrderQty(e.target.value)}
                      placeholder="100"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-setup" className="text-xs font-semibold">Setup Time (Mins)</Label>
                    <Input
                      id="new-setup"
                      type="number"
                      value={newSetupMins}
                      onChange={(e) => setNewSetupMins(e.target.value)}
                      placeholder="30"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-process-mins" className="text-xs font-semibold">Process Time (Mins)</Label>
                    <Input
                      id="new-process-mins"
                      type="number"
                      value={newProcessMins}
                      onChange={(e) => setNewProcessMins(e.target.value)}
                      placeholder="5.0"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-manpower" className="text-xs font-semibold">Operators Needed</Label>
                    <Input
                      id="new-manpower"
                      type="number"
                      value={newManpower}
                      onChange={(e) => setNewManpower(e.target.value)}
                      placeholder="1"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new-text" className="text-xs font-semibold">Operation Description</Label>
                  <Input
                    id="new-text"
                    value={newProcessText}
                    onChange={(e) => setNewProcessText(e.target.value)}
                    placeholder="e.g. CNC MILLING PASS OP 10"
                    className="h-9 text-xs"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOrderOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                    Save Work Order
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 border-border/70 bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Total Steps</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl font-extrabold mt-2 font-mono text-foreground">{stats.total}</p>
        </Card>

        <Card className="p-4 border-blue-500/30 bg-blue-500/5 shadow-2xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <span>In Progress</span>
            <Play className="h-4 w-4 fill-current" />
          </div>
          <p className="text-xl font-extrabold mt-2 font-mono text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
        </Card>

        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="text-xl font-extrabold mt-2 font-mono text-emerald-600 dark:text-emerald-400">{stats.completed}</p>
        </Card>

        <Card className="p-4 border-amber-500/30 bg-amber-500/5 shadow-2xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <span>Paused</span>
            <PauseCircle className="h-4 w-4" />
          </div>
          <p className="text-xl font-extrabold mt-2 font-mono text-amber-600 dark:text-amber-400">{stats.paused}</p>
        </Card>

        <Card className="p-4 border-red-500/30 bg-red-500/5 shadow-2xs">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-semibold">
            <span>Delayed</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <p className="text-xl font-extrabold mt-2 font-mono text-red-600 dark:text-red-400">{stats.delayed}</p>
        </Card>

        <Card className="p-4 border-border/70 bg-card shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
            <span>Units Done</span>
            <Factory className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-extrabold mt-2 font-mono text-foreground">
            {stats.totalDoneUnits} <span className="text-xs font-normal text-muted-foreground">/ {stats.totalTargetUnits}</span>
          </p>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border-border/70 shadow-xs bg-card space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, Material SKU, Description, or Workstation..."
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Machine:</span>
            </div>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="h-9 bg-background border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-primary min-w-[140px]"
            >
              <option value="ALL">All Workstations</option>
              {uniqueMachines.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Status:</span>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 bg-background border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-primary min-w-[130px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PLANNED">Planned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="DELAYED">Delayed</option>
            </select>
          </div>
        </div>
      </Card>

      {/* VIEW 1: PRODUCTION SCHEDULE CALENDAR (MRPeasy Style) */}
      {viewMode === "calendar" ? (
        <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
          {/* MRPeasy Style Header Toolbar */}
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between flex-wrap gap-4 bg-muted/20">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-foreground">Production Schedule</span>
              <div className="flex items-center gap-1 bg-background border border-border/60 p-0.5 rounded-lg text-xs font-semibold">
                <span className="px-2 py-0.5 bg-primary/10 text-primary font-bold rounded">Manufacturing Orders</span>
                <span className="px-2 py-0.5 text-muted-foreground">Operations</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Navigation controls */}
              <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border/60">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-extrabold uppercase font-mono tracking-wider px-2">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Granularity Switcher: Month / Week / Day */}
              <div className="flex items-center bg-background border border-border/60 rounded-lg p-0.5 text-xs font-bold font-mono">
                <button
                  onClick={() => setCalendarGranularity("month")}
                  className={cn("px-2.5 py-1 rounded-md transition-colors", calendarGranularity === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Month
                </button>
                <button
                  onClick={() => setCalendarGranularity("week")}
                  className={cn("px-2.5 py-1 rounded-md transition-colors", calendarGranularity === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Week
                </button>
                <button
                  onClick={() => setCalendarGranularity("day")}
                  className={cn("px-2.5 py-1 rounded-md transition-colors", calendarGranularity === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Day
                </button>
              </div>

              {/* MRPeasy Reference Format Button: Gantt chart Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("gantt")}
                className="h-8 text-xs font-bold gap-1.5 bg-background hover:bg-primary/10 border-border/70 text-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Gantt chart
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 px-4 pb-4">
            {/* Calendar Weekday Header */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-muted-foreground uppercase border-b border-border/40 pb-2.5 mb-2">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>

            {/* Calendar Days Matrix with MRPeasy Spanning Production Bars */}
            <div className="grid grid-cols-7 gap-2 text-xs">
              {calendarDays.map((cd, idx) => {
                if (cd.isPadding) {
                  return <div key={idx} className="min-h-[140px] bg-slate-50/20 dark:bg-slate-900/10 rounded-lg border border-dashed border-border/20" />;
                }

                const dayProcsList = cd.dayProcs || [];

                return (
                  <div
                    key={idx}
                    className="min-h-[140px] rounded-lg p-2 bg-background border border-border/70 flex flex-col justify-between hover:border-primary/40 transition-colors"
                  >
                    <div className="flex justify-between items-center border-b border-border/30 pb-1 mb-1.5">
                      <span className="font-extrabold text-xs font-mono">{cd.dayNum}</span>
                      {dayProcsList.length > 0 && (
                        <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {dayProcsList.length} Jobs
                        </span>
                      )}
                    </div>

                    {/* MRPeasy Style Multi-day Order Schedule Bars */}
                    <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[100px]">
                      {dayProcsList.map((proc: any) => {
                        const startStr = proc.scheduledStart
                          ? `${proc.scheduledStart.getMonth() + 1}/${proc.scheduledStart.getDate()} ${proc.scheduledStart.getHours()}:${String(proc.scheduledStart.getMinutes()).padStart(2, '0')}`
                          : proc.sopStartDate;
                        const endStr = proc.scheduledEnd
                          ? `${proc.scheduledEnd.getMonth() + 1}/${proc.scheduledEnd.getDate()} ${proc.scheduledEnd.getHours()}:${String(proc.scheduledEnd.getMinutes()).padStart(2, '0')}`
                          : "";

                        return (
                          <div
                            key={proc.id}
                            onClick={() => handleOpenLogModal(proc)}
                            className={cn(
                              "p-1.5 rounded-md border text-[10px] cursor-pointer transition-all hover:scale-[1.02] shadow-2xs group relative overflow-hidden",
                              proc.executionStatus === "COMPLETED"
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-950 dark:text-emerald-100"
                                : proc.executionStatus === "IN_PROGRESS"
                                ? "bg-blue-500/20 border-blue-500/40 text-blue-950 dark:text-blue-100 font-bold"
                                : proc.executionStatus === "PAUSED"
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-950 dark:text-amber-100"
                                : proc.executionStatus === "DELAYED"
                                ? "bg-red-500/20 border-red-500/40 text-red-950 dark:text-red-100"
                                : "bg-emerald-500/15 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                            )}
                            title={`Order ${proc.orderId} (${proc.material}): ${startStr} - ${endStr} [${proc.machineName}]`}
                          >
                            <div className="font-extrabold font-mono flex items-center justify-between text-[9.5px]">
                              <span>{startStr} - {endStr || 'EOD'} MO{proc.orderId}</span>
                              <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                            </div>
                            <div className="truncate font-semibold text-[9px] mt-0.5">
                              {proc.material} ({proc.orderQty} pcs)
                            </div>
                            <div className="text-[8.5px] opacity-80 font-mono">
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
          </CardContent>
        </Card>
      ) : viewMode === "gantt" ? (
        /* VIEW 2: WORKSTATION GANTT CHART TIMELINE (Sleek Modern SaaS Layout with Non-Overlapping Sub-Tracks) */
        <Card className="border border-border/80 shadow-md bg-card overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between flex-wrap gap-4 bg-muted/20">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">Workstation Gantt Chart Timeline</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom Controls */}
              <div className="flex items-center bg-background border border-border/60 rounded-lg p-0.5 text-xs font-bold">
                <span className="text-[10px] text-muted-foreground px-2 uppercase font-mono">Zoom:</span>
                <button
                  onClick={() => setGanttZoom("compact")}
                  className={cn("px-2 py-0.5 rounded text-[11px] transition-colors", ganttZoom === "compact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Compact
                </button>
                <button
                  onClick={() => setGanttZoom("normal")}
                  className={cn("px-2 py-0.5 rounded text-[11px] transition-colors", ganttZoom === "normal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Standard
                </button>
                <button
                  onClick={() => setGanttZoom("wide")}
                  className={cn("px-2 py-0.5 rounded text-[11px] transition-colors", ganttZoom === "wide" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  Detailed
                </button>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center gap-1.5 bg-background p-1 rounded-lg border border-border/60">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-extrabold uppercase font-mono tracking-wider px-2">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="h-8 text-xs font-bold gap-1.5 bg-background hover:bg-primary/10 border-border/70 text-foreground"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                Production Schedule
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <div style={{ minWidth: `${200 + daysInCurrentMonth.length * ganttColWidthPx}px` }}>
              {/* Timeline Header Row */}
              <div className="flex border-b border-border/60 bg-muted/50 text-xs font-extrabold text-muted-foreground font-mono sticky top-0 z-20 shadow-2xs">
                <div className="w-56 shrink-0 p-3 border-r border-border/60 flex items-center justify-between bg-card sticky left-0 z-30">
                  <span className="uppercase tracking-wider">Workstation</span>
                  <Factory className="h-3.5 w-3.5 text-primary" />
                </div>

                {/* Day Columns Header */}
                <div className="flex-1 flex">
                  {daysInCurrentMonth.map((day) => (
                    <div
                      key={day.dayNum}
                      style={{ width: `${ganttColWidthPx}px` }}
                      className={cn(
                        "shrink-0 p-1.5 border-r border-border/40 text-center flex flex-col justify-center select-none transition-colors",
                        day.isWeekend ? "bg-slate-100/60 dark:bg-slate-900/40 text-muted-foreground" : "bg-card text-foreground"
                      )}
                    >
                      <span className="text-[9px] uppercase tracking-tighter opacity-70">{day.dayName}</span>
                      <span className="text-xs font-extrabold font-mono">{day.dayNum}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workstation Rows & Non-overlapping Sub-Tracks */}
              <div className="divide-y divide-border/40">
                {uniqueMachines.map((machineName, mIdx) => {
                  const machineProcs = filteredProcesses.filter((p) => p.machineName === machineName || p.machineId === machineName);

                  // Group overlapping processes into non-overlapping sub-tracks
                  const tracks: any[][] = [];
                  machineProcs.forEach((proc) => {
                    if (!proc.scheduledStart) return;
                    const startDay = proc.scheduledStart.getDate();
                    const endDay = proc.scheduledEnd ? proc.scheduledEnd.getDate() : startDay;

                    let placed = false;
                    for (let t = 0; t < tracks.length; t++) {
                      const hasOverlap = tracks[t].some((p) => {
                        const pStart = p.scheduledStart.getDate();
                        const pEnd = p.scheduledEnd ? p.scheduledEnd.getDate() : pStart;
                        return !(endDay < pStart || startDay > pEnd);
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

                  // Ensure at least 1 track is present
                  if (tracks.length === 0) tracks.push([]);

                  return (
                    <div key={machineName} className={cn("flex transition-colors", mIdx % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                      {/* Workstation Sidebar Label */}
                      <div className="w-56 shrink-0 p-3 border-r border-border/60 font-bold text-xs flex flex-col justify-center bg-card sticky left-0 z-10 shadow-2xs">
                        <span className="text-foreground text-sm font-extrabold">{machineName}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                            {machineProcs.length} Operations
                          </span>
                        </div>
                      </div>

                      {/* Tracks Area */}
                      <div className="flex-1 flex flex-col divide-y divide-border/20 relative">
                        {tracks.map((trackProcs, tIdx) => (
                          <div key={tIdx} className="h-14 flex relative items-center">
                            {/* Vertical Grid Day Guides */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {daysInCurrentMonth.map((day) => (
                                <div
                                  key={day.dayNum}
                                  style={{ width: `${ganttColWidthPx}px` }}
                                  className={cn(
                                    "shrink-0 border-r border-border/25 border-dashed h-full",
                                    day.isWeekend && "bg-slate-500/[0.03]"
                                  )}
                                />
                              ))}
                            </div>

                            {/* Positioned Process Gantt Pills */}
                            {trackProcs.map((proc) => {
                              if (!proc.scheduledStart) return null;
                              const startDay = proc.scheduledStart.getDate();
                              const endDay = proc.scheduledEnd ? proc.scheduledEnd.getDate() : startDay;
                              const durationDays = Math.max(1, endDay - startDay + 1);

                              const leftPx = (startDay - 1) * ganttColWidthPx + 2;
                              const widthPx = durationDays * ganttColWidthPx - 4;

                              return (
                                <div
                                  key={proc.id}
                                  onClick={() => handleOpenLogModal(proc)}
                                  style={{
                                    left: `${leftPx}px`,
                                    width: `${Math.max(widthPx, ganttColWidthPx - 4)}px`,
                                  }}
                                  className={cn(
                                    "absolute h-10 rounded-lg border text-xs font-sans cursor-pointer transition-all hover:scale-[1.02] shadow-xs z-10 p-2 flex flex-col justify-between overflow-hidden group",
                                    proc.executionStatus === "COMPLETED"
                                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-950 dark:text-emerald-100"
                                      : proc.executionStatus === "IN_PROGRESS"
                                      ? "bg-blue-500/20 border-blue-500/50 text-blue-950 dark:text-blue-100 font-bold"
                                      : proc.executionStatus === "PAUSED"
                                      ? "bg-amber-500/20 border-amber-500/50 text-amber-950 dark:text-amber-100"
                                      : proc.executionStatus === "DELAYED"
                                      ? "bg-red-500/20 border-red-500/50 text-red-950 dark:text-red-100"
                                      : "bg-emerald-500/15 border-emerald-500/40 text-emerald-950 dark:text-emerald-100"
                                  )}
                                  title={`Order ${proc.orderId} (${proc.material}): Step ${proc.processId} on ${proc.machineName}`}
                                >
                                  {/* Progress bar overlay */}
                                  <div
                                    className="absolute bottom-0 left-0 h-1 bg-emerald-500/60 transition-all"
                                    style={{ width: `${proc.completionPct}%` }}
                                  />

                                  <div className="font-extrabold font-mono text-[10.5px] flex items-center justify-between whitespace-nowrap">
                                    <span className="truncate">MO{proc.orderId} (Step {proc.processId})</span>
                                    <span className="text-[9.5px] opacity-80 shrink-0 font-mono ml-1">{proc.completedQty}/{proc.orderQty} pcs</span>
                                  </div>

                                  <div className="truncate font-semibold text-[9.5px] opacity-90 leading-tight">
                                    {proc.material}
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
          </CardContent>
        </Card>
      ) : (
        /* VIEW 3: DISPATCH OPERATIONS TABLE */
        <Card className="border-border/70 shadow-sm overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 text-xs">
                  <TableHead className="font-bold">Order ID</TableHead>
                  <TableHead className="font-bold">Step</TableHead>
                  <TableHead className="font-bold">Material / SKU</TableHead>
                  <TableHead className="font-bold">Workstation</TableHead>
                  <TableHead className="font-bold">Target SOP Date</TableHead>
                  <TableHead className="font-bold">Operation Description</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="font-bold text-right">Work Done / Target</TableHead>
                  <TableHead className="font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProcesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-xs">
                      No workstation operations found matching your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProcesses.map((proc) => (
                    <TableRow key={proc.id} className="hover:bg-muted/30 transition-colors text-xs">
                      <TableCell className="font-bold font-mono text-foreground">{proc.orderId}</TableCell>
                      <TableCell className="font-mono">{proc.processId}</TableCell>
                      <TableCell className="font-semibold text-primary">{proc.material}</TableCell>
                      <TableCell className="font-bold">{proc.machineName}</TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{proc.sopStartDate || "01-06-2026"}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">{proc.processText}</TableCell>
                      <TableCell className="text-center">
                        <select
                          value={proc.executionStatus}
                          onChange={(e) => updateStepExecutionStatus(proc.id, e.target.value as any)}
                          className="bg-background border border-border/80 rounded px-2 py-1 text-[11px] font-bold outline-none cursor-pointer focus:ring-1 focus:ring-primary"
                        >
                          <option value="PLANNED">PLANNED</option>
                          <option value="IN_PROGRESS">IN PROGRESS</option>
                          <option value="PAUSED">PAUSED</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="DELAYED">DELAYED</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold font-mono">
                            {proc.completedQty} / {proc.orderQty} <span className="text-[10px] text-muted-foreground font-normal">({proc.completionPct}%)</span>
                          </span>
                          <div className="w-24 bg-muted/60 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                proc.completionPct >= 100
                                  ? "bg-emerald-500"
                                  : proc.completionPct > 0
                                  ? "bg-blue-500"
                                  : "bg-muted-foreground/30"
                              }`}
                              style={{ width: `${proc.completionPct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenLogModal(proc)}
                          className="text-[11px] h-7 px-2.5 gap-1 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          Log Progress
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Log Work Done Dialog */}
      <Dialog open={isLogWorkDoneOpen} onOpenChange={setIsLogWorkDoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-primary" />
              Log Daily Work Done — Order {selectedProcessForLog?.orderId} (Step {selectedProcessForLog?.processId})
            </DialogTitle>
          </DialogHeader>

          {selectedProcessForLog && (
            <form onSubmit={handleSaveWorkDone} className="space-y-4 pt-2 text-xs">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-1">
                <p className="font-bold text-foreground">{selectedProcessForLog.material} on Workstation {selectedProcessForLog.machineName}</p>
                <p className="text-[11px] text-muted-foreground">Target Order Quantity: <span className="font-bold font-mono text-foreground">{selectedProcessForLog.orderQty} units</span></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="log-completed" className="text-xs font-semibold">Completed Qty Done</Label>
                  <Input
                    id="log-completed"
                    type="number"
                    value={logCompletedQty}
                    onChange={(e) => setLogCompletedQty(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="log-scrap" className="text-xs font-semibold">Scrap / Defect Qty</Label>
                  <Input
                    id="log-scrap"
                    type="number"
                    value={logScrapQty}
                    onChange={(e) => setLogScrapQty(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="log-notes" className="text-xs font-semibold">Operator / Workstation Notes</Label>
                <textarea
                  id="log-notes"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. Completed first shift batch of 50 units. Tool calibration done."
                  className="w-full bg-background border border-input rounded-md p-2 text-xs min-h-[70px] outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsLogWorkDoneOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                  Save Work Log
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
