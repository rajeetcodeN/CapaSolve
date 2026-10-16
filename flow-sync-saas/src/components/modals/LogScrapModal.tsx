import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrapReason } from "@/lib/types";
import { Trash2, AlertOctagon, Disc, Sparkles, Box, Hammer, HelpCircle } from "lucide-react";

interface LogScrapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  processId: number;
  machineId: string;
  totalOrderQty?: number;
  onConfirm: (scrapQty: number, reason: ScrapReason, notes: string) => void;
}

const SCRAP_REASONS: {
  id: ScrapReason;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    id: "SETUP_SCRAP",
    label: "Setup / Changeover Part",
    description: "Trial part used for fixture centering or tool touch-off",
    icon: Disc,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    id: "DIMENSION_OOS",
    label: "Dimension Out of Spec",
    description: "Diameter, bore depth, or geometric tolerance exceeded",
    icon: AlertOctagon,
    color: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  {
    id: "SURFACE_FLAW",
    label: "Surface Chatter / Roughness",
    description: "Ra roughness limit exceeded, chatter marks, burrs",
    icon: Sparkles,
    color: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  },
  {
    id: "MATERIAL_POROSITY",
    label: "Material Inclusions / Voids",
    description: "Internal casting blowholes, cold shuts, alloy porosity",
    icon: Box,
    color: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  },
  {
    id: "TOOL_BREAKAGE",
    label: "Tool Break Damage",
    description: "Broken tap/endmill lodged in workpiece, cutter dive",
    icon: Hammer,
    color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  },
  {
    id: "OTHER",
    label: "Other Defect",
    description: "Workholding slippage, operator error, coolant stain",
    icon: HelpCircle,
    color: "text-slate-400 border-slate-500/30 bg-slate-500/10",
  },
];

export function LogScrapModal({
  open,
  onOpenChange,
  orderId,
  processId,
  machineId,
  totalOrderQty,
  onConfirm,
}: LogScrapModalProps) {
  const [scrapQty, setScrapQty] = useState<number>(1);
  const [selectedReason, setSelectedReason] = useState<ScrapReason>("DIMENSION_OOS");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (scrapQty <= 0) return;
    onConfirm(scrapQty, selectedReason, notes.trim());
    setScrapQty(1);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
            <Trash2 className="w-4 h-4" />
            <span>Quality Assurance & Scrap Telemetry</span>
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            Log Defect / Scrap Units
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Record rejected pieces for Work Order{" "}
            <span className="text-white font-mono font-medium">{orderId}</span> (Step {processId} on
            Machine <span className="text-white font-mono font-medium">{machineId}</span>).
            {totalOrderQty ? ` Target batch: ${totalOrderQty} pcs.` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="scrap-qty" className="text-xs font-semibold text-slate-300">
              Scrap Quantity (Pieces)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="scrap-qty"
                type="number"
                min="1"
                max={totalOrderQty || 9999}
                value={scrapQty}
                onChange={(e) => setScrapQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-slate-950 border-slate-800 text-base font-semibold text-red-400 w-32"
              />
              <div className="flex gap-1">
                {[1, 2, 5, 10].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScrapQty(num)}
                    className="border-slate-800 text-xs text-slate-300 hover:bg-slate-800 h-9 px-2.5"
                  >
                    +{num}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Defect Classification
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {SCRAP_REASONS.map((r) => {
                const Icon = r.icon;
                const isSelected = selectedReason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? `${r.color} ring-1 ring-red-400/50 shadow-sm`
                        : "border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-black/30" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white leading-tight">
                        {r.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{r.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scrap-notes" className="text-xs font-semibold text-slate-300">
              Inspection Notes / Root Cause (Optional)
            </Label>
            <Textarea
              id="scrap-notes"
              placeholder="e.g. Bore diameter measured 50.12mm (tolerance +/- 0.05mm max)."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-16 bg-slate-950 border-slate-800 text-xs text-slate-200 resize-none focus-visible:ring-red-500/50"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-500 text-white font-semibold text-xs gap-1.5 shadow-sm"
            >
              Record {scrapQty} Defect Piece{scrapQty > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
