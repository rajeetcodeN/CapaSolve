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
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { CreateOrderModal } from "@/components/modals/CreateOrderModal";
import { CreateStepModal } from "@/components/modals/CreateStepModal";
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
} from "lucide-react";
import { parseSOPDate } from "@/lib/scheduler";
import { ExportButton } from "@/components/ExportButton";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Orders — MFG Scheduler" },
      { name: "description", content: "Manage and import manufacturing orders." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const { orders, processes, loadDefaultCSV, loadFromCSVText, clearAll, removeOrder, role } =
    useAppStore();
  const { t } = useTranslations();

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<
    "orderId" | "material" | "orderQty" | "sopDate" | null
  >("sopDate");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);

  // Sorting Handler
  const handleSort = (field: "orderId" | "material" | "orderQty" | "sopDate") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Sort Icon Renderer
  const renderSortIcon = (field: "orderId" | "material" | "orderQty" | "sopDate") => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50 shrink-0" />;
    }
    return sortAsc ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary shrink-0" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary shrink-0" />
    );
  };

  // Sorted orders useMemo
  const sortedOrders = useMemo(() => {
    const sorted = [...orders];
    if (!sortField) return sorted;

    sorted.sort((a, b) => {
      let comparison = 0;
      if (sortField === "orderId") {
        comparison = a.orderId.localeCompare(b.orderId);
      } else if (sortField === "material") {
        comparison = a.material.localeCompare(b.material);
      } else if (sortField === "orderQty") {
        comparison = a.orderQty - b.orderQty;
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
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-primary" />
                {t("orders.activeDatasets", { orders: orders.length, processes: processes.length })}
              </CardTitle>
              <CardDescription>{t("orders.summaryRollup")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 select-none">
                      <TableHead
                        onClick={() => handleSort("orderId")}
                        className="w-[120px] font-semibold sticky left-0 bg-muted z-10 border-r border-border/40 shadow-[2px_0_5px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          {t("orders.tableOrderId")}
                          {renderSortIcon("orderId")}
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
                        <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Upload className="h-8 w-8 text-muted-foreground/50 animate-bounce" />
                            <span className="text-base font-medium">{t("orders.noActive")}</span>
                            <span className="text-xs">{t("orders.uploadPrompt")}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {sortedOrders.map((o) => {
                      const steps = processes.filter((p) => p.orderId === o.id);
                      return (
                        <TableRow key={o.id} className="hover:bg-muted/10 transition-colors">
                          <TableCell className="font-semibold text-primary sticky left-0 bg-background z-10 border-r border-border/30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            {o.orderId}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{o.material}</TableCell>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveOrder(o.id)}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 p-0"
                            >
                              &times;
                            </Button>
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
                        <TableCell colSpan={14} className="py-12 text-center text-slate-500">
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

      {/* Manual Order & Step Creation Modals */}
      <CreateOrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} />
      <CreateStepModal isOpen={isStepModalOpen} onClose={() => setIsStepModalOpen(false)} />
    </div>
  );
}
