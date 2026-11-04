import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Info,
  HelpCircle,
  Layers,
  CalendarClock,
  Activity,
  BarChart3,
  Wrench,
  Clock,
  TrendingUp,
  SlidersHorizontal,
  ArrowRight,
  Sparkles,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useLocation, useNavigate, Link } from "@tanstack/react-router";

interface ContextGuide {
  badge: string;
  title: string;
  summary: string;
  docAnchor?: string;
  points: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }[];
  proTip?: string;
  quickLink?: {
    label: string;
    to: string;
  };
}

const CONTEXT_GUIDES: Record<string, ContextGuide> = {
  "/orders": {
    badge: "Orders & Routing",
    title: "Orders & Process Sequence Guide",
    summary:
      "Manage work orders, configure routing operation steps, and control dispatch priority weights.",
    docAnchor: "orders",
    points: [
      {
        icon: Layers,
        title: "Order Priority Tiers",
        description:
          "Assign Urgent, High, Medium, or Low. Higher priority orders reserve machines ahead of standard jobs.",
      },
      {
        icon: SlidersHorizontal,
        title: "CSV Auto-Detection",
        description:
          "Intelligent column parser detects Order IDs, quantities, setup times (R), and cycle times (M) from ERP/Excel files.",
      },
      {
        icon: CalendarClock,
        title: "Sequence Rollup",
        description:
          "Operations with matching Order IDs are sequenced together to preserve multi-step manufacturing dependencies.",
      },
    ],
    proTip:
      "Click the Priority pill in any row to modify dispatch weight and trigger instant schedule recalculation.",
    quickLink: {
      label: "View Gantt Timeline",
      to: "/gantt",
    },
  },
  "/gantt": {
    badge: "Schedule Timeline",
    title: "Gantt Timeline & Sequencer Guide",
    summary:
      "Constraint-based timeline showing scheduled process blocks across all factory workstations.",
    docAnchor: "gantt",
    points: [
      {
        icon: CalendarClock,
        title: "Multi-Constraint Scheduling",
        description:
          "Operations are placed respecting setup headcount ceilings, shift hours, and predecessor step dependencies.",
      },
      {
        icon: Activity,
        title: "Interactive Drag-and-Drop",
        description:
          "Re-sequence jobs across compatible machines. Real-time collision alerts flag capacity overloads immediately.",
      },
      {
        icon: BarChart3,
        title: "Timeline Zoom & Grouping",
        description:
          "Filter by machine group or zoom between compact and wide views to inspect shift boundaries.",
      },
    ],
    proTip:
      "Double-click any scheduled operation block to inspect cycle time, setup ratio, and predecessor links.",
    quickLink: {
      label: "Open Shop Floor Status",
      to: "/status",
    },
  },
  "/status": {
    badge: "Shop-Floor Dispatch",
    title: "Shop-Floor Execution Guide",
    summary: "Real-time tracking of planned, active, and completed operations across workstations.",
    docAnchor: "status",
    points: [
      {
        icon: Activity,
        title: "Live Execution Status",
        description:
          "Track operations through Planned, In Progress, Completed, or Delayed states with instant badge toggles.",
      },
      {
        icon: Clock,
        title: "Progress Logging",
        description:
          "Log completed quantities, scrap counts, and remaining run times directly from the shop floor.",
      },
      {
        icon: Layers,
        title: "Inline Priority Overrides",
        description:
          "Fast-track urgent work orders on the fly with clickable priority dropdowns in the dispatch table.",
      },
    ],
    proTip:
      "Click any status badge in the dispatch list to update progress or mark an operation completed.",
    quickLink: {
      label: "Inspect Capacity Analytics",
      to: "/capacity",
    },
  },
  "/capacity": {
    badge: "Capacity Analytics",
    title: "Machine Capacity & Workload Guide",
    summary:
      "Analyze workstation utilization rates, setup vs. run hours, and factory bottleneck constraints.",
    docAnchor: "capacity",
    points: [
      {
        icon: BarChart3,
        title: "Run vs. Setup Load",
        description:
          "Distinguishes between active machining hours and changeover durations to highlight tooling bottlenecks.",
      },
      {
        icon: TrendingUp,
        title: "Bottleneck Identification",
        description:
          "Pinpoints over-subscribed workstations that limit throughput and cause schedule delays.",
      },
      {
        icon: CalendarClock,
        title: "Shift Capacity Modeling",
        description:
          "Evaluates whether adding second shifts or setup technicians relieves machine queue depth.",
      },
    ],
    proTip:
      "Export capacity tables to CSV or PDF for executive production meetings and capacity planning.",
    quickLink: {
      label: "Configure Machine Groups",
      to: "/machines",
    },
  },
  "/machines": {
    badge: "Factory Resources",
    title: "Workstations & Groups Guide",
    summary:
      "Configure machine groups, setup technician pools, and equipment operating constraints.",
    docAnchor: "machines",
    points: [
      {
        icon: Wrench,
        title: "Machine Groups",
        description:
          "Group interchangeable workstations (e.g. 3-Axis Mills, Lathes) so orders dynamically route to any free machine.",
      },
      {
        icon: Activity,
        title: "Setup Headcount Ceilings",
        description:
          "Limit maximum concurrent tool changeovers across lines to prevent unassisted changeover stalls.",
      },
      {
        icon: SlidersHorizontal,
        title: "Efficiency Factors",
        description:
          "Apply machine speed derating and planned maintenance windows to maintain accurate delivery projections.",
      },
    ],
    proTip: "Machines in the same group share operation routing rules automatically.",
    quickLink: {
      label: "Define Operating Shifts",
      to: "/shifts",
    },
  },
  "/shifts": {
    badge: "Plant Calendars",
    title: "Operating Shifts & Calendars Guide",
    summary:
      "Define operating hours, multi-shift patterns, and planned factory non-working intervals.",
    docAnchor: "machines",
    points: [
      {
        icon: Clock,
        title: "Shift Patterns",
        description:
          "Configure 1-shift, 2-shift, or 24/7 schedules with start times, end times, and meal breaks.",
      },
      {
        icon: CalendarClock,
        title: "Downtime Calendars",
        description:
          "Mark holidays and planned maintenance windows so operations pause without triggering false delays.",
      },
    ],
    proTip: "Changing shift hours immediately updates available capacity across the timeline.",
    quickLink: {
      label: "Review Schedule Timeline",
      to: "/gantt",
    },
  },
  "/monthly": {
    badge: "Monthly Planning",
    title: "Monthly Fulfillment Planning Guide",
    summary:
      "Aggregate long-range order demand against machine group availability over multi-month horizons.",
    docAnchor: "capacity",
    points: [
      {
        icon: TrendingUp,
        title: "Demand vs. Capacity",
        description: "Compare incoming order hours with planned factory capacity month-by-month.",
      },
      {
        icon: CalendarClock,
        title: "Delivery Risk Scoring",
        description:
          "Identify work orders with high risk of exceeding customer SOP target delivery dates.",
      },
    ],
    proTip:
      "Filter by specific order priorities to inspect critical customer commitments in upcoming quarters.",
  },
  "/sandbox": {
    badge: "What-If Simulator",
    title: "Scenario Sandbox Guide",
    summary:
      "Simulate emergency rush orders, equipment outages, and overtime shifts without touching live production data.",
    docAnchor: "sandbox",
    points: [
      {
        icon: Sparkles,
        title: "Rush Order Insertion",
        description:
          "Insert high-priority orders to observe the displacement impact on lower-priority production jobs.",
      },
      {
        icon: Wrench,
        title: "Outage Testing",
        description:
          "Simulate an unexpected machine breakdown to evaluate alternative machine group routing.",
      },
    ],
    proTip: "Sandbox changes remain isolated until you explicitly promote them to the live plan.",
  },
  default: {
    badge: "System Overview",
    title: "CapaSolve System Overview",
    summary: "Constraint-based manufacturing scheduling and shop-floor sequencing engine.",
    docAnchor: "orders",
    points: [
      {
        icon: Layers,
        title: "1. Import & Prioritize Orders",
        description:
          "Load factory CSV spreadsheets with setup (R) and cycle (M) times. Set order priority (Urgent, High, Medium, Low).",
      },
      {
        icon: CalendarClock,
        title: "2. Constraint Optimization",
        description:
          "Automated engine sequences operations respecting shift calendars, technician headcount, and machine routing.",
      },
      {
        icon: Activity,
        title: "3. Gantt & Shop-Floor Execution",
        description:
          "Interactive drag-and-drop timeline with real-time collision detection and operator progress logging.",
      },
    ],
    proTip: "Use the left navigation or top search (⌘K) to jump between Orders, Gantt, and Status.",
    quickLink: {
      label: "Go to Orders & CSV Import",
      to: "/orders",
    },
  },
};

