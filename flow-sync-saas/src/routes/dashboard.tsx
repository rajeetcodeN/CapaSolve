import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { toast } from "sonner";
import { 
  Play, 
  ListOrdered, 
  BarChart3, 
  Cloud, 
  CloudUpload, 
  CloudDownload, 
  ShieldAlert, 
  Upload, 
  RotateCcw,
  FileSpreadsheet,
  Download,
  Info,
  Sparkles,
  Layers,
  FileCheck,
  Check
} from "lucide-react";
import { DataCleaningHub } from "@/components/DataCleaningHub";
import { SAMPLE_DATASETS } from "@/lib/sampleCsvDatasets";
import { ExampleDatasetsModal } from "@/components/modals/ExampleDatasetsModal";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MFG Scheduler" },
      { name: "description", content: "Manufacturing scheduling overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [uploadedRawCsvText, setUploadedRawCsvText] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  const { 
    orders, 
    processes, 
    machines, 
    slots, 
    warnings, 
    runScheduler, 
    saveToCloud, 
    loadFromCloud, 
    isCloudSaving, 
    isCloudLoading,
    role,
    plan,
    clearAll,
    loadFromCSVText,
    loadDefaultCSV
  } = useAppStore();
  const { t } = useTranslations();
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  const scheduledCount = processes.filter((p) => p.status === "SCHEDULED").length;

  const processFile = (file: File) => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only users with the Developer or Admin role can upload or change production datasets.");
      return;
    }
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".tsv") && !fileName.endsWith(".txt")) {
      toast.error("Please upload a valid CSV or TSV spreadsheet file.");
      return;
    }

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setUploadedRawCsvText(text);
        toast.success(`File "${file.name}" uploaded successfully! Opening Data Cleaning Assistant...`);
      } catch (err) {
        toast.error("Failed to read CSV file.");
        console.error(err);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const onRun = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Guests have view-only access. Only Developers or Admins can run the scheduler.");
      return;
    }
    runScheduler();
    toast.success(t("common.allCompatible"));
    navigate({ to: "/gantt" });
  };

  const onSaveToCloud = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only Developers or Admins can modify or save schedules to the cloud.");
      return;
    }
    saveToCloud();
  };

  const onLoadFromCloud = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only Developers or Admins can load external cloud data.");
      return;
    }
    loadFromCloud();
  };

  const handleReset = async () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only users with the Developer or Admin role can reset the scheduler to factory seeding.");
      return;
    }
    setImporting(true);
    try {
      await loadDefaultCSV();
      runScheduler();
      toast.success("Default factory seed dataset loaded successfully!");
    } catch (e) {
      toast.error("Failed to load default seed data.");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadBlankTemplate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const blankCsvContent = "Order,Order Process ID,Material,Machine,Maschine-Group,Process Text,SOP Start Date,Order QTY,Base-Qty each process,Set up Time (Not related to any qty),Unit,Process time (related to qty),Unit,Manpower Utilization,Unit,SOP Start time\n100101,10,MAT-PART-01,603011,M1,\"OPERATION DESC SAMPLE\",01-06-2026,100,1,60,MIN,5.0,MIN,1.0,MIN,08:00:00\n100101,20,MAT-PART-01,603012,M2,\"OPERATION STEP 20\",01-06-2026,100,1,30,MIN,2.5,MIN,1.0,MIN,10:30:00\n";
    const blob = new Blob([blankCsvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "capasolve_empty_production_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded blank production CSV template!");
  };

  const handleLoadSample = (sampleContent: string, sampleName: string) => {
    setUploadedRawCsvText(sampleContent);
    toast.success(`Loaded sample dataset: ${sampleName}`);
  };

  const handleClearAll = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only users with the Developer or Admin role can clear the scheduler data.");
      return;
    }
    clearAll();
    setUploadedRawCsvText("");
    toast.info("Active dataset cleared.");
  };

  // If a file is uploaded, show the Data Cleaning and Mapping editor Hub right here on the dashboard
  if (uploadedRawCsvText) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between border-b pb-4 border-border/60">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Data Cleaning Wizard</h1>
            <p className="text-xs text-muted-foreground">Confirm column mappings and resolve file anomalies before loading.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setUploadedRawCsvText("")} className="cursor-pointer">
            Cancel
          </Button>
        </div>
        <DataCleaningHub 
          initialCsvText={uploadedRawCsvText}
          onSaved={() => {
            setUploadedRawCsvText("");
            runScheduler();
          }}
          onCancel={() => setUploadedRawCsvText("")}
        />
      </div>
    );
  }

  // If there are no orders loaded, show the primary Import dropzone as the main dashboard screen
  if (orders.length === 0) {
    return (
      <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300 pb-12">
        {/* Role-based Information Banner */}
        {role === "GUEST" && (
          <div className="flex items-center gap-3 bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 p-4 rounded-lg shadow-sm">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Guest Mode Active:</span> You have view-only rights. Use the role switcher in the header to change roles and inspect different permissions.
            </div>
          </div>
        )}

        <div className="text-center space-y-2 py-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Configure your manufacturing timeline by uploading a production orders spreadsheet, downloading our blank template, or exploring pre-filled industry sample datasets.
          </p>
        </div>

        {/* Primary Upload Dropzone */}
        <Card 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed transition-all p-10 text-center rounded-2xl bg-card/50 backdrop-blur-sm shadow-xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer ${
            isDragOver 
              ? "border-primary bg-primary/10 scale-[1.01] shadow-2xl ring-2 ring-primary/40 text-primary" 
              : "border-border/80 hover:border-primary/50 hover:bg-card/80"
          }`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
          
          <div className={`p-4 rounded-full mb-4 transition-all duration-300 ${
            isDragOver ? "bg-primary text-primary-foreground scale-110 animate-bounce" : "bg-primary/10 text-primary group-hover:scale-110"
          }`}>
            <Upload className="h-9 w-9" />
          </div>
          
          <h3 className="text-lg font-bold text-foreground">
            {isDragOver ? "Drop your CSV file here to upload" : "Upload Production Orders"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mt-1 mb-6 leading-relaxed">
            Drag and drop or select your scheduling CSV spreadsheet containing columns for Order code, Material details, Process ID steps, Quantities, and target SOP Dates.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="flex flex-wrap justify-center items-center gap-3 relative z-10" onClick={(e) => e.stopPropagation()}>
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 shadow-md cursor-pointer text-xs gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Select CSV File
            </Button>
            <Button
              onClick={() => setIsExampleModalOpen(true)}
              variant="outline"
              size="lg"
              className="border-primary/40 text-primary hover:bg-primary/10 font-bold px-5 shadow-sm cursor-pointer text-xs gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              Load Factory Example Datasets
            </Button>
            <Button
              onClick={handleDownloadBlankTemplate}
              variant="ghost"
              size="lg"
              className="text-muted-foreground hover:text-foreground text-xs gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download Blank Template (.csv)
            </Button>
          </div>
        </Card>

        {/* Informational Cards Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Card 1: Expected CSV Format & Column Schema */}
          <Card className="border border-border/80 shadow-sm bg-card flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <FileCheck className="h-4 w-4 text-emerald-500" />
                Expected Production CSV Format & Schema
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                Our smart CSV parser automatically recognizes English, German, and custom ERP header names. Make sure your file includes these columns:
              </p>
              <div className="space-y-2">
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">Order ID <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">Order, WorkOrder, Auftrag, JobID</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">Step / Process ID <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">Order Process ID, Step No, Vorgang</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">Material / SKU <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">Material, Product Code, SKU, PartNo</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">Machine / Line <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">Machine, Assembly Line, Workstation</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">SOP Start Date <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">SOP Start Date, ScheduledDate, Startdatum</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">Order Quantity <span className="text-red-500 text-[9px] font-mono ml-1">REQUIRED</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">Order QTY, Quantity, Menge, BatchQty</span>
                </div>
                <div className="p-2 bg-muted/40 rounded-lg border border-border/50 flex justify-between items-center text-[11px]">
                  <span className="font-bold text-foreground">Setup & Process Times <span className="text-muted-foreground text-[9px] font-mono ml-1">OPTIONAL</span></span>
                  <span className="font-mono text-muted-foreground text-[10px]">Set up Time, Process time, RunMins</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Supported Manufacturing Scenarios */}
          <Card className="border border-border/80 shadow-sm bg-card flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Layers className="h-4 w-4 text-indigo-500" />
                Supported Manufacturing Resource Types
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-[9px] bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded">JOB SHOP</span>
                  Precision CNC & Machining Workshops
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sequence multi-operation parts (Milling, Drilling, Grinding) across machine groups (M1, M2) while respecting setup times and operator capacity.
                </p>
              </div>

              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-[9px] bg-emerald-500/10 text-emerald-500 px-1 py-0.5 rounded">ASSEMBLY</span>
                  Assembly Lines & Sequential Workstations
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Manage assembly lines (Line Alpha, Line Beta) with station section codes, line setup, and crew headcount constraints.
                </p>
              </div>

              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 space-y-1">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="font-mono text-[9px] bg-purple-500/10 text-purple-500 px-1 py-0.5 rounded">HIGH VOLUME</span>
                  Injection Molding & Electronics SMT
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Optimize multi-cavity mold changeovers, SMT placement rates, reflow oven zones, and automated optical inspection routines.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* One-Click Pre-Filled Sample Industry Datasets Grid */}
        <Card className="border border-border/80 shadow-sm bg-card">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Pre-Filled Industry Sample Datasets
              </CardTitle>
              <p className="text-xs text-muted-foreground">Click any dataset to instantly load 30 rows of realistic factory data into the Gantt & Capacity solver.</p>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {SAMPLE_DATASETS.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => handleLoadSample(sample.content, sample.name)}
                  className="group p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">{sample.icon}</span>
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{sample.name}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{sample.description}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-muted-foreground">{sample.industry}</span>
                    <span className="text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Load Data &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Role-based Information Banner */}
      {role === "GUEST" && (
        <div className="flex items-center gap-3 bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 p-4 rounded-lg shadow-sm">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-bold">Guest Mode Active:</span> You have view-only rights. Use the role switcher in the header to change roles and inspect different permissions.
          </div>
        </div>
      )}

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {role !== "DEVELOPER" && role !== "ADMIN" && (
            <span className="text-xs text-muted-foreground mr-2 border border-border px-2.5 py-1 rounded bg-muted/50">
              Developer/Admin role required to modify
            </span>
          )}
          <Button 
            variant="outline"
            size="lg"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="cursor-pointer font-semibold text-xs h-10 px-4 gap-1.5"
          >
            <Upload className="h-4 w-4" /> Upload CSV
          </Button>
          <Button 
            variant="outline"
            size="lg"
            onClick={handleClearAll}
            disabled={importing}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer font-semibold text-xs h-10 px-4"
          >
            Clear Active Data
          </Button>
          <Button onClick={onRun} size="lg" className={`gap-2 cursor-pointer font-semibold text-xs h-10 px-5 ${role !== "DEVELOPER" && role !== "ADMIN" ? "opacity-70" : ""}`}>
            <Play className="h-4 w-4" /> {t("dashboard.generate")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("dashboard.orders")} value={orders.length} icon={<ListOrdered className="h-5 w-5 text-blue-500" />} />
        <Stat label={t("dashboard.processes")} value={processes.length} icon={<Play className="h-5 w-5 text-indigo-500" />} />
        <Stat label={t("dashboard.machines")} value={machines.length} icon={<BarChart3 className="h-5 w-5 text-purple-500" />} />
        <Stat
          label={t("dashboard.scheduledProcesses")}
          value={scheduledCount}
          icon={<ShieldAlert className="h-5 w-5 text-emerald-500" />}
          hint={slots.length > 0 ? `${warnings.length} ${t("dashboard.activeWarnings")}` : t("dashboard.notGenerated")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListOrdered className="h-4 w-4 text-primary" /> {t("dashboard.ordersCardTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex flex-col justify-between flex-grow">
            <span>
              {t("dashboard.ordersCardDesc")}
            </span>
            <div className="mt-4 flex gap-2">
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <Link to="/orders">{t("dashboard.ordersCardButton")}</Link>
              </Button>
              <Button 
                onClick={() => fileRef.current?.click()} 
                disabled={importing}
                variant="outline" 
                size="sm" 
                className="cursor-pointer gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Upload CSV
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" /> {t("dashboard.ganttCardTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex flex-col justify-between flex-grow">
            <span>
              {t("dashboard.ganttCardDesc")}
            </span>
            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="cursor-pointer">
                <Link to="/gantt">{t("dashboard.ganttCardButton")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm flex flex-col justify-between hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4 text-sky-500" /> Cloud Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground flex flex-col justify-between flex-grow">
            <span className="block mb-4">
              Backup and synchronize your active orders, process steps, manual overrides, and planner settings directly to Supabase storage.
            </span>
            <div className="flex gap-2">
              <Button 
                onClick={onSaveToCloud} 
                disabled={isCloudSaving || isCloudLoading} 
                size="sm" 
                className="gap-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CloudUpload className="h-3.5 w-3.5" />
                {isCloudSaving ? t("common.savingToCloud") : t("common.saveToCloud")}
              </Button>
              <Button 
                onClick={onLoadFromCloud} 
                disabled={isCloudSaving || isCloudLoading} 
                variant="outline" 
                size="sm" 
                className="gap-1 cursor-pointer"
              >
                <CloudDownload className="h-3.5 w-3.5" />
                {isCloudLoading ? t("common.loadingFromCloud") : t("common.loadFromCloud")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Example Datasets Modal */}
      <ExampleDatasetsModal open={isExampleModalOpen} onOpenChange={setIsExampleModalOpen} />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="border border-border/80 shadow-sm hover:border-primary/40 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
          {icon && <div className="p-2 rounded-lg bg-muted/60">{icon}</div>}
        </div>
        <div className="mt-2 text-3xl font-extrabold font-mono tracking-tight">{value}</div>
        {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

