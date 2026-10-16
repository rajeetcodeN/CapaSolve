import React, { useState, useMemo, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppStore } from "@/lib/store";
import { Order, OrderProcess, Machine, HoldReason, ScrapReason } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  CheckCircle2,
  Trash2,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Clock,
  Printer,
  ChevronRight,
  AlertTriangle,
  Radio,
  Sparkles,
} from "lucide-react";
import { HoldReasonModal } from "@/components/modals/HoldReasonModal";
import { LogScrapModal } from "@/components/modals/LogScrapModal";
import { JobTravelerSheet } from "@/components/JobTravelerSheet";
import { toast } from "sonner";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "Operator Kiosk — CapaSolve" },
      { name: "description", content: "Touch-optimized Shop Floor Operator Workstation Kiosk." },
    ],
  }),
  component: OperatorKioskPage,
});

function OperatorKioskPage() {
  const {
    machines,
    processes,
    orders,
    updateStepExecutionStatus,
    logScrap,
    checkMaterialReadiness,
  } = useAppStore();

  const [selectedMachineId, setSelectedMachineId] = useState<string>(machines[0]?.id || "603011");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentShift, setCurrentShift] = useState<string>("Shift 1 (06:00 - 13:00)");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // Modals
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [scrapModalOpen, setScrapModalOpen] = useState(false);
  const [travelerModalOpen, setTravelerModalOpen] = useState(false);

  // Clock & Shift Update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      );
      const hour = now.getHours();
      if (hour >= 6 && hour < 13) {
        setCurrentShift("Shift 1 (06:00 - 13:00)");
      } else if (hour >= 13 && hour < 20) {
        setCurrentShift("Shift 2 (13:00 - 20:00)");
      } else {
        setCurrentShift("Off-Shift Maintenance");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || machines[0];
  }, [machines, selectedMachineId]);

  // Operations for this machine
  const machineProcesses = useMemo(() => {
    return processes
      .filter((p) => p.machineId === selectedMachineId)
      .map((p) => {
        const order = orders.find((o) => o.id === p.orderId || o.orderId === p.orderId);
        return {
          ...p,
          order,
          orderQty: order?.orderQty || 100,
          displayWO: order?.orderId || p.orderId,
          completedQty: p.completedQty || 0,
          scrapQty: p.scrapQty || 0,
        };
      });
  }, [processes, orders, selectedMachineId]);

  // Find the active running or first queued process
  const activeProcess = useMemo(() => {
    const running = machineProcesses.find((p) => p.executionStatus === "IN_PROGRESS");
    if (running) return running;
    const paused = machineProcesses.find((p) => p.executionStatus === "PAUSED");
    if (paused) return paused;
    const released = machineProcesses.find(
      (p) => p.executionStatus === "PLANNED" || p.status === "SCHEDULED",
    );
    if (released) return released;
    return machineProcesses[0] || null;
  }, [machineProcesses]);

  // Next operations in queue (excluding current active)
  const queueProcesses = useMemo(() => {
    if (!activeProcess) return [];
    return machineProcesses
      .filter((p) => p.id !== activeProcess.id && p.executionStatus !== "COMPLETED")
      .slice(0, 5);
  }, [machineProcesses, activeProcess]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  const handleStart = () => {
    if (!activeProcess) return;
    updateStepExecutionStatus(activeProcess.id, "IN_PROGRESS");
    toast.success(`Job Started: Work Order ${activeProcess.displayWO}`);
  };

  const handleHoldConfirm = (reason: HoldReason, notes: string) => {
    if (!activeProcess) return;
    updateStepExecutionStatus(activeProcess.id, "PAUSED", undefined, undefined, notes, reason);
    toast.info(`Job Paused on HOLD: ${reason}`);
  };

  const handleScrapConfirm = (scrapQty: number, reason: ScrapReason, notes: string) => {
    if (!activeProcess) return;
    logScrap(activeProcess.id, scrapQty, reason, notes);
  };

  const handleComplete = () => {
    if (!activeProcess) return;
    updateStepExecutionStatus(activeProcess.id, "COMPLETED", activeProcess.orderQty);
    toast.success(`Job COMPLETED: Work Order ${activeProcess.displayWO}`);
  };

  const handleAddPieces = (delta: number) => {
    if (!activeProcess) return;
    const current = activeProcess.completedQty;
    const next = Math.min(activeProcess.orderQty, current + delta);
    updateStepExecutionStatus(
      activeProcess.id,
      activeProcess.executionStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "IN_PROGRESS",
      next,
    );
    toast.success(`Logged +${delta} completed pieces.`);
  };

  const handlePinUnlock = () => {
    if (pinInput === "1234" || pinInput === "0000") {
      setIsLocked(false);
      setPinModalOpen(false);
      setPinInput("");
      toast.success("Workstation unlocked.");
    } else {
      toast.error("Incorrect Station PIN. Use 1234 for demo.");
    }
  };

  const materialStatus = useMemo(() => {
    if (!activeProcess?.order?.material) return null;
    return checkMaterialReadiness(activeProcess.order.material, activeProcess.orderQty);
  }, [activeProcess, checkMaterialReadiness]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Top Kiosk Industrial Status Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Exit Kiosk</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-extrabold text-sm tracking-wider uppercase flex items-center gap-1.5">
                <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
                CapaSolve Shop Floor Kiosk
              </span>
              <Badge
                variant="outline"
                className="text-[10px] border-emerald-500/30 text-emerald-400 font-mono"
              >
                ONLINE • SYNCED
              </Badge>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">{currentShift}</div>
          </div>
        </div>

        {/* Machine Selector & Clock Controls */}
        <div className="flex items-center gap-4">
          {/* Workstation Selector */}
          <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-xl border border-slate-700">
            <span className="text-xs font-semibold text-slate-400 pl-2">Station:</span>
            <select
              value={selectedMachineId}
              onChange={(e) => setSelectedMachineId(e.target.value)}
              disabled={isLocked}
              className="bg-slate-900 text-white font-mono font-bold text-sm rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
            >
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.machineGroupId})
                </option>
              ))}
            </select>
          </div>

          {/* Clock */}
          <div className="hidden md:flex items-center gap-2 bg-slate-800/70 border border-slate-700/80 px-3.5 py-1.5 rounded-xl">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-base font-bold text-white tracking-widest">
              {currentTime}
            </span>
          </div>

          {/* Station Lock */}
          <button
            onClick={() => {
              if (isLocked) {
                setPinModalOpen(true);
              } else {
                setIsLocked(true);
                toast.info("Workstation locked. PIN required to reconfigure.");
              }
            }}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isLocked
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title={isLocked ? "Unlock Station" : "Lock Station"}
          >
            {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Kiosk Operational Body */}
      <main className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl w-full mx-auto">
        {/* Left Column (8 Cols): Active Running Operation Card */}
        <section className="lg:col-span-8 flex flex-col gap-5">
          {activeProcess ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 flex flex-col justify-between">
              {/* Header Info */}
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase text-slate-400">
                        Current Work Order
                      </span>
                      {activeProcess.executionStatus === "IN_PROGRESS" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                          ● RUNNING
                        </span>
                      )}
                      {activeProcess.executionStatus === "PAUSED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                          ⏸ ON HOLD
                        </span>
                      )}
                      {activeProcess.executionStatus === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/40">
                          ✓ COMPLETED
                        </span>
                      )}
                    </div>
                    <h1 className="text-4xl font-extrabold font-mono text-white tracking-tight mt-1">
                      WO #{activeProcess.displayWO}
                    </h1>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTravelerModalOpen(true)}
                      className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-400" />
                      View Job Traveler
                    </Button>
                    <span className="text-xs text-slate-400 mt-2 font-mono">
                      Step {activeProcess.processId}: {activeProcess.processText || "Machining"}
                    </span>
                  </div>
                </div>

                {/* Part & Material Specification Details */}
                <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                      Part / Material SKU
                    </span>
                    <span className="text-sm font-mono font-bold text-white truncate block">
                      {activeProcess.order?.material || "100-024-830.01-00"}
                    </span>
                    {materialStatus && (
                      <span
                        className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                          materialStatus.readiness === "READY"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : materialStatus.readiness === "LOW_STOCK"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                        }`}
                      >
                        {materialStatus.readiness === "READY"
                          ? "✓ Material Stock In Bin"
                          : `⚠ ${materialStatus.readiness}`}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                      Cycle / Setup Time
                    </span>
                    <span className="text-sm font-bold text-white font-mono">
                      {activeProcess.setupTimeMin}m Setup · {Math.round(activeProcess.sumV2)}m
                      Machining
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Manpower: {(activeProcess.manpowerPct * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                      Target Due Date
                    </span>
                    <span className="text-sm font-bold text-white font-mono">
                      {activeProcess.order?.sopStartDate || "2026-08-01"}
                    </span>
                    <span className="text-[10px] text-amber-400 block mt-1 font-semibold">
                      Priority: {activeProcess.order?.priority || "Normal"}
                    </span>
                  </div>
                </div>

                {/* Big Progress Counter Display */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Production Progress
                      </span>
                      <div className="text-5xl font-extrabold font-mono text-white tracking-tight mt-1">
                        {activeProcess.completedQty}{" "}
                        <span className="text-2xl text-slate-500 font-normal">
                          / {activeProcess.orderQty} pcs
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl font-extrabold font-mono text-emerald-400">
                        {Math.min(
                          100,
                          Math.round((activeProcess.completedQty / activeProcess.orderQty) * 100),
                        )}
                        %
                      </div>
                      {activeProcess.scrapQty > 0 && (
                        <div className="text-xs font-bold text-red-400 font-mono mt-1">
                          Scrap: {activeProcess.scrapQty} pcs
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((activeProcess.completedQty / activeProcess.orderQty) * 100),
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Fast Piece Increment Buttons (+1, +5, +10, +25) */}
                  <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Rapid Counter Logging:
                    </span>
                    <div className="flex items-center gap-2">
                      {[1, 5, 10, 25].map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() => handleAddPieces(delta)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-sm rounded-xl border border-slate-700 active:scale-95 transition-all cursor-pointer shadow-sm"
                        >
                          +{delta}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Huge Shop Floor Execution Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {/* START / RESUME */}
                <button
                  type="button"
                  onClick={handleStart}
                  className="p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-sm flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-white" />
                  <span>START RUN</span>
                </button>

                {/* PAUSE / HOLD */}
                <button
                  type="button"
                  onClick={() => setHoldModalOpen(true)}
                  className="p-4 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-98 text-white font-extrabold text-sm flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Pause className="w-6 h-6" />
                  <span>PAUSE / HOLD</span>
                </button>

                {/* LOG SCRAP */}
                <button
                  type="button"
                  onClick={() => setScrapModalOpen(true)}
                  className="p-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-extrabold text-sm flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Trash2 className="w-6 h-6" />
                  <span>LOG DEFECT</span>
                </button>

                {/* COMPLETE */}
                <button
                  type="button"
                  onClick={handleComplete}
                  className="p-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-extrabold text-sm flex flex-col items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>COMPLETE</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center flex-1">
              <AlertTriangle className="w-12 h-12 text-amber-500 mb-3" />
              <h2 className="text-xl font-bold text-white mb-1">No Active Operations Scheduled</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Workstation {activeMachine?.name} has completed all assigned tasks or no operations
                are currently dispatched to this machine.
              </p>
            </div>
          )}
        </section>

        {/* Right Column (4 Cols): Queue & Shift Next Up */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Next in Queue</span>
                <Badge
                  variant="secondary"
                  className="bg-slate-800 text-slate-300 font-mono text-xs"
                >
                  {queueProcesses.length}
                </Badge>
              </h2>
              <span className="text-[11px] text-slate-500 font-mono">
                Line {activeMachine?.machineGroupId}
              </span>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {queueProcesses.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Queue is clear. No further operations staged for this shift.
                </div>
              ) : (
                queueProcesses.map((proc, idx) => (
                  <div
                    key={proc.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">
                          WO #{proc.displayWO}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          Step {proc.processId}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate max-w-[170px]">
                        {proc.order?.material || "Standard Item"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Qty: {proc.orderQty} · Setup: {proc.setupTimeMin}m · Run:{" "}
                        {Math.round(proc.sumV2)}m
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          proc.order?.priority === "Urgent"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : proc.order?.priority === "High"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {proc.order?.priority || "Normal"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          updateStepExecutionStatus(proc.id, "IN_PROGRESS");
                          toast.success(`Promoted WO #${proc.displayWO} to active.`);
                        }}
                        className="h-7 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-2 gap-1 cursor-pointer"
                      >
                        Promote <ChevronRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Shift Handover Summary */}
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
              <span>Station Assigned:</span>
              <span className="font-bold text-white font-mono">{activeMachine?.name}</span>
            </div>
          </div>
        </section>
      </main>

      {/* PIN Unlock Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-xs w-full shadow-2xl text-center">
            <Lock className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white mb-1">Workstation Locked</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter 4-digit Station Supervisor PIN to unlock (Demo PIN: 1234).
            </p>
            <Input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              className="text-center font-mono text-2xl tracking-widest bg-slate-950 border-slate-800 text-white h-12 mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPinModalOpen(false)}
                className="flex-1 border-slate-800 text-xs text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePinUnlock}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Reason Modal */}
      {activeProcess && (
        <HoldReasonModal
          open={holdModalOpen}
          onOpenChange={setHoldModalOpen}
          orderId={activeProcess.displayWO}
          processId={activeProcess.processId}
          machineId={activeProcess.machineId}
          onConfirm={handleHoldConfirm}
        />
      )}

      {/* Log Scrap Modal */}
      {activeProcess && (
        <LogScrapModal
          open={scrapModalOpen}
          onOpenChange={setScrapModalOpen}
          orderId={activeProcess.displayWO}
          processId={activeProcess.processId}
          machineId={activeProcess.machineId}
          totalOrderQty={activeProcess.orderQty}
          onConfirm={handleScrapConfirm}
        />
      )}

      {/* Job Traveler Sheet */}
      {travelerModalOpen && activeProcess?.order && (
        <JobTravelerSheet
          order={activeProcess.order}
          processes={processes.filter(
            (p) =>
              p.orderId === activeProcess.order?.id || p.orderId === activeProcess.order?.orderId,
          )}
          machines={machines}
          onClose={() => setTravelerModalOpen(false)}
        />
      )}
    </div>
  );
}
