import { useState, useEffect } from "react";
import { OrderProcess } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, AlertTriangle, Clock, Hammer } from "lucide-react";
import { toast } from "sonner";

interface LogWorkDoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: OrderProcess | null;
  orderQty?: number;
}

export function LogWorkDoneModal({ open, onOpenChange, process, orderQty = 100 }: LogWorkDoneModalProps) {
  const { logProcessProgress } = useAppStore();

  const [completedQty, setCompletedQty] = useState<number>(0);
  const [scrapQty, setScrapQty] = useState<number>(0);
  const [actualSetupMin, setActualSetupMin] = useState<number>(0);
  const [actualProcessMin, setActualProcessMin] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (process) {
      setCompletedQty(process.completedQty || 0);
      setScrapQty(process.scrapQty || 0);
      setActualSetupMin(process.setupTimeMin || 0);
      setActualProcessMin(process.processTimeMin || 0);
      setNotes(process.operatorNotes || "");
    }
  }, [process]);

  if (!process) return null;

  const completionPct = Math.min(100, Math.round(((completedQty || 0) / orderQty) * 100));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (completedQty < 0 || scrapQty < 0) {
      toast.error("Quantities cannot be negative.");
      return;
    }

    logProcessProgress(process.id, {
      completedQty,
      scrapQty,
      actualSetupMin,
      actualProcessMin,
      operatorNotes: notes,
      executionStatus: completionPct >= 100 ? "COMPLETED" : completedQty > 0 ? "IN_PROGRESS" : "PLANNED",
    });

    toast.success(`Logged progress for Step ${process.processId} (${process.processText}): ${completionPct}% Complete`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Hammer className="h-5 w-5 text-primary" />
            MES Operator Progress & Scrap Logger
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-xs">
          {/* Order & Process Info Header */}
          <div className="bg-muted/40 p-3 rounded-xl border border-border/60 space-y-1">
            <div className="flex justify-between items-center font-semibold text-foreground">
              <span>Order ID: {process.orderId}</span>
              <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                Step {process.processId}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">{process.processText} on Workstation: <strong className="text-foreground">{process.machineId}</strong></p>
          </div>

          {/* Progress Visual Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Completion Progress</span>
              <span className="text-primary font-bold">{completionPct}%</span>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Good Units Done *
              </Label>
              <Input
                type="number"
                min={0}
                value={completedQty}
                onChange={(e) => setCompletedQty(parseInt(e.target.value) || 0)}
                className="h-8 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                Scrap / Defect Count
              </Label>
              <Input
                type="number"
                min={0}
                value={scrapQty}
                onChange={(e) => setScrapQty(parseInt(e.target.value) || 0)}
                className="h-8 text-xs font-bold text-rose-600 dark:text-rose-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                Actual Setup (min)
              </Label>
              <Input
                type="number"
                min={0}
                value={actualSetupMin}
                onChange={(e) => setActualSetupMin(parseInt(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Actual Machining (min)
              </Label>
              <Input
                type="number"
                min={0}
                value={actualProcessMin}
                onChange={(e) => setActualProcessMin(parseInt(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Operator Shift Notes</Label>
            <Textarea
              placeholder="e.g. Tooling change required after batch #20..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
              Save Execution Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
