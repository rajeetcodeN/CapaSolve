import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Upload,
  Play,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Layers,
  CalendarClock,
  Activity,
  X,
  ImageIcon,
} from "lucide-react";

export function OnboardingTour() {
  const { tourOpen, setTourOpen, tourCompleted, setTourCompleted } = useAppStore();

  const [step, setStep] = useState(0);

  // Auto-open on initial load if tour has not been completed yet
  useEffect(() => {
    if (!tourCompleted && !tourOpen) {
      const timer = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted, tourOpen, setTourOpen]);

  // Reset step to 0 whenever tour is opened
  useEffect(() => {
    if (tourOpen) {
      setStep(0);
    }
  }, [tourOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!tourOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        if (step < steps.length - 1) setStep((s) => s + 1);
      } else if (e.key === "ArrowLeft") {
        if (step > 0) setStep((s) => s - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tourOpen, step]);

  const handleClose = () => {
    setTourOpen(false);
    setTourCompleted(true);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const steps = [
    {
      id: "welcome",
      stepNumber: "Welcome",
      title: "Welcome to CapaSolve SaaS!",
      description:
        "CapaSolve is an advanced manufacturing scheduling engine designed to eliminate workstation bottlenecks and maximize factory OEE.",
      icon: <Factory className="h-10 w-10 text-primary" />,
      screenshotPlaceholderTitle: "CapaSolve Manufacturing Hub",
      features: [
        "Automated multi-constraint capacity scheduling",
        "4-tier order priority dispatch (Urgent, High, Medium, Low)",
        "Live interactive Gantt sequencer with instant collision alerts",
      ],
    },
    {
      id: "upload",
      stepNumber: "Step 1 of 3",
      title: "1. Upload Production Datasets",
      description:
        "Import process CSV spreadsheets containing Order IDs, Materials, Base Quantities, Setup Times (R), and Machining Times (M). AI automatically cleans and maps your columns.",
      icon: <Upload className="h-10 w-10 text-blue-500" />,
      screenshotPlaceholderTitle: "Orders & CSV Import View",
      features: [
        "Auto-detects column headers from SAP, ERP, or Excel sheets",
        "Assign priority tiers to critical customer work orders",
        "Automatic operation rollup grouped by Order ID",
      ],
    },
    {
      id: "solver",
      stepNumber: "Step 2 of 3",
      title: "2. Constraint-Based Optimization",
      description:
        "Our solver respects shift availability, setup technician ceilings, machine group rules, and SOP start dates to generate realistic timelines.",
      icon: <Play className="h-10 w-10 text-emerald-500" />,
      screenshotPlaceholderTitle: "Constraint Solver Engine",
      features: [
        "Restricts simultaneous setups to available technician capacity",
        "Validates machine compatibility and shift calendars",
        "Sequences operations to meet target SOP completion dates",
      ],
    },
    {
      id: "gantt",
      stepNumber: "Step 3 of 3",
      title: "3. Live Interactive Gantt & Analytics",
      description:
        "Drag-and-drop process blocks across machines, inspect live collisions, and track OEE metrics in real time.",
      icon: <BarChart3 className="h-10 w-10 text-indigo-500" />,
      screenshotPlaceholderTitle: "Interactive Gantt Timeline & Metrics",
      features: [
        "Drag-and-drop operations with instant conflict detection",
        "Track job execution status (Planned, In Progress, Completed, Delayed)",
        "Real-time machine utilization and bottleneck analytics",
      ],
    },
  ];

  const current = steps[step];

  return (
    <Dialog open={tourOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md border border-border/80 p-6 shadow-2xl rounded-2xl bg-card">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-1 pr-8">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
            {current.stepNumber}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Skip
          </button>
        </div>

        {/* Step Icon & Title Header */}
        <DialogHeader className="text-center space-y-2 pt-1">
          <div className="flex justify-center">
            <div className="p-3.5 bg-primary/10 rounded-2xl">{current.icon}</div>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {/* Feature Points */}
        <div className="space-y-2 py-1">
          {current.features.map((feat, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs text-foreground bg-muted/30 border border-border/50 px-2.5 py-1.5 rounded-lg"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="leading-snug">{feat}</span>
            </div>
          ))}
        </div>

        {/* Screenshot Placeholder Container (Ready for screenshots) */}
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
          <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
            <span className="text-[11px] font-semibold text-foreground">
              {current.screenshotPlaceholderTitle}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Preview screenshot will be displayed here
            </span>
          </div>
        </div>

        {/* Step dots (Clickable) */}
        <div className="flex justify-center items-center gap-1.5 pt-2">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStep(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === step
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
              }`}
              title={`Go to step ${idx + 1}`}
              aria-label={`Step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="text-xs h-8 font-medium gap-1 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          ) : (
            <div />
          )}

          <Button
            size="sm"
            onClick={handleNext}
            className="text-xs h-8 font-bold cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 gap-1 ml-auto"
          >
            {step === steps.length - 1 ? "Get Started" : "Next"}
            {step === steps.length - 1 ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
