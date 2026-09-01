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
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { PlusCircle, Layers, Calendar, Hash, Tag, Clock } from "lucide-react";

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ isOpen, onClose }) => {
  const { language } = useTranslations();
  const { machines, addWorkOrder } = useAppStore();

  const [orderId, setOrderId] = useState(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
  const [material, setMaterial] = useState("CASING-ALUM-304");
  const [orderQty, setOrderQty] = useState(100);
  const [sopStartDate, setSopStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [processId, setProcessId] = useState(10);
  const [machineId, setMachineId] = useState(machines[0]?.id || "603010");
  const [processText, setProcessText] = useState("CNC Milling & Facing");
  const [setupTimeMin, setSetupTimeMin] = useState(30);
  const [processTimeMin, setProcessTimeMin] = useState(5);
  const [manpowerUtil, setManpowerUtil] = useState(1.0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim() || !material.trim()) {
      toast.error("Please fill in Order ID and Material SKU.");
      return;
    }

    if (orderQty <= 0 || setupTimeMin < 0 || processTimeMin <= 0) {
      toast.error("Quantities and processing times must be positive numbers.");
      return;
    }

    addWorkOrder({
      orderId: orderId.trim(),
      material: material.trim(),
      orderQty,
      sopStartDate: `${sopStartDate}T08:00:00Z`,
      processId,
      machineId,
      processText: processText.trim(),
      baseQty: 1,
      setupTimeMin,
      processTimeMin,
      manpowerUtilizationMin: manpowerUtil,
    });

    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <PlusCircle className="h-5 w-5 text-primary" />
            {language === "de" ? "Neuen Fertigungsauftrag erstellen" : "Create New Work Order"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {language === "de"
              ? "Geben Sie die Auftrags- und Operationsdaten ein, um sofort in den Terminplaner aufzunehmen."
              : "Enter work order parameters and initial operation step to add directly to the active schedule."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Order Details */}
          <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl border border-border/50">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Hash className="h-3 w-3" /> Order ID / Number
              </Label>
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. 1023811"
                className="text-xs bg-background h-8"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Material SKU / Part No
              </Label>
              <Input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="e.g. CASING-ALUM-304"
                className="text-xs bg-background h-8"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" /> Order Quantity
              </Label>
              <Input
                type="number"
                value={orderQty}
                onChange={(e) => setOrderQty(Number(e.target.value))}
                className="text-xs bg-background h-8"
                min={1}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> SOP Target Start Date
              </Label>
              <Input
                type="date"
                value={sopStartDate}
                onChange={(e) => setSopStartDate(e.target.value)}
                className="text-xs bg-background h-8"
                required
              />
            </div>
          </div>

          {/* Initial Step Details */}
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 space-y-3">
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Initial Operation Step Definition
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Step Number (Vorgang)
                </Label>
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
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Assigned Workcenter / Machine
                </Label>
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2 text-xs h-8 outline-none focus:ring-1 focus:ring-primary"
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} — {m.name} ({m.machineGroupId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Process Description
                </Label>
                <Input
                  value={processText}
                  onChange={(e) => setProcessText(e.target.value)}
                  placeholder="e.g. CNC Milling & Surface Finishing"
                  className="text-xs bg-background h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Setup Time (mins)
                </Label>
                <Input
                  type="number"
                  value={setupTimeMin}
                  onChange={(e) => setSetupTimeMin(Number(e.target.value))}
                  className="text-xs bg-background h-8"
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Process Time / Unit (mins)
                </Label>
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
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/95"
            >
              Add Work Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
