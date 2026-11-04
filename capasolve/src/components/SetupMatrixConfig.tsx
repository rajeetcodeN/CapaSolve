import React, { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  ShieldAlert,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { SetupMatrixRule } from "@/lib/types";
import Papa from "papaparse";

export function SetupMatrixConfig() {
  const {
    setupMatrixRules,
    addSetupMatrixRule,
    deleteSetupMatrixRule,
    importSetupMatrixRules,
    exportSetupMatrixRulesCSV,
    role,
  } = useAppStore();

  const [fromMat, setFromMat] = useState<string>("");
  const [toMat, setToMat] = useState<string>("");
  const [machineGroupId, setMachineGroupId] = useState<string>("");
  const [mins, setMins] = useState<number>(30);
  const [desc, setDesc] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = role === "ADMIN" || role === "DEVELOPER";

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error("Access Denied: Only Admins or Developers can modify the setup matrix.");
      return;
    }
    if (!fromMat.trim() || !toMat.trim()) {
      toast.error("Please enter both From and To material SKU patterns.");
      return;
    }

    addSetupMatrixRule({
      fromMaterial: fromMat.trim().toUpperCase(),
      toMaterial: toMat.trim().toUpperCase(),
      machineGroupId: machineGroupId.trim() || undefined,
      setupTimeMin: mins,
      description: desc.trim() || undefined,
    });

    setFromMat("");
    setToMat("");
    setMachineGroupId("");
    setMins(30);
    setDesc("");
    toast.success("Sequence changeover setup rule added to scheduler engine.");
  };

  const handleDeleteRule = (id: string) => {
    if (!canEdit) {
      toast.error("Access Denied: Only Admins or Developers can delete rules.");
      return;
    }
    deleteSetupMatrixRule(id);
    toast.info("Setup matrix rule deleted.");
  };

  const handleExportCSV = () => {
    const csvContent = exportSetupMatrixRulesCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `capasolve_setup_matrix_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Setup matrix rules exported to CSV.");
  };

  const handleDownloadTemplate = () => {
    const template =
      "fromMaterial,toMaterial,machineGroupId,setupTimeMin,description\n" +
      '"*","*",,15,"Default baseline changeover"\n' +
      '"100-024-830.01-00","100-024-830.02-00","M1",45,"Heavy die tooling swap"\n' +
      '"RAW-STEE-01","RAW-ALUM-02",,60,"Material cleanout and coolant purge"\n';
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "setup_matrix_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info("Sample CSV template downloaded.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) {
      toast.error("Access Denied: Only Admins or Developers can import rules.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const parsedRules: SetupMatrixRule[] = (results.data as any[])
            .filter((row) => row.fromMaterial && row.toMaterial)
            .map((row, idx) => ({
              id: `imported-${Date.now()}-${idx}`,
              fromMaterial: String(row.fromMaterial).trim(),
              toMaterial: String(row.toMaterial).trim(),
              machineGroupId: row.machineGroupId ? String(row.machineGroupId).trim() : undefined,
              setupTimeMin: Math.max(0, parseInt(row.setupTimeMin) || 15),
              description: row.description ? String(row.description).trim() : undefined,
            }));

          if (parsedRules.length === 0) {
            toast.error(
              "No valid rules found in CSV. Check headers: fromMaterial, toMaterial, setupTimeMin.",
            );
            return;
          }

          importSetupMatrixRules(parsedRules);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (err: any) {
          toast.error(`Error parsing setup matrix CSV: ${err?.message || "Invalid file"}`);
        }
      },
      error: (err) => {
        toast.error(`Failed to read CSV: ${err.message}`);
      },
    });
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-2xl">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
            Sequence-Dependent Setup Changeover Matrix
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 mt-1">
            Configure dynamic setup penalties (R-time) applied when transitioning between material
            families or machine tooling setups. Applied automatically during finite-capacity
            scheduling.
          </CardDescription>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-800"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
            Template
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8 text-xs gap-1.5 border-slate-200 dark:border-slate-800"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV ({setupMatrixRules.length})
          </Button>

          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </Button>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {!canEdit && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-medium">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              Role Notice: You are in <strong>{role}</strong> mode. Editing or importing setup
              matrix rules requires Developer or Admin permissions.
            </span>
          </div>
        )}

        {/* Add New Rule Form */}
        {canEdit && (
          <form
            onSubmit={handleAddRule}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                From Material SKU *
              </Label>
              <Input
                type="text"
                placeholder="e.g. STEE-1001 or *"
                value={fromMat}
                onChange={(e) => setFromMat(e.target.value)}
                className="h-8 text-xs font-mono uppercase bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                To Material SKU *
              </Label>
              <Input
                type="text"
                placeholder="e.g. STAI-2002 or *"
                value={toMat}
                onChange={(e) => setToMat(e.target.value)}
                className="h-8 text-xs font-mono uppercase bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Machine Group (Opt.)
              </Label>
              <Input
                type="text"
                placeholder="e.g. M1"
                value={machineGroupId}
                onChange={(e) => setMachineGroupId(e.target.value)}
                className="h-8 text-xs font-mono uppercase bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Setup Penalty (min)
              </Label>
              <Input
                type="number"
                min={0}
                value={mins}
                onChange={(e) => setMins(parseInt(e.target.value) || 0)}
                className="h-8 text-xs font-medium bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                size="sm"
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-medium h-8 text-xs gap-1 shadow-xs border border-emerald-600/60 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            </div>
          </form>
        )}

        {/* Existing Rules Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-850">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  From Material
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  To Material
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Machine Group
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Dynamic Setup Time
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Description / Note
                </TableHead>
                {canEdit && (
                  <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-right">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {setupMatrixRules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 6 : 5}
                    className="h-24 text-center text-xs text-muted-foreground"
                  >
                    No transition rules configured. The solver will use standard baseline setup
                    times from order operations.
                  </TableCell>
                </TableRow>
              ) : (
                setupMatrixRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {r.fromMaterial}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {r.toMaterial}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {r.machineGroupId ? (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {r.machineGroupId}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">All groups</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {r.setupTimeMin} minutes
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {r.description || "--"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRule(r.id)}
                          className="h-7 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
