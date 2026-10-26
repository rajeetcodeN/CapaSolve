import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { CreateWorkOrderModal } from "@/components/modals/CreateWorkOrderModal";
import { CreateStepModal } from "@/components/modals/CreateStepModal";
import { ExampleDatasetsModal } from "@/components/modals/ExampleDatasetsModal";
import {
  Upload,
  RotateCcw,
  Factory,
  Layers,
  Calendar,
  Clock,
  Search,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  Wrench,
  Copy,
  Flame,
  Zap,
  Check,
  ChevronDown,
  Sparkles,
  Printer,
} from "lucide-react";
import { parseSOPDate } from "@/lib/scheduler";
import { ExportButton } from "@/components/ExportButton";
import { OrderPriority, Order } from "@/lib/types";
import { QuickOverviewPopover } from "@/components/QuickOverviewPopover";
import { JobTravelerSheet } from "@/components/JobTravelerSheet";
import { cn } from "@/lib/utils";

export const PRIORITY_CONFIG: Record<
  OrderPriority,
  { label: string; badgeClass: string; dot: string }
> = {
  Urgent: {
    label: "Urgent",
    badgeClass:
      "bg-rose-50 text-rose-700 border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/50",
    dot: "bg-rose-500",
  },
  High: {
    label: "High",
    badgeClass:
      "bg-orange-50 text-orange-700 border-orange-200/90 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60 hover:bg-orange-100 dark:hover:bg-orange-900/50",
    dot: "bg-orange-500",
  },
  Med: {
    label: "Medium",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200/90 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50",
    dot: "bg-amber-500",
  },
  Low: {
    label: "Low",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200/90 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-750",
    dot: "bg-slate-400",
  },
};

