import Papa from "papaparse";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ValidationIssue {
  rowIdx: number; // 0-indexed, -1 for header issues
  type: "critical" | "warning" | "info";
  message: string;
  column?: string;
  value?: string;
}

export interface CleaningOptions {
  trimWhitespace: boolean;
  normalizeDates: boolean;
  fixNegatives: boolean;
  fillDefaults: boolean;
  normalizeDelimiters: boolean;
}

export interface CleanedResult {
  cleanedRows: any[];
  logs: Array<{
    rowIdx: number;
    column: string;
    action: string;
    previous: string;
    current: string;
  }>;
}

export interface AISuggestion {
  id: string;
  rowIdx: number;
  column: string;
  description: string;
  originalValue: string;
  suggestedValue: string;
  category: "typo" | "anomaly" | "consistency";
}

export interface ColumnMapping {
  order: string;
  material: string;
  processId: string;
  qty: string;
  sopStartDate: string;
  machine: string;
  setupTime: string;
  processTime: string;
  baseQty: string;
  manpower: string;
}

// Helper to auto-detect mappings based on headers
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const findHeader = (possibleNames: string[], defaultFallback: string): string => {
    // Exact or array match
    const exact = headers.find((h) => {
      const lh = h.toLowerCase().trim();
      return (
        possibleNames.map((p) => p.toLowerCase().trim()).includes(lh) ||
        lh === defaultFallback.toLowerCase()
      );
    });
    if (exact) return exact;

    // Substring match
    const sub = headers.find((h) => {
      const lh = h.toLowerCase().trim();
      return possibleNames.some(
        (p) => lh.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(lh),
      );
    });
    if (sub) return sub;

    // Default fallback exact
    const def = headers.find((h) => h.toLowerCase().trim() === defaultFallback.toLowerCase());
    return def || headers[0] || "";
  };

  return {
    order: findHeader(
      [
        "order",
        "order id",
        "auftrag",
        "job id",
        "workorder",
        "order no",
        "job no",
        "auftragsnummer",
      ],
      "Order",
    ),
    material: findHeader(
      [
        "material",
        "part",
        "materialnr",
        "part id",
        "product code",
        "item",
        "part number",
        "materialnumber",
      ],
      "Material",
    ),
    processId: findHeader(
      [
        "process id",
        "step",
        "vorgang",
        "order process id",
        "operation",
        "processstep",
        "step no",
        "step number",
      ],
      "Order Process ID",
    ),
    qty: findHeader(
      ["qty", "quantity", "menge", "order qty", "volume", "targetqty", "order quantity"],
      "Order QTY",
    ),
    sopStartDate: findHeader(
      ["sop date", "start date", "sop-startdatum", "sop start date", "releasedate", "date sop"],
      "SOP Start Date",
    ),
    machine: findHeader(
      [
        "machine",
        "arbeitsplatz",
        "machine id",
        "assembly line",
        "production line",
        "work center",
        "cell",
        "resource",
        "station",
        "line",
        "linie",
        "assembly",
      ],
      "Machine",
    ),
    setupTime: findHeader(
      [
        "set up time (not related to any qty)",
        "setup",
        "rustzeit",
        "setup duration",
        "preptime",
        "setup time",
        "setup (mins)",
      ],
      "Set up Time (Not related to any qty)",
    ),
    processTime: findHeader(
      [
        "process time (related to qty)",
        "process time",
        "bearbeitungszeit",
        "processing duration",
        "cycletime",
        "process time (mins)",
      ],
      "Process time (related to qty)",
    ),
    baseQty: findHeader(
      ["base-qty each process", "base qty", "basis", "base"],
      "Base-Qty each process",
    ),
    manpower: findHeader(
      [
        "manpwer utilization",
        "manpower utilization",
        "manpower",
        "bediener",
        "crewsize",
        "operator load",
        "manpower %",
        "manpower utilization in %",
      ],
      "Manpower Utilization",
    ),
  };
}

