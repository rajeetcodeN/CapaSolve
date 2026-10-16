import { describe, it, expect } from "vitest";
import {
  detectCSVFormat,
  parseAndNormalizeDate,
  detectColumnMapping,
  validateCSVData,
} from "../dataCleaner";

describe("CapaSolve Data Cleaning & CSV Ingestion Engine", () => {
  describe("detectCSVFormat", () => {
    it("detects standard comma delimiter", () => {
      const csv = "Order,Material,Process ID\n1001,MAT-A,10\n1002,MAT-B,20";
      const format = detectCSVFormat(csv);
      expect(format.delimiter).toBe(",");
    });

    it("detects European / German SAP semicolon delimiter", () => {
      const csv =
        "Auftrag;Material;Vorgang;Arbeitsplatz\n1001;MAT-A;10;603011\n1002;MAT-B;20;603012";
      const format = detectCSVFormat(csv);
      expect(format.delimiter).toBe(";");
    });

    it("detects Tab separated TSV", () => {
      const tsv = "Order\tMaterial\tProcess ID\n1001\tMAT-A\t10\n1002\tMAT-B\t20";
      const format = detectCSVFormat(tsv);
      expect(format.delimiter).toBe("\t");
    });
  });

  describe("parseAndNormalizeDate", () => {
    it("handles standard ISO YYYY-MM-DD", () => {
      expect(parseAndNormalizeDate("2026-06-01")).toBe("2026-06-01");
    });

    it("normalizes German standard DD.MM.YYYY into ISO format", () => {
      expect(parseAndNormalizeDate("01.06.2026")).toBe("2026-06-01");
      expect(parseAndNormalizeDate("15.11.2026")).toBe("2026-11-15");
    });

    it("normalizes hyphenated DD-MM-YYYY dates", () => {
      expect(parseAndNormalizeDate("25-12-2026")).toBe("2026-12-25");
    });
  });

  describe("detectColumnMapping", () => {
    it("auto-detects German SAP PP column headers", () => {
      const germanHeaders = [
        "Auftrag",
        "Material",
        "Vorgang",
        "Menge",
        "Starttermin",
        "Arbeitsplatz",
        "Rüstzeit",
        "Bearbeitungszeit",
        "Basis",
        "Bediener",
      ];

      const mapping = detectColumnMapping(germanHeaders);
      expect(mapping.order).toBe("Auftrag");
      expect(mapping.material).toBe("Material");
      expect(mapping.processId).toBe("Vorgang");
      expect(mapping.machine).toBe("Arbeitsplatz");
    });

    it("auto-detects English manufacturing headers", () => {
      const englishHeaders = [
        "Order ID",
        "Part Number",
        "Step No",
        "Quantity",
        "SOP Date",
        "Machine ID",
        "Setup Time",
        "Process Time",
        "Base Qty",
        "Manpower %",
      ];

      const mapping = detectColumnMapping(englishHeaders);
      expect(mapping.order).toBe("Order ID");
      expect(mapping.material).toBe("Part Number");
      expect(mapping.processId).toBe("Step No");
      expect(mapping.machine).toBe("Machine ID");
    });
  });

  describe("validateCSVData", () => {
    it("validates a compliant CSV and reports zero critical issues", () => {
      const validCsv = `Order,Material,Process ID,Quantity,SOP Start Date,Resource,Setup Time,Process Time,Base-Qty,Manpower
1001,SKU-A,10,50,2026-06-01,M1,30,60,1,100%
1001,SKU-A,20,50,2026-06-01,M2,15,45,1,100%`;

      const validation = validateCSVData(validCsv, ",");
      const criticalIssues = validation.issues.filter((i) => i.type === "critical");
      expect(criticalIssues.length).toBe(0);
    });

    it("detects missing critical required columns", () => {
      const brokenCsv = `SomeRandomCol,AnotherCol\nValue1,Value2`;
      const validation = validateCSVData(brokenCsv, ",");
      const criticalIssues = validation.issues.filter((i) => i.type === "critical");
      expect(criticalIssues.length).toBeGreaterThan(0);
    });
  });
});
