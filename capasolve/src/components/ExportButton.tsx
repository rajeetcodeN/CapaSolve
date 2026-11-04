import React from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import Papa from "papaparse";

export function ExportButton({ variant = "outline", size = "sm" }: { variant?: any; size?: any }) {
  const { orders, processes } = useAppStore();

  const handleExportCSV = () => {
    if (processes.length === 0) {
      toast.error("No schedule data available to export.");
      return;
    }

    const exportRows = processes.map((p) => {
      const parentOrder = orders.find((o) => o.id === p.orderId || o.orderId === p.orderId);
      return {
        "Order ID": parentOrder?.orderId || p.orderId,
        Material: parentOrder?.material || "",
        "Process Step": p.processId,
        "Process Text": p.processText,
        "Machine ID": p.machineId,
        "Order Qty": parentOrder?.orderQty || 0,
        "Base Qty": p.baseQty,
        "Setup Time (min)": p.setupTimeMin,
        "Process Time (min)": p.processTimeMin,
        "Total Time (min)": Math.round(p.totalTimeMin),
        Status: p.status,
        "Scheduled Start": p.scheduledStart || "N/A",
        "Scheduled End": p.scheduledEnd || "N/A",
      };
    });

    const csv = Papa.unparse(exportRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `CapaSolve_Schedule_${new Date().toISOString().substring(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Schedule exported successfully to CSV!");
  };

  const handleExportExcel = async () => {
    if (processes.length === 0) {
      toast.error("No schedule data available to export.");
      return;
    }

    try {
      const XLSX = await import("xlsx");

      const exportRows = processes.map((p) => {
        const parentOrder = orders.find((o) => o.id === p.orderId || o.orderId === p.orderId);
        return {
          "Order ID": parentOrder?.orderId || p.orderId,
          "Material SKU": parentOrder?.material || "",
          "Process Step": p.processId,
          "Process Text": p.processText,
          "Workstation / Machine": p.machineId,
          "Order Qty": parentOrder?.orderQty || 0,
          "Base Qty": p.baseQty,
          "Setup Time (min)": p.setupTimeMin,
          "Process Time (min)": p.processTimeMin,
          "Total Time (min)": Math.round(p.totalTimeMin),
          "Execution Status": p.status,
          "Scheduled Start": p.scheduledStart || "N/A",
          "Scheduled End": p.scheduledEnd || "N/A",
        };
      });

      const totalSetupMin = processes.reduce((acc, p) => acc + (p.setupTimeMin || 0), 0);
      const totalProcessMin = processes.reduce((acc, p) => acc + (p.processTimeMin || 0), 0);
      const uniqueMachines = Array.from(new Set(processes.map((p) => p.machineId)));

      const kpiRows = [
        { Metric: "Total Production Orders", Value: orders.length },
        { Metric: "Total Operations", Value: processes.length },
        { Metric: "Active Workstations", Value: uniqueMachines.length },
        { Metric: "Total Setup Time (hours)", Value: (totalSetupMin / 60).toFixed(1) },
        { Metric: "Total Run Time (hours)", Value: (totalProcessMin / 60).toFixed(1) },
        { Metric: "Export Generated At", Value: new Date().toISOString() },
      ];

      const wb = XLSX.utils.book_new();
      const wsSchedule = XLSX.utils.json_to_sheet(exportRows);
      const wsKpis = XLSX.utils.json_to_sheet(kpiRows);

      XLSX.utils.book_append_sheet(wb, wsSchedule, "Production Schedule");
      XLSX.utils.book_append_sheet(wb, wsKpis, "KPI Summary");

      XLSX.writeFile(wb, `CapaSolve_Schedule_${new Date().toISOString().substring(0, 10)}.xlsx`);
      toast.success("Schedule exported successfully to Excel (.xlsx)!");
    } catch (err: any) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel file.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="gap-1.5 cursor-pointer font-medium text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleExportExcel} className="text-xs cursor-pointer gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          <span>Export as Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="text-xs cursor-pointer gap-2">
          <FileText className="h-4 w-4 text-sky-500" />
          <span>Export as CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="text-xs cursor-pointer gap-2">
          <Printer className="h-4 w-4 text-slate-400" />
          <span>Print / Save PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
