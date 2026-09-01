import { useState } from "react";
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
import { SlidersHorizontal, Plus, Trash2, Shield, Check } from "lucide-react";
import { toast } from "sonner";

export interface SetupMatrixRule {
  id: string;
  fromMaterial: string;
  toMaterial: string;
  changeoverMins: number;
}

const initialRules: SetupMatrixRule[] = [
  { id: "sm-1", fromMaterial: "STEE-1001", toMaterial: "STAI-2002", changeoverMins: 45 },
  { id: "sm-2", fromMaterial: "STAI-2002", toMaterial: "ALUM-3003", changeoverMins: 30 },
  { id: "sm-3", fromMaterial: "ALUM-3003", toMaterial: "STEE-1001", changeoverMins: 60 },
];

export function SetupMatrixConfig() {
  const [rules, setRules] = useState<SetupMatrixRule[]>(initialRules);
  const [fromMat, setFromMat] = useState<string>("");
  const [toMat, setToMat] = useState<string>("");
  const [mins, setMins] = useState<number>(30);

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromMat.trim() || !toMat.trim()) {
      toast.error("Please enter both From and To material SKU codes.");
      return;
    }

    const newRule: SetupMatrixRule = {
      id: `sm-${Date.now()}`,
      fromMaterial: fromMat.trim().toUpperCase(),
      toMaterial: toMat.trim().toUpperCase(),
      changeoverMins: mins,
    };

    setRules([...rules, newRule]);
    setFromMat("");
    setToMat("");
    setMins(30);
    toast.success("Sequence changeover setup rule added.");
  };

  const handleDeleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
    toast.info("Rule deleted.");
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 shadow-2xs bg-white dark:bg-slate-900 rounded-2xl">
      <CardHeader>
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          Sequence-Dependent Setup Changeover Matrix
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Configure dynamic changeover setup times applied when switching between different material
          families or tooling configurations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Add New Rule Form */}
        <form
          onSubmit={handleAddRule}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800"
        >
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              From Material SKU
            </Label>
            <Input
              type="text"
              placeholder="e.g. STEE-1001"
              value={fromMat}
              onChange={(e) => setFromMat(e.target.value)}
              className="h-8 text-xs font-mono uppercase bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              To Material SKU
            </Label>
            <Input
              type="text"
              placeholder="e.g. STAI-2002"
              value={toMat}
              onChange={(e) => setToMat(e.target.value)}
              className="h-8 text-xs font-mono uppercase bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Changeover (min)
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
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium h-8 text-xs gap-1 shadow-xs border border-slate-700/60"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Transition Rule
            </Button>
          </div>
        </form>

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
                  Changeover Setup Time
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                    {r.fromMaterial}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                    {r.toMaterial}
                  </TableCell>
                  <TableCell className="text-xs font-normal text-slate-700 dark:text-slate-300">
                    {r.changeoverMins} minutes
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRule(r.id)}
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
  );
}
