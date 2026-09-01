import React from "react";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
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
  const { orders, processes, slots } = useAppStore();

  const handleExportCSV = () => {
    if (processes.length === 0) {
      toast.error("No schedule data available to export.");
      return;
    }

    const exportRows = processes.map((p) => {
      const parentOrder = orders.find((o) => o.id === p.orderId);
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
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleExportCSV} className="text-xs cursor-pointer gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          <span>Export as CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="text-xs cursor-pointer gap-2">
          <Printer className="h-4 w-4 text-blue-500" />
          <span>Print / Save PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
