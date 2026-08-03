/**
 * CapaSolve SaaS — Example Factory Datasets & Scenario Presets Modal
 * Allows planners and developers to load diverse pre-built production datasets with 1 click.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import { Factory, Sparkles, Zap, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import { DEFAULT_CSV_CONTENT } from "@/lib/default-csv";

interface ExampleDatasetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExampleDatasetsModal({ open, onOpenChange }: ExampleDatasetsModalProps) {
  const { loadDefaultCSV, runScheduler, parseAndSetCSVData } = useAppStore();
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  const presets = [
    {
      id: "preset-sap-cnc",
      title: "German SAP PP COOIS CNC Milling & Drilling",
      subtitle: "Baseline Industrial Dataset",
      description: "100+ operations across Workstations 603010, 603011, 603012 & 605001. Realistic setup changeovers (60–240 min) and manpower utilization ratios.",
      badge: "DEFAULT SAP",
      badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      icon: Factory,
      action: async () => {
        await loadDefaultCSV();
      },
    },
    {
      id: "preset-auto-stamping",
      title: "Automotive High-Volume Stamping & Machining",
      subtitle: "Peak Bottleneck & 0% Setter Testing",
      description: "High-volume batch runs (1,000–5,000 pcs) with peak load on Group M1. Ideal for testing 0% Setter (Operator Self-Setup) mode and preponement limits.",
      badge: "HIGH VOLUME",
      badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      icon: Zap,
      action: async () => {
        // High-volume automotive dataset
        const autoCsv = `Order,Order Process ID,Material,Machine,Maschine-Group,Process Text,SOP Start Date,Order QTY,Base-Qty each process,Set up Time (Not related to any qty),Unit,Process time (related to qty),Unit,Summe V2/Sum total process time,Manpwer Utilization,Unit,Manpower Utilization in %,SOP Start time
200101,10,AUTO-BRACKET-X,603011,M1,STAMPING & BLANKING,01-06-2026,2500,100,120,MIN,1.5,MIN,157.5,1.0,MIN,50%,08:00:00
200101,20,AUTO-BRACKET-X,603012,M1,CNC DEBURRING & DRILLING,01-06-2026,2500,100,60,MIN,2.0,MIN,110,1.5,MIN,75%,10:30:00
200102,10,AUTO-HOUSING-ALU,605001,M2,HIGH-SPEED MILLING,01-06-2026,1200,50,90,MIN,4.5,MIN,198,2.0,MIN,60%,09:15:00
200102,20,AUTO-HOUSING-ALU,603010,M2,THREAD TAPPING & REAMING,01-06-2026,1200,50,45,MIN,1.8,MIN,88.2,1.0,MIN,50%,13:00:00
200103,10,AUTO-SHAFT-STEEL,603011,M1,TURNING & GRINDING,02-06-2026,3000,100,180,MIN,3.2,MIN,276,2.5,MIN,80%,08:00:00
200104,10,AUTO-VALVE-BODY,605001,M2,5-AXIS CONTOUR MILLING,02-06-2026,800,20,150,MIN,8.0,MIN,470,3.0,MIN,90%,09:00:00
200104,20,AUTO-VALVE-BODY,603012,M1,HONING & QUALITY INSPECTION,02-06-2026,800,20,30,MIN,2.5,MIN,130,1.0,MIN,40%,15:30:00`;
        parseAndSetCSVData(autoCsv);
      },
    },
    {
      id: "preset-aero-tooling",
      title: "Aerospace 5-Axis Precision Batch Production",
      subtitle: "Complex Material BOM & Setup Matrix",
      description: "Titanium and Inconel aerospace components with frequent sequence-dependent setup changeovers, strict SOP due dates, and low tolerances.",
      badge: "AEROSPACE 5-AXIS",
      badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/30",
      icon: Layers,
      action: async () => {
        // Aerospace precision dataset
        const aeroCsv = `Order,Order Process ID,Material,Machine,Maschine-Group,Process Text,SOP Start Date,Order QTY,Base-Qty each process,Set up Time (Not related to any qty),Unit,Process time (related to qty),Unit,Summe V2/Sum total process time,Manpwer Utilization,Unit,Manpower Utilization in %,SOP Start time
300101,10,TITANIUM-RIB-01,605001,M1,ROUGH POCKET MILLING,01-06-2026,45,1,240,MIN,45.0,MIN,2265,3.0,MIN,85%,07:30:00
300101,20,TITANIUM-RIB-01,605001,M1,FINISH CONTOUR & DRILLING,01-06-2026,45,1,180,MIN,30.0,MIN,1530,2.0,MIN,70%,14:00:00
300102,10,INCONEL-FLANGE,603011,M2,HEAVY TURNING & GROOVING,01-06-2026,120,5,150,MIN,18.0,MIN,582,2.5,MIN,90%,08:00:00
300102,20,INCONEL-FLANGE,603010,M2,PRECISION BORE REAMING,01-06-2026,120,5,90,MIN,12.0,MIN,378,1.5,MIN,60%,13:30:00
300103,10,ALU-7075-BRACKET,603012,M1,HIGH-SPEED POCKETING,02-06-2026,350,10,60,MIN,3.5,MIN,182.5,1.0,MIN,50%,09:00:00`;
        parseAndSetCSVData(aeroCsv);
      },
    },
  ];

  const handleSelectPreset = async (p: (typeof presets)[0]) => {
    setLoadingPreset(p.id);
    toast.info(`Loading factory preset dataset: ${p.title}...`);
    try {
      await p.action();
      runScheduler();
      toast.success(`Loaded '${p.title}' successfully! Schedule optimized.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed to load preset: " + e.message);
    } finally {
      setLoadingPreset(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Factory Seed Datasets & Scenario Presets
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose a pre-configured factory production dataset to benchmark solver performance, test 0% setter modes, or demonstrate machine group allocations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {presets.map((p) => {
            const IconComponent = p.icon;
            const isLoading = loadingPreset === p.id;

            return (
              <Card
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className="p-4 border border-border/80 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {p.title}
                        </h4>
                        <Badge className={`text-[10px] px-2 py-0 border ${p.badgeColor}`}>
                          {p.badge}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground">{p.subtitle}</p>
                      <p className="text-[11.5px] text-muted-foreground/90 leading-relaxed pt-0.5">
                        {p.description}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    disabled={isLoading}
                    className="h-8 px-3 text-xs font-bold gap-1 shrink-0 bg-primary/90 text-primary-foreground group-hover:bg-primary"
                  >
                    {isLoading ? (
                      "Loading..."
                    ) : (
                      <>
                        Load <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