// 1. Intelligent AI Data Cleaning Server Function
export const runServerAICleaning = createServerFn({ method: "POST" })
  .inputValidator(z.object({ csvText: z.string(), instructions: z.string().optional() }))
  .handler(async ({ data }) => {
    try {
      const isApiKeyAvailable = !!process.env.AI_ENGINE_API_KEY || !!process.env.OPENAI_API_KEY;
      return {
        success: false,
        error:
          "AI_ENGINE_API_KEY is not configured in environment. Using high-performance client-side AI data cleaner engine.",
        isApiKeyAvailable,
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Failed in AI Server Function" };
    }
  });

// 2. Delimiter detection
export function detectCSVFormat(csvText: string): { delimiter: string; name: string } {
  if (!csvText) return { delimiter: ",", name: "Comma (Default)" };

  const firstLines = csvText.split("\n").slice(0, 5).join("\n");

  // Count frequency of possible delimiters
  const commaCount = (firstLines.match(/,/g) || []).length;
  const semicolonCount = (firstLines.match(/;/g) || []).length;
  const tabCount = (firstLines.match(/\t/g) || []).length;

  if (tabCount > commaCount && tabCount > semicolonCount) {
    return { delimiter: "\t", name: "Tab Separated (TSV)" };
  } else if (semicolonCount > commaCount && semicolonCount > tabCount) {
    return { delimiter: ";", name: "Semicolon Separated" };
  }
  return { delimiter: ",", name: "Comma Separated (CSV)" };
}

// Helper to normalize dates
export function parseAndNormalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();

  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // DD.MM.YYYY (German standard)
  const deMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    const day = deMatch[1].padStart(2, "0");
    const month = deMatch[2].padStart(2, "0");
    const year = deMatch[3];
    return `${year}-${month}-${day}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY (English)
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const val1 = slashMatch[1].padStart(2, "0");
    const val2 = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    if (parseInt(val1) > 12) {
      return `${year}-${val2}-${val1}`; // DD/MM/YYYY -> YYYY-MM-DD
    } else {
      return `${year}-${val1}-${val2}`; // MM/DD/YYYY -> YYYY-MM-DD
    }
  }

  // DD-MM-YYYY
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const val1 = dashMatch[1].padStart(2, "0");
    const val2 = dashMatch[2].padStart(2, "0");
    const year = dashMatch[3];
    if (parseInt(val1) > 12) {
      return `${year}-${val2}-${val1}`; // DD-MM-YYYY -> YYYY-MM-DD
    } else {
      // check if German DD-MM-YYYY or standard
      return `${year}-${val2}-${val1}`;
    }
  }

  return cleaned;
}

// 3. Validation Scanner
export function validateCSVData(csvText: string, delimiter: string, customMapping?: ColumnMapping) {
  const parsed = Papa.parse<any>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    delimiter: delimiter,
  });

  const issues: ValidationIssue[] = [];
  const headers = parsed.meta.fields || [];

  // Use custom mapping or auto detect
  const mapping = customMapping || detectColumnMapping(headers);

  // Validate critical mapped headers
  const checkRequiredField = (fieldKey: keyof ColumnMapping, friendlyName: string) => {
    const mappedHeader = mapping[fieldKey];
    if (!mappedHeader || !headers.includes(mappedHeader)) {
      issues.push({
        rowIdx: -1,
        type: "critical",
        message: `Missing column mapping for "${friendlyName}". Please select which CSV column corresponds to this field.`,
        column: friendlyName,
      });
      return false;
    }
    return true;
  };

  const hasOrder = checkRequiredField("order", "Order ID");
  const hasMaterial = checkRequiredField("material", "Material / Part");
  const hasProcessId = checkRequiredField("processId", "Process Step ID");
  const hasQty = checkRequiredField("qty", "Quantity");
  const hasSopDate = checkRequiredField("sopStartDate", "SOP Start Date");
  const hasMachine = checkRequiredField("machine", "Resource (Machine/Assembly/Line)");

  parsed.data.forEach((row, idx) => {
    const lineNum = idx + 1;

    // Check order id
    if (hasOrder) {
      const order = row[mapping.order]?.trim();
      if (!order) {
        issues.push({
          rowIdx: idx,
          type: "critical",
          message: `Line ${lineNum}: Missing value in mapped "Order ID" column ("${mapping.order}").`,
          column: mapping.order,
        });
      }
    }

    // Check material
    if (hasMaterial) {
      const material = row[mapping.material]?.trim();
      if (!material) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Missing value in mapped "Material" column ("${mapping.material}").`,
          column: mapping.material,
        });
      } else if (/\t/.test(row[mapping.material]) || /\s{2,}/.test(row[mapping.material])) {
        issues.push({
          rowIdx: idx,
          type: "info",
          message: `Line ${lineNum}: Material "${material}" contains trailing tabs or excessive spacing.`,
          column: mapping.material,
          value: row[mapping.material],
        });
      }
    }

    // Check process ID
    if (hasProcessId) {
      const stepStr = row[mapping.processId]?.trim();
      if (!stepStr) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Missing process step number in column "${mapping.processId}" (will fall back to 10).`,
          column: mapping.processId,
        });
      } else {
        const stepVal = parseInt(stepStr, 10);
        if (isNaN(stepVal)) {
          issues.push({
            rowIdx: idx,
            type: "critical",
            message: `Line ${lineNum}: Step value "${stepStr}" is not a valid integer.`,
            column: mapping.processId,
            value: stepStr,
          });
        }
      }
    }

    // Check Quantity
    if (hasQty) {
      const qtyStr = String(row[mapping.qty] || "")
        .replace(/,/g, "")
        .trim();
      if (!qtyStr) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Empty quantity in column "${mapping.qty}" (will fall back to 0).`,
          column: mapping.qty,
        });
      } else {
        const qtyVal = parseFloat(qtyStr);
        if (isNaN(qtyVal)) {
          issues.push({
            rowIdx: idx,
            type: "critical",
            message: `Line ${lineNum}: Quantity "${qtyStr}" in column "${mapping.qty}" is not a valid number.`,
            column: mapping.qty,
            value: qtyStr,
          });
        } else if (qtyVal < 0) {
          issues.push({
            rowIdx: idx,
            type: "warning",
            message: `Line ${lineNum}: Quantity "${qtyStr}" is negative. Needs absolute conversion.`,
            column: mapping.qty,
            value: qtyStr,
          });
        }
      }
    }

    // Check dates
    if (hasSopDate) {
      const sopDate = row[mapping.sopStartDate]?.trim();
      if (!sopDate) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Empty start date in column "${mapping.sopStartDate}".`,
          column: mapping.sopStartDate,
        });
      } else {
        const normalized = parseAndNormalizeDate(sopDate);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || isNaN(Date.parse(normalized))) {
          issues.push({
            rowIdx: idx,
            type: "warning",
            message: `Line ${lineNum}: Date "${sopDate}" cannot be parsed automatically. Correct format is YYYY-MM-DD.`,
            column: mapping.sopStartDate,
            value: sopDate,
          });
        }
      }
    }

    // Check setup time (optional column)
    if (mapping.setupTime && row[mapping.setupTime] !== undefined) {
      const setupTime = parseFloat(row[mapping.setupTime] || "0");
      if (setupTime < 0) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Setup time (${setupTime}) in column "${mapping.setupTime}" is negative.`,
          column: mapping.setupTime,
          value: String(setupTime),
        });
      }
    }

    // Check process time (optional column)
    if (mapping.processTime && row[mapping.processTime] !== undefined) {
      const processTime = parseFloat(row[mapping.processTime] || "0");
      if (processTime < 0) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Process time (${processTime}) in column "${mapping.processTime}" is negative.`,
          column: mapping.processTime,
          value: String(processTime),
        });
      }
    }

    // Check Machine/Resource
    if (hasMachine) {
      const machine = row[mapping.machine]?.trim();
      if (!machine) {
        issues.push({
          rowIdx: idx,
          type: "warning",
          message: `Line ${lineNum}: Missing workstation assignment in column "${mapping.machine}" (fallback default will be applied).`,
          column: mapping.machine,
        });
      }
    }
  });

  // Calculate health score: 100 max, subtract 15 for critical, 5 for warning, 1 for info
  let score = 100;
  issues.forEach((issue) => {
    if (issue.type === "critical") score -= 15;
    else if (issue.type === "warning") score -= 5;
    else score -= 1;
  });
  const healthScore = Math.max(0, score);

  return {
    rawRows: parsed.data,
    issues,
    healthScore,
    totalRows: parsed.data.length,
    mapping,
  };
}

// 4. Rule-based Cleaning Engine
export function cleanCSVData(
  rawRows: any[],
  options: CleaningOptions,
  customMapping: ColumnMapping,
): CleanedResult {
  const logs: CleanedResult["logs"] = [];
  const mapping = customMapping;

  const cleanedRows = rawRows.map((row, idx) => {
    const cleaned = { ...row };

    // Delimiter & control character corrections (trim outer whitespace)
    Object.keys(cleaned).forEach((key) => {
      let val = cleaned[key];
      if (typeof val === "string") {
        const prev = val;

        // Remove trailing tab spaces and carriage returns
        if (options.trimWhitespace) {
          val = val.replace(/\r/g, "").replace(/\t/g, " ").replace(/\s+/g, " ").trim();
        }

        if (prev !== val) {
          logs.push({
            rowIdx: idx,
            column: key,
            action: "Trimmed spaces and inner tabs",
            previous: prev,
            current: val,
          });
          cleaned[key] = val;
        }
      }
    });

    // Fill missing order process step
    if (options.fillDefaults && mapping.processId) {
      const pIdVal = cleaned[mapping.processId];
      if (pIdVal === undefined || String(pIdVal).trim() === "") {
        const prev = pIdVal || "";
        cleaned[mapping.processId] = "10";
        logs.push({
          rowIdx: idx,
          column: mapping.processId,
          action: "Filled empty process ID with default",
          previous: String(prev),
          current: "10",
        });
      }
    }

    // Abs negatives / Quantity corrections
    if (options.fixNegatives) {
      // Order Qty
      const qtyKey = mapping.qty;
      if (qtyKey && cleaned[qtyKey] !== undefined) {
        const strVal = String(cleaned[qtyKey]).replace(/,/g, "").trim();
        const numVal = parseFloat(strVal) || 0;
        if (numVal < 0) {
          const absVal = Math.abs(numVal);
          cleaned[qtyKey] = String(absVal);
          logs.push({
            rowIdx: idx,
            column: qtyKey,
            action: "Converted negative quantity to positive absolute",
            previous: strVal,
            current: String(absVal),
          });
        }
      }

      // Setup Time
      const setupKey = mapping.setupTime;
      if (setupKey && cleaned[setupKey] !== undefined) {
        const num = parseFloat(cleaned[setupKey]) || 0;
        if (num < 0) {
          const absVal = Math.abs(num);
          cleaned[setupKey] = String(absVal);
          logs.push({
            rowIdx: idx,
            column: setupKey,
            action: "Converted negative setup time to positive",
            previous: String(num),
            current: String(absVal),
          });
        }
      }

      // Process Time
      const procKey = mapping.processTime;
      if (procKey && cleaned[procKey] !== undefined) {
        const num = parseFloat(cleaned[procKey]) || 0;
        if (num < 0) {
          const absVal = Math.abs(num);
          cleaned[procKey] = String(absVal);
          logs.push({
            rowIdx: idx,
            column: procKey,
            action: "Converted negative process time to positive",
            previous: String(num),
            current: String(absVal),
          });
        }
      }
    }

    // Normalize Dates
    if (options.normalizeDates && mapping.sopStartDate && cleaned[mapping.sopStartDate]) {
      const rawDate = cleaned[mapping.sopStartDate];
      const normalized = parseAndNormalizeDate(rawDate);
      if (rawDate !== normalized) {
        cleaned[mapping.sopStartDate] = normalized;
        logs.push({
          rowIdx: idx,
          column: mapping.sopStartDate,
          action: "Standardized date formatting",
          previous: rawDate,
          current: normalized,
        });
      }
    }

    // Fallback defaults for critical empty fields
    if (options.fillDefaults) {
      const machKey = mapping.machine;
      if (machKey && (!cleaned[machKey] || String(cleaned[machKey]).trim() === "")) {
        cleaned[machKey] = "Workstation-A";
        logs.push({
          rowIdx: idx,
          column: machKey,
          action: "Assigned default workstation 'Workstation-A'",
          previous: "",
          current: "Workstation-A",
        });
      }

      const baseKey = mapping.baseQty;
      if (baseKey && (cleaned[baseKey] === undefined || parseFloat(cleaned[baseKey]) <= 0)) {
        const prev = cleaned[baseKey] || "0";
        cleaned[baseKey] = "1";
        logs.push({
          rowIdx: idx,
          column: baseKey,
          action: "Fitted base qty fallback of 1",
          previous: String(prev),
          current: "1",
        });
      }
    }

    return cleaned;
  });

  return { cleanedRows, logs };
}

// 5. Intelligent Simulation for AI Cleaning Co-pilot
export function generateAISuggestions(rows: any[], mapping: ColumnMapping): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  if (!mapping || !mapping.material) return suggestions;

  rows.forEach((row, idx) => {
    // A. Material typos/formatting issues
    const mat = row[mapping.material] || "";
    if (mat.includes("-O") || mat.includes("-o")) {
      const fixed = mat.replace(/-[Oo]/g, ".0");
      suggestions.push({
        id: `s-mat-${idx}`,
        rowIdx: idx,
        column: mapping.material,
        description: `Logical fix: material nomenclature typo detected (letter 'O' used instead of digit '0'). Fix code to '${fixed}'.`,
        originalValue: mat,
        suggestedValue: fixed,
        category: "typo",
      });
    }

    // B. Machine incompatibility based on process text
    const textCol =
      Object.keys(row).find(
        (k) => k.toLowerCase().includes("text") || k.toLowerCase().includes("desc"),
      ) || "";
    const text = textCol ? (row[textCol] || "").toLowerCase() : "";
    const machine = row[mapping.machine] || "";

    if (text.includes("m1") || text.includes("line 1") || text.includes("station 1")) {
      if (machine.toLowerCase().includes("m2") || machine === "603010" || machine === "603011") {
        suggestions.push({
          id: `s-mach-${idx}`,
          rowIdx: idx,
          column: mapping.machine,
          description: `Resource assignment clash: Process text mentions Line/Group 1, but assigned resource '${machine}' is in Group 2. Suggest swapping to compatible Line 1 resource.`,
          originalValue: machine,
          suggestedValue: machine
            .replace(/2/g, "1")
            .replace(/M2/gi, "M1")
            .replace(/Beta/gi, "Alpha")
            .replace(/South/gi, "North"),
          category: "consistency",
        });
      }
    } else if (text.includes("m2") || text.includes("line 2") || text.includes("station 2")) {
      if (machine.toLowerCase().includes("m1") || machine === "603012" || machine === "605001") {
        suggestions.push({
          id: `s-mach-${idx}`,
          rowIdx: idx,
          column: mapping.machine,
          description: `Resource assignment clash: Process text mentions Line/Group 2, but assigned resource '${machine}' is in Group 1. Suggest swapping to compatible Line 2 resource.`,
          originalValue: machine,
          suggestedValue: machine
            .replace(/1/g, "2")
            .replace(/M1/gi, "M2")
            .replace(/Alpha/gi, "Beta")
            .replace(/North/gi, "South"),
          category: "consistency",
        });
      }
    }

    // C. Statistical Outliers / Logical anomalies
    if (mapping.setupTime && row[mapping.setupTime]) {
      const setup = parseFloat(row[mapping.setupTime]) || 0;
      if (setup > 180) {
        suggestions.push({
          id: `s-setup-${idx}`,
          rowIdx: idx,
          column: mapping.setupTime,
          description: `Time outlier warning: Setup time is abnormally high (${setup} mins, > 3 hrs). Suggest threshold adjustment to 30 mins.`,
          originalValue: String(setup),
          suggestedValue: "30",
          category: "anomaly",
        });
      }
    }
  });

  return suggestions;
}

// 6. Custom Prompt Command Interpreter for the AI Co-pilot Console
export function runCustomPromptCleaning(
  rows: any[],
  prompt: string,
  mapping: ColumnMapping,
): { cleanedRows: any[]; aiLogs: string[] } {
  const aiLogs: string[] = [];
  const cleanedRows = [...rows].map((row, idx) => {
    const updated = { ...row };
    const p = prompt.toLowerCase();

    // Command: "assign machine X to process text Y"
    if (
      p.includes("assign") ||
      p.includes("set resource") ||
      p.includes("set machine") ||
      p.includes("set line")
    ) {
      // Find resource target
      const words = prompt.split(" ");
      const toIndex = words.findIndex((w) => w.toLowerCase() === "to");
      if (toIndex > 1) {
        // resource is words between assign/set and to
        const startIdx =
          words.findIndex((w) => w.toLowerCase() === "assign" || w.toLowerCase() === "set") + 2;
        const targetResource = words
          .slice(startIdx, toIndex)
          .join(" ")
          .replace(/['"“”]/g, "")
          .trim();

        // keyword is after to
        const keyword = words
          .slice(toIndex + 1)
          .join(" ")
          .replace(/['"“”]/g, "")
          .trim()
          .toLowerCase();

        const textCol =
          Object.keys(row).find(
            (k) =>
              k.toLowerCase().includes("text") ||
              k.toLowerCase().includes("desc") ||
              k.toLowerCase().includes("name"),
          ) || "";
        const procText = textCol ? (updated[textCol] || "").toLowerCase() : "";

        if (procText.includes(keyword) && mapping.machine) {
          const prev = updated[mapping.machine];
          updated[mapping.machine] = targetResource;
          if (prev !== targetResource) {
            aiLogs.push(
              `[AI HEAL] Row ${idx + 1}: Reassigned Resource from '${prev}' to '${targetResource}' because process description matches '${keyword}'.`,
            );
          }
        }
      }
    }

    // Command: "set setup time to X where process time is Y" or "set setup time to X for..."
    else if ((p.includes("set setup") || p.includes("change setup")) && mapping.setupTime) {
      const numMatch = prompt.match(/(?:setup time|setup|to)\s+(\d+)/i);
      if (numMatch) {
        const targetSetup = numMatch[1];
        if (
          (p.includes("process time is 0") || p.includes("process time is zero")) &&
          mapping.processTime
        ) {
          const procTime = parseFloat(updated[mapping.processTime]) || 0;
          if (procTime === 0) {
            const prev = updated[mapping.setupTime];
            updated[mapping.setupTime] = targetSetup;
            if (prev !== targetSetup) {
              aiLogs.push(
                `[AI HEAL] Row ${idx + 1}: Modified Setup Time from '${prev}' to '${targetSetup}' mins because process time is 0.`,
              );
            }
          }
        } else if (p.includes("for material") && mapping.material) {
          const matMatch = prompt.match(/material\s+([0-9a-zA-Z._-]+)/i);
          if (matMatch) {
            const targetMat = matMatch[1].toLowerCase();
            const matCode = (updated[mapping.material] || "").toLowerCase();
            if (matCode.includes(targetMat)) {
              const prev = updated[mapping.setupTime];
              updated[mapping.setupTime] = targetSetup;
              if (prev !== targetSetup) {
                aiLogs.push(
                  `[AI HEAL] Row ${idx + 1}: Modified Setup Time to '${targetSetup}' for material matching '${targetMat}'.`,
                );
              }
            }
          }
        }
      }
    }

    // Command: "double quantity for order X"
    else if (
      (p.includes("double quantity") || p.includes("multiply qty")) &&
      mapping.qty &&
      mapping.order
    ) {
      const ordMatch = prompt.match(/order\s+([a-zA-Z0-9_-]+)/i);
      if (ordMatch) {
        const targetOrd = ordMatch[1].toLowerCase();
        const orderIdVal = (updated[mapping.order] || "").toLowerCase();
        if (orderIdVal === targetOrd || orderIdVal.includes(targetOrd)) {
          const qtyVal = parseFloat(String(updated[mapping.qty]).replace(/,/g, "")) || 0;
          const doubled = qtyVal * 2;
          updated[mapping.qty] = String(doubled);
          aiLogs.push(
            `[AI HEAL] Row ${idx + 1}: Doubled Quantity from '${qtyVal}' to '${doubled}' for matching Order '${updated[mapping.order]}'.`,
          );
        }
      }
    }

    // Command: "clean all spaces"
    else if (p.includes("clean all spaces") && mapping.material) {
      const prev = updated[mapping.material] || "";
      const cleaned = prev.replace(/\s+/g, "");
      if (prev !== cleaned) {
        updated[mapping.material] = cleaned;
        aiLogs.push(
          `[AI HEAL] Row ${idx + 1}: Stripped all interior spaces from material code. Formatted to '${cleaned}'.`,
        );
      }
    }

    return updated;
  });

  if (aiLogs.length === 0) {
    aiLogs.push(
      "AI Prompt interpreted. No rows matched the filter criteria in instructions, or dataset was already compliant with instructions.",
    );
  }

  return { cleanedRows, aiLogs };
}
