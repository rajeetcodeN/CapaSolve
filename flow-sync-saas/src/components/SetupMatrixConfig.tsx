import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <Card className="border border-border/80 shadow-sm bg-card">
      <CardHeader>
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          Sequence-Dependent Setup Changeover Matrix
        </CardTitle>
        <CardDescription>
          Configure dynamic changeover setup times applied when switching between different material families or tooling configurations.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Add New Rule Form */}
        <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">From Material SKU</Label>
            <Input
              type="text"
              placeholder="e.g. STEE-1001"
              value={fromMat}
              onChange={(e) => setFromMat(e.target.value)}
              className="h-8 text-xs font-mono uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">To Material SKU</Label>
            <Input
              type="text"
              placeholder="e.g. STAI-2002"
              value={toMat}
              onChange={(e) => setToMat(e.target.value)}
              className="h-8 text-xs font-mono uppercase"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Changeover (min)</Label>
            <Input
              type="number"
              min={0}
              value={mins}
              onChange={(e) => setMins(parseInt(e.target.value) || 0)}
              className="h-8 text-xs font-bold"
            />
          </div>

          <div className="flex items-end">
            <Button type="submit" size="sm" className="w-full bg-primary text-primary-foreground font-bold h-8 text-xs gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Transition Rule
            </Button>
          </div>
        </form>

        {/* Existing Rules Table */}
        <div className="border border-border/60 rounded-xl overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs font-bold">From Material</TableHead>
                <TableHead className="text-xs font-bold">To Material</TableHead>
                <TableHead className="text-xs font-bold">Changeover Setup Time</TableHead>
                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-bold text-primary">{r.fromMaterial}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{r.toMaterial}</TableCell>
                  <TableCell className="text-xs font-bold">{r.changeoverMins} minutes</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRule(r.id)}
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
  );
}
