import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Play,
  CheckCircle2,
  Layers,
  CalendarClock,
  Activity,
  BarChart3,
  GitBranch,
  Wrench,
  Clock,
  BookOpen,
  ArrowRight,
  Sparkles,
  Sliders,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation — CapaSolve" },
      {
        name: "description",
        content:
          "Comprehensive engineering documentation for CapaSolve constraint-based manufacturing scheduling, priority dispatching, and shop-floor execution.",
      },
    ],
  }),
  component: DocumentationPage,
});

function DocumentationPage() {
  const sections = [
    { id: "orders", title: "1. Work Orders & Priority Tiers", icon: Layers },
    { id: "solver", title: "2. Constraint Optimization Engine", icon: CalendarClock },
    { id: "gantt", title: "3. Interactive Gantt Timeline", icon: Activity },
    { id: "status", title: "4. Shop-Floor Execution & Dispatch", icon: CheckCircle2 },
    { id: "sandbox", title: "5. AI 'What-If' Scenario Sandbox", icon: GitBranch },
    { id: "capacity", title: "6. Capacity & Bottleneck Analytics", icon: BarChart3 },
    { id: "machines", title: "7. Workstations, Groups & Shifts", icon: Wrench },
  ];

  return (
    <div className="flex-1 py-10 px-4 sm:px-8 max-w-6xl mx-auto space-y-8 text-left">
      {/* Page Header */}
      <div className="border-b border-border/60 pb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs font-mono gap-1 text-primary border-primary/30"
          >
            <BookOpen className="h-3 w-3" /> System Documentation
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">v0.1 Beta</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          CapaSolve Manufacturing Scheduling Documentation
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Technical specifications, constraint formulas, priority dispatch logic, and shop-floor
          operation guides for the CapaSolve scheduling platform.
        </p>
      </div>

      {/* Quick Jump Navigation */}
      <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Quick Jump by Process:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="text-xs px-2.5 py-1 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
            >
              <sec.icon className="h-3 w-3 text-primary shrink-0" />
              <span>{sec.title}</span>
            </a>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Work Orders & Priority */}
        <section id="orders" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-blue-500" />
                1. Work Orders, CSV Schemas & Priority Tiers
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                Production jobs are imported via CSV or manually created in the workspace. Each
                record corresponds to a discreet manufacturing operation step belonging to a parent
                Work Order.
              </p>

              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-sm">
                  4-Tier Order Priority Weighting
                </h4>
                <p>
                  The scheduling engine applies deterministic priority weighting during operation
                  placement before evaluating target SOP dates:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
                    <div className="font-bold text-rose-700 dark:text-rose-300">
                      Urgent (Weight 1)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Highest allocation priority. Preempts standard lines; schedules at earliest
                      possible machine slot.
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-orange-200 dark:border-orange-900/60 bg-orange-50/50 dark:bg-orange-950/20">
                    <div className="font-bold text-orange-700 dark:text-orange-300">
                      High (Weight 2)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      High customer commitment orders. Scheduled ahead of medium priority batch
                      production.
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="font-bold text-amber-700 dark:text-amber-300">
                      Medium (Weight 3 - Default)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Standard factory production orders sequenced by customer SOP target completion
                      date.
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="font-bold text-slate-700 dark:text-slate-300">
                      Low (Weight 4)
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Buffer filler jobs or safety stock production scheduled into otherwise idle
                      machine intervals.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-foreground text-sm">Required CSV Column Fields</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-muted/60 border-b border-border text-foreground font-semibold">
                      <tr>
                        <th className="p-2.5">Field Name</th>
                        <th className="p-2.5">Aliases Detected</th>
                        <th className="p-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">Order ID</td>
                        <td className="p-2.5">order, orderid, wo, auftrag</td>
                        <td className="p-2.5 font-sans">
                          Unique sales or manufacturing order identifier.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">Process / Step ID</td>
                        <td className="p-2.5">processid, step, op, vorgang</td>
                        <td className="p-2.5 font-sans">
                          Operation step sequence (e.g. 10, 20, 30). Predecessor constraints follow
                          this numerical sequence.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">Machine / Line</td>
                        <td className="p-2.5">machine, workstation, ressource, linie</td>
                        <td className="p-2.5 font-sans">
                          Target workstation code. Must match a registered machine or machine group.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">Setup Time (R)</td>
                        <td className="p-2.5">setup, rustzeit, setuptime</td>
                        <td className="p-2.5 font-sans">
                          Fixed tooling and changeover duration (in minutes), independent of part
                          quantity.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">Machining Time (M)</td>
                        <td className="p-2.5">process, bearbeitung, runtime</td>
                        <td className="p-2.5 font-sans">
                          Total active machining cycle duration (in minutes) for the designated
                          batch quantity.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-foreground">Priority (Optional)</td>
                        <td className="p-2.5">priority, prio, priorität</td>
                        <td className="p-2.5 font-sans">
                          Urgent, High, Med, or Low dispatch level. Defaults to Med if omitted.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 2: Constraint Optimization Engine */}
        <section id="solver" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-emerald-500" />
                2. Constraint Optimization & Solver Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                The CapaSolve deterministic solver builds realistic timelines without manual
                spreadsheet calculations. It evaluates four core mathematical constraints
                simultaneously:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
                  <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Precedence & Predecessor Routing
                  </div>
                  <p>
                    Operation Step 20 cannot start on Machine B until Step 10 has completed on
                    Machine A. Pre-prep buffer intervals ensure parts have physically transferred
                    between lines.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
                  <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Technician & Setup Ceilings
                  </div>
                  <p>
                    If the factory has 2 setup technicians, no more than 2 machines may undergo
                    concurrent tooling changeovers. Excess changeovers are deferred until a
                    technician is liberated.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
                  <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Operating Shift Calendars
                  </div>
                  <p>
                    Work is scheduled exclusively during operational shift windows. Operations
                    automatically pause across lunch breaks, night shutdowns, and weekend
                    non-working windows.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1.5">
                  <div className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Machine Group Balancing
                  </div>
                  <p>
                    When an order targets a machine group instead of a static machine ID, the solver
                    automatically loads the unit with the earliest availability and shortest setup
                    penalty.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 3: Interactive Gantt Timeline */}
        <section id="gantt" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                3. Interactive Gantt Timeline & Collision Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                The Gantt timeline provides an interactive digital twin of the factory floor.
                Machine rows represent individual workstations, while horizontal blocks represent
                operation durations.
              </p>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-sm">Key Timeline Features</h4>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Drag-and-Drop Adjustment:</strong> Shift operation blocks along the
                    timeline. The engine verifies machine compatibility and flags dependency
                    violations in real time.
                  </li>
                  <li>
                    <strong>Collision Warnings:</strong> Visual warning badges alert planners when
                    operations overlap on the same line or exceed shift availability.
                  </li>
                  <li>
                    <strong>Resolution Controls:</strong> Toggle between Compact (high density),
                    Normal, and Wide zoom views to analyze hourly or multi-week spans.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Shop Floor Status */}
        <section id="status" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                4. Shop-Floor Execution & Dispatch Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                The Shop Floor view translates the optimized schedule into live dispatch lists for
                machine operators and plant supervisors.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                  <span className="font-bold text-foreground">Execution States</span>
                  <p>
                    Jobs transition between <strong>Planned</strong> (released to line),{" "}
                    <strong>In Progress</strong> (machine actively cutting),{" "}
                    <strong>Completed</strong> (parts inspected), and <strong>Delayed</strong>{" "}
                    (awaiting material or tooling).
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                  <span className="font-bold text-foreground">Real-Time Progress Logging</span>
                  <p>
                    Operators click "Log Progress" to record finished parts, scrap counts, and
                    actual elapsed cycle time. This recalculates downstream start dates immediately.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 5: AI What-If Scenario Sandbox */}
        <section id="sandbox" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-emerald-500" />
                5. AI "What-If" Scenario Simulation Sandbox
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                The Sandbox empowers production managers to stress-test their factory against
                disruptions without affecting active shop-floor execution.
              </p>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-sm">Disruption Case Types</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                  <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="font-bold text-foreground block">Machine Group Delay</span>
                    <span className="text-[11px]">
                      Simulates a conveyor or line halt. Reveals buffer exhaustion and downstream
                      machine starving.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="font-bold text-foreground block">Machine Breakdown</span>
                    <span className="text-[11px]">
                      Simulates unplanned spindle outage for X hours. Recommends alternate machine
                      group diverts.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-border bg-muted/20">
                    <span className="font-bold text-foreground block">Resource Shortage</span>
                    <span className="text-[11px]">
                      Simulates technician deficit (e.g. 50%). Measures machine idling during
                      changeovers.
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200">
                <strong>Safety Guarantee:</strong> All simulation runs execute on isolated What-If
                branches. Active customer schedules are never modified unless an Admin explicitly
                clicks "Promote to Live Plan".
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 6: Capacity & Bottlenecks */}
        <section id="capacity" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                6. Capacity & Bottleneck Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <p>
                Capacity analysis isolates the root causes of production backlog by dissecting total
                hours into active machining, changeover setup, and idling.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="font-bold text-foreground block">Utilization %</span>
                  <span className="text-[11px]">
                    Operating hours divided by total available shift capacity across workstations.
                    Target: &ge; 85%.
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="font-bold text-foreground block">On-Time Delivery (OTD)</span>
                  <span className="text-[11px]">
                    Percentage of work orders scheduled to complete on or prior to customer SOP due
                    dates. Target: &ge; 95%.
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <span className="font-bold text-foreground block">Bottleneck Workstations</span>
                  <span className="text-[11px]">
                    Lines running at 100% capacity while accumulating upstream buffer queues.
                    Primary target for overtime.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Section 7: Workstations & Shifts */}
        <section id="machines" className="scroll-mt-20">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                7. Workstations, Groups & Operating Shifts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                Configure machine groups, speed derating factors, and plant calendar rotations.
                Machines assigned to the same group inherit interchangeable process routing,
                allowing the solver to dynamically balance line loadings.
              </p>
              <div className="flex gap-2 pt-2">
                <Link
                  to="/machines"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Configure Workstations <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  to="/shifts"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border hover:bg-muted text-foreground transition-colors"
                >
                  Manage Operating Shifts <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
