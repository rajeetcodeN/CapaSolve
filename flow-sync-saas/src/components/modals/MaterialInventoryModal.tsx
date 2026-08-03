import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, Plus, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";

export interface MaterialItem {
  sku: string;
  description: string;
  availableQty: number;
  reservedQty: number;
  leadTimeDays: number;
  expectedArrivalDate?: string;
}

const defaultMaterials: MaterialItem[] = [
  { sku: "RAW-STEE-01", description: "Stainless Steel Rod 50mm", availableQty: 1200, reservedQty: 850, leadTimeDays: 3, expectedArrivalDate: "2026-08-05" },
  { sku: "RAW-ALUM-02", description: "Aluminum Extrusion Bar 20mm", availableQty: 400, reservedQty: 600, leadTimeDays: 7, expectedArrivalDate: "2026-08-12" },
  { sku: "RAW-PLAS-03", description: "ABS Polymer Resin Beads 25kg", availableQty: 2500, reservedQty: 1000, leadTimeDays: 2, expectedArrivalDate: "2026-08-04" },
];

interface MaterialInventoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MaterialInventoryModal({ open, onOpenChange }: MaterialInventoryModalProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>(defaultMaterials);
  const [sku, setSku] = useState("");
  const [desc, setDesc] = useState("");
  const [avail, setAvail] = useState(1000);
  const [leadDays, setLeadDays] = useState(5);

  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) return toast.error("Material SKU code is required.");

    const newItem: MaterialItem = {
      sku: sku.trim().toUpperCase(),
      description: desc.trim() || "Raw Material Component",
      availableQty: avail,
      reservedQty: 0,
      leadTimeDays: leadDays,
    };

    setMaterials([...materials, newItem]);
    setSku("");
    setDesc("");
    setAvail(1000);
    toast.success(`Added raw material component ${newItem.sku}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Raw Material Availability & BOM Line-Shortage Engine
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Add Material Form */}
          <form onSubmit={handleAddMaterial} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">SKU Code *</Label>
              <Input
                type="text"
                placeholder="e.g. RAW-STEE-01"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="h-8 text-xs font-mono uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                type="text"
                placeholder="e.g. Steel Rod"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">On-Hand Qty</Label>
              <Input
                type="number"
                min={0}
                value={avail}
                onChange={(e) => setAvail(parseInt(e.target.value) || 0)}
                className="h-8 text-xs font-bold"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" className="w-full bg-primary text-primary-foreground font-bold h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add Component
              </Button>
            </div>
          </form>

          {/* Material Stock Table */}
          <div className="border border-border/60 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs font-bold">SKU Code</TableHead>
                  <TableHead className="text-xs font-bold">Description</TableHead>
                  <TableHead className="text-xs font-bold">On-Hand Qty</TableHead>
                  <TableHead className="text-xs font-bold">Reserved Qty</TableHead>
                  <TableHead className="text-xs font-bold">Shortage Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m) => {
                  const isShortage = m.availableQty < m.reservedQty;
                  return (
                    <TableRow key={m.sku}>
                      <TableCell className="font-mono text-xs font-bold text-primary">{m.sku}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.description}</TableCell>
                      <TableCell className="text-xs font-bold">{m.availableQty} units</TableCell>
                      <TableCell className="text-xs font-bold">{m.reservedQty} units</TableCell>
                      <TableCell>
                        {isShortage ? (
                          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            SHORTAGE ({m.reservedQty - m.availableQty} units)
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            IN STOCK
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
