import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Factory, Upload, Play, BarChart3, CheckCircle2, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export function OnboardingTour() {
  const { tourCompleted, setTourCompleted, loadDefaultCSV, runScheduler } = useAppStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!tourCompleted) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tourCompleted]);

  const steps = [
    {
      title: "Welcome to CapaSolve SaaS!",
      description: "CapaSolve is an advanced manufacturing scheduling engine designed to eliminate workstation bottlenecks and maximize factory OEE.",
      icon: <Factory className="h-10 w-10 text-primary" />,
    },
    {
      title: "1. Upload Production Datasets",
      description: "Import process CSV spreadsheets containing Order IDs, Materials, Base Quantities, Setup Times (R), and Machining Times (M). AI automatically cleans and maps your columns.",
      icon: <Upload className="h-10 w-10 text-blue-500" />,
    },
    {
      title: "2. Constraint-Based Optimization",
      description: "Our solver respects shift availability, setup technician ceilings, machine group rules, and SOP start dates to generate realistic timelines.",
      icon: <Play className="h-10 w-10 text-emerald-500" />,
    },
    {
      title: "3. Live Interactive Gantt & Analytics",
      description: "Drag-and-drop process blocks across machines, inspect live collisions, and track OEE metrics in real time.",
      icon: <BarChart3 className="h-10 w-10 text-indigo-500" />,
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setOpen(false);
      setTourCompleted(true);
    }
  };

  const handleQuickSeed = async () => {
    setOpen(false);
    setTourCompleted(true);
    await loadDefaultCSV();
    runScheduler();
    navigate({ to: "/gantt" });
  };

  const current = steps[step];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md border border-border/80 p-6 shadow-2xl">
        <DialogHeader className="text-center space-y-3 pt-2">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-2xl">
              {current.icon}
            </div>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 py-4">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            size="sm"
            onClick={handleNext}
            className="text-xs font-bold cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95"
          >
            {step === steps.length - 1 ? "Get Started" : "Next"} <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
