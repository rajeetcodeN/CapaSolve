import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppStore, calculateExecutionStats } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play,
  ListOrdered,
  BarChart3,
  Cloud,
  CloudUpload,
  CloudDownload,
  ShieldAlert,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  Download,
  Info,
  Sparkles,
  Layers,
  FileCheck,
  Check,
  CheckCheck,
  Activity,
  Pause,
  Clock,
  AlertTriangle,
  Search,
  ArrowRight,
  CheckCircle2,
  Printer,
  Trash2,
  Gauge,
  Flame,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseSOPDate } from "@/lib/scheduler";
import { DataCleaningHub } from "@/components/DataCleaningHub";
import { SAMPLE_DATASETS } from "@/lib/sampleCsvDatasets";
import { ExampleDatasetsModal } from "@/components/modals/ExampleDatasetsModal";
import { QuickOverviewPopover } from "@/components/QuickOverviewPopover";
import { HoldReasonModal } from "@/components/modals/HoldReasonModal";
import { LogScrapModal } from "@/components/modals/LogScrapModal";
import { JobTravelerSheet } from "@/components/JobTravelerSheet";
import { HoldReason, ScrapReason, Order } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CapaSolve" },
      { name: "description", content: "Manufacturing scheduling overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [uploadedRawCsvText, setUploadedRawCsvText] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  const {
    orders,
    processes,
    machines,
    slots,
    warnings,
    runScheduler,
    saveToCloud,
    loadFromCloud,
    isCloudSaving,
    isCloudLoading,
    role,
    plan,
    clearAll,
    loadFromCSVText,
    loadDefaultCSV,
    updateStepExecutionStatus,
    releaseAllScheduled,
    simulateShopFloorProgress,
    resetAllExecutionStatuses,
    checkMaterialReadiness,
    logScrap,
  } = useAppStore();
  const { t } = useTranslations();
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  // Modals for Reason Telemetry & Job Traveler
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [selectedProcessForHold, setSelectedProcessForHold] = useState<any>(null);

  const [scrapModalOpen, setScrapModalOpen] = useState(false);
  const [selectedProcessForScrap, setSelectedProcessForScrap] = useState<any>(null);

  const [travelerModalOpen, setTravelerModalOpen] = useState(false);
  const [selectedOrderForTraveler, setSelectedOrderForTraveler] = useState<Order | null>(null);
  const [travelerProcesses, setTravelerProcesses] = useState<any[]>([]);

  // Shop Floor Execution & Dispatch State
  const [selectedExecutionFilter, setSelectedExecutionFilter] = useState<
    "ALL" | "QUEUED" | "HOLD" | "RELEASED" | "RUNNING" | "DONE"
  >("ALL");
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [selectedDispatchMachine, setSelectedDispatchMachine] = useState<string>("ALL");
  const [dispatchPage, setDispatchPage] = useState(1);
  const DISPATCH_ITEMS_PER_PAGE = 8;

  const scheduledCount = processes.filter((p) => p.status === "SCHEDULED").length;
  const execStats = useMemo(() => calculateExecutionStats(processes), [processes]);

  // Enriched processes with parent order & workstation metadata
  const enrichedProcesses = useMemo(() => {
    return processes.map((proc) => {
      const parentOrder = orders.find((o) => o.id === proc.orderId || o.orderId === proc.orderId);
      const machine = machines.find((m) => m.id === proc.machineId);
      const orderQty = parentOrder?.orderQty || 100;
      const completedQty = proc.completedQty || 0;
      const scrapQty = proc.scrapQty || 0;
      const completionPct = Math.min(100, Math.round((completedQty / orderQty) * 100));

      let effectiveStatus: "QUEUED" | "HOLD" | "RELEASED" | "RUNNING" | "DONE" = "QUEUED";
      if (proc.executionStatus === "COMPLETED" || completionPct >= 100) {
        effectiveStatus = "DONE";
      } else if (proc.executionStatus === "IN_PROGRESS" || completedQty > 0) {
        effectiveStatus = "RUNNING";
      } else if (proc.executionStatus === "PAUSED") {
        effectiveStatus = "HOLD";
      } else if (proc.status === "SCHEDULED" || proc.executionStatus === "PLANNED") {
        effectiveStatus = "RELEASED";
      }

      return {
        ...proc,
        parentOrder,
        machine,
        orderQty,
        completedQty,
        scrapQty,
        completionPct,
        effectiveStatus,
        displayWO: parentOrder?.orderId || proc.orderId,
      };
    });
  }, [processes, orders, machines]);

  // Filter & Search dispatch processes
  const filteredDispatchProcesses = useMemo(() => {
    return enrichedProcesses.filter((proc) => {
      if (selectedExecutionFilter !== "ALL" && proc.effectiveStatus !== selectedExecutionFilter) {
        return false;
      }
      if (selectedDispatchMachine !== "ALL") {
        if (
          proc.machineId !== selectedDispatchMachine &&
          proc.machine?.name !== selectedDispatchMachine
        ) {
          return false;
        }
      }
      if (dispatchSearch.trim()) {
        const q = dispatchSearch.toLowerCase();
        const matchesWO = proc.displayWO.toLowerCase().includes(q);
        const matchesText = proc.processText?.toLowerCase().includes(q) || false;
        const matchesMachine = (proc.machine?.name || proc.machineId)?.toLowerCase().includes(q);
        const matchesMaterial = proc.parentOrder?.material?.toLowerCase().includes(q) || false;
        if (!matchesWO && !matchesText && !matchesMachine && !matchesMaterial) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedProcesses, selectedExecutionFilter, selectedDispatchMachine, dispatchSearch]);

  // Executive Metric 1: Projected On-Time Delivery (OTD %)
  const otdMetrics = useMemo(() => {
    if (orders.length === 0) return { otdPct: 100, onTimeCount: 0, lateCount: 0, total: 0 };

    let onTimeCount = 0;
    let lateCount = 0;

    orders.forEach((o) => {
      const orderProcs = processes.filter((p) => p.orderId === o.id || p.orderId === o.orderId);
      const scheduledProcs = orderProcs.filter((p) => p.status === "SCHEDULED" && p.scheduledEnd);

      if (scheduledProcs.length === 0) {
        onTimeCount++;
        return;
      }

      let maxEnd = 0;
      scheduledProcs.forEach((p) => {
        const t = new Date(p.scheduledEnd!).getTime();
        if (t > maxEnd) maxEnd = t;
      });

      let dueTime: number;
      if (o.customerDueDate) {
        dueTime = new Date(o.customerDueDate).getTime();
      } else {
        const sopD = parseSOPDate(o.sopStartDate, o.sopStartTime || "00:00:00");
        dueTime = sopD.getTime() + 5 * 24 * 3600 * 1000;
      }

      if (!isNaN(dueTime) && maxEnd > dueTime) {
        lateCount++;
      } else {
        onTimeCount++;
      }
    });

    const total = onTimeCount + lateCount;
    const otdPct = total > 0 ? parseFloat(((onTimeCount / total) * 100).toFixed(1)) : 100;
    return { otdPct, onTimeCount, lateCount, total };
  }, [orders, processes]);

  // Executive Metric 2: Critical Plant Bottleneck Indicator
  const bottleneckMetrics = useMemo(() => {
    if (machines.length === 0 || slots.length === 0) {
      return {
        hasBottleneck: false,
        criticalMachine: null,
        maxUtilPct: 0,
        delayedOrdersCount: 0,
      };
    }

    const dates = new Set<string>();
    slots.forEach((s) => {
      if (s.date) dates.add(s.date);
    });
    const availableMinutesPerMachine = Math.max(1, dates.size) * 14 * 60;

    const machineLoads: Record<string, number> = {};
    machines.forEach((m) => {
      machineLoads[m.id] = 0;
    });

    slots.forEach((s) => {
      if (machineLoads[s.machineId] !== undefined) {
        machineLoads[s.machineId] += s.minutesUsed;
      }
    });

    let maxLoad = 0;
    let bottleneckMachineId = machines[0]?.id;

    Object.entries(machineLoads).forEach(([mId, load]) => {
      if (load > maxLoad) {
        maxLoad = load;
        bottleneckMachineId = mId;
      }
    });

    const maxUtilPct =
      availableMinutesPerMachine > 0
        ? parseFloat(((maxLoad / availableMinutesPerMachine) * 100).toFixed(1))
        : 0;

    const criticalMachineObj = machines.find((m) => m.id === bottleneckMachineId) || null;
    const delayedCount = warnings.filter(
      (w) => typeof w === "string" && w.includes(bottleneckMachineId),
    ).length;

    return {
      hasBottleneck: maxUtilPct > 95,
      criticalMachine: criticalMachineObj,
      maxUtilPct,
      delayedOrdersCount: Math.max(delayedCount, maxUtilPct > 100 ? 3 : 0),
    };
  }, [machines, slots, warnings]);

  const totalDispatchPages = Math.max(
    1,
    Math.ceil(filteredDispatchProcesses.length / DISPATCH_ITEMS_PER_PAGE),
  );
  const paginatedDispatchProcesses = useMemo(() => {
    const start = (dispatchPage - 1) * DISPATCH_ITEMS_PER_PAGE;
    return filteredDispatchProcesses.slice(start, start + DISPATCH_ITEMS_PER_PAGE);
  }, [filteredDispatchProcesses, dispatchPage]);

  // Row-level execution actions
  const handleStartStep = (stepId: string) => {
    updateStepExecutionStatus(stepId, "IN_PROGRESS");
    toast.success("Dispatched operation: running on shop floor!");
  };

  const handleInitiateHold = (proc: any) => {
    setSelectedProcessForHold(proc);
    setHoldModalOpen(true);
  };

  const handleConfirmHold = (reason: HoldReason, notes: string) => {
    if (!selectedProcessForHold) return;
    updateStepExecutionStatus(
      selectedProcessForHold.id,
      "PAUSED",
      undefined,
      undefined,
      notes,
      reason,
    );
    toast.info(`Operation paused: placed on HOLD (${reason}).`);
  };

  const handleInitiateScrap = (proc: any) => {
    setSelectedProcessForScrap(proc);
    setScrapModalOpen(true);
  };

  const handleConfirmScrap = (scrapQty: number, reason: ScrapReason, notes: string) => {
    if (!selectedProcessForScrap) return;
    logScrap(selectedProcessForScrap.id, scrapQty, reason, notes);
  };

  const handleOpenTraveler = (orderIdStr: string) => {
    const ord = orders.find((o) => o.id === orderIdStr || o.orderId === orderIdStr);
    if (!ord) {
      toast.error(`Could not locate order ${orderIdStr}`);
      return;
    }
    const procs = processes.filter((p) => p.orderId === ord.id || p.orderId === ord.orderId);
    setSelectedOrderForTraveler(ord);
    setTravelerProcesses(procs);
    setTravelerModalOpen(true);
  };

  const handleCompleteStep = (stepId: string, targetQty: number) => {
    updateStepExecutionStatus(stepId, "COMPLETED", targetQty);
    toast.success("Operation marked COMPLETED!");
  };

  const handleResetStep = (stepId: string) => {
    updateStepExecutionStatus(stepId, "PLANNED", 0);
    toast.info("Operation reset to Released queue.");
  };

  const formatTimeWindow = (startStr: string | null, endStr: string | null) => {
    if (!startStr || !endStr) return "Awaiting Dispatch";
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const startFmt = s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const endFmt = e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateFmt = s.toLocaleDateString([], { month: "short", day: "numeric" });
      return `${dateFmt} ${startFmt} - ${endFmt}`;
    } catch {
      return "Scheduled";
    }
  };

  const processFile = (file: File) => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only users with the Developer or Admin role can upload or change production datasets.",
      );
      return;
    }
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".tsv") && !fileName.endsWith(".txt")) {
      toast.error("Please upload a valid CSV or TSV spreadsheet file.");
      return;
    }

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setUploadedRawCsvText(text);
        toast.success(
          `File "${file.name}" uploaded successfully! Opening Data Cleaning Assistant...`,
        );
      } catch (err) {
        toast.error("Failed to read CSV file.");
        console.error(err);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const onRun = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Guests have view-only access. Only Developers or Admins can run the scheduler.",
      );
      return;
    }
    runScheduler();
    toast.success(t("common.allCompatible"));
    navigate({ to: "/gantt" });
  };

  const onSaveToCloud = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only Developers or Admins can modify or save schedules to the cloud.",
      );
      return;
    }
    saveToCloud();
  };

  const onLoadFromCloud = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only Developers or Admins can load external cloud data.");
      return;
    }
    loadFromCloud();
  };

  const handleReset = async () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only users with the Developer or Admin role can reset the scheduler to factory seeding.",
      );
      return;
    }
    setImporting(true);
    try {
      await loadDefaultCSV();
      runScheduler();
      toast.success("Default factory seed dataset loaded successfully!");
    } catch (e) {
      toast.error("Failed to load default seed data.");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadBlankTemplate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const blankCsvContent =
      'Order,Order Process ID,Material,Machine,Maschine-Group,Process Text,SOP Start Date,Order QTY,Base-Qty each process,Set up Time (Not related to any qty),Unit,Process time (related to qty),Unit,Manpower Utilization,Unit,SOP Start time\n100101,10,MAT-PART-01,603011,M1,"OPERATION DESC SAMPLE",01-06-2026,100,1,60,MIN,5.0,MIN,1.0,MIN,08:00:00\n100101,20,MAT-PART-01,603012,M2,"OPERATION STEP 20",01-06-2026,100,1,30,MIN,2.5,MIN,1.0,MIN,10:30:00\n';
    const blob = new Blob([blankCsvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "capasolve_empty_production_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded blank production CSV template!");
  };

  const handleLoadSample = (sampleContent: string, sampleName: string) => {
    setUploadedRawCsvText(sampleContent);
    toast.success(`Loaded sample dataset: ${sampleName}`);
  };

  const handleClearAll = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only users with the Developer or Admin role can clear the scheduler data.",
      );
      return;
    }
    clearAll();
    setUploadedRawCsvText("");
    toast.info("Active dataset cleared.");
  };

  // If a file is uploaded, show the Data Cleaning and Mapping editor Hub right here on the dashboard
  if (uploadedRawCsvText) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4 border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Data Cleaning Wizard</h1>
            <p className="text-xs text-muted-foreground">
              Confirm column mappings and resolve file anomalies before loading.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUploadedRawCsvText("")}
            className="cursor-pointer"
          >
            Cancel
          </Button>
        </div>
        <DataCleaningHub
          initialCsvText={uploadedRawCsvText}
          onSaved={() => {
            setUploadedRawCsvText("");
            runScheduler();
          }}
          onCancel={() => setUploadedRawCsvText("")}
        />
      </div>
    );
  }

  // If there are no orders loaded, show the primary Import dropzone as the main dashboard screen
  if (orders.length === 0) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300 pb-12">
        {/* Role-based Information Banner */}
        {role === "GUEST" && (
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 p-4 rounded-xl shadow-2xs">
            <ShieldAlert className="h-5 w-5 shrink-0 text-slate-500" />
            <div className="text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">
                Guest Mode Active:
              </span>{" "}
              You have view-only rights. Use the role switcher in the header to change roles and
              inspect different permissions.
            </div>
          </div>
        )}

        <div className="text-center space-y-2 py-4">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              {t("dashboard.title")}
            </h1>
            <QuickOverviewPopover className="h-9 w-9 rounded-xl shadow-xs" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Configure your manufacturing timeline by uploading a production orders spreadsheet,
            downloading our blank template, or exploring pre-filled industry sample datasets.
          </p>
        </div>

        {/* Primary Upload Dropzone */}
        <Card
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed transition-all p-10 text-center rounded-2xl bg-card/50 backdrop-blur-sm shadow-xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer ${
            isDragOver
              ? "border-primary bg-primary/10 scale-[1.01] shadow-2xl ring-2 ring-primary/40 text-primary"
              : "border-border/80 hover:border-primary/50 hover:bg-card/80"
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />

          <div
            className={`p-4 rounded-full mb-4 transition-all duration-300 ${
              isDragOver
                ? "bg-primary text-primary-foreground scale-110 animate-bounce"
                : "bg-primary/10 text-primary group-hover:scale-110"
            }`}
          >
            <Upload className="h-9 w-9" />
          </div>

          <h3 className="text-lg font-bold text-foreground">
            {isDragOver ? "Drop your CSV file here to upload" : "Upload Production Orders"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1 mb-6 leading-relaxed">
            Drag and drop or select your scheduling CSV spreadsheet containing columns for Order
            code, Material details, Process ID steps, Quantities, and target SOP Dates.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div
            className="flex flex-wrap justify-center items-center gap-3 relative z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 shadow-md cursor-pointer text-xs gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Select CSV File
            </Button>
            <Button
              onClick={() => setIsExampleModalOpen(true)}
              variant="outline"
              size="lg"
              className="border-primary/40 text-primary hover:bg-primary/10 font-bold px-5 shadow-sm cursor-pointer text-xs gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              Load Factory Example Datasets
            </Button>
            <Button
              onClick={handleDownloadBlankTemplate}
              variant="ghost"
              size="lg"
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download Blank Template (.csv)
            </Button>
          </div>
        </Card>

        {/* Informational Cards Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Expected CSV Format & Column Schema */}
          <Card className="border border-border/80 shadow-sm bg-card flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <FileCheck className="h-4 w-4 text-emerald-500" />
                Expected Production CSV Format & Schema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                Our smart CSV parser automatically recognizes English, German, and custom ERP header
                names. Make sure your file includes these columns:
              </p>
              <div className="space-y-2">
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    Order ID{" "}
                    <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    Order, WorkOrder, Auftrag, JobID
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    Step / Process ID{" "}
                    <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    Order Process ID, Step No, Vorgang
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    Material / SKU{" "}
                    <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    Material, Product Code, SKU, PartNo
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    Machine / Line{" "}
                    <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    Machine, Assembly Line, Workstation
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    SOP Start Date{" "}
                    <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    SOP Start Date, ScheduledDate, Startdatum
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    Order Quantity{" "}
                    <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    Order QTY, Quantity, Menge, BatchQty
                  </span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">
                    Setup & Process Times{" "}
                    <span className="text-muted-foreground text-[9px] font-mono ml-1">
                      OPTIONAL
                    </span>
                  </span>
                  <span className="font-mono text-muted-foreground text-[10px]">
                    Set up Time, Process time, RunMins
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Supported Manufacturing Scenarios */}
          <Card className="border border-border/80 shadow-sm bg-card flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Layers className="h-4 w-4 text-indigo-500" />
                Supported Manufacturing Resource Types
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-[9px] bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded">
                    JOB SHOP
                  </span>
                  Precision CNC & Machining Workshops
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sequence multi-operation parts (Milling, Drilling, Grinding) across machine groups
                  (M1, M2) while respecting setup times and operator capacity.
                </p>
              </div>

              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-[9px] bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded">
                    ASSEMBLY
                  </span>
                  Assembly Lines & Sequential Workstations
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Manage assembly lines (Line Alpha, Line Beta) with station section codes, line
                  setup, and crew headcount constraints.
                </p>
              </div>

              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-[9px] bg-purple-500/10 text-purple-500 px-1 py-0.5 rounded">
                    HIGH VOLUME
                  </span>
                  Injection Molding & Electronics SMT
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Optimize multi-cavity mold changeovers, SMT placement rates, reflow oven zones,
                  and automated optical inspection routines.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* One-Click Pre-Filled Sample Industry Datasets Grid */}
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Pre-Filled Industry Sample Datasets
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Click any dataset to instantly load 30 rows of realistic factory data into the Gantt
                & Capacity solver.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {SAMPLE_DATASETS.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => handleLoadSample(sample.content, sample.name)}
                  className="group p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                        {sample.icon}
                      </span>
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {sample.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {sample.description}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-muted-foreground">{sample.industry}</span>
                    <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Load Data &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Role-based Information Banner */}
      {role === "GUEST" && (
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 p-4 rounded-xl shadow-2xs">
          <ShieldAlert className="h-5 w-5 shrink-0 text-slate-500" />
          <div className="text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Guest Mode Active:</span>{" "}
            You have view-only rights. Use the role switcher in the header to change roles and
            inspect different permissions.
          </div>
        </div>
      )}

      {/* 1. Streamlined Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
                <BarChart3 className="h-4 w-4" />
              </div>
              {t("dashboard.title")}
            </h1>
            <Badge className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800/80 text-[11px] gap-1.5 font-mono shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              AI Engine Connected
            </Badge>
            <QuickOverviewPopover />
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {role !== "DEVELOPER" && role !== "ADMIN" && (
            <span className="text-xs text-muted-foreground mr-2 border border-border px-2.5 py-1 rounded bg-muted/50">
              Developer/Admin role required to modify
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="cursor-pointer font-medium text-xs h-8.5 px-3.5 gap-1.5 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-2xs rounded-lg"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" /> Upload CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            disabled={importing}
            className="text-rose-600 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer font-medium text-xs h-8.5 px-3.5 rounded-lg shadow-2xs"
          >
            Clear Active Data
          </Button>
          <Button
            onClick={onRun}
            size="sm"
            className={`gap-1.5 cursor-pointer font-semibold text-xs h-8.5 px-4 bg-[#1e3f2e] hover:bg-[#27533d] text-white shadow-xs border border-[#27533d] rounded-lg ${role !== "DEVELOPER" && role !== "ADMIN" ? "opacity-70" : ""}`}
          >
            <Play className="h-3.5 w-3.5" /> {t("dashboard.generate")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t("dashboard.orders")}
          value={orders.length}
          icon={<ListOrdered className="h-4 w-4 text-slate-400" />}
        />
        <Stat
          label={t("dashboard.processes")}
          value={processes.length}
          icon={<Play className="h-4 w-4 text-slate-400" />}
        />
        <Stat
          label={t("dashboard.machines")}
          value={machines.length}
          icon={<BarChart3 className="h-4 w-4 text-slate-400" />}
        />
        <Stat
          label={t("dashboard.scheduledProcesses")}
          value={scheduledCount}
          icon={<ShieldAlert className="h-4 w-4 text-slate-400" />}
          hint={
            slots.length > 0
              ? `${warnings.length} ${t("dashboard.activeWarnings")}`
              : t("dashboard.notGenerated")
          }
        />
      </div>

      {/* Executive Operational Intelligence Bar: Factory Velocity & Bottleneck Alert */}
      {orders.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {/* Card 1: Factory Velocity & Projected On-Time Delivery (OTD) */}
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8.5 w-8.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Gauge className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Factory Velocity & Projected OTD
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{otdMetrics.otdPct}%</span>
                    <Badge
                      className={cn(
                        "text-[10px] font-mono",
                        otdMetrics.otdPct >= 90
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
                      )}
                    >
                      {otdMetrics.otdPct >= 90 ? "On Schedule" : "Attention Required"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {otdMetrics.onTimeCount}
                </span>{" "}
                / {otdMetrics.total} Orders On-Time
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  otdMetrics.otdPct >= 90 ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{ width: `${otdMetrics.otdPct}%` }}
              />
            </div>
          </Card>

          {/* Card 2: Critical Plant Bottleneck Indicator */}
          <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs rounded-xl overflow-hidden p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "h-8.5 w-8.5 rounded-lg border flex items-center justify-center shrink-0",
                    bottleneckMetrics.hasBottleneck
                      ? "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                      : "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  <Flame className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Critical Line Bottleneck Indicator
                  </div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
                    {bottleneckMetrics.criticalMachine ? (
                      <>
                        <span>
                          {bottleneckMetrics.criticalMachine.name ||
                            bottleneckMetrics.criticalMachine.id}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          ({bottleneckMetrics.maxUtilPct}%)
                        </span>
                      </>
                    ) : (
                      "No Data"
                    )}
                  </div>
                </div>
              </div>
              <Badge
                className={cn(
                  "text-[10px] font-mono",
                  bottleneckMetrics.hasBottleneck
                    ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
                )}
              >
                {bottleneckMetrics.hasBottleneck ? "Critical Bottleneck" : "Capacity Balanced"}
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground line-clamp-1">
              {bottleneckMetrics.hasBottleneck
                ? `Workstation is at ${bottleneckMetrics.maxUtilPct}% capacity — ${bottleneckMetrics.delayedOrdersCount} scheduling conflicts or overtime risks detected.`
                : `All lines operating within safe capacity limits (Peak utilization: ${bottleneckMetrics.maxUtilPct}%).`}
            </p>
          </Card>
        </div>
      )}

      {/* Shop Floor Execution Status & Dispatch Queue */}
      {processes.length > 0 && (
        <Card className="border border-border/80 shadow-xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Activity className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base font-semibold tracking-tight">
                    Shop Floor Execution & Dispatch Queue
                  </CardTitle>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                    {execStats.running > 0 ? (
                      <>
                        <span className="relative flex h-2 w-2 mr-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {execStats.running} Active on Floor
                      </>
                    ) : (
                      "Ready for Dispatch"
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Live execution status tracking, floor unit progress, and work center dispatch
                  actions.
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => simulateShopFloorProgress()}
                  className="cursor-pointer text-xs h-8 gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/60 font-medium"
                  title="Simulate shop floor production progress across machines"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Simulate Progress
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => releaseAllScheduled()}
                  className="cursor-pointer text-xs h-8 gap-1.5 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  title="Release all scheduled operations to shop floor"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-slate-500" /> Release All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetAllExecutionStatuses()}
                  className="cursor-pointer text-xs h-8 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5"
                  title="Reset all operation statuses"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  asChild
                  variant="default"
                  size="sm"
                  className="cursor-pointer text-xs h-8 gap-1.5 bg-[#1e3f2e] hover:bg-[#27533d] text-white"
                >
                  <Link to="/status">
                    Schedule Calendar <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Status Filter Pills Bar - Matching Screenshot Exactly */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* ALL */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExecutionFilter("ALL");
                    setDispatchPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedExecutionFilter === "ALL"
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 shadow-2xs font-semibold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850",
                  )}
                >
                  <span>All</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                    {processes.length}
                  </span>
                </button>

                {/* QUEUED */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExecutionFilter(
                      selectedExecutionFilter === "QUEUED" ? "ALL" : "QUEUED",
                    );
                    setDispatchPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedExecutionFilter === "QUEUED"
                      ? "bg-slate-800 text-white border-slate-900 shadow-2xs font-semibold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850",
                  )}
                >
                  <span>Queued</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                    {execStats.queued}
                  </span>
                </button>

                {/* HOLD */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExecutionFilter(selectedExecutionFilter === "HOLD" ? "ALL" : "HOLD");
                    setDispatchPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedExecutionFilter === "HOLD"
                      ? "bg-amber-600 text-white border-amber-700 shadow-2xs font-semibold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850",
                  )}
                >
                  <span>Hold</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                    {execStats.hold}
                  </span>
                </button>

                {/* RELEASED */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExecutionFilter(
                      selectedExecutionFilter === "RELEASED" ? "ALL" : "RELEASED",
                    );
                    setDispatchPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedExecutionFilter === "RELEASED"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-2xs font-semibold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850",
                  )}
                >
                  <span>Released</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                    {execStats.released}
                  </span>
                </button>

                {/* RUNNING */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExecutionFilter(
                      selectedExecutionFilter === "RUNNING" ? "ALL" : "RUNNING",
                    );
                    setDispatchPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedExecutionFilter === "RUNNING"
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-800 shadow-2xs font-semibold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850",
                  )}
                >
                  <span className="flex items-center gap-1">
                    {execStats.running > 0 && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                    Running
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                    {execStats.running}
                  </span>
                </button>

                {/* DONE */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExecutionFilter(selectedExecutionFilter === "DONE" ? "ALL" : "DONE");
                    setDispatchPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedExecutionFilter === "DONE"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600 shadow-2xs font-semibold"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850",
                  )}
                >
                  <span>Done</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                    {execStats.done}
                  </span>
                </button>
              </div>

              {/* Filter Controls: Machine Quick Filter & Search */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Select
                  value={selectedDispatchMachine}
                  onValueChange={(val) => {
                    setSelectedDispatchMachine(val);
                    setDispatchPage(1);
                  }}
                >
                  <SelectTrigger className="w-[170px] h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
                    <SelectValue placeholder="All Workstations" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
                    <SelectItem value="ALL" className="text-xs">
                      All Workstations
                    </SelectItem>
                    {machines.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name || m.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search WO, step, machine..."
                    value={dispatchSearch}
                    onChange={(e) => {
                      setDispatchSearch(e.target.value);
                      setDispatchPage(1);
                    }}
                    className="h-8 pl-8 text-xs bg-background rounded-md"
                  />
                  {dispatchSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setDispatchSearch("");
                        setDispatchPage(1);
                      }}
                      className="absolute right-2 top-2 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-md border border-border/70 overflow-hidden bg-background">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/60">
                  <TableRow>
                    <TableHead className="w-[180px] text-xs font-semibold">
                      Work Order / Material
                    </TableHead>
                    <TableHead className="w-[170px] text-xs font-semibold">
                      Operation & Step
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold">Workstation</TableHead>
                    <TableHead className="w-[170px] text-xs font-semibold">
                      Schedule Window
                    </TableHead>
                    <TableHead className="w-[150px] text-xs font-semibold">
                      Progress / Units
                    </TableHead>
                    <TableHead className="w-[110px] text-xs font-semibold">Status</TableHead>
                    <TableHead className="w-[150px] text-right text-xs font-semibold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDispatchProcesses.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-32 text-center text-muted-foreground text-xs"
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Activity className="h-6 w-6 text-slate-300 dark:text-slate-700" />
                          <span>No operations match current filters.</span>
                          {(selectedExecutionFilter !== "ALL" || dispatchSearch) && (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-xs h-auto p-0 text-primary"
                              onClick={() => {
                                setSelectedExecutionFilter("ALL");
                                setDispatchSearch("");
                                setDispatchPage(1);
                              }}
                            >
                              Reset filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDispatchProcesses.map((proc) => {
                      return (
                        <TableRow
                          key={proc.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50"
                        >
                          {/* Work Order & Material */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col">
                              <span className="font-semibold text-xs text-foreground font-mono">
                                {proc.displayWO}
                              </span>
                              <span
                                className="text-[11px] text-muted-foreground truncate max-w-[160px]"
                                title={proc.parentOrder?.material || "Standard Item"}
                              >
                                {proc.parentOrder?.material || "Standard Item"}
                              </span>
                              {(() => {
                                const readinessInfo = checkMaterialReadiness(
                                  proc.parentOrder?.material || "",
                                  proc.orderQty || 100,
                                );
                                return (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    {readinessInfo.readiness === "READY" ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Material Ready
                                      </span>
                                    ) : readinessInfo.readiness === "LOW_STOCK" ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Low Stock ({readinessInfo.available})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        Shortage
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>

                          {/* Operation & Step */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                  Step {proc.processId}
                                </span>
                                <span className="font-semibold text-xs text-foreground truncate max-w-[100px]">
                                  {proc.processText || "Processing"}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                {proc.totalTimeMin} min · R:{proc.setupTimeMin}m M:
                                {proc.processTimeMin}m
                              </span>
                            </div>
                          </TableCell>

                          {/* Workstation */}
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className="font-mono text-[11px] font-medium px-2 py-0 bg-slate-50 dark:bg-slate-850"
                              >
                                {proc.machine?.name || proc.machineId || "Unassigned"}
                              </Badge>
                            </div>
                          </TableCell>

                          {/* Schedule Window */}
                          <TableCell className="py-2.5">
                            <span className="text-xs text-muted-foreground block">
                              {formatTimeWindow(proc.scheduledStart, proc.scheduledEnd)}
                            </span>
                          </TableCell>

                          {/* Progress / Units & Scrap */}
                          <TableCell className="py-2.5">
                            <div className="flex flex-col gap-1 w-full max-w-[130px]">
                              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                <span>
                                  {proc.completedQty} / {proc.orderQty}
                                </span>
                                <span className="flex items-center gap-1">
                                  {proc.scrapQty && proc.scrapQty > 0 ? (
                                    <span className="text-red-500 font-bold">
                                      +{proc.scrapQty} scrap
                                    </span>
                                  ) : null}
                                  <span>{proc.completionPct}%</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    proc.effectiveStatus === "DONE"
                                      ? "bg-emerald-500"
                                      : proc.effectiveStatus === "RUNNING"
                                        ? "bg-emerald-600"
                                        : proc.effectiveStatus === "HOLD"
                                          ? "bg-amber-500"
                                          : "bg-slate-400",
                                  )}
                                  style={{ width: `${proc.completionPct}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell className="py-2.5">
                            {proc.effectiveStatus === "RUNNING" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Running
                              </span>
                            )}
                            {proc.effectiveStatus === "HOLD" && (
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                                  <Pause className="w-3 h-3" /> Hold
                                </span>
                                {proc.holdReason && (
                                  <span
                                    className="text-[9px] font-mono text-amber-600 dark:text-amber-400 truncate max-w-[110px]"
                                    title={proc.holdReason}
                                  >
                                    {proc.holdReason.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>
                            )}
                            {proc.effectiveStatus === "RELEASED" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                                <Clock className="w-3 h-3 text-slate-500" /> Released
                              </span>
                            )}
                            {proc.effectiveStatus === "QUEUED" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-850 dark:text-slate-400 dark:border-slate-800">
                                Queued
                              </span>
                            )}
                            {proc.effectiveStatus === "DONE" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Done
                              </span>
                            )}
                          </TableCell>

                          {/* Quick 1-Click Action Buttons */}
                          <TableCell className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Print Job Traveler */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleOpenTraveler(
                                    proc.parentOrder?.id ||
                                      proc.parentOrder?.orderId ||
                                      proc.orderId,
                                  )
                                }
                                className="cursor-pointer text-xs h-7 px-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                title="Print Shop Floor Job Traveler"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>

                              {(proc.effectiveStatus === "RELEASED" ||
                                proc.effectiveStatus === "QUEUED") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartStep(proc.id)}
                                  className="cursor-pointer text-xs h-7 px-2.5 gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/50"
                                  title="Dispatch & Start operation"
                                >
                                  <Play className="h-3 w-3 fill-emerald-600 text-emerald-600" />{" "}
                                  Start
                                </Button>
                              )}

                              {proc.effectiveStatus === "RUNNING" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleInitiateHold(proc)}
                                    className="cursor-pointer text-xs h-7 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200 dark:border-amber-900/50"
                                    title="Hold operation with reason telemetry"
                                  >
                                    <Pause className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleInitiateScrap(proc)}
                                    className="cursor-pointer text-xs h-7 px-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Log Scrap / Defect pieces"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCompleteStep(proc.id, proc.orderQty)}
                                    className="cursor-pointer text-xs h-7 px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                    title="Mark complete"
                                  >
                                    <Check className="h-3 w-3" /> Done
                                  </Button>
                                </>
                              )}

                              {proc.effectiveStatus === "HOLD" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStartStep(proc.id)}
                                    className="cursor-pointer text-xs h-7 px-2.5 gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/50"
                                    title="Resume operation"
                                  >
                                    <Play className="h-3 w-3 fill-emerald-600 text-emerald-600" />{" "}
                                    Resume
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleInitiateScrap(proc)}
                                    className="cursor-pointer text-xs h-7 px-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                    title="Log Scrap / Defect pieces"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleResetStep(proc.id)}
                                    className="cursor-pointer text-xs h-7 px-1.5 text-slate-400 hover:text-slate-700"
                                    title="Release back to queue"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </Button>
                                </>
                              )}

                              {proc.effectiveStatus === "DONE" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetStep(proc.id)}
                                  className="cursor-pointer text-xs h-7 px-2 text-slate-400 hover:text-slate-700"
                                  title="Re-open operation"
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" /> Reopen
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls & Item Counts */}
            {filteredDispatchProcesses.length > DISPATCH_ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Showing {(dispatchPage - 1) * DISPATCH_ITEMS_PER_PAGE + 1} -{" "}
                  {Math.min(
                    dispatchPage * DISPATCH_ITEMS_PER_PAGE,
                    filteredDispatchProcesses.length,
                  )}{" "}
                  of {filteredDispatchProcesses.length} operations
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={dispatchPage <= 1}
                    onClick={() => setDispatchPage((p) => Math.max(1, p - 1))}
                    className="cursor-pointer text-xs h-7 px-2.5"
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-mono px-2 text-muted-foreground">
                    Page {dispatchPage} of {totalDispatchPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={dispatchPage >= totalDispatchPages}
                    onClick={() => setDispatchPage((p) => Math.min(totalDispatchPages, p + 1))}
                    className="cursor-pointer text-xs h-7 px-2.5"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListOrdered className="h-4 w-4 text-primary" /> {t("dashboard.ordersCardTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex flex-col justify-between flex-grow">
            <span>{t("dashboard.ordersCardDesc")}</span>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <Link to="/orders">{t("dashboard.ordersCardButton")}</Link>
              </Button>
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={importing}
                variant="outline"
                size="sm"
                className="cursor-pointer gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Upload CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> {t("dashboard.ganttCardTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex flex-col justify-between flex-grow">
            <span>{t("dashboard.ganttCardDesc")}</span>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <Link to="/gantt">{t("dashboard.ganttCardButton")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4 text-sky-500" /> Cloud Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex flex-col justify-between flex-grow">
            <span className="block mb-4">
              Backup and synchronize your active orders, process steps, manual overrides, and
              planner settings directly to Supabase storage.
            </span>
            <div className="flex gap-2">
              <Button
                onClick={onSaveToCloud}
                disabled={isCloudSaving || isCloudLoading}
                size="sm"
                className="gap-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CloudUpload className="h-3.5 w-3.5" />
                {isCloudSaving ? t("common.savingToCloud") : t("common.saveToCloud")}
              </Button>
              <Button
                onClick={onLoadFromCloud}
                disabled={isCloudSaving || isCloudLoading}
                variant="outline"
                size="sm"
                className="gap-1 cursor-pointer"
              >
                <CloudDownload className="h-3.5 w-3.5" />
                {isCloudLoading ? t("common.loadingFromCloud") : t("common.loadFromCloud")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Example Datasets Modal */}
      <ExampleDatasetsModal open={isExampleModalOpen} onOpenChange={setIsExampleModalOpen} />

      {/* Hold Reason Telemetry Modal */}
      {selectedProcessForHold && (
        <HoldReasonModal
          open={holdModalOpen}
          onOpenChange={setHoldModalOpen}
          orderId={selectedProcessForHold.displayWO || selectedProcessForHold.orderId}
          processId={selectedProcessForHold.processId}
          machineId={selectedProcessForHold.machine?.name || selectedProcessForHold.machineId}
          onConfirm={handleConfirmHold}
        />
      )}

      {/* Log Scrap Telemetry Modal */}
      {selectedProcessForScrap && (
        <LogScrapModal
          open={scrapModalOpen}
          onOpenChange={setScrapModalOpen}
          orderId={selectedProcessForScrap.displayWO || selectedProcessForScrap.orderId}
          processId={selectedProcessForScrap.processId}
          machineId={selectedProcessForScrap.machine?.name || selectedProcessForScrap.machineId}
          totalOrderQty={selectedProcessForScrap.orderQty}
          onConfirm={handleConfirmScrap}
        />
      )}

      {/* Printable Job Traveler Sheet */}
      {travelerModalOpen && selectedOrderForTraveler && (
        <JobTravelerSheet
          order={selectedOrderForTraveler}
          processes={travelerProcesses}
          machines={machines}
          onClose={() => setTravelerModalOpen(false)}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border border-border/80 shadow-sm hover:border-primary/40 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
          {icon && <div className="p-2 rounded-lg bg-muted/60">{icon}</div>}
        </div>
        <div className="mt-2 text-3xl font-extrabold font-mono tracking-tight">{value}</div>
        {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
