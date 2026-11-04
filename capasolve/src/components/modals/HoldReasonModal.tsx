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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoldReason } from "@/lib/types";
import {
  AlertCircle,
  Wrench,
  AlertTriangle,
  PackageX,
  Coffee,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

interface HoldReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  processId: number;
  machineId: string;
  onConfirm: (reason: HoldReason, notes: string) => void;
}

const HOLD_REASONS: {
  id: HoldReason;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    id: "TOOLING_ISSUE",
    label: "Tool Wear / Breakage",
    description: "Worn inserts, endmill chipping, tool holder alignment",
    icon: Wrench,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    id: "MACHINE_FAULT",
    label: "Machine / Spindle Alarm",
    description: "CNC axis drive fault, hydraulic pressure, coolant alarm",
    icon: AlertTriangle,
    color: "text-red-400 border-red-500/30 bg-red-500/10",
  },
  {
    id: "MATERIAL_DEFECT",
    label: "Material Defect / Shortage",
    description: "Porosity, out-of-spec blank dimensions, missing billet",
    icon: PackageX,
    color: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  },
  {
    id: "QUALITY_CHECK",
    label: "Quality / FAI Inspection",
    description: "Awaiting CMM first-article sign-off or QA verification",
    icon: CheckCircle,
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  },
  {
    id: "OPERATOR_PAUSE",
    label: "Operator Break / Handover",
    description: "Shift turnover, meal pause, operator re-assignment",
    icon: Coffee,
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    id: "OTHER",
    label: "Other Operational Delay",
    description: "Shop floor congestion, program transfer, fixture cleaning",
    icon: HelpCircle,
    color: "text-slate-400 border-slate-500/30 bg-slate-500/10",
  },
];

export function HoldReasonModal({
  open,
  onOpenChange,
  orderId,
  processId,
  machineId,
  onConfirm,
}: HoldReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<HoldReason>("TOOLING_ISSUE");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedReason, notes.trim());
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Shop Floor Telemetry</span>
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            Place Operation on Hold
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Select an operational reason code for stopping Work Order{" "}
            <span className="text-white font-mono font-medium">{orderId}</span> (Step {processId} on
            Machine <span className="text-white font-mono font-medium">{machineId}</span>).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Reason Code
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {HOLD_REASONS.map((r) => {
                const Icon = r.icon;
                const isSelected = selectedReason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? `${r.color} ring-1 ring-amber-400/50 shadow-sm`
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
            <Label htmlFor="hold-notes" className="text-xs font-semibold text-slate-300">
              Floor Notes / Actions Taken (Optional)
            </Label>
            <Textarea
              id="hold-notes"
              placeholder="e.g. Tool insert chipped on flute 2. Maintenance dispatched."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-20 bg-slate-950 border-slate-800 text-xs text-slate-200 resize-none focus-visible:ring-amber-500/50"
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
              className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs gap-1.5 shadow-sm"
            >
              Confirm Hold
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
