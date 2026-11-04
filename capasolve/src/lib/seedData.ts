import { Machine, MachineGroup, MaterialInventoryItem } from "./types";

export const DEFAULT_MATERIALS_INVENTORY: MaterialInventoryItem[] = [
  {
    sku: "100-024-830.01-00",
    description: "Cold Rolled Steel Bar 45mm x 3000mm",
    availableQty: 1500,
    reservedQty: 320,
    leadTimeDays: 3,
    unit: "pcs",
  },
  {
    sku: "100-024-830.02-00",
    description: "Aluminum Alloy Billet 6061-T6",
    availableQty: 450,
    reservedQty: 420,
    leadTimeDays: 5,
    unit: "pcs",
  },
  {
    sku: "100-024-830.03-00",
    description: "Titanium Grade 5 Round Stock",
    availableQty: 0,
    reservedQty: 180,
    leadTimeDays: 14,
    unit: "pcs",
  },
  {
    sku: "100-024-830.04-00",
    description: "Brass Hex Bar 32mm CuZn39Pb3",
    availableQty: 850,
    reservedQty: 200,
    leadTimeDays: 4,
    unit: "pcs",
  },
  {
    sku: "RAW-STEE-01",
    description: "Stainless Steel Rod 50mm",
    availableQty: 1200,
    reservedQty: 850,
    leadTimeDays: 3,
    unit: "pcs",
  },
  {
    sku: "RAW-ALUM-02",
    description: "Aluminum Extrusion Bar 20mm",
    availableQty: 40,
    reservedQty: 50,
    leadTimeDays: 7,
    unit: "pcs",
  },
  {
    sku: "RAW-PLAS-03",
    description: "ABS Polymer Resin Beads 25kg",
    availableQty: 2500,
    reservedQty: 1000,
    leadTimeDays: 2,
    unit: "pcs",
  },
];

// Seed static machine data matching Excel screenshots and CSV
export const SEED_GROUPS: MachineGroup[] = [
  { id: "M1", name: "M1" },
  { id: "M2", name: "M2" },
];

export const SEED_MACHINES: Machine[] = [
  { id: "603012", name: "603012", machineGroupId: "M1" },
  { id: "605001", name: "605001", machineGroupId: "M1" },
  { id: "603010", name: "603010", machineGroupId: "M2" },
  { id: "603011", name: "603011", machineGroupId: "M2" },
];
