import Papa from "papaparse";
import { Order, OrderProcess, OrderPriority } from "./types";
import { parseSOPDate } from "./scheduler";

export interface ParsedCsvResult {
  orders: Order[];
  processes: OrderProcess[];
}

interface RawCsvRow {
  [key: string]: string | undefined;
  Order?: string;
  Material?: string;
  "Order Process ID"?: string;
  "Order QTY"?: string;
  "SOP Start Date"?: string;
  "SOP Start time"?: string;
  Priority?: string;
  "Order Priority"?: string;
  Priorität?: string;
  Prio?: string;
  "Base-Qty each process"?: string;
  "Set up Time (Not related to any qty)"?: string;
  "Process time (related to qty)"?: string;
  "Manpwer Utilization"?: string;
  "Manpower Utilization"?: string;
  Machine?: string;
  "Process Text"?: string;
}

interface BatchAggregation {
  orderCode: string;
  material: string;
  step: number;
  orderQty: number;
  sopStartDate: string;
  sopStartTime: string;
  machineId: string;
  processText: string;
  baseQty: number;
  setupTimeMin: number;
  processTimeMin: number;
  manpowerUtilizationMin: number;
  priority: OrderPriority;
}

/**
 * Parses raw CSV content (either direct string or object envelope) into domain Orders and Processes.
 */
export function parseCSVData(csvInput: unknown): ParsedCsvResult {
  let text = "";
  if (typeof csvInput === "string") {
    text = csvInput;
  } else if (csvInput && typeof csvInput === "object") {
    const obj = csvInput as Record<string, unknown>;
    text = String(obj.data || obj.default || obj.text || JSON.stringify(csvInput));
  } else {
    text = String(csvInput || "");
  }

  // If double-encoded as a JSON string, unwrap it
  if (text.startsWith('"') && text.endsWith('"') && !text.includes("\n")) {
    try {
      text = JSON.parse(text);
    } catch {
      // Keep original text
    }
  }

  const parsed = Papa.parse<RawCsvRow>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const orders: Order[] = [];
  const processes: OrderProcess[] = [];
  const batchMap = new Map<string, BatchAggregation>();

  parsed.data.forEach((row) => {
    const orderCode = row["Order"]?.trim();
    const material = row["Material"]?.trim();
    const stepStr = row["Order Process ID"]?.trim();
    if (!orderCode || !material || !stepStr) return;

    const step = parseInt(stepStr, 10) || 10;
    const batchKey = `${orderCode}_${step}`;

    const qtyStr = String(row["Order QTY"] || "0").replace(/,/g, "");
    const qty = parseFloat(qtyStr) || 0;

    const sopDate = row["SOP Start Date"]?.trim() || "";
    const sopTime = row["SOP Start time"]?.trim() || "";

    const rawPriority = String(
      row["Priority"] || row["Order Priority"] || row["Priorität"] || row["Prio"] || "",
    )
      .trim()
      .toLowerCase();

    let priority: OrderPriority = "Med";
    if (rawPriority.includes("urg") || rawPriority.includes("dringend") || rawPriority === "1") {
      priority = "Urgent";
    } else if (
      rawPriority.includes("high") ||
      rawPriority.includes("hoch") ||
      rawPriority === "2"
    ) {
      priority = "High";
    } else if (
      rawPriority.includes("low") ||
      rawPriority.includes("niedrig") ||
      rawPriority === "4"
    ) {
      priority = "Low";
    } else if (
      rawPriority.includes("med") ||
      rawPriority.includes("mittel") ||
      rawPriority === "3"
    ) {
      priority = "Med";
    }

    const existing = batchMap.get(batchKey);
    if (existing) {
      existing.orderQty += qty;
      if (priority === "Urgent" || (priority === "High" && existing.priority !== "Urgent")) {
        existing.priority = priority;
      }

      // Update to earliest SOP date
      try {
        const d1 = parseSOPDate(existing.sopStartDate, existing.sopStartTime);
        const d2 = parseSOPDate(sopDate, sopTime);
        if (d2.getTime() < d1.getTime()) {
          existing.sopStartDate = sopDate;
          existing.sopStartTime = sopTime;
        }
      } catch {
        // Ignore date parsing failure
      }
    } else {
      const baseQty = parseFloat(row["Base-Qty each process"] || "1") || 1;
      const setupTimeMin = parseFloat(row["Set up Time (Not related to any qty)"] || "0") || 0;
      const processTimeMin = parseFloat(row["Process time (related to qty)"] || "0") || 0;
      const rawManpowerUtil = row["Manpwer Utilization"] || row["Manpower Utilization"] || "0";
      const manpowerUtilizationMin = parseFloat(String(rawManpowerUtil).replace(/,/g, "")) || 0;

      batchMap.set(batchKey, {
        orderCode,
        material,
        step,
        orderQty: qty,
        sopStartDate: sopDate,
        sopStartTime: sopTime,
        machineId: row["Machine"]?.trim() || "",
        processText: row["Process Text"]?.trim() || "",
        baseQty,
        setupTimeMin,
        processTimeMin,
        manpowerUtilizationMin,
        priority,
      });
    }
  });

  // Populate orders and processes
  batchMap.forEach((batch) => {
    const safeOrderCode = batch.orderCode.replace(/-/g, "_");
    const orderId = `ord-${safeOrderCode}_${batch.step}`;

    orders.push({
      id: orderId,
      orderId: batch.orderCode,
      material: batch.material,
      sopStartDate: batch.sopStartDate,
      sopStartTime: batch.sopStartTime,
      orderQty: batch.orderQty,
      priority: batch.priority,
    });

    const sumV2 = (batch.orderQty / batch.baseQty) * batch.processTimeMin;
    const sumV3 = batch.manpowerUtilizationMin * batch.baseQty * batch.orderQty;
    const manpowerPct =
      batch.processTimeMin > 0 ? batch.manpowerUtilizationMin / batch.processTimeMin : 0;
    const totalTimeMin = batch.setupTimeMin + sumV2;

    processes.push({
      id: `${orderId}-${batch.step}`,
      orderId,
      priority: batch.priority,
      processId: batch.step,
      machineId: batch.machineId,
      originalMachineId: batch.machineId,
      processText: batch.processText,
      baseQty: batch.baseQty,
      setupTimeMin: batch.setupTimeMin,
      processTimeMin: batch.processTimeMin,
      manpowerUtilizationMin: batch.manpowerUtilizationMin,
      sumV2,
      sumV3,
      totalTimeMin,
      manpowerPct,
      status: "UNSCHEDULED",
      scheduledStart: null,
      scheduledEnd: null,
    });
  });

  return { orders, processes };
}
