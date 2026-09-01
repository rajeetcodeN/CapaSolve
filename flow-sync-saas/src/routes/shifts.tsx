import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  Wrench,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  Factory,
  SlidersHorizontal,
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
  {
    id: "s-1",
    name: "Single Shift (1-Shift)",
    hoursPerDay: 8,
    startTime: "08:00",
    endTime: "16:00",
    weekendWork: false,
  },
  {
    id: "s-2",
    name: "Double Shift (2-Shift)",
    hoursPerDay: 16,
    startTime: "06:00",
    endTime: "22:00",
    weekendWork: false,
  },
  {
    id: "s-3",
    name: "24-Hour Continuous (3-Shift)",
    hoursPerDay: 24,
    startTime: "00:00",
    endTime: "24:00",
    weekendWork: true,
  },
];

const defaultMaintenance: MaintenanceBlock[] = [
  {
    id: "maint-1",
    machineId: "603011",
    startDate: "2026-08-10",
    endDate: "2026-08-11",
    reason: "Annual Spindle & Lubrication Calibration",
  },
  {
    id: "maint-2",
    machineId: "605001",
    startDate: "2026-08-15",
    endDate: "2026-08-15",
    reason: "Preventative Hydraulic Oil Change",
  },
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
      {/* 1. Streamlined Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            Shift Rosters & Maintenance Overrides
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Configure multi-shift rosters, weekend working rules, and planned preventative
            maintenance downtime blocks.
          </p>
        </div>
      </div>

      {/* Shift Profiles Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {shifts.map((s) => (
          <Card
            key={s.id}
            className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-xl flex flex-col justify-between"
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  {s.hoursPerDay} HOURS / DAY
                </Badge>
                <Clock className="h-4 w-4 text-slate-400" />
              </div>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                {s.name}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Operating Window:{" "}
                <strong className="text-slate-700 dark:text-slate-300 font-mono">
                  {s.startTime} – {s.endTime}
                </strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-500">Weekend Shift Allowed:</span>
                <span
                  className={`font-semibold ${s.weekendWork ? "text-slate-900 dark:text-white" : "text-slate-400"}`}
                >
                  {s.weekendWork ? "YES (SAT & SUN)" : "NO (MON-FRI)"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Maintenance Downtime Creator Section */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Wrench className="h-4 w-4 text-slate-500" />
            Schedule Preventative Maintenance Downtime Block
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Lock workstations as offline for scheduled repairs. Solver automatically re-routes jobs
            around maintenance windows.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <form
            onSubmit={handleAddMaintenance}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Workstation *
              </Label>
              <Select value={mMachine} onValueChange={setMMachine}>
                <SelectTrigger className="w-full h-8.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
                  <SelectValue placeholder="Select workstation" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      {m.name} ({m.machineGroupId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DatePickerField value={mStart} onChange={setMStart} label="Start Date *" />

            <DatePickerField value={mEnd} onChange={setMEnd} label="End Date *" />

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Maintenance Reason *
              </Label>
              <Input
                type="text"
                placeholder="e.g. Calibration & Belt Replacement"
                value={mReason}
                onChange={(e) => setMReason(e.target.value)}
                className="h-8.5 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs"
              />
            </div>

            <div className="sm:col-span-4 flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                className="bg-[#1e3f2e] hover:bg-[#27533d] text-white font-medium h-8.5 text-xs gap-1.5 shadow-xs border border-[#27533d] rounded-lg"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Maintenance Block
              </Button>
            </div>
          </form>

          {/* Maintenance Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-850">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Workstation
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Start Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    End Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Maintenance Description
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintBlocks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      {b.machineId}
                    </TableCell>
                    <TableCell className="text-xs font-normal text-slate-700 dark:text-slate-300">
                      {b.startDate}
                    </TableCell>
                    <TableCell className="text-xs font-normal text-slate-700 dark:text-slate-300">
                      {b.endDate}
                    </TableCell>
                    <TableCell className="text-xs font-normal text-slate-500">{b.reason}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMaintenance(b.id)}
                        className="h-7 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
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
