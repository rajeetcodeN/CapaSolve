import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "@/lib/translations";
import {
  Play,
  BarChart3,
  Layers,
  Clock,
  ShieldCheck,
  ArrowRight,
  Cpu,
  Factory,
  Database,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CapaSolve — Modern Manufacturing Scheduling SaaS" },
      {
        name: "description",
        content:
          "Optimize workstation timelines, reduce setup bottlenecks, and maximize OEE with AI-powered constraint scheduling.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t, language } = useTranslations();

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hash === "#features" || window.location.href.includes("features"))
    ) {
      const el = document.getElementById("features");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth" });
        }, 150);
      }
    }
  }, []);

  // Interactive ROI Calculator State
  const [machines, setMachines] = useState(12);
  const [operators, setOperators] = useState(8);

  // Calculations
  const weeklyHoursSaved = Math.round(machines * 2.2 + operators * 1.8);
  const annualSavings = Math.round(weeklyHoursSaved * 52 * 50); // $50/hr average labor/machine overhead
  const oeeImprovement = (5 + machines * 0.15 + operators * 0.1).toFixed(1);

  // Copy dictionary
  const copy = {
    en: {
      heroTag: "REVOLUTIONIZE FACTORY PLANNING",
      heroTitle: "Optimize Manufacturing Schedules. Maximize Workstation OEE.",
      heroSubtitle:
        "Constraint-based resource planning designed for modern factories. Reduce setup bottlenecks, allocate technicians, and sync timelines in real-time.",
      startFree: "Start Free Trial",
      viewDemo: "Open Interactive Demo",
      metricOEE: "Average OEE Improvement",
      metricHours: "Planning Hours Saved / Wk",
      metricROI: "Average ROI Payback",
      featuresTitle: "Engineered for High-Mix, Low-Volume Production",
      featuresSubtitle:
        "CapaSolve automates the complex constraints of machine capacity, setup technician loading, and order sequences.",
      featGantt: "Visual Gantt Scheduler",
      featGanttDesc:
        "Drag-and-drop process blocks across machines. Live collision alerts prevent double-booking.",
      featOEE: "Performance & OEE Analytics",
      featOEEDesc:
        "Track setup vs machining times. Identify workstation bottlenecks before they stall production.",
      featCap: "Daily Capacity Planner",
      featCapDesc: "Set hourly limits on operator availability. Automatically load-balance shifts.",
      featCloud: "Supabase Cloud Sync",
      featCloudDesc:
        "Safeguard scheduling states. Save, load, and share production plans across workstations.",
      featAccess: "Role-Based Access Control",
      featAccessDesc:
        "Segregate accounts. Developers modify plans, admins manage billing/team, and guests view read-only charts.",
      featExcel: "Instant CSV/Excel Processing",
      featExcelDesc:
        "Directly import standard process sheets. Confirmed formulas compute durations instantly.",
      roiTitle: "Calculate Your ROI with CapaSolve",
      roiSubtitle:
        "Input your factory size to estimate potential time savings and annual financial impact.",
      roiMachines: "Number of Active Machines",
      roiOperators: "Number of Operators per Shift",
      roiSavedHours: "Weekly Planning Hours Saved",
      roiSavedMoney: "Estimated Annual Savings",
      roiOEE: "Projected OEE Increase",
      roiDisclaimer:
        "Estimates are based on average customer metrics: $50/hour internal overhead rate and 30% planning efficiency gains.",
      ctaTitle: "Ready to eliminate scheduling bottlenecks?",
      ctaSubtitle:
        "Create a free trial account, select your role (Admin or Developer), and begin optimizing your timelines in under 5 minutes.",
    },
  };

  const str = copy.en;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6 border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
        {/* Subtle background glow elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-[1400px] grid md:grid-cols-2 gap-12 items-center relative z-10">
          {/* Hero Content */}
          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20 animate-pulse-subtle">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {str.heroTag}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-foreground">
              Optimize Manufacturing Schedules.{" "}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-500 bg-clip-text text-transparent">
                Maximize OEE.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              {str.heroSubtitle}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button
                asChild
                size="lg"
                className="cursor-pointer font-bold shadow-lg shadow-primary/25 bg-primary text-primary-foreground hover:bg-primary/95 transition-all hover:scale-[1.02]"
              >
                <Link to="/signup">
                  {str.startFree} <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="cursor-pointer font-bold border-border/80 hover:bg-accent"
              >
                <Link to="/dashboard">{str.viewDemo}</Link>
              </Button>
            </div>

            {/* Micro Trust Indicators */}
            <div className="pt-6 border-t border-border/40 flex flex-wrap gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>No Credit Card Required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>30-Day Free Trial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Instant Setup</span>
              </div>
            </div>
          </div>

          {/* Glassmorphic Live Interactive Dashboard Mockup */}
          <div className="relative flex justify-center">
            <div className="w-full max-w-xl border border-border/80 rounded-2xl bg-card/80 backdrop-blur-md shadow-2xl p-5 space-y-4 text-left relative overflow-hidden group hover:border-primary/50 transition-all duration-500">
              <div className="absolute -right-16 -top-16 w-40 h-40 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-colors" />

              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <span className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="text-[10px] text-muted-foreground font-mono bg-muted px-2.5 py-0.5 rounded border border-border/40 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  capasolve-app://production-gantt
                </div>
              </div>

              {/* Gantt Timeline Simulation Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground border-b border-border/30 pb-1 font-semibold">
                  <span>Workstations</span>
                  <div className="flex gap-6 font-mono">
                    <span>Shift 1 (06:00 - 13:00)</span>
                    <span>Shift 2 (13:00 - 20:00)</span>
                  </div>
                </div>

                {/* Machine Row 1 */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-foreground w-14 font-mono">603012</span>
                  <div className="flex-grow grid grid-cols-6 gap-1 h-7">
                    <div className="col-span-2 bg-amber-500/15 border border-amber-500/40 rounded flex items-center justify-center text-[9px] text-amber-700 dark:text-amber-300 font-semibold shadow-2xs">
                      Setup Rüst (R)
                    </div>
                    <div className="col-span-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded flex items-center justify-center text-[9px] text-slate-800 dark:text-slate-200 font-semibold shadow-2xs">
                      Milling (M)
                    </div>
                    <div className="col-span-1 border border-dashed border-border/80 rounded" />
                  </div>
                </div>

                {/* Machine Row 2 */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-foreground w-14 font-mono">605001</span>
                  <div className="flex-grow grid grid-cols-6 gap-1 h-7">
                    <div className="col-span-1 border border-dashed border-border/80 rounded" />
                    <div className="col-span-2 bg-amber-500/15 border border-amber-500/40 rounded flex items-center justify-center text-[9px] text-amber-700 dark:text-amber-300 font-semibold shadow-2xs">
                      Setup Rüst (R)
                    </div>
                    <div className="col-span-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded flex items-center justify-center text-[9px] text-slate-800 dark:text-slate-200 font-semibold shadow-2xs">
                      Assembly (M)
                    </div>
                  </div>
                </div>

                {/* Machine Row 3 */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-foreground w-14 font-mono">603010</span>
                  <div className="flex-grow grid grid-cols-6 gap-1 h-7">
                    <div className="col-span-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded flex items-center justify-center text-[9px] text-slate-800 dark:text-slate-200 font-semibold shadow-2xs">
                      Drilling (M)
                    </div>
                    <div className="col-span-2 bg-amber-500/15 border border-amber-500/40 rounded flex items-center justify-center text-[9px] text-amber-700 dark:text-amber-300 font-semibold shadow-2xs">
                      Setup Rüst (R)
                    </div>
                    <div className="col-span-1 border border-dashed border-border/80 rounded" />
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center justify-between text-[11px] bg-muted/60 p-2.5 rounded-lg border border-border/40 mt-4">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Optimal Capacity Load Balanced
                </span>
                <span className="text-muted-foreground font-mono font-bold">OEE Target: 88.4%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Metrics Banner */}
      <section className="py-12 px-6 border-b border-border/40 bg-muted/30">
        <div className="mx-auto max-w-[1400px] grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="space-y-1">
            <div className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight font-mono">
              +{oeeImprovement}%
            </div>
            <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              {str.metricOEE}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight font-mono">
              {weeklyHoursSaved} hrs
            </div>
            <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              {str.metricHours}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl md:text-5xl font-extrabold text-primary tracking-tight font-mono">
              &lt; 3 Months
            </div>
            <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
              {str.metricROI}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-24 px-6 border-b border-border/40">
        <div className="mx-auto max-w-[1400px] text-center space-y-16">
          <div className="space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              {str.featuresTitle}
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
              {str.featuresSubtitle}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
              title={str.featGantt}
              description={str.featGanttDesc}
            />
            <FeatureCard
              icon={<Layers className="h-5 w-5 text-indigo-500" />}
              title={str.featOEE}
              description={str.featOEEDesc}
            />
            <FeatureCard
              icon={<Clock className="h-5 w-5 text-emerald-500" />}
              title={str.featCap}
              description={str.featCapDesc}
            />
            <FeatureCard
              icon={<Database className="h-5 w-5 text-sky-500" />}
              title={str.featCloud}
              description={str.featCloudDesc}
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5 text-amber-500" />}
              title={str.featAccess}
              description={str.featAccessDesc}
            />
            <FeatureCard
              icon={<Play className="h-5 w-5 text-purple-500" />}
              title={str.featExcel}
              description={str.featExcelDesc}
            />
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section className="py-24 px-6 border-b border-border/40 bg-muted/20">
        <div className="mx-auto max-w-[1100px] text-center space-y-12">
          <div className="space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
              {str.roiTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{str.roiSubtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center bg-card border border-border/80 p-8 rounded-2xl shadow-xl text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />

            {/* Input Controls */}
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {str.roiMachines}
                  </label>
                  <span className="text-sm font-extrabold text-primary font-mono">
                    {machines} Machines
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="50"
                  value={machines}
                  onChange={(e) => setMachines(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {str.roiOperators}
                  </label>
                  <span className="text-sm font-extrabold text-primary font-mono">
                    {operators} Operators
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={operators}
                  onChange={(e) => setOperators(parseInt(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <p className="text-[10px] text-muted-foreground italic leading-relaxed pt-4 border-t border-border/40">
                * {str.roiDisclaimer}
              </p>
            </div>

            {/* Calculations Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/40 p-6 rounded-xl border border-border/60">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  {str.roiSavedHours}
                </span>
                <div className="text-2xl font-extrabold text-foreground font-mono">
                  ~{weeklyHoursSaved} hrs / wk
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  {str.roiOEE}
                </span>
                <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  +{oeeImprovement}%
                </div>
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-1 pt-4 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  {str.roiSavedMoney}
                </span>
                <div className="text-3xl font-extrabold text-primary tracking-tight font-mono">
                  {language === "de"
                    ? `~${annualSavings.toLocaleString()} €`
                    : `~$${annualSavings.toLocaleString()}`}{" "}
                  / yr
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Conversion Banner */}
      <section className="py-24 px-6 bg-primary text-primary-foreground text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15)_0%,transparent_70%)]" />

        <div className="mx-auto max-w-3xl space-y-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{str.ctaTitle}</h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            {str.ctaSubtitle}
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="cursor-pointer font-bold shadow-lg bg-background text-foreground hover:bg-background/90"
            >
              <Link to="/signup">{str.startFree}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="cursor-pointer font-bold border-primary-foreground/40 bg-transparent hover:bg-white/10 hover:text-white text-primary-foreground"
            >
              <Link to="/dashboard">{str.viewDemo}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border border-border/60 hover:border-primary/50 hover:-translate-y-1 transition-all duration-300 shadow-sm hover:shadow-lg bg-card/60 backdrop-blur-sm group">
      <CardContent className="pt-6 space-y-3">
        <div className="p-3 bg-muted rounded-xl w-fit group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          {icon}
        </div>
        <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
