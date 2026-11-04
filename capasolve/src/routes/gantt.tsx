import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { GanttTimelineView } from "@/components/GanttTimelineView";
import { QuickOverviewPopover } from "@/components/QuickOverviewPopover";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ZoomIn, Play, RotateCcw, Tv, Minimize2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/gantt")({
  head: () => ({
    meta: [
      { title: "Gantt Timeline Sequencer — CapaSolve" },
      {
        name: "description",
        content: "Finite-capacity machine workstation schedule & shift sequence Gantt timeline.",
      },
    ],
  }),
  component: GanttPage,
});

function GanttPage() {
  const store = useAppStore();
  const [timelineZoom, setTimelineZoom] = useState<"compact" | "normal" | "wide">("normal");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");
  const [selectedMachine, setSelectedMachine] = useState<string>("ALL");

  // Andon Wall Display Mode State
  const [isAndonMode, setIsAndonMode] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [currentTime, setCurrentTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [currentDateStr, setCurrentDateStr] = useState<string>(() =>
    new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  );

  // Andon Live Timer & Auto-Refresh Hook
  useEffect(() => {
    if (!isAndonMode) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString());
      setCurrentDateStr(
        now.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );

      setCountdown((prev) => {
        if (prev <= 1) {
          store.runScheduler();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAndonMode(false);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAndonMode, store]);

  const handleToggleAndon = () => {
    if (!isAndonMode) {
      setIsAndonMode(true);
      setCountdown(60);
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {
        // Fullscreen API may be blocked or unsupported by browser policy
      }
    } else {
      setIsAndonMode(false);
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // Fullscreen API may be blocked or unsupported by browser policy
      }
    }
  };

  const handleRunSolver = async () => {
    try {
      toast.info("Computing finite capacity schedule...");
      await store.runScheduler();
      toast.success("Schedule successfully optimized!");
    } catch {
      toast.error("Failed to solve schedule.");
    }
  };

  return (
    <div
      className={
        isAndonMode
          ? "fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200"
          : "flex-1 flex flex-col min-h-0 bg-background overflow-y-auto"
      }
    >
      {isAndonMode ? (
        /* Andon Kiosk Header Bar */
        <header className="bg-slate-900 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-wider uppercase text-white flex items-center gap-2">
                  <Tv className="h-4 w-4 text-emerald-400" />
                  Shop Floor Andon Display
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Live Broadcast
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {store.machines.length} Active Workstations • {store.slots.length} Scheduled Steps
              </p>
            </div>
          </div>

          {/* Digital Clock Banner */}
          <div className="flex flex-col items-center">
            <div className="text-xl font-mono font-extrabold tracking-widest text-emerald-400">
              {currentTime}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              {currentDateStr}
            </div>
          </div>

          {/* Andon Controls & Auto-refresh countdown */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700/80 px-3 py-1 rounded-lg text-xs">
              <RefreshCw
                className="h-3.5 w-3.5 text-emerald-400 animate-spin"
                style={{ animationDuration: "8s" }}
              />
              <span className="text-[11px] text-slate-400">Auto-refresh:</span>
              <span className="font-mono font-bold text-white text-xs w-6 text-center">
                {countdown}s
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                store.runScheduler();
                setCountdown(60);
                toast.success("Schedule refreshed!");
              }}
              className="h-8 text-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700 cursor-pointer shadow-2xs gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Sync Now
            </Button>

            <Button
              size="sm"
              onClick={handleToggleAndon}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer shadow-2xs gap-1.5"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              Exit Kiosk (Esc)
            </Button>
          </div>
        </header>
      ) : (
        /* Regular Page Header with Actions & Contextual Help at the end */
        <header className="border-b border-border/60 bg-card/40 backdrop-blur-md px-6 py-4 sticky top-0 z-30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Gantt Timeline Sequencer
              </h1>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                Live Horizon
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Finite capacity workstation allocations, shift limits, and setup changeovers.
            </p>
          </div>

          {/* Header Toolbar: Controls + (i) Help cleanly at the end */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Machine Filter */}
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Workstation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Machines</SelectItem>
                {store.machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Granularity */}
            <div className="flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5">
              <Button
                variant={granularity === "day" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setGranularity("day")}
                className="h-7 px-2.5 text-xs"
              >
                Day
              </Button>
              <Button
                variant={granularity === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setGranularity("week")}
                className="h-7 px-2.5 text-xs"
              >
                Week
              </Button>
              <Button
                variant={granularity === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setGranularity("month")}
                className="h-7 px-2.5 text-xs"
              >
                Month
              </Button>
            </div>

            {/* Zoom */}
            <Select
              value={timelineZoom}
              onValueChange={(val: "compact" | "normal" | "wide") => setTimelineZoom(val)}
            >
              <SelectTrigger className="w-[110px] h-8 text-xs bg-background border-border/80">
                <ZoomIn className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Zoom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
              </SelectContent>
            </Select>

            {/* Run Solver Button */}
            <Button
              size="sm"
              onClick={handleRunSolver}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Solve
            </Button>

            {/* Andon Display Mode Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleAndon}
              className="h-8 text-xs border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer shadow-2xs gap-1.5"
              title="Open full-screen Andon display for shop floor TV monitors"
            >
              <Tv className="w-3.5 h-3.5" />
              Andon Kiosk
            </Button>

            {/* Contextual Help System Popover — Positioned strictly at the end */}
            <QuickOverviewPopover />
          </div>
        </header>
      )}

      {/* Main Gantt Canvas */}
      <main className="flex-1 p-3 md:p-6 overflow-x-auto">
        <GanttTimelineView
          timelineZoom={timelineZoom}
          granularity={granularity}
          onGranularityChange={setGranularity}
          selectedMachine={selectedMachine}
        />
      </main>
    </div>
  );
}
