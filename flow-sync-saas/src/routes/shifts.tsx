import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Calendar, 
  Clock, 
  Wrench, 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle,
  Factory,
  SlidersHorizontal
} from "lucide-react";
import { toast } from "sonner";

export interface ShiftProfile {
  id: string;
  name: string;
  hoursPerDay: number;
  startTime: string;
  endTime: string;
  weekendWork: boolean;
}

export interface MaintenanceBlock {
  id: string;
  machineId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

const defaultShifts: ShiftProfile[] = [
  { id: "s-1", name: "Single Shift (1-Shift)", hoursPerDay: 8, startTime: "08:00", endTime: "16:00", weekendWork: false },
  { id: "s-2", name: "Double Shift (2-Shift)", hoursPerDay: 16, startTime: "06:00", endTime: "22:00", weekendWork: false },
  { id: "s-3", name: "24-Hour Continuous (3-Shift)", hoursPerDay: 24, startTime: "00:00", endTime: "24:00", weekendWork: true },
];

const defaultMaintenance: MaintenanceBlock[] = [
  { id: "maint-1", machineId: "603011", startDate: "2026-08-10", endDate: "2026-08-11", reason: "Annual Spindle & Lubrication Calibration" },
  { id: "maint-2", machineId: "605001", startDate: "2026-08-15", endDate: "2026-08-15", reason: "Preventative Hydraulic Oil Change" },
];

export const Route = createFileRoute("/shifts")({
  component: ShiftsPage,
});

function ShiftsPage() {
  const { machines } = useAppStore();
  const [shifts, setShifts] = useState<ShiftProfile[]>(defaultShifts);
  const [maintBlocks, setMaintBlocks] = useState<MaintenanceBlock[]>(defaultMaintenance);

  // New Maintenance Form State
  const [mMachine, setMMachine] = useState<string>(machines[0]?.id || "603011");
  const [mStart, setMStart] = useState<string>("2026-08-20");
  const [mEnd, setMEnd] = useState<string>("2026-08-20");
  const [mReason, setMReason] = useState<string>("");

  const handleAddMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mReason.trim()) return toast.error("Please enter a maintenance reason.");

    const newBlock: MaintenanceBlock = {
      id: `maint-${Date.now()}`,
      machineId: mMachine,
      startDate: mStart,
      endDate: mEnd,
      reason: mReason.trim(),
    };

    setMaintBlocks([...maintBlocks, newBlock]);
    setMReason("");
    toast.success(`Scheduled maintenance block for Workstation ${mMachine}`);
  };

  const handleDeleteMaintenance = (id: string) => {
    setMaintBlocks(maintBlocks.filter((b) => b.id !== id));
    toast.info("Maintenance block deleted.");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Calendar className="h-7 w-7 text-primary" />
            Custom Shift Calendars & Maintenance Overrides
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure multi-shift rosters, weekend working rules, and planned preventative maintenance downtime blocks per workstation.
          </p>
        </div>
      </div>

      {/* Shift Profiles Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {shifts.map((s) => (
          <Card key={s.id} className="border border-border/80 shadow-sm bg-card flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                  {s.hoursPerDay} HOURS / DAY
                </Badge>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base font-bold text-foreground mt-2">{s.name}</CardTitle>
              <CardDescription className="text-xs">
                Operating Window: <strong className="text-foreground font-mono">{s.startTime} – {s.endTime}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-border/60">
                <span className="text-muted-foreground">Weekend Shift Allowed:</span>
                <span className={`font-bold ${s.weekendWork ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                  {s.weekendWork ? "YES (SAT & SUN)" : "NO (MON-FRI)"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Maintenance Downtime Creator Section */}
      <Card className="border border-border/80 shadow-sm bg-card">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            Schedule Preventative Maintenance Downtime Block
          </CardTitle>
          <CardDescription>
            Lock workstations as offline for scheduled repairs. Solver automatically re-routes jobs around maintenance windows.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleAddMaintenance} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Target Workstation *</Label>
              <select
                value={mMachine}
                onChange={(e) => setMMachine(e.target.value)}
                className="w-full h-9 px-2 bg-background border border-input rounded-md text-xs font-bold"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.machineGroupId})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Start Date *</Label>
              <Input
                type="date"
                value={mStart}
                onChange={(e) => setMStart(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">End Date *</Label>
              <Input
                type="date"
                value={mEnd}
                onChange={(e) => setMEnd(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Maintenance Reason *</Label>
              <Input
                type="text"
                placeholder="e.g. Calibration & Belt Replacement"
                value={mReason}
                onChange={(e) => setMReason(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="sm:col-span-4 flex justify-end pt-2">
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold h-9 text-xs gap-1.5">
                <Plus className="h-4 w-4" />
                Add Maintenance Block
              </Button>
            </div>
          </form>

          {/* Maintenance Table */}
          <div className="border border-border/60 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-xs font-bold">Workstation</TableHead>
                  <TableHead className="text-xs font-bold">Start Date</TableHead>
                  <TableHead className="text-xs font-bold">End Date</TableHead>
                  <TableHead className="text-xs font-bold">Maintenance Description</TableHead>
                  <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintBlocks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-bold text-primary">{b.machineId}</TableCell>
                    <TableCell className="text-xs font-semibold">{b.startDate}</TableCell>
                    <TableCell className="text-xs font-semibold">{b.endDate}</TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">{b.reason}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMaintenance(b.id)}
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
