import React from "react";
import { Order, OrderProcess, Machine } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Printer, X, CheckSquare, AlertCircle } from "lucide-react";

interface JobTravelerSheetProps {
  order: Order;
  processes: OrderProcess[];
  machines: Machine[];
  onClose?: () => void;
}

export function JobTravelerSheet({ order, processes, machines, onClose }: JobTravelerSheetProps) {
  // Sort processes by processId step
  const sortedSteps = [...processes].sort((a, b) => a.processId - b.processId);

  const handlePrint = () => {
    window.print();
  };

  const getMachineName = (machineId: string) => {
    const m = machines.find((mach) => mach.id === machineId);
    return m ? `${m.name} (${m.machineGroupId})` : machineId;
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "--";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 flex justify-center p-4 sm:p-6 print:p-0 print:static print:bg-white print:z-auto">
      {/* Control Bar - Hidden during print */}
      <div className="fixed top-4 right-4 flex items-center gap-3 z-50 print:hidden bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-xl">
        <Button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs gap-1.5 shadow-md"
        >
          <Printer className="w-4 h-4" />
          Print Job Traveler (PDF)
        </Button>
        {onClose && (
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        )}
      </div>

      {/* Printable Sheet */}
      <div className="w-full max-w-4xl bg-white text-black p-8 rounded-lg shadow-2xl print:shadow-none print:p-4 print:max-w-none print:w-full print:rounded-none font-sans text-xs">
        {/* Company & Document Header */}
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
          <div>
            <div className="text-2xl font-extrabold tracking-tight uppercase">
              CapaSolve Manufacturing
            </div>
            <div className="text-xs text-gray-600 font-medium">
              Production Shop Floor Router & Traveler
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-bold bg-gray-100 px-3 py-1 border border-black inline-block">
              WO #{order.orderId}
            </div>
            <div className="text-[10px] text-gray-500 mt-1">
              Doc ID: TRV-{order.id.slice(0, 8).toUpperCase()} | Printed:{" "}
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Master Work Order Details Grid */}
        <div className="grid grid-cols-4 gap-3 border border-black p-3 mb-4 bg-gray-50 print:bg-transparent">
          <div>
            <span className="block text-[10px] font-bold uppercase text-gray-600">
              Part / Material SKU
            </span>
            <span className="font-mono font-bold text-sm text-black">{order.material}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-gray-600">
              Batch Order Qty
            </span>
            <span className="font-bold text-sm text-black">
              {order.orderQty.toLocaleString()} units
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-gray-600">
              S&OP Target Due Date
            </span>
            <span className="font-bold text-sm text-black">{formatDate(order.sopStartDate)}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-gray-600">
              Priority Level
            </span>
            <span
              className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold uppercase border ${
                order.priority === "Urgent"
                  ? "bg-red-100 text-red-800 border-red-400"
                  : order.priority === "High"
                    ? "bg-amber-100 text-amber-800 border-amber-400"
                    : "bg-blue-100 text-blue-800 border-blue-400"
              }`}
            >
              {order.priority || "Normal"}
            </span>
          </div>
        </div>

        {/* Material & Raw Stock Verification Section */}
        <div className="border border-black p-2.5 mb-4 grid grid-cols-3 gap-3 text-[11px]">
          <div>
            <span className="font-bold">Raw Material Heat / Lot #:</span>
            <div className="border-b border-dotted border-gray-400 mt-3 h-4"></div>
          </div>
          <div>
            <span className="font-bold">Stock Room Pull Signature:</span>
            <div className="border-b border-dotted border-gray-400 mt-3 h-4"></div>
          </div>
          <div>
            <span className="font-bold">First Piece Inspection:</span>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-3.5 h-3.5 border border-black inline-block"></span> PASSED
              </span>
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-3.5 h-3.5 border border-black inline-block"></span> REJECT
              </span>
            </div>
          </div>
        </div>

        {/* Operations Sequential Routing Sheet */}
        <div className="mb-4">
          <div className="font-bold text-xs uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Sequential Operations Sign-Off Sheet</span>
            <span className="text-[10px] font-normal text-gray-500">
              All steps must be signed off in sequence
            </span>
          </div>

          <table className="w-full border-collapse border border-black text-left">
            <thead>
              <tr className="bg-gray-200 border-b border-black text-[10px] uppercase font-bold text-black print:bg-gray-100">
                <th className="border border-black p-1.5 w-12 text-center">Step</th>
                <th className="border border-black p-1.5 w-28">Workstation</th>
                <th className="border border-black p-1.5">Operation Description</th>
                <th className="border border-black p-1.5 w-16 text-center">Setup / Run</th>
                <th className="border border-black p-1.5 w-24">Scheduled</th>
                <th className="border border-black p-1.5 w-16 text-center">Qty Good</th>
                <th className="border border-black p-1.5 w-14 text-center">Scrap</th>
                <th className="border border-black p-1.5 w-20 text-center">Operator</th>
                <th className="border border-black p-1.5 w-16 text-center">QA Stamp</th>
              </tr>
            </thead>
            <tbody>
              {sortedSteps.map((step) => (
                <tr key={step.id} className="border-b border-black text-[11px] h-14">
                  <td className="border border-black p-1.5 text-center font-bold font-mono">
                    {step.processId}
                  </td>
                  <td className="border border-black p-1.5 font-mono font-medium">
                    {getMachineName(step.machineId)}
                  </td>
                  <td className="border border-black p-1.5">
                    <div className="font-bold text-xs">
                      {step.processText || "Machining Operation"}
                    </div>
                    <div className="text-[10px] text-gray-600">
                      Base Qty: {step.baseQty} | Manpower: {(step.manpowerPct * 100).toFixed(0)}%
                    </div>
                  </td>
                  <td className="border border-black p-1.5 text-center font-mono text-[10px]">
                    {step.setupTimeMin}m / {Math.round(step.sumV2)}m
                  </td>
                  <td className="border border-black p-1.5 font-mono text-[10px]">
                    <div>{formatDate(step.scheduledStart)}</div>
                    <div className="text-gray-500">to {formatDate(step.scheduledEnd)}</div>
                  </td>
                  <td className="border border-black p-1.5 text-center font-mono font-bold">
                    {step.completedQty !== undefined && step.completedQty > 0
                      ? step.completedQty
                      : ""}
                  </td>
                  <td className="border border-black p-1.5 text-center font-mono font-bold text-red-600">
                    {step.scrapQty !== undefined && step.scrapQty > 0 ? step.scrapQty : ""}
                  </td>
                  <td className="border border-black p-1.5 text-center">
                    {/* Blank sign-off area */}
                  </td>
                  <td className="border border-black p-1.5 text-center">
                    {/* Blank QA stamp area */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quality & Traceability Notes */}
        <div className="border border-black p-3 mb-4 grid grid-cols-2 gap-4">
          <div>
            <span className="block font-bold text-[10px] uppercase mb-1">
              Special Handling Instructions / Notes:
            </span>
            <div className="h-14 border border-dashed border-gray-400 p-1.5 text-[10px] text-gray-600">
              {order.priority === "Urgent"
                ? "EXPEDITED ORDER — High Priority line progression required. "
                : ""}
              Keep parts clean and deburred. Apply corrosion preventative oil prior to staging for
              packing.
            </div>
          </div>
          <div>
            <span className="block font-bold text-[10px] uppercase mb-1">
              Final Inspection & Release Stamp:
            </span>
            <div className="h-14 border border-black flex items-center justify-around p-2 text-center text-[10px]">
              <div>
                <span className="block text-gray-500 text-[9px]">Final QA Inspector</span>
                <span className="block border-b border-black w-24 mt-4"></span>
              </div>
              <div>
                <span className="block text-gray-500 text-[9px]">Accepted Qty</span>
                <span className="block border-b border-black w-16 mt-4"></span>
              </div>
              <div>
                <span className="block text-gray-500 text-[9px]">Release Date</span>
                <span className="block border-b border-black w-20 mt-4"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Traveler Footer */}
        <div className="text-[9px] text-gray-500 flex justify-between border-t border-gray-300 pt-2">
          <span>CapaSolve APS — Certified Manufacturing Traveler</span>
          <span>Confidential — Internal Shop Floor Use Only</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}
