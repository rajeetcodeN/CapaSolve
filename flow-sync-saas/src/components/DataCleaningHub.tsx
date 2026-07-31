import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import { 
  Upload, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Trash2, 
  Play, 
  ChevronRight, 
  FileSpreadsheet, 
  Check, 
  X, 
  Terminal, 
  Undo,
  FileCheck,
  Zap,
  Map as MapIcon,
  BarChart2,
  TrendingUp,
  Settings,
  Layers,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppStore } from "@/lib/store";
import { useTranslations } from "@/lib/translations";
import { 
  detectCSVFormat, 
  validateCSVData, 
  cleanCSVData, 
  generateAISuggestions, 
  runCustomPromptCleaning,
  detectColumnMapping,
  parseAndNormalizeDate,
  ValidationIssue,
  AISuggestion,
  ColumnMapping
} from "@/lib/dataCleaner";
import { SAMPLE_DATASETS, EXPECTED_COLUMNS_SPEC, SampleDataset } from "@/lib/sampleCsvDatasets";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell
} from "recharts";

export function DataCleaningHub({ 
  initialCsvText, 
  onSaved, 
  onCancel 
}: { 
  initialCsvText: string; 
  onSaved: () => void; 
  onCancel: () => void; 
}) {
  const navigate = useNavigate();
  const { t } = useTranslations();
  const { loadFromCSVText, role } = useAppStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State variables
  const [csvRawText, setCsvRawText] = useState<string>(initialCsvText);
  const [delimiterInfo, setDelimiterInfo] = useState<{ delimiter: string; name: string }>({ delimiter: ",", name: "Comma" });
  const [isDragOver, setIsDragOver] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [healthScore, setHealthScore] = useState(100);
  
  // Column mapping states
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    order: "Order",
    material: "Material",
    processId: "Order Process ID",
    qty: "Order QTY",
    sopStartDate: "SOP Start Date",
    machine: "Machine",
    setupTime: "Set up Time (Not related to any qty)",
    processTime: "Process time (related to qty)",
    baseQty: "Base-Qty each process",
    manpower: "Manpower Utilization"
  });
  const [resourceType, setResourceType] = useState<string>("Assembly Line"); // Assembly Line, Production Line, Machine Group, Workstation
  
  // Page level view tab
  const [mainPageTab, setMainPageTab] = useState<string>("workspace");

  // Active row arrays
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [cleanedRows, setCleanedRows] = useState<any[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<Array<{ rowIdx: number; column: string; action: string; previous: string; current: string }>>([]);
  
  // AI State
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [customAiPrompt, setCustomAiPrompt] = useState<string>("");
  const [aiTerminalLogs, setAiTerminalLogs] = useState<string[]>([]);
  const [aiIsThinking, setAiIsThinking] = useState(false);
  
  // Cleaning Rules checkboxes
  const [cleaningOptions, setCleaningOptions] = useState({
    trimWhitespace: true,
    normalizeDates: true,
    fixNegatives: true,
    fillDefaults: true,
    normalizeDelimiters: true
  });

  const [activeViewTab, setActiveViewTab] = useState<string>("issues");
  const [activeGridTab, setActiveGridTab] = useState<string>("cleaned");

  // Proactively initialize when initialCsvText changes
  useEffect(() => {
    if (initialCsvText) {
      processCsvText(initialCsvText);
    }
  }, [initialCsvText]);

  const processCsvText = (text: string) => {
    setCsvRawText(text);
    
    // Delimiter detection
    const format = detectCSVFormat(text);
    setDelimiterInfo(format);

    // Extract headers first to perform mapping detection
    const parsedTemp = Papa.parse<any>(text.trim(), {
      header: true,
      skipEmptyLines: true,
      delimiter: format.delimiter
    });
    const headers = parsedTemp.meta.fields || [];
    setAvailableHeaders(headers);

    // Auto-detect mappings
    const detectedMapping = detectColumnMapping(headers);
    setColumnMapping(detectedMapping);

    // Auto-detect resource type based on resource column header
    const lowerMachHeader = detectedMapping.machine.toLowerCase();
    let resType = "Workstation";
    if (lowerMachHeader.includes("assembly")) {
      resType = "Assembly Line";
    } else if (lowerMachHeader.includes("production") || lowerMachHeader.includes("line")) {
      resType = "Production Line";
    } else if (lowerMachHeader.includes("group")) {
      resType = "Machine Group";
    }
    setResourceType(resType);

    // Perform validation scanner
    const scan = validateCSVData(text, format.delimiter, detectedMapping);
    setRawRows(scan.rawRows);
    setCleanedRows(scan.rawRows); // start cleaning from raw rows
    setValidationIssues(scan.issues);
    setHealthScore(scan.healthScore);
    setTotalRows(scan.totalRows);
    
    // Initialize logs and suggestions
    setCleaningLogs([]);
    const suggs = generateAISuggestions(scan.rawRows, detectedMapping);
    setAiSuggestions(suggs);
    setAiTerminalLogs([
      `[SYSTEM] Data loaded from Dashboard upload`,
      `[SYSTEM] Auto-detected delimiter: ${format.name}`,
      `[SYSTEM] Mapped resource column: "${detectedMapping.machine}" (${resType})`,
      `[SYSTEM] Scanned ${scan.totalRows} rows. Health score calculated: ${scan.healthScore}/100.`
    ]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text);
      
      // Delimiter detection
      const format = detectCSVFormat(text);
      setDelimiterInfo(format);

      // Extract headers first to perform mapping detection
      const parsedTemp = Papa.parse<any>(text.trim(), {
        header: true,
        skipEmptyLines: true,
        delimiter: format.delimiter
      });
      const headers = parsedTemp.meta.fields || [];
      setAvailableHeaders(headers);

      // Auto-detect mappings
      const detectedMapping = detectColumnMapping(headers);
      setColumnMapping(detectedMapping);

      // Auto-detect resource type based on resource column header
      const lowerMachHeader = detectedMapping.machine.toLowerCase();
      if (lowerMachHeader.includes("assembly")) {
        setResourceType("Assembly Line");
      } else if (lowerMachHeader.includes("production") || lowerMachHeader.includes("line")) {
        setResourceType("Production Line");
      } else if (lowerMachHeader.includes("group")) {
        setResourceType("Machine Group");
      } else {
        setResourceType("Workstation");
      }

      // Perform validation scanner
      const scan = validateCSVData(text, format.delimiter, detectedMapping);
      setRawRows(scan.rawRows);
      setCleanedRows(scan.rawRows); // start cleaning from raw rows
      setValidationIssues(scan.issues);
      setHealthScore(scan.healthScore);
      setTotalRows(scan.totalRows);
      
      // Initialize logs and suggestions
      setCleaningLogs([]);
      const suggs = generateAISuggestions(scan.rawRows, detectedMapping);
      setAiSuggestions(suggs);
      setAiTerminalLogs([
        `[SYSTEM] File uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        `[SYSTEM] Auto-detected delimiter: ${format.name}`,
        `[SYSTEM] Mapped resource column: "${detectedMapping.machine}" (${resourceType})`,
        `[SYSTEM] Scanned ${scan.totalRows} rows. Health score calculated: ${scan.healthScore}/100.`
      ]);

      toast.success("CSV uploaded and analyzed successfully!");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".tsv") || file.name.endsWith(".txt"))) {
      processFile(file);
    } else {
      toast.error("Please drop a valid .csv, .tsv, or .txt file.");
    }
  };

  const handleMappingChange = (fieldKey: keyof ColumnMapping, val: string) => {
    const updated = { ...columnMapping, [fieldKey]: val };
    setColumnMapping(updated);
    
    // Auto adjust resource type labels
    if (fieldKey === "machine") {
      const lowerMach = val.toLowerCase();
      if (lowerMach.includes("assembly")) {
        setResourceType("Assembly Line");
      } else if (lowerMach.includes("production") || lowerMach.includes("line")) {
        setResourceType("Production Line");
      } else if (lowerMach.includes("group")) {
        setResourceType("Machine Group");
      } else {
        setResourceType("Workstation");
      }
    }

    if (csvRawText) {
      const scan = validateCSVData(csvRawText, delimiterInfo.delimiter, updated);
      setRawRows(scan.rawRows);
      setCleanedRows(scan.rawRows);
      setValidationIssues(scan.issues);
      setHealthScore(scan.healthScore);
      setTotalRows(scan.totalRows);
      
      // Regenerate suggestions
      const suggs = generateAISuggestions(scan.rawRows, updated);
      setAiSuggestions(suggs);

      setAiTerminalLogs(prev => [
        ...prev,
        `[SYSTEM] Updated mapping: Mapped ${fieldKey} to "${val}". Recalculated validation.`
      ]);
    }
  };

  const runStandardCleaning = () => {
    if (rawRows.length === 0) {
      toast.error("Please upload a CSV file first.");
      return;
    }
    
    const result = cleanCSVData(rawRows, cleaningOptions, columnMapping);
    setCleanedRows(result.cleanedRows);
    setCleaningLogs(result.logs);

    // Update health status and suggestions for cleaned rows
    const cleanedText = Papa.unparse(result.cleanedRows, { delimiter: delimiterInfo.delimiter });
    const rescan = validateCSVData(cleanedText, delimiterInfo.delimiter, columnMapping);
    setValidationIssues(rescan.issues);
    setHealthScore(rescan.healthScore);
    
    // Regenerate suggestions
    const newSuggs = generateAISuggestions(result.cleanedRows, columnMapping);
    setAiSuggestions(newSuggs);

    setAiTerminalLogs(prev => [
      ...prev,
      `[CLEANER] Executed Standard Clean rules. Updated ${result.logs.length} fields.`,
      `[SYSTEM] Post-clean health scan score: ${rescan.healthScore}/100. Issues remaining: ${rescan.issues.length}`
    ]);

    toast.success(`Standard auto-cleaning completed! Resolved ${result.logs.length} formatting issues.`);
  };

  // AI Co-pilot Suggestions Handlers
  const acceptAiSuggestion = (sugg: AISuggestion) => {
    const updated = cleanedRows.map((row, idx) => {
      if (idx === sugg.rowIdx) {
        const copy = { ...row };
        copy[sugg.column] = sugg.suggestedValue;
        return copy;
      }
      return row;
    });

    setCleanedRows(updated);
    setAiSuggestions(prev => prev.filter(s => s.id !== sugg.id));
    setAiTerminalLogs(prev => [
      ...prev,
      `[AI CO-PILOT] Accepted suggestion on row ${sugg.rowIdx + 1}: changed ${sugg.column} from "${sugg.originalValue}" to "${sugg.suggestedValue}".`
    ]);

    // Rescan issues
    const cleanedText = Papa.unparse(updated, { delimiter: delimiterInfo.delimiter });
    const rescan = validateCSVData(cleanedText, delimiterInfo.delimiter, columnMapping);
    setValidationIssues(rescan.issues);
    setHealthScore(rescan.healthScore);
    toast.success("AI suggestion applied!");
  };

  const ignoreAiSuggestion = (suggId: string) => {
    setAiSuggestions(prev => prev.filter(s => s.id !== suggId));
  };

  // AI Custom Instructions Execution
  const runCustomInstructions = () => {
    if (!customAiPrompt.trim()) return;
    if (cleanedRows.length === 0) {
      toast.error("Please upload a dataset first.");
      return;
    }

    setAiIsThinking(true);
    setAiTerminalLogs(prev => [...prev, `[AI CONSULT] Interpreting instruction prompt: "${customAiPrompt}"...`]);

    setTimeout(() => {
      const result = runCustomPromptCleaning(cleanedRows, customAiPrompt, columnMapping);
      setCleanedRows(result.cleanedRows);
      setAiTerminalLogs(prev => [...prev, ...result.aiLogs, `[AI CONSULT] Cleaning execution complete.`]);
      setCustomAiPrompt("");
      setAiIsThinking(false);

      // Rescan issues
      const cleanedText = Papa.unparse(result.cleanedRows, { delimiter: delimiterInfo.delimiter });
      const rescan = validateCSVData(cleanedText, delimiterInfo.delimiter, columnMapping);
      setValidationIssues(rescan.issues);
      setHealthScore(rescan.healthScore);
      toast.success("AI prompt instructions executed!");
    }, 1000);
  };

  const handleImportToScheduler = () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only Admin or Developer role can commit dataset changes.");
      return;
    }
    if (cleanedRows.length === 0) {
      toast.error("No cleaned data to import. Please upload a CSV first.");
      return;
    }

    try {
      // 1. Extract unique resource values from the mapped machine column
      const resourceColName = columnMapping.machine;
      const uniqueResources = Array.from(
        new Set(cleanedRows.map(r => String(r[resourceColName] || "").trim()).filter(Boolean))
      );

      if (uniqueResources.length === 0) {
        toast.error("Error: Mapped Resource column contains no workstation names.");
        return;
      }

      // 2. Generate custom machineGroups and machines based on resourceType selection
      const customGroupId = "mapped-group-1";
      const customGroupName = resourceType || "Custom Resources";
      const newMachineGroup = { id: customGroupId, name: customGroupName };

      const newMachines = uniqueResources.map((resName) => ({
        id: resName,
        name: resName,
        machineGroupId: customGroupId
      }));

      // 3. Translate cleanedRows into standard expected keys for active store scheduling
      const standardizedRows = cleanedRows.map((row) => {
        const std: Record<string, string> = {};
        
        // Mapped core fields
        std["Order"] = row[columnMapping.order] || "";
        std["Material"] = row[columnMapping.material] || "";
        std["Order Process ID"] = row[columnMapping.processId] || "10";
        std["Order QTY"] = row[columnMapping.qty] || "0";
        std["SOP Start Date"] = row[columnMapping.sopStartDate] || "";
        std["Machine"] = row[columnMapping.machine] || "";

        // Mapped optional / fallback fields
        std["Set up Time (Not related to any qty)"] = columnMapping.setupTime ? (row[columnMapping.setupTime] || "0") : "0";
        std["Process time (related to qty)"] = columnMapping.processTime ? (row[columnMapping.processTime] || "0") : "0";
        std["Base-Qty each process"] = columnMapping.baseQty ? (row[columnMapping.baseQty] || "1") : "1";
        
        // Manpower
        const manpowerKey = columnMapping.manpower;
        const manpowerVal = manpowerKey ? (row[manpowerKey] || "0") : "0";
        std["Manpower Utilization"] = String(manpowerVal);
        std["Manpwer Utilization"] = String(manpowerVal); // duplicate to handle typo mappings in parsing

        // Add additional metadata fields preserved if they exist
        Object.keys(row).forEach(key => {
          if (!Object.values(columnMapping).includes(key)) {
            std[key] = row[key];
          }
        });

        return std;
      });

      // 4. Update the active store's machines configuration
      useAppStore.setState({
        machines: newMachines,
        machineGroups: [newMachineGroup],
        columnMapping: columnMapping
      });

      // 5. Serialize standardized rows to CSV and load into active store
      const csvText = Papa.unparse(standardizedRows, { delimiter: delimiterInfo.delimiter });
      loadFromCSVText(csvText);
      
      toast.success(`Dataset successfully committed! Loaded ${newMachines.length} custom resources under Group "${customGroupName}".`);
      onSaved();
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error("Import failed during serialization. Check validation console.");
      console.error(err);
    }
  };

  const handleResetWorkspaceCSV = async () => {
    if (role !== "DEVELOPER" && role !== "ADMIN") {
      toast.error("Access Denied: Only Developers or Admins can reset standard factory datasets.");
      return;
    }
    
    try {
      // Revert standard machine layouts
      const standardGroup = [
        { id: "M1", name: "M1" },
        { id: "M2", name: "M2" }
      ];
      const standardMachines = [
        { id: "603012", name: "603012", machineGroupId: "M1" },
        { id: "605001", name: "605001", machineGroupId: "M1" },
        { id: "603010", name: "603010", machineGroupId: "M2" },
        { id: "603011", name: "603011", machineGroupId: "M2" }
      ];
      useAppStore.setState({
        machines: standardMachines,
        machineGroups: standardGroup
      });

      const storeState = useAppStore.getState();
      await storeState.loadDefaultCSV();
      toast.success("Successfully reset scheduler to default seed CSV and machine groups.");
      navigate({ to: "/orders" });
    } catch (err) {
      toast.error("Failed to load factory process.csv");
    }
  };

  // -------------------------------------------------------------
  // CHARTS / ANALYTICS DATA COMPILATIONS
  // -------------------------------------------------------------

  // 1. Capacity Load per Workstation / Assembly / Line (total load in hours)
  const resourceCapacityData = useMemo(() => {
    const map = new window.Map<string, { name: string; count: number; hours: number }>();
    cleanedRows.forEach(row => {
      const res = String(row[columnMapping.machine] || "Unassigned").trim();
      const procTime = parseFloat(row[columnMapping.processTime]) || 0;
      const setupTime = parseFloat(row[columnMapping.setupTime]) || 0;
      const qtyStr = String(row[columnMapping.qty] || "0").replace(/,/g, "");
      const qty = parseFloat(qtyStr) || 0;
      const base = parseFloat(row[columnMapping.baseQty]) || 1;
      
      // setup + (proc * qty) / base
      const totalTimeMin = setupTime + (procTime * qty) / base;
      const hours = Math.round((totalTimeMin / 60) * 10) / 10;
      
      const existing = map.get(res) || { name: res, count: 0, hours: 0 };
      existing.count += 1;
      existing.hours += hours;
      map.set(res, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [cleanedRows, columnMapping]);

  // 2. Timeline distribution (SOP Orders starting per Day)
  const dailyTimelineData = useMemo(() => {
    const map = new window.Map<string, { date: string; orders: number; volume: number }>();
    cleanedRows.forEach(row => {
      let rawDate = row[columnMapping.sopStartDate] || "";
      let normDate = parseAndNormalizeDate(rawDate);
      if (!normDate) normDate = "Undefined";
      
      const qtyStr = String(row[columnMapping.qty] || "0").replace(/,/g, "");
      const qty = parseFloat(qtyStr) || 0;

      const existing = map.get(normDate) || { date: normDate, orders: 0, volume: 0 };
      existing.orders += 1;
      existing.volume += qty;
      map.set(normDate, existing);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [cleanedRows, columnMapping]);

  // 3. Top Materials distribution
  const topMaterialsData = useMemo(() => {
    const map = new window.Map<string, { material: string; count: number; qty: number }>();
    cleanedRows.forEach(row => {
      const mat = String(row[columnMapping.material] || "Unknown").trim();
      const qtyStr = String(row[columnMapping.qty] || "0").replace(/,/g, "");
      const qty = parseFloat(qtyStr) || 0;

      const existing = map.get(mat) || { material: mat, count: 0, qty: 0 };
      existing.count += 1;
      existing.qty += qty;
      map.set(mat, existing);
    });
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  }, [cleanedRows, columnMapping]);

  const handleLoadSampleDataset = (sample: SampleDataset) => {
    processCsvText(sample.content);
    toast.success(`Loaded sample dataset: ${sample.name}`);
  };

  const handleDownloadSampleDataset = (sample: SampleDataset, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([sample.content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", sample.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded sample file: ${sample.filename}`);
  };

  // State for toggling Expected Format guide
  const [showFormatGuide, setShowFormatGuide] = useState(false);

  // Render Component Content
  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            CSV Data Upload & Cleaning Hub
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Analyze, align delimiters, map custom headers (Assembly / Production lines), heal schedules with AI instructions, and preview analytics charts.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="outline" size="sm" onClick={handleResetWorkspaceCSV} className="gap-1.5 transition-all">
            <Undo className="h-4 w-4" /> Reset Default Seed
          </Button>
          <Button 
            onClick={handleImportToScheduler} 
            disabled={cleanedRows.length === 0} 
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm transition-all font-semibold cursor-pointer"
          >
            <FileCheck className="h-4 w-4" />
            Save & Continue
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel} 
            className="cursor-pointer gap-1.5 border-destructive/20 hover:bg-destructive/5 text-destructive dark:text-red-400 font-medium"
          >
            Cancel & Clear
          </Button>
        </div>
      </div>

      {/* Overview Analytics Bar if Data is loaded */}
      {rawRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/40 p-4 rounded-xl border border-border/60 backdrop-blur-sm">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Rows Scanned</span>
            <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">{totalRows}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Detected Delimiter</span>
            <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400 font-mono">{delimiterInfo.name}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Resource Field Type</span>
            <p className="text-xl font-extrabold text-purple-600 dark:text-purple-400">{resourceType}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Data Health Score</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold font-mono" style={{
                color: healthScore > 85 ? '#10b981' : healthScore > 60 ? '#f59e0b' : '#ef4444'
              }}>{healthScore}%</span>
              <div className="h-2 w-16 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full ${healthScore > 85 ? 'bg-emerald-500' : healthScore > 60 ? 'bg-amber-500' : 'bg-red-500'}`} 
                  style={{ width: `${healthScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab Controller */}
      <Tabs value={mainPageTab} onValueChange={setMainPageTab} className="w-full">
        <TabsList className="bg-muted/80 border border-border/60 h-10 p-0.5 grid grid-cols-2 max-w-[400px] mb-4">
          <TabsTrigger value="workspace" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground transition-all gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Workspace & Editor
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs data-[state=active]:bg-background data-[state=active]:text-foreground transition-all gap-1.5" disabled={rawRows.length === 0}>
            <BarChart2 className="h-3.5 w-3.5" /> Visual Analytics Charts
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Clean & Validate Workspace */}
        <TabsContent value="workspace" className="outline-none space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN: Upload, Mapping, and Validation Option panels */}
            <div className="lg:col-span-5 space-y-6">
              {/* Dropzone Card */}
              <Card className="border border-border/85 shadow-sm relative overflow-hidden bg-card text-card-foreground">
                <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-foreground flex items-center gap-1.5">
                      <Upload className="h-4.5 w-4.5 text-muted-foreground" />
                      CSV File Input
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">Drag and drop or select your CSV/TSV production files.</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFormatGuide(!showFormatGuide)}
                    className="text-xs text-primary hover:text-primary/80 gap-1"
                  >
                    <Info className="h-3.5 w-3.5" />
                    {showFormatGuide ? "Hide Guide" : "Expected Format Guide"}
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                      isDragOver 
                        ? "border-primary bg-primary/5 scale-[0.99] shadow-sm" 
                        : "border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/40 bg-card"
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept=".csv,.tsv,.txt" 
                      className="hidden" 
                    />
                    <Upload className="h-7 w-7 text-muted-foreground mb-2 animate-bounce" />
                    <p className="text-xs font-semibold text-center text-foreground">Click to select or drag CSV file</p>
                    <p className="text-[10px] text-muted-foreground text-center mt-1">Accepts CSV, TSV (Tab separated), Semicolon separated</p>
                    
                    {rawRows.length > 0 && (
                      <div className="mt-3 px-3 py-0.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Dataset Loaded ({totalRows} Rows)
                      </div>
                    )}
                  </div>

                  {/* One-Click Sample Dataset Templates */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        One-Click Sample Industry Datasets
                      </Label>
                      <span className="text-[9px] text-muted-foreground">Click to load instantly</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {SAMPLE_DATASETS.map((sample) => (
                        <div
                          key={sample.id}
                          onClick={() => handleLoadSampleDataset(sample)}
                          className="group p-2.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-primary font-mono bg-primary/10 px-1 py-0.5 rounded border border-primary/20">{sample.icon}</span>
                              <span className="text-[11px] font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{sample.name}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDownloadSampleDataset(sample, e)}
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={`Download ${sample.filename}`}
                            >
                              <FileSpreadsheet className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </Button>
                          </div>
                          <span className="text-[9px] text-muted-foreground line-clamp-1 mt-1">{sample.industry}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expected CSV Format Visual Guide Card */}
              {showFormatGuide && (
                <Card className="border border-primary/30 shadow-md bg-gradient-to-b from-primary/5 to-transparent text-card-foreground animate-in fade-in duration-200">
                  <CardHeader className="pb-2 border-b border-primary/10">
                    <CardTitle className="text-sm font-bold text-primary flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileCheck className="h-4 w-4" />
                        Expected CSV Format & Required Schema
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowFormatGuide(false)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Our smart column mapping engine auto-detects English, German, and custom ERP header names.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-3">
                    <div className="space-y-2">
                      {EXPECTED_COLUMNS_SPEC.map((col) => (
                        <div key={col.field} className="p-2 bg-background rounded-md border border-border/50 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground flex items-center gap-1">
                              {col.label}
                              {col.required ? (
                                <span className="text-[9px] bg-red-500/10 text-red-500 px-1 rounded font-mono">REQUIRED</span>
                              ) : (
                                <span className="text-[9px] bg-muted text-muted-foreground px-1 rounded font-mono">OPTIONAL</span>
                              )}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">e.g. {col.example}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{col.description}</p>
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-[9px] font-semibold text-muted-foreground">Supported Header Aliases:</span>
                            {col.aliases.slice(0, 4).map((alias) => (
                              <span key={alias} className="text-[9px] font-mono bg-muted/80 px-1 py-0.2 rounded border border-border/40">
                                {alias}
                              </span>
                            ))}
                            {col.aliases.length > 4 && (
                              <span className="text-[9px] text-muted-foreground">+{col.aliases.length - 4} more</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-2.5 bg-muted/40 rounded-lg border border-border/50 text-[10px] text-muted-foreground space-y-1">
                      <span className="font-bold text-foreground flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        Date Format & Delimiter Flexibility:
                      </span>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-[9.5px]">
                        <li>Dates support formats like <code className="font-mono">DD-MM-YYYY</code>, <code className="font-mono">YYYY-MM-DD</code>, <code className="font-mono">01 July 2026</code>.</li>
                        <li>Delimiters support Comma (<code className="font-mono">,</code>), Semicolon (<code className="font-mono">;</code>), Tab (<code className="font-mono">\t</code>), and Pipe (<code className="font-mono">|</code>).</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Column Mapping Panel (Shows only if headers are loaded) */}
              {rawRows.length > 0 && (
                <Card className="border border-border/80 shadow-sm bg-card text-card-foreground">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-lg text-foreground flex items-center gap-1.5">
                      <MapIcon className="h-4.5 w-4.5 text-muted-foreground" />
                      Interactive Column Mapping
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">Map CSV headers to required scheduler fields.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3.5">
                    {/* Resource Type Selector */}
                    <div className="space-y-1 bg-muted/30 p-2.5 rounded-lg border border-border/60">
                      <Label htmlFor="resource-type-selector" className="text-[10px] uppercase font-bold text-primary">Target Resource Type</Label>
                      <select 
                        id="resource-type-selector"
                        value={resourceType}
                        onChange={(e) => setResourceType(e.target.value)}
                        className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary mt-1"
                      >
                        <option value="Assembly Line">Assembly Line (e.g. Line Alpha, Line Beta)</option>
                        <option value="Production Line">Production Line (e.g. Line 1, Line 2)</option>
                        <option value="Machine Group">Machine Group (e.g. Group M1, Group M2)</option>
                        <option value="Workstation">Workstation (e.g. Milling A, Drill B)</option>
                      </select>
                      <span className="text-[9px] text-muted-foreground italic block mt-1">This sets the name of the main resource group.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Order mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Order ID *</Label>
                        <select 
                          value={columnMapping.order}
                          onChange={(e) => handleMappingChange("order", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Material mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Material / Part *</Label>
                        <select 
                          value={columnMapping.material}
                          onChange={(e) => handleMappingChange("material", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Process ID mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Step ID *</Label>
                        <select 
                          value={columnMapping.processId}
                          onChange={(e) => handleMappingChange("processId", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Qty mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Quantity *</Label>
                        <select 
                          value={columnMapping.qty}
                          onChange={(e) => handleMappingChange("qty", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* SOP Start date mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">SOP Start Date *</Label>
                        <select 
                          value={columnMapping.sopStartDate}
                          onChange={(e) => handleMappingChange("sopStartDate", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Resource Column mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Resource Col *</Label>
                        <select 
                          value={columnMapping.machine}
                          onChange={(e) => handleMappingChange("machine", e.target.value)}
                          className="bg-background border border-border text-primary font-semibold rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Optional Setup Time mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Setup Time (Opt)</Label>
                        <select 
                          value={columnMapping.setupTime}
                          onChange={(e) => handleMappingChange("setupTime", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">-- None (Default 0) --</option>
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      {/* Optional Process Time mapping */}
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Process Time (Opt)</Label>
                        <select 
                          value={columnMapping.processTime}
                          onChange={(e) => handleMappingChange("processTime", e.target.value)}
                          className="bg-background border border-border text-foreground rounded-md p-1 px-2 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">-- None (Default 0) --</option>
                          {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Validation Meter & Issues Console */}
              <Card className="border border-border/80 shadow-sm bg-card text-card-foreground">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-foreground flex items-center gap-1.5">
                      <Settings className="h-4.5 w-4.5 text-muted-foreground" />
                      Validation Analytics
                    </CardTitle>
                    {rawRows.length > 0 && (
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        healthScore > 85 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                          : healthScore > 60 
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      }`}>
                        Score: {healthScore}%
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-muted-foreground">Logical and formatting scan results of the uploaded document.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {rawRows.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Upload a dataset to run formatting and column mapping scanners.
                    </div>
                  ) : (
                    <Tabs value={activeViewTab} onValueChange={setActiveViewTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-muted border border-border/40 h-9 p-0.5">
                        <TabsTrigger value="issues" className="text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground">
                          Issues ({validationIssues.length})
                        </TabsTrigger>
                        <TabsTrigger value="options" className="text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground">
                          Clean Rules
                        </TabsTrigger>
                        <TabsTrigger value="logs" className="text-[10px] data-[state=active]:bg-background data-[state=active]:text-foreground">
                          Logs ({cleaningLogs.length})
                        </TabsTrigger>
                      </TabsList>
                      
                      {/* Tab: Issues list */}
                      <TabsContent value="issues" className="pt-3 max-h-[260px] overflow-y-auto space-y-2">
                        {validationIssues.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6 text-center text-emerald-500 dark:text-emerald-400 gap-1.5">
                            <CheckCircle className="h-7 w-7 text-emerald-500" />
                            <span className="text-xs font-semibold">Dataset fully compliant!</span>
                            <span className="text-[10px] text-muted-foreground">Standard scheduler fields are clean and formatted.</span>
                          </div>
                        ) : (
                          validationIssues.map((issue, idx) => (
                            <div 
                              key={idx} 
                              className={`p-2.5 rounded-md border flex items-start gap-2.5 text-[11px] ${
                                issue.type === "critical" 
                                  ? "bg-destructive/15 border-destructive/20 text-destructive dark:text-red-400" 
                                  : issue.type === "warning"
                                  ? "bg-amber-500/15 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                  : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              {issue.type === "critical" && <X className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />}
                              {issue.type === "warning" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />}
                              {issue.type === "info" && <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-550" />}
                              
                              <div className="space-y-0.5">
                                <p className="font-semibold leading-tight">{issue.message}</p>
                                {issue.column && (
                                  <div className="flex gap-2 text-[9px] opacity-70">
                                    <span>Col: <strong className="font-mono">{issue.column}</strong></span>
                                    {issue.rowIdx >= 0 && <span>Row: <strong>{issue.rowIdx + 1}</strong></span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </TabsContent>

                      {/* Tab: Auto-Clean Selection checkboxes */}
                      <TabsContent value="options" className="pt-3 space-y-3">
                        <div className="space-y-2.5 bg-muted/20 border border-border p-3 rounded-lg text-[11px]">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="opt-trim" 
                              checked={cleaningOptions.trimWhitespace}
                              onCheckedChange={(checked) => setCleaningOptions(prev => ({ ...prev, trimWhitespace: !!checked }))}
                            />
                            <label htmlFor="opt-trim" className="font-medium cursor-pointer text-foreground leading-none">
                              Trim inner tab-spaces & carriage returns
                            </label>
                          </div>
                          <p className="text-[9px] text-muted-foreground pl-5">
                            Strips excessive spacing, carriage returns, and tabs in material strings.
                          </p>

                          <div className="flex items-center space-x-2 pt-1">
                            <Checkbox 
                              id="opt-dates"
                              checked={cleaningOptions.normalizeDates}
                              onCheckedChange={(checked) => setCleaningOptions(prev => ({ ...prev, normalizeDates: !!checked }))}
                            />
                            <label htmlFor="opt-dates" className="font-medium cursor-pointer text-foreground leading-none">
                              Standardize date formats to YYYY-MM-DD
                            </label>
                          </div>
                          <p className="text-[9px] text-muted-foreground pl-5">
                            Converts German dots (13.07.2026) or slash layouts into ISO.
                          </p>

                          <div className="flex items-center space-x-2 pt-1">
                            <Checkbox 
                              id="opt-neg"
                              checked={cleaningOptions.fixNegatives}
                              onCheckedChange={(checked) => setCleaningOptions(prev => ({ ...prev, fixNegatives: !!checked }))}
                            />
                            <label htmlFor="opt-neg" className="font-medium cursor-pointer text-foreground leading-none">
                              Convert negative quantities & setup times
                            </label>
                          </div>
                          <p className="text-[9px] text-muted-foreground pl-5">
                            Applies absolute values to negative capacities or durations.
                          </p>

                          <div className="flex items-center space-x-2 pt-1">
                            <Checkbox 
                              id="opt-defaults"
                              checked={cleaningOptions.fillDefaults}
                              onCheckedChange={(checked) => setCleaningOptions(prev => ({ ...prev, fillDefaults: !!checked }))}
                            />
                            <label htmlFor="opt-defaults" className="font-medium cursor-pointer text-foreground leading-none">
                              Auto-populate blank/missing columns
                            </label>
                          </div>
                          <p className="text-[9px] text-muted-foreground pl-5">
                            Fills empty workstation rows and sets process base quantities to 1.
                          </p>
                        </div>

                        <Button 
                          onClick={runStandardCleaning} 
                          className="w-full bg-primary hover:bg-primary/95 text-xs text-white"
                        >
                          Apply Checked Cleaning Rules
                        </Button>
                      </TabsContent>

                      {/* Tab: Standard change logs */}
                      <TabsContent value="logs" className="pt-3 max-h-[260px] overflow-y-auto space-y-2">
                        {cleaningLogs.length === 0 ? (
                          <div className="py-12 text-center text-xs text-muted-foreground">
                            No corrections logged yet. Apply auto-clean rules above.
                          </div>
                        ) : (
                          cleaningLogs.map((log, idx) => (
                            <div key={idx} className="p-2 border border-border bg-card rounded text-[10px] font-mono space-y-1 shadow-sm">
                              <div className="flex justify-between border-b border-border/50 pb-0.5 font-bold">
                                <span className="text-foreground">Row {log.rowIdx + 1} &middot; {log.column}</span>
                                <span className="text-[8px] text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200/50">{log.action}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-[9px] text-muted-foreground mt-1">
                                <div>Before: <strong className="text-red-500 line-through font-normal">{log.previous || "BLANK"}</strong></div>
                                <div>After: <strong className="text-emerald-600 font-normal">{log.current}</strong></div>
                              </div>
                            </div>
                          ))
                        )}
                      </TabsContent>
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: AI Co-pilot Console & Grid comparison */}
            <div className="lg:col-span-7 space-y-6">
              {/* AI Co-pilot Suggestions & Custom Instructions Console */}
              <Card className="bg-gradient-to-br from-indigo-50/20 to-slate-50/20 dark:from-indigo-950/5 dark:to-zinc-900/5 border border-border shadow-md">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-1.5 text-foreground">
                      <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
                      AI Cleaning Assistant & Co-pilot
                    </CardTitle>
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-bold">
                      Simulation Engine Ready
                    </span>
                  </div>
                  <CardDescription className="text-muted-foreground">Heal dataset discrepancies using contextual model recommendations or custom commands.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Suggestion list */}
                  {rawRows.length > 0 && aiSuggestions.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-muted-foreground block">AI Smart Heuristic Suggestions:</span>
                      <div className="grid gap-2 sm:grid-cols-2 max-h-[170px] overflow-y-auto">
                        {aiSuggestions.map((sugg) => (
                          <div key={sugg.id} className="bg-card border border-indigo-100 dark:border-indigo-900 p-2.5 rounded-lg text-xs space-y-2 flex flex-col justify-between shadow-sm">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[8px] bg-indigo-500/10 text-indigo-600 px-1.5 py-0.2 rounded uppercase font-mono">
                                  {sugg.category}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-semibold">Row {sugg.rowIdx + 1}</span>
                              </div>
                              <p className="text-[10px] text-foreground leading-normal">{sugg.description}</p>
                            </div>
                            <div className="flex gap-2 items-center justify-between pt-1 border-t border-border/30">
                              <span className="text-[9px] text-muted-foreground truncate max-w-[120px]">Fix: "{sugg.suggestedValue}"</span>
                              <div className="flex gap-1 shrink-0">
                                <Button 
                                  onClick={() => ignoreAiSuggestion(sugg.id)} 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-5 w-5 p-0 text-red-500 hover:text-red-650 hover:bg-red-50"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button 
                                  onClick={() => acceptAiSuggestion(sugg)} 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-5 px-1.5 text-[9px] text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 border-emerald-200"
                                >
                                  <Check className="h-3 w-3 mr-0.5" /> Accept
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Console Input for Custom Prompts */}
                  <div className="space-y-2">
                    <Label htmlFor="ai-instructions" className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                      <span>Instruct AI Co-pilot to clean or edit dataset:</span>
                      <span className="text-[9px] font-normal text-muted-foreground/80 italic">Natural Language Engine</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="ai-instructions"
                        placeholder="E.g. 'assign Assembly Line Alpha to all casings' or 'double quantity for order 100501'"
                        value={customAiPrompt}
                        onChange={(e) => setCustomAiPrompt(e.target.value)}
                        disabled={rawRows.length === 0 || aiIsThinking}
                        className="text-xs bg-background border-border text-foreground focus-visible:ring-primary"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") runCustomInstructions();
                        }}
                      />
                      <Button 
                        onClick={runCustomInstructions} 
                        disabled={rawRows.length === 0 || aiIsThinking || !customAiPrompt.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 text-xs px-3 transition-colors border border-indigo-500/20 font-semibold"
                      >
                        {aiIsThinking ? (
                          <span className="animate-spin mr-1">⌛</span>
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                        )}
                        Run AI Fix
                      </Button>
                    </div>

                    {/* Hotkeys/Shortcuts prompt clicks */}
                    {rawRows.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-[10px] text-muted-foreground py-0.5 mr-1">Try:</span>
                        <button 
                          onClick={() => setCustomAiPrompt(`Assign Assy Line Alpha to all casing steps`)}
                          className="text-[9px] bg-background hover:bg-muted border border-border/80 text-muted-foreground px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          Assign Alpha Line to casing
                        </button>
                        <button 
                          onClick={() => setCustomAiPrompt("Clean all spaces")}
                          className="text-[9px] bg-background hover:bg-muted border border-border/80 text-muted-foreground px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          Trim Spaces in Materials
                        </button>
                        <button 
                          onClick={() => setCustomAiPrompt(`double quantity for order ${rawRows[0]?.[columnMapping.order] || '100501'}`)}
                          className="text-[9px] bg-background hover:bg-muted border border-border/80 text-muted-foreground px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          Double Qty of Order 1
                        </button>
                      </div>
                    )}
                  </div>

                  {/* AI Terminal Log Output */}
                  <div className="rounded-lg bg-slate-50 dark:bg-zinc-950 border border-border text-slate-700 dark:text-zinc-350 p-3 font-mono text-[10px] space-y-1 relative shadow-inner">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-1.5 mb-1.5 text-slate-500 font-bold text-[8px] uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Terminal className="h-3 w-3" /> AI Co-pilot Reasoning Console</span>
                      <span className="text-emerald-600 dark:text-emerald-450 font-bold">online</span>
                    </div>
                    <div className="max-h-[120px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                      {aiTerminalLogs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed">
                          {log.startsWith("[SYSTEM]") && <span className="text-sky-600 dark:text-sky-400">{log}</span>}
                          {log.startsWith("[CLEANER]") && <span className="text-amber-600 dark:text-amber-400">{log}</span>}
                          {log.startsWith("[AI CO-PILOT]") && <span className="text-indigo-600 dark:text-indigo-400">{log}</span>}
                          {log.startsWith("[AI CONSULT]") && <span className="text-pink-600 dark:text-pink-400">{log}</span>}
                          {log.startsWith("[AI HEAL]") && <span className="text-emerald-600 dark:text-emerald-400">{log}</span>}
                          {!log.startsWith("[") && <span className="text-slate-600 dark:text-zinc-400">{log}</span>}
                        </div>
                      ))}
                      {aiTerminalLogs.length === 0 && (
                        <div className="text-slate-400 dark:text-zinc-650 text-center py-4">
                          Awaiting dataset upload. Scanners and prompts will compile here.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Grid Preview (Before / After Comparison) */}
              {rawRows.length > 0 && (
                <Card className="border border-border/80 shadow-sm overflow-hidden bg-card text-card-foreground">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-border/50 bg-slate-50/50 dark:bg-slate-950/20">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2 text-foreground font-semibold">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                        Dataset Comparison Preview
                      </CardTitle>
                    </div>
                    <Tabs value={activeGridTab} onValueChange={setActiveGridTab} className="bg-muted border border-border/55 p-0.5 rounded-md h-7 shrink-0">
                      <TabsList className="h-full p-0">
                        <TabsTrigger value="cleaned" className="text-[10px] h-full px-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
                          Cleaned Output
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="text-[10px] h-full px-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground">
                          Raw Upload
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-[300px]">
                      <Table className="text-[11px] font-mono select-none">
                        <TableHeader className="bg-slate-50/80 dark:bg-slate-900 border-b border-border sticky top-0 z-10">
                          <TableRow className="border-b border-border hover:bg-transparent">
                            <TableHead className="font-bold text-muted-foreground border-r border-border w-[45px] text-center">Row</TableHead>
                            <TableHead className="font-bold text-foreground border-r border-border">{columnMapping.order}</TableHead>
                            <TableHead className="font-bold text-foreground border-r border-border">{columnMapping.material}</TableHead>
                            <TableHead className="font-bold text-foreground border-r border-border">{columnMapping.processId}</TableHead>
                            <TableHead className="font-bold text-foreground border-r border-border">{columnMapping.qty}</TableHead>
                            <TableHead className="font-bold text-foreground border-r border-border">{columnMapping.sopStartDate}</TableHead>
                            <TableHead className="font-bold text-primary border-r border-border">{columnMapping.machine}</TableHead>
                            {columnMapping.setupTime && <TableHead className="font-bold text-muted-foreground border-r border-border">Setup</TableHead>}
                            {columnMapping.processTime && <TableHead className="font-bold text-muted-foreground">Process</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(activeGridTab === "cleaned" ? cleanedRows : rawRows).map((row, idx) => {
                            const isModified = activeGridTab === "cleaned" && JSON.stringify(row) !== JSON.stringify(rawRows[idx]);

                            return (
                              <TableRow 
                                key={idx} 
                                className={`hover:bg-muted/5 border-b border-border/30 ${
                                  isModified ? "bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold" : ""
                                }`}
                              >
                                <TableCell className="text-center font-bold text-muted-foreground border-r border-border/30 w-[45px]">{idx + 1}</TableCell>
                                <TableCell className="border-r border-border/30 font-semibold">{row[columnMapping.order]}</TableCell>
                                <TableCell className="border-r border-border/30 truncate max-w-[130px] font-sans" title={row[columnMapping.material]}>
                                  {row[columnMapping.material]}
                                </TableCell>
                                <TableCell className="border-r border-border/30 text-center">{row[columnMapping.processId]}</TableCell>
                                <TableCell className="border-r border-border/30 text-right">{row[columnMapping.qty]}</TableCell>
                                <TableCell className="border-r border-border/30 text-center font-sans">{row[columnMapping.sopStartDate]}</TableCell>
                                <TableCell className="border-r border-border/30 text-center font-sans font-bold text-primary">{row[columnMapping.machine]}</TableCell>
                                {columnMapping.setupTime && <TableCell className="border-r border-border/30 text-right">{row[columnMapping.setupTime]}</TableCell>}
                                {columnMapping.processTime && <TableCell className="text-right">{row[columnMapping.processTime]}</TableCell>}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Visual Charts & Analytics */}
        <TabsContent value="analytics" className="outline-none space-y-6">
          {cleanedRows.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Chart 1: Resource Hours Loading */}
              <Card className="border border-border/80 shadow-sm bg-card text-card-foreground">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-md text-foreground flex items-center gap-2 font-semibold">
                    <BarChart2 className="h-4.5 w-4.5 text-indigo-500" />
                    Resource Capacity Loading (Load in Hours)
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Summed setup + processing times grouped per active resource.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[280px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={resourceCapacityData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="name" stroke="#888888" angle={-15} textAnchor="end" height={50} />
                        <YAxis stroke="#888888" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} 
                          labelStyle={{ fontWeight: "bold", color: "#4f46e5" }}
                        />
                        <Legend />
                        <Bar name="Capacity Load (Hours)" dataKey="hours" fill="url(#indigoGrad)" radius={[4, 4, 0, 0]}>
                          {resourceCapacityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} />
                          ))}
                        </Bar>
                        <defs>
                          <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Chart 2: Timeline SOP Date Volume */}
              <Card className="border border-border/80 shadow-sm bg-card text-card-foreground">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-md text-foreground flex items-center gap-2 font-semibold">
                    <TrendingUp className="h-4.5 w-4.5 text-sky-500" />
                    SOP Launch Schedule (Timeline Volume)
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Daily start volume and counts of orders across timeline.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[280px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="date" stroke="#888888" angle={-15} textAnchor="end" height={50} />
                        <YAxis stroke="#888888" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
                          labelStyle={{ fontWeight: "bold", color: "#0284c7" }}
                        />
                        <Legend />
                        <Area name="Order Qty Volume" dataKey="volume" stroke="#0ea5e9" fill="url(#skyGrad)" strokeWidth={2} />
                        <defs>
                          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Chart 3: Top Materials Distribution */}
              <Card className="border border-border/80 shadow-sm bg-card text-card-foreground md:col-span-2">
                <CardHeader className="pb-3 border-b border-border/50">
                  <CardTitle className="text-md text-foreground flex items-center gap-2 font-semibold">
                    <Layers className="h-4.5 w-4.5 text-purple-500" />
                    Top Materials Breakdown (Quantities Mapped)
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">Ranking of the top 8 materials by target scheduling quantities.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="h-[280px] w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topMaterialsData} layout="vertical" margin={{ top: 10, right: 20, left: 30, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" stroke="#888888" />
                        <YAxis type="category" dataKey="material" stroke="#888888" width={110} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }}
                          labelStyle={{ fontWeight: "bold", color: "#a855f7" }}
                        />
                        <Legend />
                        <Bar name="Total Material Qty" dataKey="qty" fill="url(#purpleGrad)" radius={[0, 4, 4, 0]}>
                          {topMaterialsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} />
                          ))}
                        </Bar>
                        <defs>
                          <linearGradient id="purpleGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#c084fc" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-24 text-center text-muted-foreground border border-border/60 rounded-xl bg-muted/20">
              Please upload a dataset on the Workspace tab first to compile interactive charts.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
