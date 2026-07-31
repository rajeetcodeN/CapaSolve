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
import { Upload, RotateCcw, Factory, Layers, Calendar, Clock, Search, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const {
    orders,
    processes,
    loadDefaultCSV,
    loadFromCSVText,
    clearAll,
    removeOrder,
    role,
  } = useAppStore();
  const { t } = useTranslations();
  
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<"orderId" | "material" | "orderQty" | "sopDate" | null>("sopDate");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

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
      toast.error("Access Denied: Only users with the Developer or Admin role can upload or change production datasets.");
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
      toast.error("Access Denied: Only users with the Developer or Admin role can reset the scheduler to factory seeding.");
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
      toast.error("Access Denied: Only users with the Developer or Admin role can clear the scheduler data.");
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("orders.title")}</h1>
          <p className="text-muted-foreground">
            Current schedule is seeded directly from the workspace's <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs text-foreground">process.csv</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <ExportButton size="sm" />
          <Button variant="outline" size="sm" onClick={handleReset} disabled={importing}>
            <RotateCcw className="mr-1.5 h-4 w-4" /> {t("common.reset")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
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
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="mr-1.5 h-4 w-4" />
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
              <CardDescription>
                {t("orders.summaryRollup")}
              </CardDescription>
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
                          <TableCell className="font-semibold text-primary sticky left-0 bg-background z-10 border-r border-border/30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{o.orderId}</TableCell>
                           <TableCell className="font-mono text-xs">{o.material}</TableCell>
                           <TableCell className="text-right font-mono font-medium">{o.orderQty.toLocaleString()}</TableCell>
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
                                     <span className="font-mono font-bold text-primary">{t("orders.step")} {s.processId}</span>
                                     <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-extrabold font-mono">ID: {o.orderId}</span>
                                   </div>
                                   <div className="flex items-center gap-1 text-foreground font-semibold">
                                     <Factory className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                     <span className="font-mono">{t("common.machine")}: {s.machineId}</span>
                                   </div>
                                   <div className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
                                     <div className="flex justify-between">
                                       <span>{t("common.setupTime")} R:</span>
                                       <span className="font-bold text-foreground">{s.setupTimeMin}m</span>
                                     </div>
                                     <div className="flex justify-between">
                                       <span>{t("common.processTime")} M:</span>
                                       <span className="font-bold text-foreground">{s.processTimeMin}m</span>
                                     </div>
                                     <div className="flex justify-between border-t border-border/30 pt-0.5 mt-0.5">
                                       <span>SumV2:</span>
                                       <span className="font-bold text-sky-600">{(s.sumV2 ?? 0).toFixed(1)}m</span>
                                     </div>
                                     <div className="flex justify-between">
                                       <span>SumV3:</span>
                                       <span className="font-bold text-indigo-600">{(s.sumV3 ?? 0).toLocaleString(undefined, {maximumFractionDigits: 1})}m</span>
                                     </div>
                                     <div className="flex justify-between">
                                       <span>{t("common.ratio")} P%:</span>
                                       <span className="font-bold text-orange-600">{Math.round((s.manpowerPct ?? 0) * 100)}%</span>
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
              <CardDescription>
                {t("orders.excelDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-w-full">
                <Table className="text-xs border-collapse">
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-b border-border">
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-left border-r border-border/40">{t("orders.excelOrderQty").split(" ")[0]}</TableHead>
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-left border-r border-border/40">{t("orders.tableSequence").split(" ")[2] || "Process"} ID</TableHead>
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-left border-r border-border/40">{t("orders.tableMaterial")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-left border-r border-border/40">{t("common.machine")}</TableHead>
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-left border-r border-border/40">Process Text</TableHead>
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-left border-r border-border/40">{t("orders.tableSopDate")}</TableHead>
                      
                      {/* RED columns */}
                      <TableHead className="bg-red-600 text-white font-extrabold uppercase tracking-wider text-center border-r border-red-700 w-[95px] min-w-[95px]">
                        {t("orders.excelOrderQty")}
                      </TableHead>
                      <TableHead className="bg-red-600 text-white font-extrabold uppercase tracking-wider text-center border-r border-red-700 w-[85px] min-w-[85px]">
                        {t("orders.excelBaseQty")}
                      </TableHead>
                      
                      {/* YELLOW columns */}
                      <TableHead className="bg-yellow-400 text-yellow-950 font-extrabold uppercase tracking-wider text-center border-r border-yellow-500 w-[100px] min-w-[100px]">
                        {t("orders.excelSetupTime")}
                      </TableHead>
                      <TableHead className="bg-yellow-400 text-yellow-950 font-extrabold uppercase tracking-wider text-center border-r border-yellow-500 w-[100px] min-w-[100px]">
                        {t("orders.excelProcessTime")}
                      </TableHead>
                      
                      <TableHead className="font-semibold text-slate-700 uppercase tracking-wider text-right border-r border-border/40">{t("orders.excelOperatorUtil")}</TableHead>
                      <TableHead className="font-semibold text-sky-700 bg-sky-50/30 uppercase tracking-wider text-right border-r border-border/40 font-bold">{t("orders.excelSumV2")}</TableHead>
                      <TableHead className="font-semibold text-indigo-700 bg-indigo-50/30 uppercase tracking-wider text-right border-r border-border/40 font-bold">{t("orders.excelSumV3")}</TableHead>
                      <TableHead className="font-semibold text-orange-700 bg-orange-50/30 uppercase tracking-wider text-center font-bold">{t("orders.excelManpowerPct")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProcesses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={14} className="py-12 text-center text-muted-foreground">
                          {t("orders.noExcelMatches")}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredProcesses.map((p) => {
                      const order = orders.find((o) => o.id === p.orderId);
                      if (!order) return null;
                      
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/5 transition-colors font-mono">
                          <TableCell className="font-bold text-foreground font-sans border-r border-border/30">{order.orderId}</TableCell>
                          <TableCell className="font-bold text-primary border-r border-border/30">{p.processId}</TableCell>
                          <TableCell className="text-muted-foreground border-r border-border/30">{order.material}</TableCell>
                          <TableCell className="font-semibold text-foreground border-r border-border/30">{p.machineId}</TableCell>
                          <TableCell className="font-sans font-medium text-foreground max-w-[200px] truncate border-r border-border/30" title={p.processText}>
                            {p.processText}
                          </TableCell>
                          <TableCell className="font-sans text-xs text-muted-foreground border-r border-border/30">
                            {order.sopStartDate} {order.sopStartTime}
                          </TableCell>
                          
                          {/* RED inputs */}
                          <TableCell className="text-center font-bold text-red-700 bg-red-50/40 border-r border-red-100">{order.orderQty.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-bold text-red-700 bg-red-50/40 border-r border-red-100">{p.baseQty}</TableCell>
                          
                          {/* YELLOW inputs */}
                          <TableCell className="text-center font-bold text-yellow-800 bg-yellow-50/30 border-r border-yellow-100">{p.setupTimeMin} min</TableCell>
                          <TableCell className="text-center font-bold text-yellow-800 bg-yellow-50/30 border-r border-yellow-100">{p.processTimeMin} min</TableCell>
                          
                          <TableCell className="text-right font-medium text-slate-700 border-r border-border/30">{(p.manpowerUtilizationMin ?? 0).toFixed(3)}</TableCell>
                          
                          {/* Calculations */}
                          <TableCell className="text-right font-bold text-sky-700 bg-sky-50/10 border-r border-border/30">
                            {(p.sumV2 ?? 0).toFixed(1)}m
                          </TableCell>
                          <TableCell className="text-right font-bold text-indigo-700 bg-indigo-50/10 border-r border-border/30">
                            {(p.sumV3 ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}m
                          </TableCell>
                          <TableCell className="text-center font-bold text-orange-700 bg-orange-50/10">
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
    </div>
  );
}
