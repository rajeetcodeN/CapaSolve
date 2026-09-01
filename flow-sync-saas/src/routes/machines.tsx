import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Factory,
  Plus,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Wrench,
  Search,
  Filter,
  Shield,
  Trash2,
  CalendarOff,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/machines")({
  head: () => ({
    meta: [
      { title: "Workstation & Machine Management — CapaSolve SaaS" },
      {
        name: "description",
        content:
          "Manage manufacturing workstations, machine groups, and planned maintenance downtime blocks.",
      },
    ],
  }),
  component: MachineManagementPage,
});

function MachineManagementPage() {
  const { machines, machineGroups, setDailyCapacity, language } = useAppStore();
  const { t } = useTranslations();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("ALL");

  // Local state for adding machine
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [newMachineId, setNewMachineId] = useState("");
  const [newMachineName, setNewMachineName] = useState("");
  const [newGroupId, setNewGroupId] = useState("M1");

  // Local state for maintenance downtime modal
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [selectedMachineForMaint, setSelectedMachineForMaint] = useState<any>(null);
  const [maintStartDate, setMaintStartDate] = useState("2026-06-10");
  const [maintEndDate, setMaintEndDate] = useState("2026-06-12");
  const [maintNote, setMaintNote] = useState("Planned Preventive Maintenance / Tool Re-alignment");

  // Filtered Machines List
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (selectedGroup !== "ALL" && m.machineGroupId !== selectedGroup) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.id.toLowerCase().includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.machineGroupId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [machines, selectedGroup, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = machines.length;
    const totalGroups = machineGroups.length;
    return { total, totalGroups };
  }, [machines, machineGroups]);

  // Schedule Maintenance Downtime
  const handleScheduleMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForMaint) return;

    const start = new Date(maintStartDate);
    const end = new Date(maintEndDate);

    const curr = new Date(start);
    let count = 0;
    while (curr <= end) {
      const dStr = curr.toISOString().split("T")[0];
      setDailyCapacity(dStr, { setter: 0, process: 0, isHoliday: true });
      curr.setDate(curr.getDate() + 1);
      count++;
    }

    toast.success(
      `Scheduled ${count} maintenance downtime days for ${selectedMachineForMaint.name}`,
    );
    setIsMaintenanceOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Streamlined Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="h-7.5 w-7.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-800 dark:text-emerald-300 shrink-0">
              <Factory className="h-4 w-4" />
            </div>
            Workstation & Machine Management
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Configure manufacturing lines, assigned machine groups, and scheduled preventive
            maintenance blocks.
          </p>
        </div>

        <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="bg-[#1e3f2e] hover:bg-[#27533d] text-white font-medium shadow-xs border border-[#27533d] text-xs gap-1.5 cursor-pointer rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Add New Workstation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-slate-500" />
                Add Workstation Line
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newMachineId.trim()) return toast.error("Machine Code is required.");
                toast.success(`Added workstation ${newMachineName || newMachineId}`);
                setIsAddMachineOpen(false);
                setNewMachineId("");
                setNewMachineName("");
              }}
              className="space-y-4 pt-2 text-xs"
            >
              <div className="space-y-1">
                <Label
                  htmlFor="m-id"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Workstation Code / ID *
                </Label>
                <Input
                  id="m-id"
                  value={newMachineId}
                  onChange={(e) => setNewMachineId(e.target.value)}
                  placeholder="e.g. 603013"
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label
                  htmlFor="m-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Workstation Description
                </Label>
                <Input
                  id="m-name"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  placeholder="e.g. High-Speed SMT Assembly Line 03"
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Machine Group *
                </Label>
                <Select value={newGroupId} onValueChange={setNewGroupId}>
                  <SelectTrigger className="w-full h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
                    {machineGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id} className="text-xs">
                        {g.name} ({g.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddMachineOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#1e3f2e] hover:bg-[#27533d] text-white font-medium shadow-xs border border-[#27533d]"
                >
                  Save Workstation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between rounded-xl">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Workstations</p>
            <p className="text-2xl font-bold font-mono mt-1 text-slate-900 dark:text-white">
              {stats.total}
            </p>
          </div>
          <Factory className="h-7 w-7 text-slate-400" />
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between rounded-xl">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Machine Groups</p>
            <p className="text-2xl font-bold font-mono mt-1 text-slate-900 dark:text-white">
              {stats.totalGroups}
            </p>
          </div>
          <Layers className="h-7 w-7 text-slate-400" />
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex items-center justify-between rounded-xl">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Maintenance Status</p>
            <p className="text-sm font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
              All Lines Operational
            </p>
          </div>
          <CheckCircle2 className="h-7 w-7 text-slate-400" />
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-3 border-slate-200/90 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workstation by code, description, or group..."
              className="pl-9 text-xs h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Group:</span>
            </div>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs min-w-[150px]">
                <SelectValue placeholder="All Groups" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-md">
                <SelectItem value="ALL" className="text-xs">
                  All Groups
                </SelectItem>
                {machineGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">
                    {g.name} ({g.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Workstation Table */}
      <Card className="border-border/70 shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 text-xs">
                <TableHead className="font-bold">Code / ID</TableHead>
                <TableHead className="font-bold">Workstation Name</TableHead>
                <TableHead className="font-bold">Machine Group</TableHead>
                <TableHead className="font-bold text-center">Status</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMachines.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30 transition-colors text-xs">
                  <TableCell className="font-extrabold font-mono text-primary text-xs">
                    {m.id}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{m.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    Group {m.machineGroupId}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="h-3 w-3" /> Operational
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedMachineForMaint(m);
                        setIsMaintenanceOpen(true);
                      }}
                      className="text-[11px] h-7 px-2.5 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <Wrench className="h-3 w-3" />
                      Plan Maintenance
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Maintenance Dialog */}
      <Dialog open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-500" />
              Schedule Maintenance Downtime — {selectedMachineForMaint?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleScheduleMaintenance} className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <DatePickerField
                value={maintStartDate}
                onChange={setMaintStartDate}
                label="Start Date *"
              />
              <DatePickerField value={maintEndDate} onChange={setMaintEndDate} label="End Date *" />
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="maint-note"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Maintenance Description / Reason
              </Label>
              <textarea
                id="maint-note"
                value={maintNote}
                onChange={(e) => setMaintNote(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs min-h-[70px] outline-none focus:ring-1 focus:ring-emerald-600 shadow-2xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMaintenanceOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#1e3f2e] hover:bg-[#27533d] text-white font-semibold shadow-xs border border-[#27533d]"
              >
                Block Machine Dates
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
