import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  GitBranch, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ArrowRight,
  Zap,
  BarChart2
} from "lucide-react";
import { toast } from "sonner";
import { analyzeScheduleWithAI, AIAnalysisResult } from "@/lib/ai-service";

interface ScenarioBranch {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  makespanDays: number;
  totalSetupHours: number;
  utilizationPct: number;
  otdPct: number;
  active: boolean;
}

const defaultScenarios: ScenarioBranch[] = [
  {
    id: "baseline",
    name: "Master Live Schedule (Baseline)",
    description: "Current active production master plan.",
    createdAt: "2026-08-03 08:00",
    makespanDays: 14,
    totalSetupHours: 18.5,
    utilizationPct: 84,
    otdPct: 96,
    active: true,
  },
  {
    id: "scen-1",
    name: "Rush Order #99401 Insertion",
    description: "Simulate inserting 500 unit emergency rush order on CNC Workcenter 603011.",
    createdAt: "2026-08-03 10:15",
    makespanDays: 15,
    totalSetupHours: 21.0,
    utilizationPct: 91,
    otdPct: 92,
    active: false,
  },
  {
    id: "scen-2",
    name: "Machine 605001 Preventative Maintenance",
    description: "Simulate 8-hour unplanned downtime block on Workstation 605001.",
    createdAt: "2026-08-03 11:30",
    makespanDays: 14.5,
    totalSetupHours: 19.0,
    utilizationPct: 86,
    otdPct: 95,
    active: false,
  },
];

export const Route = createFileRoute("/sandbox")({
  component: SandboxPage,
});

function SandboxPage() {
  const { orders, processes, slots, globalSetterCapacity, runScheduler } = useAppStore();
  const [scenarios, setScenarios] = useState<ScenarioBranch[]>(defaultScenarios);
  const [newScenName, setNewScenName] = useState("");
  const [newScenDesc, setNewScenDesc] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);

  const handleRunAiAnalysis = async () => {
    setIsAiAnalyzing(true);
    toast.info("Gemini AI Co-Pilot analyzing schedule bottlenecks...");
    try {
      const res = await analyzeScheduleWithAI(orders, processes, slots, globalSetterCapacity);
      setAiResult(res);
      toast.success("AI Schedule Analysis Complete!");
    } catch (err: any) {
      toast.error("AI Analysis failed: " + err.message);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenName.trim()) return toast.error("Scenario name is required.");

    const newBranch: ScenarioBranch = {
      id: `scen-${Date.now()}`,
      name: newScenName.trim(),
      description: newScenDesc.trim() || "Isolated scenario sandbox branch.",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      makespanDays: 14 + Math.floor(Math.random() * 3),
      totalSetupHours: 18 + Math.floor(Math.random() * 5),
      utilizationPct: 80 + Math.floor(Math.random() * 15),
      otdPct: 90 + Math.floor(Math.random() * 8),
      active: false,
    };

    setScenarios([...scenarios, newBranch]);
    setNewScenName("");
    setNewScenDesc("");
    toast.success(`Created scenario sandbox branch: ${newBranch.name}`);
  };

  const handlePromoteToMaster = (scen: ScenarioBranch) => {
    setScenarios(
      scenarios.map((s) => ({
        ...s,
        active: s.id === scen.id,
      }))
    );
    runScheduler();
    toast.success(`Promoted '${scen.name}' to Master Live Schedule!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GitBranch className="h-7 w-7 text-primary" />
            AI "What-If" Scenario Simulation Sandbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate rush orders, machine breakdowns, or shift changes in isolated sandbox branches before promoting to live production.
          </p>
        </div>

        <Button
          onClick={handleRunAiAnalysis}
          disabled={isAiAnalyzing}
          className="bg-primary text-primary-foreground font-bold text-xs gap-2 shadow-md cursor-pointer"
        >
          <Sparkles className={`h-4 w-4 ${isAiAnalyzing ? "animate-spin" : ""}`} />
          {isAiAnalyzing ? "Analyzing with AI..." : "Run AI Co-Pilot Scenario Solver"}
        </Button>
      </div>

      {/* AI Co-Pilot Recommendation Card */}
      {aiResult && (
        <Card className="border border-primary/40 bg-primary/5 shadow-md animate-in fade-in duration-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                Gemini AI Co-Pilot Schedule Insights
              </CardTitle>
              <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                Score: {aiResult.utilizationScore}% Util / {aiResult.otdScore}% OTD
              </Badge>
            </div>
            <CardDescription className="text-foreground text-xs font-medium mt-1">
              {aiResult.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1 text-xs">
            <div className="space-y-1">
              <span className="font-bold text-muted-foreground">Observed Bottlenecks:</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {aiResult.bottlenecks.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 pt-2 border-t border-primary/20">
              <span className="font-bold text-foreground">Recommended Actions:</span>
              {aiResult.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start justify-between gap-3 bg-background/80 p-2.5 rounded-xl border border-primary/20">
                  <div>
                    <span className="font-bold text-foreground text-xs">{rec.title}</span>
                    <p className="text-muted-foreground text-[11px] mt-0.5">{rec.description}</p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                    {rec.impact} Impact
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Branch Card */}
      <Card className="border border-border/80 shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Create Isolated Scenario Branch
          </CardTitle>
          <CardDescription>
            Branch from active master schedule to evaluate trade-offs without altering live production dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateBranch} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Scenario Branch Name *</Label>
              <Input
                type="text"
                placeholder="e.g. Rush Order #99500 Branch"
                value={newScenName}
                onChange={(e) => setNewScenName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Simulation Target / Description</Label>
              <Input
                type="text"
                placeholder="e.g. Test adding weekend shift on SMT Line"
                value={newScenDesc}
                onChange={(e) => setNewScenDesc(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full bg-primary text-primary-foreground font-bold h-9 text-xs gap-1.5">
                <GitBranch className="h-4 w-4" />
                Branch Scenario
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Scenario Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scenarios.map((scen) => (
          <Card key={scen.id} className={`border shadow-sm flex flex-col justify-between ${scen.active ? "border-primary/60 bg-primary/5" : "border-border/80 bg-card"}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge className={scen.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
                  {scen.active ? "LIVE MASTER" : "SANDBOX BRANCH"}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">{scen.createdAt}</span>
              </div>
              <CardTitle className="text-base font-bold text-foreground mt-2">{scen.name}</CardTitle>
              <CardDescription className="text-xs line-clamp-2">{scen.description}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Key KPI Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-bold">TOTAL MAKESPAN</span>
                  <span className="font-extrabold text-foreground text-sm flex items-center gap-1 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {scen.makespanDays} Days
                  </span>
                </div>

                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-bold">SETUP HOURS</span>
                  <span className="font-extrabold text-foreground text-sm flex items-center gap-1 mt-0.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    {scen.totalSetupHours} hrs
                  </span>
                </div>

                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-bold">UTILIZATION %</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1 mt-0.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {scen.utilizationPct}%
                  </span>
                </div>

                <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-bold">ON-TIME DELIVERY</span>
                  <span className="font-extrabold text-primary text-sm flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    {scen.otdPct}%
                  </span>
                </div>
              </div>

              {!scen.active ? (
                <Button
                  onClick={() => handlePromoteToMaster(scen)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2"
                >
                  <ArrowRight className="h-4 w-4" />
                  Promote to Master Schedule
                </Button>
              ) : (
                <div className="p-2 text-center bg-primary/10 text-primary font-bold text-xs rounded-xl border border-primary/20">
                  Active Master Production Plan
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
