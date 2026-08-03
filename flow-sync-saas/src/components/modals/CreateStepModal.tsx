import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { PlusCircle, Clock, Wrench } from "lucide-react";

interface CreateStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetOrderId?: string;
}

export const CreateStepModal: React.FC<CreateStepModalProps> = ({ isOpen, onClose, targetOrderId }) => {
  const { language } = useTranslations();
  const { orders, machines, addWorkOrder } = useAppStore();

  const [selectedOrderId, setSelectedOrderId] = useState(targetOrderId || orders[0]?.orderId || "");
  const [processId, setProcessId] = useState(20);
  const [machineId, setMachineId] = useState(machines[0]?.id || "603010");
  const [processText, setProcessText] = useState("Drilling & Tapping");
  const [setupTimeMin, setSetupTimeMin] = useState(20);
  const [processTimeMin, setProcessTimeMin] = useState(3);
  const [manpowerUtil, setManpowerUtil] = useState(0.8);

  const selectedOrder = orders.find((o) => o.orderId === selectedOrderId || o.id === selectedOrderId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      toast.error("Please select a target work order.");
      return;
    }

    addWorkOrder({
      orderId: selectedOrder.orderId,
      material: selectedOrder.material,
      orderQty: selectedOrder.orderQty,
      sopStartDate: selectedOrder.sopStartDate,
      processId,
      machineId,
      processText: processText.trim() || `OPERATION STEP ${processId}`,
      baseQty: 1,
      setupTimeMin,
      processTimeMin,
      manpowerUtilizationMin: manpowerUtil,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Wrench className="h-5 w-5 text-primary" />
            {language === "de" ? "Operationsschritt hinzufügen" : "Add Operation Step"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {language === "de"
              ? "Fügen Sie einen weiteren Vorgangsschritt zu einem bestehenden Fertigungsauftrag hinzu."
              : "Append a new routing operation step to an existing work order."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-muted-foreground">Target Work Order</Label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-2 text-xs h-9 outline-none focus:ring-1 focus:ring-primary"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.orderId}>
                  Order #{o.orderId} ({o.material} - Qty: {o.orderQty})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl border border-border/50">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Step ID / No (Vorgang)</Label>
              <Input
                type="number"
                value={processId}
                onChange={(e) => setProcessId(Number(e.target.value))}
                className="text-xs bg-background h-8"
                step={10}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Workcenter / Machine</Label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full bg-background border border-input rounded-md px-2 text-xs h-8 outline-none focus:ring-1 focus:ring-primary"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} — {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Step Description</Label>
              <Input
                value={processText}
                onChange={(e) => setProcessText(e.target.value)}
                placeholder="e.g. Precision Drilling & Reaming"
                className="text-xs bg-background h-8"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Setup Time (mins)</Label>
              <Input
                type="number"
                value={setupTimeMin}
                onChange={(e) => setSetupTimeMin(Number(e.target.value))}
                className="text-xs bg-background h-8"
                min={0}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Process Time / Unit (mins)</Label>
              <Input
                type="number"
                value={processTimeMin}
                onChange={(e) => setProcessTimeMin(Number(e.target.value))}
                className="text-xs bg-background h-8"
                min={0.1}
                step={0.1}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs h-9">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/95">
              Add Step
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
