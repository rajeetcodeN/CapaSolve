import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/machines")({
  head: () => ({
    meta: [
      { title: "Workstation & Machine Management — CapaSolve SaaS" },
      { name: "description", content: "Manage manufacturing workstations, machine groups, and planned maintenance downtime blocks." },
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
        return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.machineGroupId.toLowerCase().includes(q);
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

    toast.success(`Scheduled ${count} maintenance downtime days for ${selectedMachineForMaint.name}`);
    setIsMaintenanceOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-border/60">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Factory className="h-7 w-7 text-primary" />
            Workstation & Machine Group Management
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Configure manufacturing lines, assigned machine groups, and scheduled preventive maintenance blocks.
          </p>
        </div>

        <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="bg-primary text-primary-foreground font-bold shadow-md text-xs gap-2">
              <Plus className="h-4 w-4" />
              Add New Workstation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add Workstation Line
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newMachineId.trim()) return toast.error("Machine Code is required.");
              toast.success(`Added workstation ${newMachineName || newMachineId}`);
              setIsAddMachineOpen(false);
              setNewMachineId("");
              setNewMachineName("");
            }} className="space-y-4 pt-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="m-id" className="text-xs font-semibold">Workstation Code / ID *</Label>
                <Input
                  id="m-id"
                  value={newMachineId}
                  onChange={(e) => setNewMachineId(e.target.value)}
                  placeholder="e.g. 603013"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="m-name" className="text-xs font-semibold">Workstation Description</Label>
                <Input
                  id="m-name"
                  value={newMachineName}
                  onChange={(e) => setNewMachineName(e.target.value)}
                  placeholder="e.g. High-Speed SMT Assembly Line 03"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="m-group" className="text-xs font-semibold">Machine Group *</Label>
                <select
                  id="m-group"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  className="w-full h-9 bg-background border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-primary"
                >
                  {machineGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.id})
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddMachineOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-bold">
                  Save Workstation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-border/70 bg-card shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Workstations</p>
            <p className="text-2xl font-extrabold font-mono mt-1 text-foreground">{stats.total}</p>
          </div>
          <Factory className="h-8 w-8 text-primary opacity-80" />
        </Card>

        <Card className="p-4 border-border/70 bg-card shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Machine Groups</p>
            <p className="text-2xl font-extrabold font-mono mt-1 text-primary">{stats.totalGroups}</p>
          </div>
          <Layers className="h-8 w-8 text-emerald-500 opacity-80" />
        </Card>

        <Card className="p-4 border-border/70 bg-card shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">Maintenance Status</p>
            <p className="text-sm font-bold mt-1 text-emerald-600 dark:text-emerald-400">All Lines Operational</p>
          </div>
          <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-80" />
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 border-border/70 shadow-xs bg-card space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workstation by code, description, or group..."
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span>Group:</span>
            </div>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="h-9 bg-background border border-input rounded-md px-3 text-xs focus:ring-1 focus:ring-primary min-w-[150px]"
            >
              <option value="ALL">All Groups</option>
              {machineGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name} ({g.id})</option>
              ))}
            </select>
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
                  <TableCell className="font-extrabold font-mono text-primary text-xs">{m.id}</TableCell>
                  <TableCell className="font-semibold text-foreground">{m.name}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">Group {m.machineGroupId}</TableCell>
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
              <div className="space-y-1">
                <Label htmlFor="maint-start" className="text-xs font-semibold">Start Date *</Label>
                <Input
                  id="maint-start"
                  type="date"
                  value={maintStartDate}
                  onChange={(e) => setMaintStartDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maint-end" className="text-xs font-semibold">End Date *</Label>
                <Input
                  id="maint-end"
                  type="date"
                  value={maintEndDate}
                  onChange={(e) => setMaintEndDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="maint-note" className="text-xs font-semibold">Maintenance Description / Reason</Label>
              <textarea
                id="maint-note"
                value={maintNote}
                onChange={(e) => setMaintNote(e.target.value)}
                className="w-full bg-background border border-input rounded-md p-2 text-xs min-h-[70px] outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsMaintenanceOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-amber-600 text-white font-bold hover:bg-amber-700">
                Block Machine Dates
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
