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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import {
  PlusCircle,
  Trash2,
  Layers,
  Calendar,
  Clock,
  Wrench,
  Hash,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { OrderPriority } from "@/lib/types";

interface RoutingStepDraft {
  processId: number;
  machineId: string;
  processText: string;
  setupTimeMin: number;
  processTimeMin: number;
  manpowerUtilizationMin: number;
}

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({ isOpen, onClose }) => {
  const { machines, materialsInventory, addWorkOrderWithRouting } = useAppStore();

  const [activeTab, setActiveTab] = useState<"basic" | "routing">("basic");

  // Basic Info State
  const [orderId, setOrderId] = useState(() => `WO-${Math.floor(100000 + Math.random() * 900000)}`);
  const [material, setMaterial] = useState("100-024-830.01-00");
  const [orderQty, setOrderQty] = useState(100);
  const [priority, setPriority] = useState<OrderPriority>("Med");
  const [sopStartDate, setSopStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sopStartTime, setSopStartTime] = useState("08:00");
  const [customerDueDate, setCustomerDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });

  // Routing Steps State
  const [steps, setSteps] = useState<RoutingStepDraft[]>([
    {
      processId: 10,
      machineId: machines[0]?.id || "603010",
      processText: "SAWING / ROUGH CUTTING",
      setupTimeMin: 15,
      processTimeMin: 2,
      manpowerUtilizationMin: 0.5,
    },
    {
      processId: 20,
      machineId: machines[1]?.id || machines[0]?.id || "603011",
      processText: "CNC 5-AXIS MILLING & FACING",
      setupTimeMin: 45,
      processTimeMin: 8,
      manpowerUtilizationMin: 1.0,
    },
    {
      processId: 30,
      machineId: machines[2]?.id || machines[0]?.id || "603012",
      processText: "DEBURRING & QUALITY INSPECTION",
      setupTimeMin: 10,
      processTimeMin: 3,
      manpowerUtilizationMin: 1.0,
    },
  ]);

  const handleAddStep = () => {
    const nextStepId = steps.length > 0 ? Math.max(...steps.map((s) => s.processId)) + 10 : 10;
    setSteps([
      ...steps,
      {
        processId: nextStepId,
        machineId: machines[0]?.id || "603010",
        processText: `OPERATION ${nextStepId}`,
        setupTimeMin: 20,
        processTimeMin: 4,
        manpowerUtilizationMin: 1.0,
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      toast.warning("A work order requires at least one routing step.");
      return;
    }
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleUpdateStep = (index: number, field: keyof RoutingStepDraft, value: any) => {
    setSteps(steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)));
  };

  // Calculations
  const totalSetupMin = steps.reduce((sum, s) => sum + (Number(s.setupTimeMin) || 0), 0);
  const totalProcessMin = steps.reduce(
    (sum, s) => sum + (Number(s.processTimeMin) || 0) * (Number(orderQty) || 1),
    0,
  );
  const totalDurationHours = ((totalSetupMin + totalProcessMin) / 60).toFixed(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!orderId.trim()) {
      toast.error("Work Order ID is required.");
      setActiveTab("basic");
      return;
    }
    if (!material.trim()) {
      toast.error("Material SKU is required.");
      setActiveTab("basic");
      return;
    }
    if (orderQty <= 0) {
      toast.error("Target quantity must be greater than 0.");
      setActiveTab("basic");
      return;
    }
    if (steps.length === 0) {
      toast.error("At least one routing step is required.");
      setActiveTab("routing");
      return;
    }

    // Validate unique step numbers
    const stepIds = new Set(steps.map((s) => s.processId));
    if (stepIds.size !== steps.length) {
      toast.error("Routing step IDs (10, 20, 30...) must be unique.");
      setActiveTab("routing");
      return;
    }

    addWorkOrderWithRouting(
      {
        orderId: orderId.trim(),
        material: material.trim(),
        sopStartDate,
        sopStartTime: `${sopStartTime}:00`,
        orderQty,
        priority,
        customerDueDate,
      },
      steps,
    );

    // Reset and close
    setOrderId(`WO-${Math.floor(100000 + Math.random() * 900000)}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col bg-card border-border shadow-2xl rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Create Work Order & Multi-Step Routing
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Define order parameters and sequential operations for finite capacity scheduling.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
              {steps.length} Steps · ~{totalDurationHours} hrs
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "basic" | "routing")}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full max-w-sm mb-4">
                <TabsTrigger value="basic" className="text-xs font-semibold">
                  1. Order Parameters
                </TabsTrigger>
                <TabsTrigger value="routing" className="text-xs font-semibold">
                  2. Sequential Routing ({steps.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Basic Info */}
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      Work Order Number (WO / COOIS)
                    </Label>
                    <Input
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      placeholder="e.g. WO-904128"
                      className="text-xs font-mono font-bold"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                      Raw Material SKU / Part Specification
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        placeholder="e.g. 100-024-830.01-00"
                        className="text-xs font-mono"
                        required
                      />
                      <Select value={material} onValueChange={setMaterial}>
                        <SelectTrigger className="w-[140px] text-xs shrink-0">
                          <SelectValue placeholder="Known SKUs" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialsInventory.map((m) => (
                            <SelectItem key={m.sku} value={m.sku} className="text-xs">
                              {m.sku}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      Target Production Quantity
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={orderQty}
                      onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="text-xs font-mono"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      Priority Level
                    </Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as OrderPriority)}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Urgent">🔴 Urgent (Expedited)</SelectItem>
                        <SelectItem value="High">🟠 High Priority</SelectItem>
                        <SelectItem value="Med">🟡 Medium Priority</SelectItem>
                        <SelectItem value="Low">⚪ Low Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      SOP Planned Start Date & Time
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={sopStartDate}
                        onChange={(e) => setSopStartDate(e.target.value)}
                        className="text-xs"
                        required
                      />
                      <Input
                        type="time"
                        value={sopStartTime}
                        onChange={(e) => setSopStartTime(e.target.value)}
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-rose-500" />
                      Customer Delivery Due Date
                    </Label>
                    <Input
                      type="date"
                      value={customerDueDate}
                      onChange={(e) => setCustomerDueDate(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Next step: review machine assignments and setup/run parameters.</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("routing")}
                    className="text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    Configure Routing <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Routing Steps */}
              <TabsContent value="routing" className="space-y-4 mt-0">
                <div className="space-y-3">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-muted/30 border border-border rounded-xl space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary text-primary-foreground font-mono font-bold text-xs">
                            Step {step.processId}
                          </Badge>
                          <span className="text-xs font-semibold text-foreground">
                            Sequence #{idx + 1}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStep(idx)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Operation Description
                          </Label>
                          <Input
                            value={step.processText}
                            onChange={(e) => handleUpdateStep(idx, "processText", e.target.value)}
                            placeholder="e.g. CNC Milling"
                            className="text-xs h-8"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold text-muted-foreground">
                            Target Machine
                          </Label>
                          <Select
                            value={step.machineId}
                            onValueChange={(v) => handleUpdateStep(idx, "machineId", v)}
                          >
                            <SelectTrigger className="text-xs h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {machines.map((m) => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">
                                  {m.name || m.id} ({m.machineGroupId})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">
                              Setup (R min)
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={step.setupTimeMin}
                              onChange={(e) =>
                                handleUpdateStep(idx, "setupTimeMin", parseInt(e.target.value) || 0)
                              }
                              className="text-xs h-8 font-mono"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-semibold text-muted-foreground">
                              Run (M min/pc)
                            </Label>
                            <Input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={step.processTimeMin}
                              onChange={(e) =>
                                handleUpdateStep(
                                  idx,
                                  "processTimeMin",
                                  parseFloat(e.target.value) || 1,
                                )
                              }
                              className="text-xs h-8 font-mono"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddStep}
                    className="w-full text-xs border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary gap-1.5 py-4"
                  >
                    <PlusCircle className="h-4 w-4" /> Add Sequential Operation Step
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Total Setup: <strong className="text-foreground">{totalSetupMin}m</strong>
              </span>
              <span>·</span>
              <span>
                Total Cycle: <strong className="text-foreground">{totalProcessMin}m</strong>
              </span>
              <span>·</span>
              <span>
                Estimated Workload:{" "}
                <strong className="text-primary font-mono">{totalDurationHours} hrs</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Schedule Work Order
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