export function QuickOverviewPopover({
  className,
  align = "end",
  side = "bottom",
  showLabel = false,
  contextPath,
}: {
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  showLabel?: boolean;
  contextPath?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const { setTourOpen } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = contextPath || location.pathname;
  const guide = CONTEXT_GUIDES[currentPath] || CONTEXT_GUIDES.default;

  const handleStartTour = () => {
    setOpen(false);
    setTourOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer focus:outline-hidden ${className || ""}`}
          title={`${guide.title} (i)`}
          aria-label={guide.title}
        >
          <Info className="h-4 w-4 shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-white" />
          {showLabel && (
            <span className="text-[8.5px] font-semibold text-slate-500 mt-0.5 tracking-tight uppercase">
              Help
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        collisionPadding={16}
        className="w-88 max-h-[82vh] overflow-y-auto p-4 shadow-2xl border border-border bg-card text-card-foreground rounded-2xl z-50"
      >
        {/* Header with Context Badge */}
        <div className="pb-2.5 border-b border-border/60 space-y-1">
          <div className="flex items-center justify-between">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 font-mono">
              {guide.badge}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Context Help</span>
          </div>
          <div className="font-bold text-sm text-foreground flex items-center gap-1.5 pt-0.5">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <span>{guide.title}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">{guide.summary}</p>
        </div>

        {/* Context-Specific Feature Points */}
        <div className="py-3 space-y-2">
          {guide.points.map((point, idx) => {
            const Icon = point.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-xl bg-muted/30 border border-border/50"
              >
                <div className="h-5 w-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground">{point.title}</span>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {point.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pro Tip Box */}
        {guide.proTip && (
          <div className="mb-3 p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2 text-[11px] text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong className="text-foreground font-semibold">Tip: </strong>
              {guide.proTip}
            </span>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
          <Button
            size="sm"
            onClick={handleStartTour}
            className="w-full text-xs h-8 font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 justify-center"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Start Product Tour
          </Button>

          <div className="flex items-center justify-between text-[11px] pt-1 px-0.5">
            <Link
              to="/documentation"
              hash={guide.docAnchor}
              onClick={() => setOpen(false)}
              className="text-primary hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <BookOpen className="h-3 w-3" />
              <span>Process Documentation</span>
            </Link>

            {guide.quickLink && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate({ to: guide.quickLink!.to as any });
                }}
                className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer transition-colors"
              >
                <span>{guide.quickLink.label}</span>
                <ArrowRight className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