export function OrderPrioritySelector({
  orderId,
  currentPriority = "Med",
  onSelect,
  disabled = false,
}: {
  orderId: string;
  currentPriority?: OrderPriority;
  onSelect: (prio: OrderPriority) => void;
  disabled?: boolean;
}) {
  const config = PRIORITY_CONFIG[currentPriority] || PRIORITY_CONFIG.Med;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer shadow-2xs focus:outline-hidden ${config.badgeClass}`}
          title={`Priority: ${config.label}. Click to modify dispatch priority.`}
        >
          <span className={`h-2 w-2 rounded-full ${config.dot} shrink-0`} />
          <span>{config.label}</span>
          {!disabled && <ChevronDown className="h-3 w-3 opacity-50 ml-0.5 shrink-0" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36 p-1.5 shadow-xl border border-border">
        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Set Priority
        </div>
        {(["Urgent", "High", "Med", "Low"] as OrderPriority[]).map((tier) => {
          const tConfig = PRIORITY_CONFIG[tier];
          const isSelected = tier === currentPriority;
          return (
            <DropdownMenuItem
              key={tier}
              onClick={() => onSelect(tier)}
              className={`flex items-center justify-between text-xs py-1.5 px-2 rounded-md cursor-pointer ${
                isSelected ? "bg-muted font-semibold" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${tConfig.dot} shrink-0`} />
                {tConfig.label}
              </span>
              {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — CapaSolve" },
      { name: "description", content: "Manage and import manufacturing orders." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const {
    orders,
    processes,
    machines,
    loadDefaultCSV,
    loadFromCSVText,
    clearAll,
    removeOrder,
    updateOrderPriority,
    bulkUpdateOrderPriority,
    checkMaterialReadiness,
    role,
  } = useAppStore();
  const { t } = useTranslations();

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | OrderPriority>("ALL");
  const [sortField, setSortField] = useState<
    "orderId" | "material" | "orderQty" | "sopDate" | "priority" | null
  >("priority");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  // Job Traveler Print Sheet Modal State
  const [travelerModalOpen, setTravelerModalOpen] = useState(false);
  const [selectedOrderForTraveler, setSelectedOrderForTraveler] = useState<Order | null>(null);
  const [travelerProcesses, setTravelerProcesses] = useState<any[]>([]);

  const handleOpenTraveler = (order: Order) => {
    const procs = processes.filter((p) => p.orderId === order.id || p.orderId === order.orderId);
    setSelectedOrderForTraveler(order);
    setTravelerProcesses(procs);
    setTravelerModalOpen(true);
  };

  // Sorting Handler
  const handleSort = (field: "orderId" | "material" | "orderQty" | "sopDate" | "priority") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort Icon Renderer
  const renderSortIcon = (field: "orderId" | "material" | "orderQty" | "sopDate" | "priority") => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 shrink-0" />;
    }
    return sortAsc ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary shrink-0" />
    );
  };

  // Priority count breakdown
  const priorityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      Urgent: 0,
      High: 0,
      Med: 0,
      Low: 0,
    };
    orders.forEach((o) => {
      const p = o.priority || "Med";
      if (counts[p] !== undefined) {
        counts[p]++;
      }
    });
    return counts;
  }, [orders]);

  // Sorted orders useMemo
  const sortedOrders = useMemo(() => {
    const sorted = [...orders];
    if (!sortField) return sorted;

    const getPrioWeight = (p?: OrderPriority) => {
      switch (p) {
        case "Urgent":
          return 1;
        case "High":
          return 2;
        case "Med":
          return 3;
        case "Low":
          return 4;
        default:
          return 3;
      }
    };

    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === "orderId") {
        comparison = a.orderId.localeCompare(b.orderId);
      } else if (sortField === "material") {
        comparison = a.material.localeCompare(b.material);
      } else if (sortField === "orderQty") {
        comparison = a.orderQty - b.orderQty;
      } else if (sortField === "priority") {
        comparison = getPrioWeight(a.priority) - getPrioWeight(b.priority);
      } else if (sortField === "sopDate") {
        try {
          const dateA = parseSOPDate(a.sopStartDate, a.sopStartTime);
          const dateB = parseSOPDate(b.sopStartDate, b.sopStartTime);
          comparison = dateA.getTime() - dateB.getTime();
        } catch (e) {
          comparison = 0;
        }
      }

      return sortAsc ? comparison : -comparison;
    });

    return sorted;
  }, [orders, sortField, sortAsc]);

  // Displayed orders filtered by priority
  const displayedOrders = useMemo(() => {
    if (priorityFilter === "ALL") return sortedOrders;
    return sortedOrders.filter((o) => (o.priority || "Med") === priorityFilter);
  }, [sortedOrders, priorityFilter]);

  // Bulk Order Selection & Priority Override State
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const areAllSelected =
    displayedOrders.length > 0 && displayedOrders.every((o) => selectedOrderIds.has(o.id));

  const handleToggleSelectAll = () => {
    if (areAllSelected) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(displayedOrders.map((o) => o.id)));
    }
  };

  const handleBulkSetPriority = (priority: OrderPriority) => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only users with the Developer or Admin role can update order priorities.",
      );
      return;
    }
    if (selectedOrderIds.size === 0) return;
    bulkUpdateOrderPriority(Array.from(selectedOrderIds), priority);
    setSelectedOrderIds(new Set());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only users with the Developer or Admin role can upload or change production datasets.",
      );
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        loadFromCSVText(text);
        toast.success(t("orders.toastImportSuccess"));
      } catch (err) {
        toast.error(t("orders.toastImportFailed"));
        console.error(err);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
      toast.success(t("orders.toastResetSuccess"));
    } catch (e) {
      toast.error(t("orders.toastResetFailed"));
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error(
        "Access Denied: Only users with the Developer or Admin role can clear the scheduler data.",
      );
      return;
    }
    clearAll();
  };

  const handleRemoveOrder = (id: string) => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only users with the Developer or Admin role can remove orders.");
      return;
    }
    removeOrder(id);
  };

  // Filter processes for Tab 2 (Excel Grid View)
  const filteredProcesses = useMemo(() => {
    let result = [...processes];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => {
        const order = orders.find((o) => o.id === p.orderId);
        return (
          p.processId.toString().includes(q) ||
          p.processText.toLowerCase().includes(q) ||
          p.machineId.toLowerCase().includes(q) ||
          (order?.orderId && order.orderId.toLowerCase().includes(q)) ||
          (order?.material && order.material.toLowerCase().includes(q))
        );
      });
    }
    return result;
  }, [processes, orders, searchQuery]);

  return (
    <div className="space-y-6">
      {/* 1. Streamlined Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            {t("orders.title")}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Manage, sequence, and import manufacturing work orders from CSV and ERP sources.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            size="sm"
            onClick={() => setIsOrderModalOpen(true)}
            className="bg-[#1e3f2e] hover:bg-[#27533d] text-white font-semibold shadow-xs border border-[#27533d] rounded-lg h-8 text-xs cursor-pointer"
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> New Order
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsStepModalOpen(true)}
            className="font-medium h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg shadow-2xs cursor-pointer"
          >
            <Wrench className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> Add Step
          </Button>
          <ExportButton size="sm" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={importing}
            className="h-8 text-xs rounded-lg shadow-2xs cursor-pointer"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-slate-500" /> {t("common.reset")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="h-8 text-xs text-rose-600 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer"
          >
            {t("common.clearAll")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="h-8 text-xs rounded-lg shadow-2xs cursor-pointer"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
            {importing ? t("common.importing") : t("common.uploadCSV")}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between border-b border-border/80 pb-2 mb-4">
          <TabsList className="bg-muted/80">
            <TabsTrigger value="summary" className="text-xs font-semibold gap-1.5">
              <Layers className="h-4 w-4" />
              {t("orders.tabSummary")}
            </TabsTrigger>
            <TabsTrigger value="excel" className="text-xs font-semibold gap-1.5">
              <FileSpreadsheet className="h-4 w-4" />
              {t("orders.tabExcel")}
            </TabsTrigger>
          </TabsList>

          {activeTab === "excel" && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("orders.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Summary by Orders */}
        <TabsContent value="summary" className="animate-in fade-in duration-200">
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border/50 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="h-5 w-5 text-primary" />
                    <span>
                      {t("orders.activeDatasets", {
                        orders: orders.length,
                        processes: processes.length,
                      })}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">{t("orders.summaryRollup")}</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {/* Priority Filter Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/60">
                    <span className="text-[11px] font-semibold text-muted-foreground px-1.5">
                      Priority:
                    </span>
                    {[
                      { id: "ALL", label: "All", count: priorityCounts.ALL, dot: "" },
                      {
                        id: "Urgent",
                        label: "Urgent",
                        count: priorityCounts.Urgent,
                        dot: "bg-rose-500",
                      },
                      {
                        id: "High",
                        label: "High",
                        count: priorityCounts.High,
                        dot: "bg-orange-500",
                      },
                      {
                        id: "Med",
                        label: "Medium",
                        count: priorityCounts.Med,
                        dot: "bg-amber-500",
                      },
                      { id: "Low", label: "Low", count: priorityCounts.Low, dot: "bg-slate-400" },
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setPriorityFilter(chip.id as any)}
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                          priorityFilter === chip.id
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                        }`}
                      >
                        {chip.dot && (
                          <span className={`h-2 w-2 rounded-full ${chip.dot} shrink-0`} />
                        )}
                        <span>{chip.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            priorityFilter === chip.id
                              ? "bg-white/20 dark:bg-slate-900/20 text-inherit"
                              : "bg-muted/80 text-muted-foreground"
                          }`}
                        >
                          {chip.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Context Help (i) at the end */}
                  <QuickOverviewPopover
                    align="end"
                    side="bottom"
                    className="h-8 w-8 rounded-xl border border-border/70 bg-card hover:bg-muted text-slate-500 hover:text-foreground shadow-2xs shrink-0"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Bulk Action Bar */}
              {selectedOrderIds.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50/90 dark:bg-emerald-950/40 border-b border-emerald-200/80 dark:border-emerald-800/60 animate-in fade-in duration-150">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-bold">
                      {selectedOrderIds.size}
                    </span>
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      {selectedOrderIds.size} {selectedOrderIds.size === 1 ? "order" : "orders"}{" "}
                      selected
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
                      Bulk Override Priority:
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleBulkSetPriority("Urgent")}
                      className="h-6.5 px-2 text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-md shadow-2xs cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white mr-1" />
                      Urgent
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleBulkSetPriority("High")}
                      className="h-6.5 px-2 text-[11px] bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md shadow-2xs cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white mr-1" />
                      High
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleBulkSetPriority("Med")}
                      className="h-6.5 px-2 text-[11px] bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md shadow-2xs cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white mr-1" />
                      Medium
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleBulkSetPriority("Low")}
                      className="h-6.5 px-2 text-[11px] bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-md shadow-2xs cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white mr-1" />
                      Low
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrderIds(new Set())}
                      className="h-6.5 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-md cursor-pointer ml-1"
                    >
                      Deselect
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 select-none">
                      <TableHead className="w-[44px] px-2 text-center sticky left-0 bg-muted z-10 border-r border-border/40">
                        <input
                          type="checkbox"
                          aria-label="Select all orders"
                          checked={areAllSelected}
                          onChange={handleToggleSelectAll}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer align-middle"
                        />
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort("orderId")}
                        className="w-[120px] font-semibold sticky left-[44px] bg-muted z-10 border-r border-border/40 shadow-[2px_0_5px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {t("orders.tableOrderId")}
                          {renderSortIcon("orderId")}
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort("priority")}
                        className="w-[130px] font-semibold cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {t("orders.tablePriority")}
                          {renderSortIcon("priority")}
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort("material")}
                        className="font-semibold cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {t("orders.tableMaterial")}
                          {renderSortIcon("material")}
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort("orderQty")}
                        className="text-right font-semibold cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center justify-end gap-1">
                          {t("orders.tableQty")}
                          {renderSortIcon("orderQty")}
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort("sopDate")}
                        className="font-semibold cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {t("orders.tableSopDate")}
                          {renderSortIcon("sopDate")}
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleSort("sopDate")}
                        className="font-semibold cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {t("orders.tableSopTime")}
                          {renderSortIcon("sopDate")}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold">{t("orders.tableSequence")}</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {orders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                          <div className="max-w-md mx-auto flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-border/80 bg-muted/20">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
                              <Factory className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground mb-1">
                              No Active Production Orders
                            </h3>
                            <p className="text-xs text-muted-foreground mb-5 text-center leading-relaxed">
                              Get started immediately by loading a pre-built factory dataset or
                              uploading your own CSV file.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-2.5">
                              <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await loadDefaultCSV();
                                    toast.success("Loaded German SAP COOIS sample dataset!");
                                  } catch {
                                    toast.error("Failed to load sample dataset.");
                                  }
                                }}
                                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                Load SAP Demo Data
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsExampleModalOpen(true)}
                                className="h-8 text-xs border-border/80 cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                Browse Sample Datasets
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => fileRef.current?.click()}
                                className="h-8 text-xs border-border/80 cursor-pointer"
                              >
                                <Upload className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                                Upload CSV
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {orders.length > 0 && displayedOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="text-sm font-medium">
                              No orders found with priority &quot;{priorityFilter}&quot;.
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPriorityFilter("ALL")}
                              className="h-7 text-xs"
                            >
                              Show All Orders
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {displayedOrders.map((o) => {
                      const steps = processes.filter((p) => p.orderId === o.id);
                      return (
                        <TableRow
                          key={o.id}
                          className={cn(
                            "hover:bg-muted/10 transition-colors",
                            selectedOrderIds.has(o.id) && "bg-emerald-50/50 dark:bg-emerald-950/20",
                          )}
                        >
                          <TableCell className="w-[44px] px-2 text-center sticky left-0 bg-background z-10 border-r border-border/30">
                            <input
                              type="checkbox"
                              aria-label={`Select order ${o.orderId}`}
                              checked={selectedOrderIds.has(o.id)}
                              onChange={() => handleToggleSelectOrder(o.id)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer align-middle"
                            />
                          </TableCell>
                          <TableCell className="font-semibold text-primary sticky left-[44px] bg-background z-10 border-r border-border/30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            {o.orderId}
                          </TableCell>
                          <TableCell>
                            <OrderPrioritySelector
                              orderId={o.id}
                              currentPriority={o.priority || "Med"}
                              onSelect={(prio) => updateOrderPriority(o.id, prio)}
                              disabled={role !== "DEVELOPER" && role !== "ADMIN"}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground">{o.material}</span>
                              {(() => {
                                const readiness = checkMaterialReadiness(o.material, o.orderQty);
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[9px] font-semibold mt-1 px-1.5 py-0.2 rounded w-fit border ${
                                      readiness.readiness === "READY"
                                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                        : readiness.readiness === "LOW_STOCK"
                                          ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                                          : "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        readiness.readiness === "READY"
                                          ? "bg-emerald-500"
                                          : readiness.readiness === "LOW_STOCK"
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                      }`}
                                    />
                                    {readiness.readiness === "READY"
                                      ? "Stock Ready"
                                      : readiness.readiness === "LOW_STOCK"
                                        ? `Low Stock (${readiness.available})`
                                        : "Shortage"}
                                  </span>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {o.orderQty.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {o.sopStartDate}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {o.sopStartTime}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-3 py-1.5">
                              {steps.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex flex-col gap-1.5 rounded-lg bg-secondary/70 p-3 text-xs font-medium text-secondary-foreground shadow-sm border border-border/60 min-w-[210px] hover:shadow transition-shadow"
                                >
                                  <div className="flex items-center justify-between border-b border-border/40 pb-1">
                                    <span className="font-mono font-bold text-primary">
                                      {t("orders.step")} {s.processId}
                                    </span>
                                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold font-mono">
                                      ID: {o.orderId}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-foreground font-semibold">
                                    <Factory className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono">
                                      {t("common.machine")}: {s.machineId}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                                    <div className="flex justify-between">
                                      <span>{t("common.setupTime")} R:</span>
                                      <span className="font-bold text-foreground">
                                        {s.setupTimeMin}m
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>{t("common.processTime")} M:</span>
                                      <span className="font-bold text-foreground">
                                        {s.processTimeMin}m
                                      </span>
                                    </div>
                                    <div className="flex justify-between border-t border-border/30 pt-0.5 mt-0.5">
                                      <span>SumV2:</span>
                                      <span className="font-bold text-sky-600">
                                        {(s.sumV2 ?? 0).toFixed(1)}m
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>SumV3:</span>
                                      <span className="font-bold text-indigo-600">
                                        {(s.sumV3 ?? 0).toLocaleString(undefined, {
                                          maximumFractionDigits: 1,
                                        })}
                                        m
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>{t("common.ratio")} P%:</span>
                                      <span className="font-bold text-orange-600">
                                        {Math.round((s.manpowerPct ?? 0) * 100)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenTraveler(o)}
                                className="h-8 w-8 text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 p-0 cursor-pointer"
                                title="Print Shop Floor Job Traveler"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveOrder(o.id)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 p-0 cursor-pointer"
                                title="Delete order"
                              >
                                &times;
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: All CSV Values (Excel View) */}
        <TabsContent value="excel" className="animate-in fade-in duration-200">
          <Card className="border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                {t("orders.excelTitle")}
              </CardTitle>
              <CardDescription>{t("orders.excelDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-w-full">
                <Table className="text-xs border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">
                        {t("orders.excelOrderQty").split(" ")[0]}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">
                        {t("orders.tableSequence").split(" ")[2] || "Process"} ID
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800 w-[90px]">
                        Priority
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">
                        {t("orders.tableMaterial")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">
                        {t("common.machine")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">
                        Process Text
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-left border-r border-slate-200 dark:border-slate-800">
                        {t("orders.tableSopDate")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800 w-[95px]">
                        {t("orders.excelOrderQty")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800 w-[85px]">
                        {t("orders.excelBaseQty")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800 w-[100px]">
                        {t("orders.excelSetupTime")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800 w-[100px]">
                        {t("orders.excelProcessTime")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800">
                        {t("orders.excelOperatorUtil")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800">
                        {t("orders.excelSumV2")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-right border-r border-slate-200 dark:border-slate-800">
                        {t("orders.excelSumV3")}
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">
                        {t("orders.excelManpowerPct")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProcesses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={15} className="py-12 text-center text-slate-500">
                          {t("orders.noExcelMatches")}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredProcesses.map((p) => {
                      const order = orders.find((o) => o.id === p.orderId);
                      if (!order) return null;

                      return (
                        <TableRow
                          key={p.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors font-mono text-xs"
                        >
                          <TableCell className="font-semibold text-slate-900 dark:text-white font-sans border-r border-slate-200 dark:border-slate-800">
                            {order.orderId}
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800">
                            {p.processId}
                          </TableCell>
                          <TableCell className="text-center border-r border-slate-200 dark:border-slate-800">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                (order.priority || "Med") === "Urgent"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                  : (order.priority || "Med") === "High"
                                    ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
                                    : (order.priority || "Med") === "Low"
                                      ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              }`}
                            >
                              {order.priority || "Med"}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800">
                            {order.material}
                          </TableCell>
                          <TableCell className="font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {p.machineId}
                          </TableCell>
                          <TableCell
                            className="font-sans font-normal text-slate-700 dark:text-slate-300 max-w-[200px] truncate border-r border-slate-200 dark:border-slate-800"
                            title={p.processText}
                          >
                            {p.processText}
                          </TableCell>
                          <TableCell className="font-sans text-xs text-slate-500 border-r border-slate-200 dark:border-slate-800">
                            {order.sopStartDate} {order.sopStartTime}
                          </TableCell>
                          <TableCell className="text-right text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {order.orderQty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {p.baseQty}
                          </TableCell>
                          <TableCell className="text-right text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {p.setupTimeMin} min
                          </TableCell>
                          <TableCell className="text-right text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {p.processTimeMin} min
                          </TableCell>
                          <TableCell className="text-right text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800">
                            {(p.manpowerUtilizationMin ?? 0).toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {(p.sumV2 ?? 0).toFixed(1)}m
                          </TableCell>
                          <TableCell className="text-right text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800">
                            {(p.sumV3 ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            m
                          </TableCell>
                          <TableCell className="text-center font-medium text-slate-800 dark:text-slate-200">
                            {Math.round((p.manpowerPct ?? 0) * 100)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual Order, Step & Dataset Modals */}
      <CreateWorkOrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} />
      <CreateStepModal isOpen={isStepModalOpen} onClose={() => setIsStepModalOpen(false)} />
      <ExampleDatasetsModal open={isExampleModalOpen} onOpenChange={setIsExampleModalOpen} />

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
