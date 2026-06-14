import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import JSZip from "jszip";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import Papa from "papaparse";
import * as turf from "@turf/turf";
import { createApprovedScopePackage } from "./core/iof";
import { createBaseline, listBaselines, loadBaseline } from "./api/baselines";
import { createBaselineGraph } from "./api/baselineGraphs";
import {
  buildBaselineGraph,
  buildBaselineGraphFromGeoJSON,
  extractLineStringsRecursive,
  generateGraphStations,
} from "./types/fiberlightBeta";
import {
  getIngestionJob,
  LARGE_DATASET_THRESHOLD_BYTES,
  startIngestion,
  uploadRawDataset,
  type IngestionJob,
  type LargeDatasetStatus,
} from "./api/ingestion";
import { CHICAGO_API, IOF_API } from "./config/api";
import type { BaselineGraph, DatasetType, OpportunityBatch, StoredBaselineMetadata } from "./types/fiberlightBeta";

console.log("BASELINE GRAPH BUILDER IMPORTED", typeof buildBaselineGraph);

type LonLat = [number, number];

type UploadedSitesRow = {
  name?: string;
  lat: number;
  lon: number;
  order?: number;
};

type RouteRole = "longhaul" | "middlemile" | "metro";

type NetworkDesignType =
  | "ACCESS"
  | "METRO"
  | "DCI"
  | "MIDDLE_MILE"
  | "LONGHAUL"
  | "HYPERSCALER_BACKBONE"
  | "GPU_CLUSTER_INTERCONNECT";

type ProductType =
  | "DARK_FIBER"
  | "LIT_WAVELENGTH"
  | "ETHERNET"
  | "DCI_TRANSPORT"
  | "IP_TRANSIT"
  | "GPU_FABRIC";

type DiversityModel =
  | "LINEAR"
  | "SAME_ROUTE_REDUNDANT_DUCT"
  | "DIVERSE_PATH"
  | "METRO_RING"
  | "DUAL_HOMED"
  | "PROTECTED_DCI"
  | "LONGHAUL_DIVERSE";

type DemandType =
  | "Enterprise"
  | "Tower"
  | "Data Center"
  | "Hyperscaler"
  | "GPU / AI Cluster"
  | "Wholesale carrier"
  | "Residential / FTTH"
  | "School / SLD"
  | "Healthcare / Government";

type DuctConfig =
  | "1x1.25"
  | "2x1.25"
  | "3x1.25"
  | "4x1.25"
  | "1x1.5"
  | "2x1.5"
  | "3x1.5"
  | "4x1.5"
  | "custom";

type FiberCountOption = "48" | "96" | "144" | "288" | "432" | "864" | "custom";

type UndergroundMix = {
  plowPct: number;
  trenchPct: number;
  hddPct: number;
  rockTrenchPct: number;
  rockBorePct: number;
};

type RouteMix = {
  undergroundPct: number;
  aerialPct: number;
  existingConduitPct: number;
};

type TranslateBudgetAssumptions = Partial<{
  riskPercent: number;
  marginPercent: number;
  engineeringPerFt: number;
  permittingPerFt: number;
  mobilization: number;
  pmOverheadPercent: number;
  insurancePercent: number;
  qcPercent: number;
  materialsEscalationPercent: number;
}>;

type NormalizedPreview = {
  customerName?: string;
  projectName?: string;
  inferredRole?: RouteRole;
  inferredNetworkType?: NetworkDesignType;
  inferredProductType?: ProductType;
  routeCoords?: LonLat[];
  sites?: UploadedSitesRow[];
  constraints?: string[];
  budgetAssumptions?: TranslateBudgetAssumptions;
  productHints?: string[];
  notes?: string;
  serverBaselineId?: string;
  serverBaselineScopeVersionId?: string;
  largeDatasetMode?: boolean;
};

type LineItem = {
  id: string;
  label: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  amount: number;
  notes?: string;
};

type DemandSet = {
  id: string;
  type: DemandType;
  expectedMrc: number;
  nrc: number;
  termMonths: number;
  probability: number;
  buildCost: number;
  requiredDiversity: DiversityModel;
  requiredBandwidth: string;
  requiredClassOfService: string;
  routeDependency: string;
};

type EngineeringPreset = {
  role: RouteRole;
  stationSpacingFt: number;
  defaultDiversity: DiversityModel;
  routeMix: RouteMix;
  undergroundMix: UndergroundMix;
  handholeSpacingFt: number;
  vaultSpacingFt: number;
  ductConfig: DuctConfig;
  fiberCount: FiberCountOption;
  engineeringPerFt: number;
  permittingPerFt: number;
  spanMiles: number;
  popCount: number;
  aggCount: number;
  buildingEntranceCount: number;
  ispRequired: boolean;
  dciHandoffCount: number;
  accessHandoffCount: number;
  restorationFactor: number;
  securityFactor: number;
  expansionReservePct: number;
  warning: string;
};

type CivilCostModel = {
  inputRouteFeet: number;
  undergroundFeet: number;
  aerialFeet: number;
  existingConduitFeet: number;
  undergroundMix: UndergroundMix;
  routeMix: RouteMix;
  undergroundCivilLabor: number;
  aerialLabor: number;
  existingConduitLabor: number;
  restoration: number;
  makeReady: number;
  crossings: number;
  directCivilLabor: number;
  routeCivilSubtotal: number;
  civilCostPerFoot: number;
  weightedCivilPerFt: number;
  civilLineItems: LineItem[];
  warnings: string[];
};

type BomModel = {
  ductCount: number;
  ductDiameterIn: number;
  fiberCount: number;
  materialSubtotal: number;
  materialEscalation: number;
  materialsEscalated: number;
  materialIncludedInBid: boolean;
  materialCostPerFoot: number;
  transportEquipment: number;
  bomLineItems: LineItem[];
  materialBreakdown: {
    conduit: number;
    innerduct: number;
    fiber: number;
    tracer: number;
    handholes: number;
    vaults: number;
    spliceClosures: number;
    restoration: number;
  };
};

type NodeType =
  | "POP"
  | "AGG"
  | "REGEN"
  | "ILA"
  | "DCI_HANDOFF"
  | "ACCESS_HANDOFF"
  | "GPU_MICRO"
  | "GPU_POD";

type NodeCounts = Record<NodeType, number>;

type NodeInfrastructureModel = {
  nodeLineItems: LineItem[];
  opexLineItems: LineItem[];
  nodeCapex: number;
  nodeMonthlyOpex: number;
  regenCount: number;
  ilaCount: number;
  popCount: number;
  aggCount: number;
  gpuCandidateCount: number;
  powerReadinessScore: number;
  realEstateReadinessScore: number;
  counts: NodeCounts;
  warnings: string[];
};

type DesignFinancialModel = {
  routeFeet: number;
  routeMiles: number;
  primaryRouteFeet: number;
  diverseRouteFeet: number;
  totalBillableFeet: number;
  civilSubtotal: number;
  materialSubtotal: number;
  nodeCapex: number;
  transportEquipment: number;
  engineering: number;
  permitting: number;
  splicing: number;
  buildingEntrance: number;
  isp: number;
  mobilization: number;
  programManagement: number;
  insurance: number;
  qc: number;
  contingency: number;
  riskedCost: number;
  margin: number;
  totalBid: number;
  monthlyRecovery36: number;
  monthlyRecovery60: number;
  monthlyRecovery120: number;
  monthlyOpex: number;
  totalMonthlyChargeSuggested: number;
  costPerFoot: number;
  costPerMile: number;
  capexPerRouteMile: number;
  bomLineItems: LineItem[];
  civilLineItems: LineItem[];
  nodeLineItems: LineItem[];
  opexLineItems: LineItem[];
  budgetLineItems: LineItem[];
  warnings: string[];
  assumptions: string[];

  directCivilLabor: number;
  materialsBase: number;
  materialsEscalated: number;
  materialsIncludedInBid: boolean;
  crossings: number;
  nodes: number;
  program: number;
  subtotal: number;
  recovery60: number;
  recovery120: number;
  weightedCivilPerFt: number;
  ductCount: number;
  ductDiameterIn: number;
  regenSites: number;
  popSites: number;
  aggSites: number;
  materialBreakdown: BomModel["materialBreakdown"];
};

type AdjacencyInputs = {
  hyperscalerProximity: number;
  latencyBand: number;
  powerAvailability: number;
  routeCohesion: number;
  capitalEfficiencyDelta: number;
};

type DeploymentType = "Transport" | "Regen" | "ILA" | "GPU Micro" | "GPU POD";

type SVANode = {
  id: string;
  type: NodeType;
  km: number;
  mi: number;
  coord: LonLat;
};

type SVASegment = {
  id: string;
  a: SVANode;
  b: SVANode;
  lengthMi: number;
  midCoord: LonLat;
  score: number;
};

type DesignModeProps = {
  corridorId: string;
  segmentId: string;
  scopeVersionId: string | null;
  setScopeVersionId: (id: string) => void;
  routeCoords: LonLat[] | null;
  setRouteCoords: Dispatch<SetStateAction<LonLat[] | null>>;
  sites: UploadedSitesRow[];
  setSites: (sites: UploadedSitesRow[]) => void;
  designStations: DesignStation[];
  setDesignStations: (stations: DesignStation[]) => void;
  opportunityBatch?: OpportunityBatch | null;
};

type DesignStation = {
  stationId: string;
  station: string;
  lat: number;
  lon: number;
  feet?: number;
  status?: string;
};

type LargeDatasetDiagnostics = {
  mode: "Small File Mode" | "Large Dataset Mode";
  apiTarget: string;
  uploadId?: string;
  jobId?: string;
  rowsRead?: number;
  pointsAccepted?: number;
  rowsRejected?: number;
  progressPct?: number;
  baselineId?: string;
  status: LargeDatasetStatus | "Idle";
  message?: string;
};

const NETWORK_LABELS: Record<NetworkDesignType, string> = {
  ACCESS: "Access",
  METRO: "Metro",
  DCI: "DCI",
  MIDDLE_MILE: "Middle Mile",
  LONGHAUL: "Longhaul",
  HYPERSCALER_BACKBONE: "Hyperscaler Backbone",
  GPU_CLUSTER_INTERCONNECT: "GPU Cluster Interconnect",
};

const PRODUCT_LABELS: Record<ProductType, string> = {
  DARK_FIBER: "Dark Fiber",
  LIT_WAVELENGTH: "Lit Wavelength",
  ETHERNET: "Ethernet",
  DCI_TRANSPORT: "DCI Transport",
  IP_TRANSIT: "IP Transit",
  GPU_FABRIC: "GPU Fabric",
};

const DIVERSITY_LABELS: Record<DiversityModel, string> = {
  LINEAR: "Linear",
  SAME_ROUTE_REDUNDANT_DUCT: "Same-route redundant duct",
  DIVERSE_PATH: "Diverse path",
  METRO_RING: "Metro ring",
  DUAL_HOMED: "Dual-homed",
  PROTECTED_DCI: "Protected DCI",
  LONGHAUL_DIVERSE: "Longhaul diverse",
};

const DEFAULT_WEIGHTS = {
  hyperscalerProximity: 0.25,
  latencyBand: 0.15,
  powerAvailability: 0.2,
  routeCohesion: 0.15,
  capitalEfficiencyDelta: 0.25,
};

const CIVIL_UNIT_COST = {
  plow: 4.75,
  trench: 14.75,
  hdd: 22,
  rockTrench: 35,
  rockBore: 68,
  aerialStrand: 5.25,
  aerialLash: 3.1,
  overlash: 1.85,
  pullExisting: 2.65,
  urbanRestoration: 7.5,
  ruralRestoration: 1.4,
  makeReady: 1850,
  poleTransfer: 650,
  bridgeAttachment: 55000,
};

const CROSSING_UNIT_COST = {
  road: 25000,
  rail: 150000,
  water: 100000,
  bridge: 55000,
};

const NODE_UNIT_DEFAULTS: Record<NodeType, { capex: number; monthlyOpex: number }> = {
  POP: { capex: 250000, monthlyOpex: 4500 },
  AGG: { capex: 150000, monthlyOpex: 2500 },
  REGEN: { capex: 320000, monthlyOpex: 5500 },
  ILA: { capex: 210000, monthlyOpex: 4200 },
  DCI_HANDOFF: { capex: 90000, monthlyOpex: 3000 },
  ACCESS_HANDOFF: { capex: 28000, monthlyOpex: 650 },
  GPU_MICRO: { capex: 575000, monthlyOpex: 14000 },
  GPU_POD: { capex: 2200000, monthlyOpex: 45000 },
};

const NETWORK_PRESETS: Record<NetworkDesignType, EngineeringPreset> = {
  ACCESS: {
    role: "metro",
    stationSpacingFt: 750,
    defaultDiversity: "LINEAR",
    routeMix: { undergroundPct: 80, aerialPct: 10, existingConduitPct: 10 },
    undergroundMix: { plowPct: 10, trenchPct: 30, hddPct: 45, rockTrenchPct: 10, rockBorePct: 5 },
    handholeSpacingFt: 1000,
    vaultSpacingFt: 8000,
    ductConfig: "2x1.25",
    fiberCount: "96",
    engineeringPerFt: 2.25,
    permittingPerFt: 1.65,
    spanMiles: 999,
    popCount: 0,
    aggCount: 0,
    buildingEntranceCount: 1,
    ispRequired: true,
    dciHandoffCount: 0,
    accessHandoffCount: 2,
    restorationFactor: 1.25,
    securityFactor: 1,
    expansionReservePct: 10,
    warning: "Access assumes building entry, ISP handoff, and lateral cost sensitivity.",
  },
  METRO: {
    role: "metro",
    stationSpacingFt: 1500,
    defaultDiversity: "METRO_RING",
    routeMix: { undergroundPct: 90, aerialPct: 5, existingConduitPct: 5 },
    undergroundMix: { plowPct: 15, trenchPct: 35, hddPct: 30, rockTrenchPct: 12, rockBorePct: 8 },
    handholeSpacingFt: 1500,
    vaultSpacingFt: 6000,
    ductConfig: "3x1.25",
    fiberCount: "288",
    engineeringPerFt: 2,
    permittingPerFt: 1.5,
    spanMiles: 999,
    popCount: 2,
    aggCount: 2,
    buildingEntranceCount: 0,
    ispRequired: false,
    dciHandoffCount: 0,
    accessHandoffCount: 0,
    restorationFactor: 1.35,
    securityFactor: 1.05,
    expansionReservePct: 15,
    warning: "Metro assumes congested restoration, denser handholes, and protected path preference.",
  },
  DCI: {
    role: "metro",
    stationSpacingFt: 1000,
    defaultDiversity: "PROTECTED_DCI",
    routeMix: { undergroundPct: 88, aerialPct: 2, existingConduitPct: 10 },
    undergroundMix: { plowPct: 5, trenchPct: 25, hddPct: 45, rockTrenchPct: 15, rockBorePct: 10 },
    handholeSpacingFt: 1500,
    vaultSpacingFt: 5000,
    ductConfig: "4x1.25",
    fiberCount: "432",
    engineeringPerFt: 2.15,
    permittingPerFt: 1.45,
    spanMiles: 999,
    popCount: 0,
    aggCount: 0,
    buildingEntranceCount: 2,
    ispRequired: true,
    dciHandoffCount: 2,
    accessHandoffCount: 0,
    restorationFactor: 1.35,
    securityFactor: 1.1,
    expansionReservePct: 20,
    warning: "DCI assumes data center entry, meet-me room work, slack discipline, and dual entrance preference.",
  },
  MIDDLE_MILE: {
    role: "middlemile",
    stationSpacingFt: 3000,
    defaultDiversity: "DIVERSE_PATH",
    routeMix: { undergroundPct: 92, aerialPct: 5, existingConduitPct: 3 },
    undergroundMix: { plowPct: 55, trenchPct: 20, hddPct: 12, rockTrenchPct: 9, rockBorePct: 4 },
    handholeSpacingFt: 3500,
    vaultSpacingFt: 10000,
    ductConfig: "3x1.5",
    fiberCount: "432",
    engineeringPerFt: 1.25,
    permittingPerFt: 1,
    spanMiles: 80,
    popCount: 2,
    aggCount: 1,
    buildingEntranceCount: 0,
    ispRequired: false,
    dciHandoffCount: 0,
    accessHandoffCount: 0,
    restorationFactor: 1,
    securityFactor: 1,
    expansionReservePct: 20,
    warning: "Middle-mile assumes mixed rural/metro construction and optional route diversity.",
  },
  LONGHAUL: {
    role: "longhaul",
    stationSpacingFt: 5000,
    defaultDiversity: "LONGHAUL_DIVERSE",
    routeMix: { undergroundPct: 95, aerialPct: 3, existingConduitPct: 2 },
    undergroundMix: { plowPct: 65, trenchPct: 18, hddPct: 8, rockTrenchPct: 7, rockBorePct: 2 },
    handholeSpacingFt: 5000,
    vaultSpacingFt: 12000,
    ductConfig: "4x1.5",
    fiberCount: "864",
    engineeringPerFt: 0.9,
    permittingPerFt: 0.75,
    spanMiles: 60,
    popCount: 2,
    aggCount: 0,
    buildingEntranceCount: 0,
    ispRequired: false,
    dciHandoffCount: 0,
    accessHandoffCount: 0,
    restorationFactor: 0.9,
    securityFactor: 1.1,
    expansionReservePct: 25,
    warning: "Longhaul assumes span-based ILA/regen, O&M, and real estate/power per node.",
  },
  HYPERSCALER_BACKBONE: {
    role: "longhaul",
    stationSpacingFt: 5000,
    defaultDiversity: "LONGHAUL_DIVERSE",
    routeMix: { undergroundPct: 96, aerialPct: 2, existingConduitPct: 2 },
    undergroundMix: { plowPct: 58, trenchPct: 20, hddPct: 12, rockTrenchPct: 7, rockBorePct: 3 },
    handholeSpacingFt: 4000,
    vaultSpacingFt: 9000,
    ductConfig: "4x1.5",
    fiberCount: "864",
    engineeringPerFt: 1.1,
    permittingPerFt: 0.95,
    spanMiles: 55,
    popCount: 2,
    aggCount: 0,
    buildingEntranceCount: 0,
    ispRequired: false,
    dciHandoffCount: 0,
    accessHandoffCount: 0,
    restorationFactor: 1.1,
    securityFactor: 1.25,
    expansionReservePct: 40,
    warning: "Hyperscaler backbone requires diversity review, expansion reserve, security, and power readiness.",
  },
  GPU_CLUSTER_INTERCONNECT: {
    role: "metro",
    stationSpacingFt: 1000,
    defaultDiversity: "PROTECTED_DCI",
    routeMix: { undergroundPct: 90, aerialPct: 1, existingConduitPct: 9 },
    undergroundMix: { plowPct: 5, trenchPct: 25, hddPct: 50, rockTrenchPct: 12, rockBorePct: 8 },
    handholeSpacingFt: 1200,
    vaultSpacingFt: 4000,
    ductConfig: "4x1.5",
    fiberCount: "864",
    engineeringPerFt: 2.4,
    permittingPerFt: 1.6,
    spanMiles: 999,
    popCount: 0,
    aggCount: 2,
    buildingEntranceCount: 2,
    ispRequired: true,
    dciHandoffCount: 2,
    accessHandoffCount: 0,
    restorationFactor: 1.45,
    securityFactor: 1.35,
    expansionReservePct: 50,
    warning: "GPU cluster interconnect weighs power, cooling, real estate, low latency, and protected DCI paths.",
  },
};

const DEFAULTS = {
  networkType: "MIDDLE_MILE" as NetworkDesignType,
  productType: "DARK_FIBER" as ProductType,
  showStationing: false,
  snapToStreets: true,
  waypointSpacingMiles: 2,
  corridorSeparationMiles: 0.25,
  protectionRouteMultiplier: 1.25,
  protectionRouteLengthOverrideMiles: 0,
  diversityPremiumPercent: 8,
  riskPercent: 10,
  marginPercent: 12,
  mobilization: 250000,
  pmOverheadPercent: 4,
  insurancePercent: 1.5,
  qcPercent: 1,
  roadCrossings: 4,
  railCrossings: 1,
  waterCrossings: 0,
  bridgeCrossings: 0,
  aerialMakeReadyCount: 0,
  poleTransferCount: 0,
  ownerFurnishedMaterials: false,
  materialsEscalationPercent: 6,
  splicingPerFt: 0.42,
  buildingEntranceUnitCost: 55000,
  ispUnitCost: 35000,
};

const LARGE_GEOMETRY_RENDER_LIMIT = 100_000;

const initialLargeDatasetDiagnostics = (): LargeDatasetDiagnostics => ({
  mode: "Small File Mode",
  apiTarget: CHICAGO_API,
  status: "Idle",
});

function safeUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundMoney(n: number) {
  return Math.round(n);
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtFt(n: number) {
  return `${Math.round(n).toLocaleString()} ft`;
}

function fmtMi(n: number) {
  return `${n.toFixed(2)} mi`;
}

function fmtPct(n: number) {
  return `${Math.round(n)}%`;
}

function lineItem(
  id: string,
  label: string,
  category: string,
  unit: string,
  quantity: number,
  unitCost: number,
  notes?: string
): LineItem {
  return {
    id,
    label,
    category,
    unit,
    quantity,
    unitCost,
    amount: roundMoney(quantity * unitCost),
    notes,
  };
}

function stationLabelFromFeet(feetFromOrigin: number) {
  const s = Math.max(0, Math.round(feetFromOrigin));
  const hundreds = Math.floor(s / 100);
  const remainder = s % 100;
  return `${hundreds}+${remainder.toString().padStart(2, "0")}`;
}

function normalizePercentMix<T extends Record<string, number>>(mix: T): T {
  const entries = Object.entries(mix);
  const sum = entries.reduce((acc, [, value]) => acc + Math.max(0, Number(value) || 0), 0);
  if (sum === 100) return mix;
  if (sum <= 0) {
    const equal = Math.floor(100 / entries.length);
    const output = {} as T;
    entries.forEach(([key], index) => {
      (output as any)[key] = index === entries.length - 1 ? 100 - equal * (entries.length - 1) : equal;
    });
    return output;
  }
  const output = {} as T;
  let allocated = 0;
  entries.forEach(([key, value], index) => {
    const normalized = index === entries.length - 1 ? 100 - allocated : Math.round((Math.max(0, value) / sum) * 100);
    allocated += normalized;
    (output as any)[key] = Math.max(0, normalized);
  });
  return output;
}

function featureCollection(features: any[]) {
  return { type: "FeatureCollection" as const, features };
}

function lineStringFromCoords(coords: LonLat[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coords },
  };
}

function getAllLineCoordsFromGeoJSON(gj: any): LonLat[][] {
  const features: any[] =
    gj?.type === "FeatureCollection"
      ? gj.features
      : gj?.type === "Feature"
        ? [gj]
        : gj?.type
          ? [{ type: "Feature", properties: {}, geometry: gj }]
          : [];
  const lines: LonLat[][] = [];

  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "LineString") lines.push(g.coordinates as LonLat[]);
    if (g.type === "MultiLineString") {
      for (const part of g.coordinates as LonLat[][]) lines.push(part);
    }
  }

  return lines.filter((line) => line.length >= 2);
}

function getPointsFromGeoJSON(gj: any): LonLat[] {
  const features: any[] =
    gj?.type === "FeatureCollection"
      ? gj.features
      : gj?.type === "Feature"
        ? [gj]
        : gj?.type
          ? [{ type: "Feature", properties: {}, geometry: gj }]
          : [];
  const pts: LonLat[] = [];

  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "Point") pts.push(g.coordinates as LonLat);
    if (g.type === "MultiPoint") {
      for (const c of g.coordinates as LonLat[]) pts.push(c);
    }
  }

  return pts;
}

async function readFileText(file: File) {
  return await file.text();
}

async function parseKMLTextToGeoJSON(kmlText: string) {
  return kmlToGeoJSON(parseKMLTextToXML(kmlText));
}

const KML_NAMESPACE_REPAIRS = {
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
  gx: "http://www.google.com/kml/ext/2.2",
  kml: "http://www.opengis.net/kml/2.2",
} as const;

type KMLNamespacePrefix = keyof typeof KML_NAMESPACE_REPAIRS;

function hasKMLNamespaceDeclaration(kmlText: string, prefix: KMLNamespacePrefix) {
  return new RegExp(`\\sxmlns:${prefix}\\s*=`, "i").test(kmlText);
}

function injectKMLRootNamespaces(kmlText: string, prefixes: KMLNamespacePrefix[]) {
  const missing = prefixes.filter((prefix) => !hasKMLNamespaceDeclaration(kmlText, prefix));
  if (!missing.length) return { text: kmlText, injected: [] as KMLNamespacePrefix[] };

  let injected = false;
  const text = kmlText.replace(/<((?:[A-Za-z_][\w.-]*:)?kml)\b([^>]*)>/i, (match, rootName: string, rootAttrs: string) => {
    injected = true;
    const selfClosing = rootAttrs.trimEnd().endsWith("/");
    const normalizedAttrs = selfClosing ? rootAttrs.replace(/\/\s*$/, "") : rootAttrs;
    const namespaceAttrs = missing.map((prefix) => ` xmlns:${prefix}="${KML_NAMESPACE_REPAIRS[prefix]}"`).join("");
    return `<${rootName}${normalizedAttrs}${namespaceAttrs}${selfClosing ? " /" : ""}>`;
  });

  return { text: injected ? text : kmlText, injected: injected ? missing : [] };
}

function repairInitialKMLNamespaces(kmlText: string) {
  const hasUnboundXsiSchemaLocation = /\bxsi:schemaLocation\s*=/i.test(kmlText) && !hasKMLNamespaceDeclaration(kmlText, "xsi");
  return hasUnboundXsiSchemaLocation ? injectKMLRootNamespaces(kmlText, ["xsi"]) : { text: kmlText, injected: [] as KMLNamespacePrefix[] };
}

function repairCommonKMLNamespaces(kmlText: string) {
  return injectKMLRootNamespaces(kmlText, ["xsi", "gx", "kml"]);
}

function kmlParserErrorText(xml: Document) {
  const parserError =
    xml.getElementsByTagName("parsererror")[0] ?? xml.getElementsByTagNameNS("*", "parsererror")[0];
  return parserError?.textContent?.trim() || null;
}

function parseKMLDocument(parser: DOMParser, kmlText: string) {
  const xml = parser.parseFromString(kmlText, "text/xml");
  return { xml, parserErrorText: kmlParserErrorText(xml) };
}

function parseKMLTextToXML(kmlText: string) {
  console.log("KML XML PARSE START", { length: kmlText.length });
  const parser = new DOMParser();
  const initialRepair = repairInitialKMLNamespaces(kmlText);
  if (initialRepair.injected.length) {
    console.log("KML NAMESPACE REPAIR APPLIED", { phase: "pre-parse", namespaces: initialRepair.injected });
  }

  const firstParse = parseKMLDocument(parser, initialRepair.text);
  if (!firstParse.parserErrorText) {
    console.log("KML XML PARSE COMPLETE", { root: firstParse.xml.documentElement?.nodeName ?? null });
    return firstParse.xml;
  }

  const commonRepair = repairCommonKMLNamespaces(initialRepair.text);
  if (commonRepair.injected.length) {
    console.log("KML NAMESPACE REPAIR APPLIED", { phase: "parsererror", namespaces: commonRepair.injected });
  }

  const finalParse =
    commonRepair.text === initialRepair.text ? firstParse : parseKMLDocument(parser, commonRepair.text);
  if (!finalParse.parserErrorText) {
    console.log("KML XML PARSE COMPLETE", { root: finalParse.xml.documentElement?.nodeName ?? null });
    return finalParse.xml;
  }

  console.error("KML PARSE FAILED");
  console.error("FIRST 1000 CHARACTERS", kmlText.slice(0, 1000));
  console.error("PARSER ERROR TEXT", finalParse.parserErrorText);
  throw new Error(finalParse.parserErrorText || "Unable to parse KML XML.");
}

async function readKMLTextFromKMZ(file: File) {
  console.log("KMZ FILE RECEIVED", { name: file.name, size: file.size, type: file.type || "(unknown)" });
  console.log("KMZ UNZIP START");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  console.log("KMZ UNZIP COMPLETE");
  const entries = Object.keys(zip.files);
  console.log("KMZ FILES FOUND", entries.length);
  entries.forEach((entry) => {
    const zipEntry = zip.files[entry];
    console.log("KMZ FILE ENTRY", { name: entry, dir: zipEntry.dir });
  });
  const kmlName = entries.find((n) => n.toLowerCase().endsWith(".kml"));
  if (!kmlName) throw new Error("KMZ did not contain a .kml file");
  console.log("KML FILE SELECTED", kmlName);
  const kmlText = await zip.files[kmlName].async("string");
  console.log("KML XML LENGTH", kmlText.length);
  return kmlText;
}

async function parseKMZToGeoJSON(file: File) {
  return parseKMLTextToGeoJSON(await readKMLTextFromKMZ(file));
}

function calcRouteFeet(coords: LonLat[]) {
  if (coords.length < 2) return 0;
  const line = turf.lineString(coords);
  const km = turf.length(line, { units: "kilometers" });
  return km * 1000 * 3.28084;
}

function pickLongestLine(lines: LonLat[][]): LonLat[] | null {
  if (!lines.length) return null;
  let longest = lines[0];
  let maxFeet = calcRouteFeet(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const feet = calcRouteFeet(lines[i]);
    if (feet > maxFeet) {
      longest = lines[i];
      maxFeet = feet;
    }
  }
  return longest;
}

function buildStationPoints(coords: LonLat[], spacingFt: number) {
  const line = turf.lineString(coords);
  const totalKm = turf.length(line, { units: "kilometers" });
  const totalFt = totalKm * 1000 * 3.28084;
  const spacingKm = Math.max(100, spacingFt) / 3.28084 / 1000;
  const points: any[] = [];

  for (let distKm = 0; distKm <= totalKm + 1e-9; distKm += spacingKm) {
    const pt = turf.along(line, distKm, { units: "kilometers" });
    const feetFromOrigin = distKm * 1000 * 3.28084;
    pt.properties = { label: stationLabelFromFeet(feetFromOrigin), feet: feetFromOrigin };
    points.push(pt);
  }

  const end = turf.along(line, totalKm, { units: "kilometers" });
  end.properties = { label: stationLabelFromFeet(totalFt), feet: totalFt };
  points.push(end);
  return featureCollection(points);
}

function designStationsFromRoute(coords: LonLat[], spacingFt: number): DesignStation[] {
  const stationsGJ = buildStationPoints(coords, Math.max(100, spacingFt));
  return stationsGJ.features.map((f: any) => {
    const feet = Math.round(f.properties.feet || 0);
    return {
      stationId: `STA-${String(feet).padStart(6, "0")}`,
      station: f.properties.label,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      feet,
    };
  });
}

function offsetLineForCorridor(coords: LonLat[], offsetMiles: number) {
  if (!coords.length || offsetMiles === 0) return coords;
  const offset = turf.lineOffset(turf.lineString(coords), offsetMiles * 1.609344, { units: "kilometers" });
  return offset.geometry.coordinates as LonLat[];
}

function sampleWaypointsAlongLine(coords: LonLat[], waypointSpacingMiles: number) {
  const line = turf.lineString(coords);
  const totalKm = turf.length(line, { units: "kilometers" });
  const spacingKm = Math.max(0.25, waypointSpacingMiles * 1.609344);
  const pts: LonLat[] = [];

  for (let d = 0; d <= totalKm + 1e-9; d += spacingKm) {
    pts.push(turf.along(line, d, { units: "kilometers" }).geometry.coordinates as LonLat);
  }

  pts.push(turf.along(line, totalKm, { units: "kilometers" }).geometry.coordinates as LonLat);
  const dedup: LonLat[] = [];
  for (const c of pts) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(last[0] - c[0]) > 1e-6 || Math.abs(last[1] - c[1]) > 1e-6) dedup.push(c);
  }
  return dedup;
}

async function osrmRouteThroughWaypoints(waypoints: LonLat[]) {
  const max = 25;
  const trimmed =
    waypoints.length > max
      ? [
          waypoints[0],
          ...waypoints
            .slice(1, -1)
            .filter((_, i) => i % Math.ceil((waypoints.length - 2) / (max - 2)) === 0),
          waypoints[waypoints.length - 1],
        ]
      : waypoints;

  const coordStr = trimmed.map(([lon, lat]) => `${lon},${lat}`).join(";");
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordStr}` +
    "?overview=full&geometries=geojson&steps=false&continue_straight=false";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM route failed: ${res.status}`);
  const data = await res.json();
  const routeCoords = data?.routes?.[0]?.geometry?.coordinates as LonLat[] | undefined;
  if (!routeCoords?.length) throw new Error("OSRM returned no route geometry");
  return routeCoords;
}

function inferRoleFromText(text: string): RouteRole | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("metro")) return "metro";
  if (normalized.includes("middle mile") || normalized.includes("middlemile") || normalized.includes("middle-mile")) return "middlemile";
  if (normalized.includes("longhaul") || normalized.includes("long haul") || normalized.includes("backbone")) return "longhaul";
  return undefined;
}

function inferNetworkTypeFromText(text: string): NetworkDesignType | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("gpu") || normalized.includes("ai cluster")) return "GPU_CLUSTER_INTERCONNECT";
  if (normalized.includes("hyperscaler")) return "HYPERSCALER_BACKBONE";
  if (normalized.includes("dci") || normalized.includes("data center interconnect")) return "DCI";
  if (normalized.includes("access") || normalized.includes("lateral") || normalized.includes("building entrance")) return "ACCESS";
  if (normalized.includes("metro")) return "METRO";
  if (normalized.includes("middle mile") || normalized.includes("middle-mile") || normalized.includes("middlemile")) return "MIDDLE_MILE";
  if (normalized.includes("long haul") || normalized.includes("longhaul") || normalized.includes("backbone")) return "LONGHAUL";
  return undefined;
}

function inferProductTypeFromText(text: string): ProductType | undefined {
  const normalized = text.toLowerCase();
  if (normalized.includes("gpu")) return "GPU_FABRIC";
  if (normalized.includes("dci")) return "DCI_TRANSPORT";
  if (normalized.includes("wavelength") || normalized.includes("wave")) return "LIT_WAVELENGTH";
  if (normalized.includes("ethernet")) return "ETHERNET";
  if (normalized.includes("internet") || normalized.includes("ip transit")) return "IP_TRANSIT";
  if (normalized.includes("dark fiber") || normalized.includes("dark-fiber")) return "DARK_FIBER";
  return undefined;
}

function inferCustomerAndProjectFromFilename(filename: string) {
  const chunks = filename.replace(/\.[^/.]+$/, "").split(/[_\- ]+/).filter(Boolean);
  return {
    customerName: chunks.slice(0, 2).join(" ") || undefined,
    projectName: chunks.slice(2, 5).join(" ") || undefined,
  };
}

function previewFromJson(json: any): NormalizedPreview {
  const preview: NormalizedPreview = {};
  if (typeof json !== "object" || json === null) return preview;

  if (json.route?.length && Array.isArray(json.route[0]) && json.route[0].length === 2) {
    preview.routeCoords = json.route;
  }

  if (json.features || json.type) {
    const lines = getAllLineCoordsFromGeoJSON(json);
    const points = getPointsFromGeoJSON(json);
    if (lines.length) preview.routeCoords = pickLongestLine(lines) || preview.routeCoords;
    if (points.length) preview.sites = points.map(([lon, lat], i) => ({ lon, lat, order: i + 1 }));
  }

  const parseSites = (rows: any[]) =>
    rows
      .map((row, index) => {
        const lat = Number(row.lat ?? row.latitude);
        const lon = Number(row.lon ?? row.lng ?? row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { name: String(row.name ?? row.site ?? row.id ?? ""), lat, lon, order: index + 1 };
      })
      .filter(Boolean) as UploadedSitesRow[];

  if (Array.isArray(json.sites)) {
    const sites = parseSites(json.sites);
    if (sites.length) preview.sites = sites;
  }
  if (Array.isArray(json.points)) {
    const sites = parseSites(json.points);
    if (sites.length) preview.sites = sites;
  }

  if (typeof json.customerName === "string") preview.customerName = json.customerName;
  if (typeof json.projectName === "string") preview.projectName = json.projectName;

  const roleText = [json.role, json.networkType, json.productType, json.notes].filter(Boolean).join(" ");
  if (roleText) {
    preview.inferredRole = inferRoleFromText(roleText);
    preview.inferredNetworkType = inferNetworkTypeFromText(roleText);
    preview.inferredProductType = inferProductTypeFromText(roleText);
  }

  if (typeof json.notes === "string") preview.notes = json.notes;
  if (Array.isArray(json.constraints)) preview.constraints = json.constraints.map(String);
  if (Array.isArray(json.productHints)) preview.productHints = json.productHints.map(String);

  const budget = json.budget ?? json.budgetAssumptions;
  if (typeof budget === "object" && budget !== null) {
    preview.budgetAssumptions = {
      riskPercent: numericOrUndefined(budget.riskPercent ?? budget.risk ?? budget.risk_percent),
      marginPercent: numericOrUndefined(budget.marginPercent ?? budget.margin ?? budget.margin_percent),
      engineeringPerFt: numericOrUndefined(budget.engineeringPerFt ?? budget.engineering_per_ft),
      permittingPerFt: numericOrUndefined(budget.permittingPerFt ?? budget.permitting_per_ft),
      mobilization: numericOrUndefined(budget.mobilization),
      pmOverheadPercent: numericOrUndefined(budget.pmOverheadPercent ?? budget.pm_overhead_percent),
      insurancePercent: numericOrUndefined(budget.insurancePercent ?? budget.insurance_percent),
      qcPercent: numericOrUndefined(budget.qcPercent ?? budget.qc_percent),
      materialsEscalationPercent: numericOrUndefined(
        budget.materialsEscalationPercent ?? budget.materials_escalation_percent
      ),
    };
  }

  return preview;
}

function numericOrUndefined(value: any) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function previewFromCsv(rows: any[]): NormalizedPreview {
  const preview: NormalizedPreview = {};
  const first = rows[0] || {};
  const lowerKeys = Object.keys(first).map((k) => k.toLowerCase());
  const hasLatLon =
    (lowerKeys.includes("lat") || lowerKeys.includes("latitude")) &&
    (lowerKeys.includes("lon") || lowerKeys.includes("lng") || lowerKeys.includes("longitude"));

  if (hasLatLon) {
    const sites = rows
      .map((row: any, index: number) => {
        const lat = Number(row.lat ?? row.latitude);
        const lon = Number(row.lon ?? row.lng ?? row.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          name: String(row.name ?? row.site ?? row.id ?? ""),
          lat,
          lon,
          order: Number(row.order ?? row.index ?? index + 1),
        };
      })
      .filter(Boolean) as UploadedSitesRow[];
    if (sites.length) preview.sites = sites;
  }

  const sampleText = rows
    .slice(0, 20)
    .flatMap((row: any) => Object.values(row))
    .filter((v) => typeof v === "string")
    .join(" ");

  preview.inferredRole = inferRoleFromText(sampleText);
  preview.inferredNetworkType = inferNetworkTypeFromText(sampleText);
  preview.inferredProductType = inferProductTypeFromText(sampleText);
  preview.productHints = extractProductHints(sampleText);
  return preview;
}

function routeCoordsFromCsvRows(rows: any[]): LonLat[] {
  const coords = rows
    .map((row: any, index: number) => {
      const lat = Number(row.lat ?? row.latitude);
      const lon = Number(row.lon ?? row.lng ?? row.longitude);
      const order = row.order !== undefined ? Number(row.order) : index + 1;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return { coord: [lon, lat] as LonLat, order: Number.isFinite(order) ? order : index + 1 };
    })
    .filter(Boolean) as Array<{ coord: LonLat; order: number }>;

  return coords.sort((a, b) => a.order - b.order).map((item) => item.coord);
}

function buildPreviewFromText(text: string, filename?: string): NormalizedPreview {
  const names = filename ? inferCustomerAndProjectFromFilename(filename) : {};
  return {
    ...names,
    inferredRole: inferRoleFromText(text),
    inferredNetworkType: inferNetworkTypeFromText(text),
    inferredProductType: inferProductTypeFromText(text),
    productHints: extractProductHints(text),
    constraints: extractConstraintHints(text),
    notes: text.trim().slice(0, 700),
  };
}

function extractProductHints(text: string) {
  const normalized = text.toLowerCase();
  const hints: string[] = [];
  if (normalized.includes("400g")) hints.push("400G capable");
  if (normalized.includes("800g")) hints.push("800G capable");
  if (normalized.includes("dark fiber")) hints.push("Dark fiber");
  if (normalized.includes("wavelength")) hints.push("Lit wavelength");
  if (normalized.includes("dual entrance")) hints.push("Dual entrance");
  if (normalized.includes("meet-me") || normalized.includes("meet me")) hints.push("Meet-me room");
  if (normalized.includes("gpu")) hints.push("GPU workload");
  return hints;
}

function extractConstraintHints(text: string) {
  const normalized = text.toLowerCase();
  const constraints: string[] = [];
  if (normalized.includes("low latency")) constraints.push("Low-latency path sensitivity");
  if (normalized.includes("diverse") || normalized.includes("diversity")) constraints.push("Diversity requested");
  if (normalized.includes("railroad") || normalized.includes("rail")) constraints.push("Rail crossing review likely");
  if (normalized.includes("waterway") || normalized.includes("river")) constraints.push("Water crossing review likely");
  if (normalized.includes("make-ready") || normalized.includes("make ready")) constraints.push("Aerial make-ready likely");
  return constraints;
}

function mergePreviewMetadata(preview: NormalizedPreview, meta: Partial<NormalizedPreview>): NormalizedPreview {
  return {
    ...preview,
    ...meta,
    constraints: [...(preview.constraints ?? []), ...(meta.constraints ?? [])],
    productHints: [...(preview.productHints ?? []), ...(meta.productHints ?? [])],
    budgetAssumptions: { ...(preview.budgetAssumptions ?? {}), ...(meta.budgetAssumptions ?? {}) },
  };
}

function createPreviewFromUpload(file: File, data: string | any): NormalizedPreview {
  const namePreview = inferCustomerAndProjectFromFilename(file.name);
  const basePreview: NormalizedPreview = {
    customerName: namePreview.customerName,
    projectName: namePreview.projectName,
  };
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".xlsx")) {
    return mergePreviewMetadata(basePreview, {
      notes: `Source file: ${file.name}. Binary document captured for advisory review; structured extraction is not enabled in this local parser.`,
    });
  }

  if (typeof data === "string") {
    if (lower.endsWith(".json") || lower.endsWith(".geojson")) {
      try {
        const parsed = JSON.parse(data);
        return mergePreviewMetadata(previewFromJson(parsed), {
          customerName: basePreview.customerName,
          projectName: basePreview.projectName,
          notes: `Parsed JSON from ${file.name}`,
        });
      } catch {
        return mergePreviewMetadata(basePreview, { notes: `Unable to parse ${file.name} as JSON.` });
      }
    }

    if (lower.endsWith(".csv")) {
      const parsed = Papa.parse<Record<string, any>>(data, { header: true, skipEmptyLines: true });
      return mergePreviewMetadata(previewFromCsv(parsed.data as any), {
        customerName: basePreview.customerName,
        projectName: basePreview.projectName,
        notes: `Parsed CSV from ${file.name}`,
      });
    }

    return mergePreviewMetadata(basePreview, buildPreviewFromText(data, file.name));
  }

  const spatialPreview = previewFromJson(data);
  return mergePreviewMetadata(spatialPreview, {
    customerName: basePreview.customerName,
    projectName: basePreview.projectName,
    notes: `Parsed spatial file ${file.name}`,
  });
}

async function parseTranslateFile(file: File): Promise<NormalizedPreview> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".kmz")) return createPreviewFromUpload(file, await parseKMZToGeoJSON(file));
  if (lower.endsWith(".kml")) return createPreviewFromUpload(file, await parseKMLTextToGeoJSON(await readFileText(file)));
  if (
    lower.endsWith(".json") ||
    lower.endsWith(".geojson") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md")
  ) {
    return createPreviewFromUpload(file, await readFileText(file));
  }
  if (lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".xlsx")) {
    return createPreviewFromUpload(file, "");
  }
  return { ...inferCustomerAndProjectFromFilename(file.name), notes: `Unsupported translate upload: ${file.name}` };
}

function formatPreview(preview: NormalizedPreview) {
  const lines: string[] = [];
  if (preview.customerName) lines.push(`Customer: ${preview.customerName}`);
  if (preview.projectName) lines.push(`Project: ${preview.projectName}`);
  if (preview.inferredNetworkType) lines.push(`Network: ${NETWORK_LABELS[preview.inferredNetworkType]}`);
  if (preview.inferredRole) lines.push(`Role: ${preview.inferredRole}`);
  if (preview.inferredProductType) lines.push(`Product: ${PRODUCT_LABELS[preview.inferredProductType]}`);
  if (preview.routeCoords?.length) lines.push(`Route coords: ${preview.routeCoords.length} points`);
  if (preview.sites?.length) lines.push(`Sites: ${preview.sites.length}`);
  if (preview.serverBaselineId) lines.push(`Baseline ID: ${preview.serverBaselineId}`);
  if (preview.constraints?.length) lines.push(`Constraints: ${preview.constraints.join(", ")}`);
  if (preview.productHints?.length) lines.push(`Product hints: ${preview.productHints.join(", ")}`);
  if (preview.budgetAssumptions) lines.push(`Budget assumptions: ${Object.keys(preview.budgetAssumptions).join(", ")}`);
  if (preview.notes) lines.push(`Notes: ${preview.notes}`);
  return lines.join("\n") || "No previewable content extracted yet.";
}

function isValidRouteCoords(coords: any): coords is LonLat[] {
  return (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    coords.every((c) => Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
  );
}

function isUploadedSiteRowArray(rows: any): rows is UploadedSitesRow[] {
  return Array.isArray(rows) && rows.every((item) => item && Number.isFinite(item.lat) && Number.isFinite(item.lon));
}

function mapPreviewBudgetToDesign(
  preview: NormalizedPreview,
  setters: {
    setRiskPercent: (value: number) => void;
    setMarginPercent: (value: number) => void;
    setEngineeringPerFt: (value: number) => void;
    setPermittingPerFt: (value: number) => void;
    setMobilization: (value: number) => void;
    setPmOverheadPercent: (value: number) => void;
    setInsurancePercent: (value: number) => void;
    setQcPercent: (value: number) => void;
    setMaterialsEscalationPercent: (value: number) => void;
  }
) {
  const budget = preview.budgetAssumptions;
  if (!budget) return;
  if (Number.isFinite(budget.riskPercent)) setters.setRiskPercent(budget.riskPercent!);
  if (Number.isFinite(budget.marginPercent)) setters.setMarginPercent(budget.marginPercent!);
  if (Number.isFinite(budget.engineeringPerFt)) setters.setEngineeringPerFt(budget.engineeringPerFt!);
  if (Number.isFinite(budget.permittingPerFt)) setters.setPermittingPerFt(budget.permittingPerFt!);
  if (Number.isFinite(budget.mobilization)) setters.setMobilization(budget.mobilization!);
  if (Number.isFinite(budget.pmOverheadPercent)) setters.setPmOverheadPercent(budget.pmOverheadPercent!);
  if (Number.isFinite(budget.insurancePercent)) setters.setInsurancePercent(budget.insurancePercent!);
  if (Number.isFinite(budget.qcPercent)) setters.setQcPercent(budget.qcPercent!);
  if (Number.isFinite(budget.materialsEscalationPercent)) {
    setters.setMaterialsEscalationPercent(budget.materialsEscalationPercent!);
  }
}

function roleFromNetworkType(networkType: NetworkDesignType): RouteRole {
  return NETWORK_PRESETS[networkType].role;
}

function productDefaultForNetwork(networkType: NetworkDesignType): ProductType {
  if (networkType === "DCI") return "DCI_TRANSPORT";
  if (networkType === "GPU_CLUSTER_INTERCONNECT") return "GPU_FABRIC";
  if (networkType === "ACCESS") return "ETHERNET";
  if (networkType === "HYPERSCALER_BACKBONE") return "LIT_WAVELENGTH";
  return "DARK_FIBER";
}

function ductConfigToDetails(cfg: DuctConfig, customCount: number, customDiameter: number) {
  if (cfg === "custom") {
    return { ductCount: Math.max(1, Math.round(customCount)), ductDiameterIn: Math.max(0.75, customDiameter) };
  }
  const [countStr, diaStr] = cfg.split("x");
  return { ductCount: Number(countStr), ductDiameterIn: Number(diaStr) };
}

function resolveFiberCount(option: FiberCountOption, customFiberCount: number) {
  return option === "custom" ? Math.max(12, Math.round(customFiberCount)) : Number(option);
}

function computeIntermediateSites(routeMiles: number, spanMiles: number) {
  const span = Math.max(10, spanMiles || 0);
  if (routeMiles <= span) return 0;
  return Math.max(0, Math.ceil(routeMiles / span) - 1);
}

function routeRequiresGeographicDiversity(diversityModel: DiversityModel) {
  return ["DIVERSE_PATH", "METRO_RING", "DUAL_HOMED", "PROTECTED_DCI", "LONGHAUL_DIVERSE"].includes(diversityModel);
}

function computeDiverseRouteFeet(args: {
  primaryRouteFeet: number;
  diversityModel: DiversityModel;
  protectionRouteLengthOverrideMiles: number;
  protectionRouteMultiplier: number;
}) {
  if (!routeRequiresGeographicDiversity(args.diversityModel)) return 0;
  if (args.protectionRouteLengthOverrideMiles > 0) return args.protectionRouteLengthOverrideMiles * 5280;
  const minimumMultiplier =
    args.diversityModel === "METRO_RING"
      ? 1.18
      : args.diversityModel === "PROTECTED_DCI"
        ? 1.15
        : args.diversityModel === "LONGHAUL_DIVERSE"
          ? 1.3
          : 1.2;
  return args.primaryRouteFeet * Math.max(minimumMultiplier, args.protectionRouteMultiplier);
}

function diversityWarnings(args: {
  diversityModel: DiversityModel;
  corridorSeparationMiles: number;
  hasProtectionGeometry: boolean;
  networkType: NetworkDesignType;
}) {
  const warnings: string[] = [];
  if (args.diversityModel === "SAME_ROUTE_REDUNDANT_DUCT") {
    warnings.push("Same-route redundant duct is not geographic diversity; shared-risk review required.");
  }
  if (routeRequiresGeographicDiversity(args.diversityModel) && !args.hasProtectionGeometry) {
    warnings.push("Protection route is estimated from multiplier/offset until a true secondary path is imported.");
  }
  if (routeRequiresGeographicDiversity(args.diversityModel) && args.corridorSeparationMiles < 0.25) {
    warnings.push("Corridor separation is below 0.25 miles; shared-risk exposure remains high.");
  }
  if (
    (args.networkType === "HYPERSCALER_BACKBONE" || args.networkType === "GPU_CLUSTER_INTERCONNECT") &&
    args.diversityModel === "LINEAR"
  ) {
    warnings.push("Hyperscaler/GPU design is linear; protected diversity should be explicitly approved by a human.");
  }
  return warnings;
}

function buildCivilModel(args: {
  totalBillableFeet: number;
  routeMix: RouteMix;
  undergroundMix: UndergroundMix;
  urbanRestorationPct: number;
  ruralRestorationPct: number;
  aerialMakeReadyCount: number;
  poleTransferCount: number;
  roadCrossings: number;
  railCrossings: number;
  waterCrossings: number;
  bridgeCrossings: number;
  networkType: NetworkDesignType;
  preset: EngineeringPreset;
}) {
  const routeMix = normalizePercentMix(args.routeMix);
  const undergroundMix = normalizePercentMix(args.undergroundMix);
  const undergroundFeet = args.totalBillableFeet * (routeMix.undergroundPct / 100);
  const aerialFeet = args.totalBillableFeet * (routeMix.aerialPct / 100);
  const existingConduitFeet = args.totalBillableFeet * (routeMix.existingConduitPct / 100);

  const plow = lineItem(
    "civil_plow",
    "Plow",
    "underground",
    "ft",
    undergroundFeet * (undergroundMix.plowPct / 100),
    CIVIL_UNIT_COST.plow
  );
  const trench = lineItem(
    "civil_trench",
    "Trench",
    "underground",
    "ft",
    undergroundFeet * (undergroundMix.trenchPct / 100),
    CIVIL_UNIT_COST.trench
  );
  const hdd = lineItem(
    "civil_hdd",
    "HDD",
    "underground",
    "ft",
    undergroundFeet * (undergroundMix.hddPct / 100),
    CIVIL_UNIT_COST.hdd
  );
  const rockTrench = lineItem(
    "civil_rock_trench",
    "Rock trench",
    "underground",
    "ft",
    undergroundFeet * (undergroundMix.rockTrenchPct / 100),
    CIVIL_UNIT_COST.rockTrench
  );
  const rockBore = lineItem(
    "civil_rock_bore",
    "Rock bore",
    "underground",
    "ft",
    undergroundFeet * (undergroundMix.rockBorePct / 100),
    CIVIL_UNIT_COST.rockBore
  );

  const aerialLabor = lineItem(
    "civil_aerial",
    "Aerial strand/lash",
    "aerial",
    "ft",
    aerialFeet,
    CIVIL_UNIT_COST.aerialStrand + CIVIL_UNIT_COST.aerialLash
  );
  const pullExisting = lineItem(
    "civil_existing_conduit",
    "Pull through existing conduit",
    "existing_conduit",
    "ft",
    existingConduitFeet,
    CIVIL_UNIT_COST.pullExisting
  );

  const urbanRestorationFeet = undergroundFeet * (clamp(args.urbanRestorationPct, 0, 100) / 100);
  const ruralRestorationFeet = undergroundFeet * (clamp(args.ruralRestorationPct, 0, 100) / 100);
  const restorationUrban = lineItem(
    "restoration_urban",
    "Urban restoration",
    "restoration",
    "ft",
    urbanRestorationFeet,
    CIVIL_UNIT_COST.urbanRestoration * args.preset.restorationFactor
  );
  const restorationRural = lineItem(
    "restoration_rural",
    "Rural restoration",
    "restoration",
    "ft",
    ruralRestorationFeet,
    CIVIL_UNIT_COST.ruralRestoration * args.preset.restorationFactor
  );

  const makeReady = lineItem(
    "aerial_make_ready",
    "Aerial make-ready",
    "aerial",
    "count",
    args.aerialMakeReadyCount,
    CIVIL_UNIT_COST.makeReady
  );
  const poleTransfers = lineItem(
    "pole_transfers",
    "Pole transfers",
    "aerial",
    "count",
    args.poleTransferCount,
    CIVIL_UNIT_COST.poleTransfer
  );
  const road = lineItem("crossing_road", "Road crossings", "crossings", "count", args.roadCrossings, CROSSING_UNIT_COST.road);
  const rail = lineItem("crossing_rail", "Rail crossings", "crossings", "count", args.railCrossings, CROSSING_UNIT_COST.rail);
  const water = lineItem(
    "crossing_water",
    "Water crossings",
    "crossings",
    "count",
    args.waterCrossings,
    CROSSING_UNIT_COST.water
  );
  const bridge = lineItem(
    "crossing_bridge",
    "Bridge/attachment special",
    "crossings",
    "count",
    args.bridgeCrossings,
    CROSSING_UNIT_COST.bridge
  );

  const civilLineItems = [
    plow,
    trench,
    hdd,
    rockTrench,
    rockBore,
    aerialLabor,
    pullExisting,
    restorationUrban,
    restorationRural,
    makeReady,
    poleTransfers,
    road,
    rail,
    water,
    bridge,
  ];

  const undergroundCivilLabor = plow.amount + trench.amount + hdd.amount + rockTrench.amount + rockBore.amount;
  const restoration = restorationUrban.amount + restorationRural.amount;
  const makeReadyTotal = makeReady.amount + poleTransfers.amount;
  const crossings = road.amount + rail.amount + water.amount + bridge.amount;
  const directCivilLabor = undergroundCivilLabor + aerialLabor.amount + pullExisting.amount;
  const routeCivilSubtotal = directCivilLabor + restoration + makeReadyTotal + crossings;
  const weightedCivilPerFt = args.totalBillableFeet > 0 ? directCivilLabor / args.totalBillableFeet : 0;

  const warnings: string[] = [];
  if (routeMix.undergroundPct + routeMix.aerialPct + routeMix.existingConduitPct !== 100) {
    warnings.push("Route mix was normalized to 100%.");
  }
  if (args.networkType === "ACCESS" && args.totalBillableFeet > 5280 * 3) {
    warnings.push("Access lateral exceeds 3 miles; validate lateral economics and customer contribution.");
  }

  return {
    inputRouteFeet: args.totalBillableFeet,
    undergroundFeet,
    aerialFeet,
    existingConduitFeet,
    undergroundMix,
    routeMix,
    undergroundCivilLabor,
    aerialLabor: aerialLabor.amount,
    existingConduitLabor: pullExisting.amount,
    restoration,
    makeReady: makeReadyTotal,
    crossings,
    directCivilLabor,
    routeCivilSubtotal,
    civilCostPerFoot: args.totalBillableFeet > 0 ? routeCivilSubtotal / args.totalBillableFeet : 0,
    weightedCivilPerFt,
    civilLineItems,
    warnings,
  } satisfies CivilCostModel;
}

function buildBomModel(args: {
  totalBillableFeet: number;
  primaryRouteFeet: number;
  diversityModel: DiversityModel;
  ductConfig: DuctConfig;
  customDuctCount: number;
  customDuctDiameterIn: number;
  fiberCountOption: FiberCountOption;
  customFiberCount: number;
  handholeSpacingFt: number;
  vaultSpacingFt: number;
  ownerFurnishedMaterials: boolean;
  materialsEscalationPercent: number;
  productType: ProductType;
  networkType: NetworkDesignType;
  expansionReservePct: number;
}) {
  const { ductCount, ductDiameterIn } = ductConfigToDetails(args.ductConfig, args.customDuctCount, args.customDuctDiameterIn);
  const fiberCount = resolveFiberCount(args.fiberCountOption, args.customFiberCount);
  const sameRouteRedundantFactor = args.diversityModel === "SAME_ROUTE_REDUNDANT_DUCT" ? 1.35 : 1;
  const materialRouteFeet =
    args.diversityModel === "SAME_ROUTE_REDUNDANT_DUCT"
      ? args.primaryRouteFeet * sameRouteRedundantFactor
      : args.totalBillableFeet;

  const conduitPerFt = ductDiameterIn <= 1.25 ? 0.95 : 1.1;
  const innerductPerFt = ductDiameterIn <= 1.25 ? 0.38 : 0.45;
  const fiberPerFt = 0.12 + fiberCount * 0.0016;
  const expansionFactor = 1 + clamp(args.expansionReservePct, 0, 100) / 100;
  const vaultCount = Math.max(0, Math.ceil(materialRouteFeet / Math.max(1000, args.vaultSpacingFt)));
  const handholeCount = Math.max(0, Math.ceil(materialRouteFeet / Math.max(500, args.handholeSpacingFt)));
  const spliceClosureCount = Math.max(1, Math.ceil(materialRouteFeet / 12000));
  const panelCount = Math.max(1, Math.ceil(fiberCount / 144));
  const rackCount = args.productType === "DARK_FIBER" ? 1 : Math.max(2, Math.ceil(fiberCount / 288));

  const items: LineItem[] = [
    lineItem("bom_conduit", "Conduit / duct system", "duct", "ft", materialRouteFeet, conduitPerFt * ductCount * expansionFactor),
    lineItem("bom_innerduct", "Innerduct", "duct", "ft", materialRouteFeet, innerductPerFt * ductCount),
    lineItem("bom_fiber", `${fiberCount}ct fiber cable`, "fiber", "ft", materialRouteFeet, fiberPerFt * expansionFactor),
    lineItem("bom_tracer", "Tracer / locate wire", "locate", "ft", materialRouteFeet, 0.08),
    lineItem("bom_warning_tape", "Warning tape / markers", "locate", "ft", materialRouteFeet, 0.05),
    lineItem("bom_handholes", "Handholes", "structures", "count", handholeCount, 2500),
    lineItem("bom_vaults", "Vaults / manholes", "structures", "count", vaultCount, 15000),
    lineItem("bom_splice_closures", "Splice closures", "splicing", "count", spliceClosureCount, 1800),
    lineItem("bom_splice_trays", "Splice trays", "splicing", "count", spliceClosureCount * Math.ceil(fiberCount / 144), 325),
    lineItem("bom_fdp", "Fiber distribution panels", "inside_plant", "count", panelCount, 2400),
    lineItem("bom_patch_panels", "Patch panels", "inside_plant", "count", panelCount, 1800),
    lineItem("bom_racks", "Racks / cabinets", "inside_plant", "count", rackCount, 4500),
    lineItem("bom_grounding", "Grounding", "inside_plant", "count", rackCount, 1800),
    lineItem("bom_restoration_material", "Restoration materials", "restoration", "ft", materialRouteFeet, 0.6),
  ];

  const transportEquipment = computeTransportEquipment(args.productType, args.networkType, fiberCount);
  if (transportEquipment > 0) {
    items.push(lineItem("bom_transport_electronics", "Transport electronics", "electronics", "system", 1, transportEquipment * 0.62));
    items.push(lineItem("bom_optics", "Optics / transceivers", "electronics", "system", 1, transportEquipment * 0.28));
    items.push(lineItem("bom_cross_connects", "Cross-connects", "electronics", "system", 1, transportEquipment * 0.1));
  }

  if (args.networkType === "DCI" || args.networkType === "GPU_CLUSTER_INTERCONNECT") {
    items.push(lineItem("bom_building_entrance_materials", "Building entrance materials", "inside_plant", "entrance", 2, 12000));
    items.push(lineItem("bom_isp_materials", "ISP materials", "inside_plant", "site", 2, 8500));
  }

  const materialSubtotal = items.reduce((acc, item) => acc + item.amount, 0);
  const materialEscalation = materialSubtotal * (clamp(args.materialsEscalationPercent, 0, 50) / 100);
  const materialsEscalated = materialSubtotal + materialEscalation;
  const includedAmount = args.ownerFurnishedMaterials ? 0 : materialsEscalated;

  return {
    ductCount,
    ductDiameterIn,
    fiberCount,
    materialSubtotal,
    materialEscalation,
    materialsEscalated,
    materialIncludedInBid: !args.ownerFurnishedMaterials,
    materialCostPerFoot: args.totalBillableFeet > 0 ? includedAmount / args.totalBillableFeet : 0,
    transportEquipment,
    bomLineItems: items,
    materialBreakdown: {
      conduit: amountById(items, "bom_conduit"),
      innerduct: amountById(items, "bom_innerduct"),
      fiber: amountById(items, "bom_fiber"),
      tracer: amountById(items, "bom_tracer"),
      handholes: amountById(items, "bom_handholes"),
      vaults: amountById(items, "bom_vaults"),
      spliceClosures: amountById(items, "bom_splice_closures"),
      restoration: amountById(items, "bom_restoration_material"),
    },
  } satisfies BomModel;
}

function amountById(items: LineItem[], id: string) {
  return items.find((item) => item.id === id)?.amount ?? 0;
}

function computeTransportEquipment(productType: ProductType, networkType: NetworkDesignType, fiberCount: number) {
  if (productType === "DARK_FIBER") return 0;
  const base =
    productType === "GPU_FABRIC"
      ? 950000
      : productType === "DCI_TRANSPORT"
        ? 420000
        : productType === "LIT_WAVELENGTH"
          ? 280000
          : productType === "ETHERNET"
            ? 95000
            : 125000;
  const networkFactor =
    networkType === "GPU_CLUSTER_INTERCONNECT"
      ? 1.6
      : networkType === "HYPERSCALER_BACKBONE"
        ? 1.35
        : networkType === "LONGHAUL"
          ? 1.2
          : 1;
  return base * networkFactor * Math.max(1, fiberCount / 288);
}

function buildNodeInfrastructureModel(args: {
  totalBillableMiles: number;
  networkType: NetworkDesignType;
  diversityModel: DiversityModel;
  includeRegens: boolean;
  includePops: boolean;
  includeAgg: boolean;
  spanMiles: number;
  popCount: number;
  aggCount: number;
  gpuMicroCount: number;
  gpuPodCount: number;
  powerAvailability: number;
  realEstateAvailability: number;
  preset: EngineeringPreset;
}) {
  const longSpanType =
    args.networkType === "LONGHAUL" ||
    args.networkType === "MIDDLE_MILE" ||
    args.networkType === "HYPERSCALER_BACKBONE";
  const routeMultiplier = routeRequiresGeographicDiversity(args.diversityModel) ? 1.4 : 1;
  const ilaCount = args.includeRegens && longSpanType ? computeIntermediateSites(args.totalBillableMiles, args.spanMiles) : 0;
  const regenCount =
    args.includeRegens && longSpanType ? computeIntermediateSites(args.totalBillableMiles, Math.max(args.spanMiles * 3, 120)) : 0;
  const dciHandoffCount =
    args.networkType === "DCI" || args.networkType === "GPU_CLUSTER_INTERCONNECT"
      ? Math.max(args.preset.dciHandoffCount, args.diversityModel === "PROTECTED_DCI" ? 4 : 2)
      : args.preset.dciHandoffCount;
  const accessHandoffCount = args.networkType === "ACCESS" ? Math.max(1, args.preset.accessHandoffCount) : args.preset.accessHandoffCount;

  const counts: NodeCounts = {
    POP: args.includePops ? Math.max(0, Math.round(args.popCount)) : 0,
    AGG: args.includeAgg ? Math.max(0, Math.round(args.aggCount)) : 0,
    REGEN: regenCount,
    ILA: ilaCount,
    DCI_HANDOFF: dciHandoffCount,
    ACCESS_HANDOFF: accessHandoffCount,
    GPU_MICRO:
      args.networkType === "GPU_CLUSTER_INTERCONNECT" || args.networkType === "HYPERSCALER_BACKBONE"
        ? Math.max(0, Math.round(args.gpuMicroCount))
        : 0,
    GPU_POD: args.networkType === "GPU_CLUSTER_INTERCONNECT" ? Math.max(0, Math.round(args.gpuPodCount)) : 0,
  };

  const nodeLineItems: LineItem[] = (Object.keys(counts) as NodeType[])
    .filter((type) => counts[type] > 0)
    .map((type) => {
      const unit = NODE_UNIT_DEFAULTS[type].capex * (type === "ILA" || type === "REGEN" ? routeMultiplier : 1);
      const securityMultiplier =
        args.networkType === "HYPERSCALER_BACKBONE" || args.networkType === "GPU_CLUSTER_INTERCONNECT" ? args.preset.securityFactor : 1;
      return lineItem(`node_${type.toLowerCase()}`, nodeLabel(type), "node_capex", "count", counts[type], unit * securityMultiplier);
    });

  const opexLineItems: LineItem[] = (Object.keys(counts) as NodeType[])
    .filter((type) => counts[type] > 0)
    .map((type) =>
      lineItem(
        `opex_${type.toLowerCase()}`,
        `${nodeLabel(type)} monthly O&M / lease / power`,
        "node_opex",
        "node-month",
        counts[type],
        NODE_UNIT_DEFAULTS[type].monthlyOpex
      )
    );

  const nodeCapex = nodeLineItems.reduce((acc, item) => acc + item.amount, 0);
  const nodeMonthlyOpex = opexLineItems.reduce((acc, item) => acc + item.amount, 0);
  const powerReadinessScore = clamp(Math.round(args.powerAvailability), 0, 100);
  const realEstateReadinessScore = clamp(Math.round(args.realEstateAvailability), 0, 100);

  const warnings: string[] = [];
  if (longSpanType && args.includeRegens && ilaCount === 0 && args.totalBillableMiles > 80) {
    warnings.push("Long-span route has no ILA count; verify span-mile setting.");
  }
  if ((args.networkType === "HYPERSCALER_BACKBONE" || args.networkType === "GPU_CLUSTER_INTERCONNECT") && powerReadinessScore < 70) {
    warnings.push("Power readiness is below hyperscaler/GPU target.");
  }
  if (args.networkType === "GPU_CLUSTER_INTERCONNECT" && realEstateReadinessScore < 70) {
    warnings.push("Real estate/cooling readiness is below GPU cluster target.");
  }

  return {
    nodeLineItems,
    opexLineItems,
    nodeCapex,
    nodeMonthlyOpex,
    regenCount,
    ilaCount,
    popCount: counts.POP,
    aggCount: counts.AGG,
    gpuCandidateCount: counts.GPU_MICRO + counts.GPU_POD,
    powerReadinessScore,
    realEstateReadinessScore,
    counts,
    warnings,
  } satisfies NodeInfrastructureModel;
}

function nodeLabel(type: NodeType) {
  switch (type) {
    case "DCI_HANDOFF":
      return "DCI handoff";
    case "ACCESS_HANDOFF":
      return "Access handoff";
    case "GPU_MICRO":
      return "GPU Micro";
    case "GPU_POD":
      return "GPU POD";
    default:
      return type;
  }
}

function buildFinancialModel(args: {
  routeFeet: number;
  primaryRouteFeet: number;
  diverseRouteFeet: number;
  civilModel: CivilCostModel;
  bomModel: BomModel;
  nodeModel: NodeInfrastructureModel;
  engineeringPerFt: number;
  permittingPerFt: number;
  splicingPerFt: number;
  buildingEntranceCount: number;
  buildingEntranceUnitCost: number;
  ispRequired: boolean;
  ispUnitCost: number;
  mobilization: number;
  pmOverheadPercent: number;
  insurancePercent: number;
  qcPercent: number;
  riskPercent: number;
  marginPercent: number;
  diversityPremiumPercent: number;
  diversityModel: DiversityModel;
  networkType: NetworkDesignType;
  preset: EngineeringPreset;
  warnings: string[];
  demandSets: DemandSet[];
}) {
  const totalBillableFeet = args.primaryRouteFeet + args.diverseRouteFeet;
  const routeMiles = args.routeFeet / 5280;
  const totalBillableMiles = totalBillableFeet / 5280;
  const materialSubtotal = args.bomModel.materialIncludedInBid ? args.bomModel.materialsEscalated : 0;
  const engineering = totalBillableFeet * args.engineeringPerFt;
  const permitting = totalBillableFeet * args.permittingPerFt;
  const splicing = totalBillableFeet * args.splicingPerFt + Math.max(1, Math.ceil(totalBillableFeet / 12000)) * 7500;
  const buildingEntrance = args.buildingEntranceCount * args.buildingEntranceUnitCost;
  const isp = args.ispRequired ? Math.max(1, args.buildingEntranceCount) * args.ispUnitCost : 0;
  const diversityPremium = routeRequiresGeographicDiversity(args.diversityModel)
    ? (args.civilModel.routeCivilSubtotal + materialSubtotal) * (clamp(args.diversityPremiumPercent, 0, 50) / 100)
    : 0;

  const directBase =
    args.civilModel.routeCivilSubtotal +
    materialSubtotal +
    args.nodeModel.nodeCapex +
    args.bomModel.transportEquipment +
    engineering +
    permitting +
    splicing +
    buildingEntrance +
    isp +
    diversityPremium;
  const programManagement = directBase * (clamp(args.pmOverheadPercent, 0, 30) / 100);
  const insurance = directBase * (clamp(args.insurancePercent, 0, 15) / 100);
  const qc = directBase * (clamp(args.qcPercent, 0, 15) / 100);
  const program = args.mobilization + programManagement + insurance + qc;
  const subtotal = directBase + program;
  const contingency = subtotal * (clamp(args.riskPercent, 0, 50) / 100);
  const riskedCost = subtotal + contingency;
  const margin = riskedCost * (clamp(args.marginPercent, 0, 60) / 100);
  const totalBid = riskedCost + margin;
  const monthlyRecovery36 = totalBid / 36;
  const monthlyRecovery60 = totalBid / 60;
  const monthlyRecovery120 = totalBid / 120;
  const monthlyOpex = args.nodeModel.nodeMonthlyOpex;
  const totalMonthlyChargeSuggested = monthlyRecovery60 + monthlyOpex;

  const demandWarnings = demandWarningsForFinancial(args.demandSets, totalBid);
  const warnings = [...args.warnings, ...args.civilModel.warnings, ...args.nodeModel.warnings, ...demandWarnings];
  const assumptions = [
    `${NETWORK_LABELS[args.networkType]} preset applied`,
    `${DIVERSITY_LABELS[args.diversityModel]} diversity model`,
    `${args.bomModel.ductCount} duct(s) at ${args.bomModel.ductDiameterIn}" and ${args.bomModel.fiberCount}ct fiber`,
    args.bomModel.materialIncludedInBid ? "Materials included in bid" : "Owner-furnished materials excluded from bid",
    args.preset.warning,
  ];

  const budgetLineItems: LineItem[] = [
    lineItem("direct_civil_labor", "Direct civil labor", "financial", "ft", totalBillableFeet, args.civilModel.directCivilLabor / Math.max(1, totalBillableFeet)),
    lineItem("civil_restoration_make_ready_crossings", "Restoration, make-ready, crossings", "financial", "each", 1, args.civilModel.routeCivilSubtotal - args.civilModel.directCivilLabor),
    lineItem("materials", "Materials", "financial", "bundle", 1, materialSubtotal),
    lineItem("node_capex", "Node infrastructure", "financial", "bundle", 1, args.nodeModel.nodeCapex),
    lineItem("transport_equipment", "Transport equipment", "financial", "bundle", 1, args.bomModel.transportEquipment),
    lineItem("engineering", "Engineering", "financial", "ft", totalBillableFeet, args.engineeringPerFt),
    lineItem("permitting", "Permitting", "financial", "ft", totalBillableFeet, args.permittingPerFt),
    lineItem("splicing", "Splicing / test", "financial", "ft", totalBillableFeet, splicing / Math.max(1, totalBillableFeet)),
    lineItem("building_entrance", "Building entrance", "financial", "entrance", args.buildingEntranceCount, args.buildingEntranceUnitCost),
    lineItem("isp", "ISP / inside plant", "financial", "site", args.ispRequired ? Math.max(1, args.buildingEntranceCount) : 0, args.ispUnitCost),
    lineItem("diversity_premium", "Diversity premium", "financial", "each", 1, diversityPremium),
    lineItem("program", "Program", "financial", "each", 1, program),
    lineItem("contingency", "Contingency", "financial", "each", 1, contingency),
    lineItem("margin", "Margin", "financial", "each", 1, margin),
    lineItem("total_bid", "Total bid", "financial", "each", 1, totalBid),
  ];

  return {
    routeFeet: args.routeFeet,
    routeMiles,
    primaryRouteFeet: args.primaryRouteFeet,
    diverseRouteFeet: args.diverseRouteFeet,
    totalBillableFeet,
    civilSubtotal: args.civilModel.routeCivilSubtotal,
    materialSubtotal,
    nodeCapex: args.nodeModel.nodeCapex,
    transportEquipment: args.bomModel.transportEquipment,
    engineering,
    permitting,
    splicing,
    buildingEntrance,
    isp,
    mobilization: args.mobilization,
    programManagement,
    insurance,
    qc,
    contingency,
    riskedCost,
    margin,
    totalBid,
    monthlyRecovery36,
    monthlyRecovery60,
    monthlyRecovery120,
    monthlyOpex,
    totalMonthlyChargeSuggested,
    costPerFoot: totalBillableFeet > 0 ? totalBid / totalBillableFeet : 0,
    costPerMile: totalBillableMiles > 0 ? totalBid / totalBillableMiles : 0,
    capexPerRouteMile: routeMiles > 0 ? totalBid / routeMiles : 0,
    bomLineItems: args.bomModel.bomLineItems,
    civilLineItems: args.civilModel.civilLineItems,
    nodeLineItems: args.nodeModel.nodeLineItems,
    opexLineItems: args.nodeModel.opexLineItems,
    budgetLineItems,
    warnings,
    assumptions,

    directCivilLabor: args.civilModel.directCivilLabor,
    materialsBase: args.bomModel.materialSubtotal,
    materialsEscalated: args.bomModel.materialsEscalated,
    materialsIncludedInBid: args.bomModel.materialIncludedInBid,
    crossings: args.civilModel.crossings,
    nodes: args.nodeModel.nodeCapex,
    program,
    subtotal,
    recovery60: monthlyRecovery60,
    recovery120: monthlyRecovery120,
    weightedCivilPerFt: args.civilModel.weightedCivilPerFt,
    ductCount: args.bomModel.ductCount,
    ductDiameterIn: args.bomModel.ductDiameterIn,
    regenSites: args.nodeModel.regenCount,
    popSites: args.nodeModel.popCount,
    aggSites: args.nodeModel.aggCount,
    materialBreakdown: args.bomModel.materialBreakdown,
  } satisfies DesignFinancialModel;
}

function demandWarningsForFinancial(demandSets: DemandSet[], totalBid: number) {
  const warnings: string[] = [];
  const expectedValue = demandSets.reduce((acc, demand) => {
    const recurring = demand.expectedMrc * demand.termMonths;
    return acc + (recurring + demand.nrc - demand.buildCost) * (clamp(demand.probability, 0, 100) / 100);
  }, 0);
  if (demandSets.length && expectedValue < totalBid * 0.35) {
    warnings.push("Demand-adjusted revenue value is light relative to build cost; validate beta demand assumptions.");
  }
  return warnings;
}

function computeAdjacencyScore(inputs: AdjacencyInputs, weights = DEFAULT_WEIGHTS) {
  const i = {
    hyperscalerProximity: clamp(inputs.hyperscalerProximity, 0, 100),
    latencyBand: clamp(inputs.latencyBand, 0, 100),
    powerAvailability: clamp(inputs.powerAvailability, 0, 100),
    routeCohesion: clamp(inputs.routeCohesion, 0, 100),
    capitalEfficiencyDelta: clamp(inputs.capitalEfficiencyDelta, 0, 100),
  };

  const score =
    i.hyperscalerProximity * weights.hyperscalerProximity +
    i.latencyBand * weights.latencyBand +
    i.powerAvailability * weights.powerAvailability +
    i.routeCohesion * weights.routeCohesion +
    i.capitalEfficiencyDelta * weights.capitalEfficiencyDelta;

  return Math.round(score);
}

function tierFromScore(score: number) {
  if (score >= 80) return "Strategic GPU Candidate";
  if (score >= 65) return "Conditional / JV Candidate";
  if (score >= 50) return "Monitor";
  return "Transport Only";
}

function deploymentFromScore(score: number): DeploymentType {
  if (score >= 85) return "GPU POD";
  if (score >= 75) return "GPU Micro";
  if (score >= 60) return "ILA";
  if (score >= 45) return "Regen";
  return "Transport";
}

function nodeVisualColor(typeOrDeployment: NodeType | DeploymentType) {
  switch (typeOrDeployment) {
    case "GPU_POD":
    case "GPU POD":
      return "#a855f7";
    case "GPU_MICRO":
    case "GPU Micro":
      return "#c084fc";
    case "ILA":
      return "#22c55e";
    case "REGEN":
    case "Regen":
      return "#38bdf8";
    case "POP":
      return "#f59e0b";
    case "AGG":
      return "#14b8a6";
    case "DCI_HANDOFF":
      return "#f43f5e";
    case "ACCESS_HANDOFF":
      return "#84cc16";
    default:
      return "#94a3b8";
  }
}

function buildRouteNodes(routeCoords: LonLat[], counts: Partial<NodeCounts>): SVANode[] {
  if (routeCoords.length < 2) return [];
  const line = turf.lineString(routeCoords);
  const totalKm = turf.length(line, { units: "kilometers" });
  const totalMi = totalKm * 0.621371;
  const nodes: SVANode[] = [];

  const addNodeAtFrac = (type: NodeType, frac: number, idx: number) => {
    const km = totalKm * clamp(frac, 0, 1);
    const pt = turf.along(line, km, { units: "kilometers" });
    nodes.push({
      id: `${type}-${idx}-${Math.round(km * 1000)}`,
      type,
      km,
      mi: km * 0.621371,
      coord: pt.geometry.coordinates as LonLat,
    });
  };

  const endpointTypes: NodeType[] = [];
  if ((counts.POP ?? 0) > 0) endpointTypes.push("POP");
  if ((counts.DCI_HANDOFF ?? 0) > 0) endpointTypes.push("DCI_HANDOFF");
  if ((counts.ACCESS_HANDOFF ?? 0) > 0) endpointTypes.push("ACCESS_HANDOFF");
  if (!endpointTypes.length) endpointTypes.push("POP");

  endpointTypes.forEach((type, index) => {
    addNodeAtFrac(type, 0, index);
    addNodeAtFrac(type, 1, index + 100);
  });

  addEvenInteriorNodes("POP", Math.max(0, (counts.POP ?? 0) - 2));
  addEvenInteriorNodes("AGG", counts.AGG ?? 0);
  addEvenInteriorNodes("ILA", counts.ILA ?? 0);
  addEvenInteriorNodes("REGEN", counts.REGEN ?? 0);
  addEvenInteriorNodes("GPU_MICRO", counts.GPU_MICRO ?? 0);
  addEvenInteriorNodes("GPU_POD", counts.GPU_POD ?? 0);

  function addEvenInteriorNodes(type: NodeType, count: number) {
    const c = Math.max(0, Math.round(count));
    for (let i = 1; i <= c; i++) addNodeAtFrac(type, i / (c + 1), i);
  }

  nodes.sort((a, b) => a.km - b.km);
  const deduped: SVANode[] = [];
  for (const n of nodes) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(last.km - n.km) > Math.max(0.02, totalKm * 0.002)) {
      deduped.push(n);
    } else if (nodeRank(n.type) > nodeRank(last.type)) {
      deduped[deduped.length - 1] = n;
    }
  }

  if (deduped.length < 2) {
    return [
      { id: "POP-END-0", type: "POP", km: 0, mi: 0, coord: routeCoords[0] },
      { id: "POP-END-1", type: "POP", km: totalKm, mi: totalMi, coord: routeCoords[routeCoords.length - 1] },
    ];
  }

  return deduped;
}

function nodeRank(type: NodeType) {
  if (type === "GPU_POD") return 8;
  if (type === "GPU_MICRO") return 7;
  if (type === "DCI_HANDOFF") return 6;
  if (type === "POP") return 5;
  if (type === "ACCESS_HANDOFF") return 4;
  if (type === "AGG") return 3;
  if (type === "REGEN") return 2;
  return 1;
}

function computeSegmentValueScore(args: {
  corridorScore: number;
  segLengthMi: number;
  nodeAType: NodeType;
  nodeBType: NodeType;
  sitesNearMid: number;
}) {
  const adjBonus = (t: NodeType) => {
    if (t === "GPU_POD") return 18;
    if (t === "GPU_MICRO") return 15;
    if (t === "POP" || t === "DCI_HANDOFF") return 10;
    if (t === "AGG" || t === "ACCESS_HANDOFF") return 7;
    if (t === "ILA") return 4;
    return 3;
  };
  const adjacency = adjBonus(args.nodeAType) + adjBonus(args.nodeBType);
  const lengthPenalty = clamp(((args.segLengthMi - 10) / 70) * 25, 0, 25);
  const siteBonus = clamp(args.sitesNearMid * 5, 0, 20);
  return clamp(Math.round(args.corridorScore + adjacency + siteBonus - lengthPenalty), 0, 100);
}

function buildSVAResult(args: {
  routeCoords: LonLat[] | null;
  icdeMode: boolean;
  svaEnabled: boolean;
  corridorScore: number | null;
  sites: UploadedSitesRow[];
  counts: Partial<NodeCounts>;
}) {
  const empty = {
    nodes: [] as SVANode[],
    segments: [] as SVASegment[],
    nodeDeployment: new Map<string, { deployment: DeploymentType; score: number }>(),
  };
  if (!args.routeCoords?.length || !args.icdeMode || !args.svaEnabled || args.corridorScore === null) return empty;

  const nodes = buildRouteNodes(args.routeCoords, args.counts);
  const line = turf.lineString(args.routeCoords);
  const segments: SVASegment[] = [];

  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    const lengthMi = Math.max(0, b.mi - a.mi);
    const midKm = (a.km + b.km) / 2;
    const midPt = turf.along(line, midKm, { units: "kilometers" });
    const midCoord = midPt.geometry.coordinates as LonLat;
    const midPoint = turf.point(midCoord);
    let sitesNearMid = 0;

    for (const s of args.sites) {
      const d = turf.distance(midPoint, turf.point([s.lon, s.lat]), { units: "miles" });
      if (d <= 2.5) sitesNearMid++;
    }

    const score = computeSegmentValueScore({
      corridorScore: args.corridorScore,
      segLengthMi: lengthMi,
      nodeAType: a.type,
      nodeBType: b.type,
      sitesNearMid,
    });

    segments.push({ id: `SEG-${i}-${a.id}-${b.id}`, a, b, lengthMi, midCoord, score });
  }

  const maxScoreByNode = new Map<string, number>();
  for (const seg of segments) {
    maxScoreByNode.set(seg.a.id, Math.max(maxScoreByNode.get(seg.a.id) ?? 0, seg.score));
    maxScoreByNode.set(seg.b.id, Math.max(maxScoreByNode.get(seg.b.id) ?? 0, seg.score));
  }

  const nodeDeployment = new Map<string, { deployment: DeploymentType; score: number }>();
  for (const n of nodes) {
    const score = maxScoreByNode.get(n.id) ?? 0;
    nodeDeployment.set(n.id, { deployment: deploymentFromScore(score), score });
  }

  return { nodes, segments, nodeDeployment };
}

function initialDemandSet(): DemandSet {
  return {
    id: safeUUID(),
    type: "Hyperscaler",
    expectedMrc: 85000,
    nrc: 250000,
    termMonths: 60,
    probability: 55,
    buildCost: 0,
    requiredDiversity: "DIVERSE_PATH",
    requiredBandwidth: "400G",
    requiredClassOfService: "Protected low latency",
    routeDependency: "Primary route",
  };
}

function shouldUseLargeDatasetMode(file: File, force = false) {
  return force || file.size > LARGE_DATASET_THRESHOLD_BYTES;
}

function createSimplifiedRoutePreview(fullGeometry: LonLat[]) {
  if (fullGeometry.length <= LARGE_GEOMETRY_RENDER_LIMIT) return fullGeometry;
  const stride = Math.max(20, Math.ceil(fullGeometry.length / LARGE_GEOMETRY_RENDER_LIMIT));
  const previewRoute = fullGeometry.filter((_, idx) => idx % stride === 0);
  const last = fullGeometry[fullGeometry.length - 1];
  if (last && previewRoute[previewRoute.length - 1] !== last) previewRoute.push(last);
  return previewRoute;
}

function countGeometryPoints(lines: LonLat[][]) {
  return lines.reduce((total, line) => total + line.length, 0);
}

function flattenGeometryLines(lines: LonLat[][]) {
  return lines.flatMap((line) => line);
}

function baselineGraphDisplayMessage(graph: BaselineGraph) {
  const fullCount = countGeometryPoints(graph.fullGeometry);
  return (
    `Baseline graph stored: ${graph.nodes.length.toLocaleString()} nodes, ` +
    `${graph.edges.length.toLocaleString()} edges, ${graph.geometry.length.toLocaleString()} routes, ` +
    `${fullCount.toLocaleString()} source points, ${(graph.stations?.length ?? 0).toLocaleString()} graph stations. ` +
    "No economics, BOM, Design route stationing, or route modification generated."
  );
}

function baselineGraphFeatureCollection(graph: BaselineGraph) {
  return featureCollection(
    graph.edges
      .map((edge) => {
        const coordinates = edge.geometry.filter(
          (coord) =>
            Array.isArray(coord) &&
            coord.length >= 2 &&
            Number.isFinite(coord[0]) &&
            Number.isFinite(coord[1])
        );
        if (coordinates.length < 2) return null;
        return {
          type: "Feature" as const,
          properties: {
            edgeId: edge.edgeId,
            baselineId: graph.baselineId,
          },
          geometry: {
            type: "LineString" as const,
            coordinates,
          },
        };
      })
      .filter(Boolean) as any[]
  );
}

function baselineGraphSummary(graph: BaselineGraph) {
  const bounds = bboxFromBaselineGraph(graph);
  const sourcePointCount = countGeometryPoints(graph.fullGeometry);
  const totalLengthFt = graph.edges.reduce((sum, edge) => sum + (Number(edge.lengthFt) || 0), 0);
  return {
    baselineId: graph.baselineId,
    name: graph.name,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    routeCount: graph.geometry.length,
    sourcePointCount,
    stationCount: graph.stations?.length ?? 0,
    bounds,
    totalLengthFt: Math.round(totalLengthFt),
    totalLengthMiles: Number((totalLengthFt / 5280).toFixed(2)),
  };
}

function baselineGraphStationIntervalForZoom(zoom: number) {
  if (zoom < 13) return null;
  if (zoom < 15) return 1000;
  if (zoom < 17) return 100;
  return 10;
}

function paddedMapBounds(map: MapLibreMap): [number, number, number, number] {
  const bounds = map.getBounds();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const lonPad = Math.max(0.001, (east - west) * 0.2);
  const latPad = Math.max(0.001, (north - south) * 0.2);
  return [west - lonPad, south - latPad, east + lonPad, north + latPad];
}

function baselineGraphStationFeatureCollection(graph: BaselineGraph, map: MapLibreMap) {
  const interval = baselineGraphStationIntervalForZoom(map.getZoom());
  if (!interval) return featureCollection([]);
  const stations = generateGraphStations(graph, interval, {
    bounds: paddedMapBounds(map),
    maxStations: interval === 10 ? 2500 : interval === 100 ? 3500 : 5000,
  });
  return featureCollection(
    stations.map((station) =>
      turf.point([station.lon, station.lat], {
        stationId: station.stationId,
        edgeId: station.edgeId,
        label: station.stationId.split("-").slice(-1)[0],
        stationFeet: station.stationFeet,
        intervalFt: station.intervalFt,
      })
    )
  );
}

function updateBaselineGraphStationLayer(map: MapLibreMap, graph: BaselineGraph | null) {
  const source = map.getSource("baseline-graph-stations-source") as GeoJSONSource | undefined;
  if (!source) return;

  const interval = graph ? baselineGraphStationIntervalForZoom(map.getZoom()) : null;
  if (!graph || !interval) {
    source.setData(featureCollection([]));
    if (map.getLayer("baseline-graph-station-dots")) map.setLayoutProperty("baseline-graph-station-dots", "visibility", "none");
    if (map.getLayer("baseline-graph-station-labels")) {
      map.setLayoutProperty("baseline-graph-station-labels", "visibility", "none");
    }
    return;
  }

  source.setData(baselineGraphStationFeatureCollection(graph, map));
  if (map.getLayer("baseline-graph-station-dots")) map.setLayoutProperty("baseline-graph-station-dots", "visibility", "visible");
  if (map.getLayer("baseline-graph-station-labels")) {
    map.setLayoutProperty("baseline-graph-station-labels", "visibility", "visible");
  }
}

function bboxFromBaselineGraph(graph: BaselineGraph): [number, number, number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const edge of graph.edges) {
    for (const [lon, lat] of edge.geometry) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  }

  if (![minLon, minLat, maxLon, maxLat].every(Number.isFinite)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

function largeBaselinePreviewMessage(fullCount: number, previewCount: number) {
  return (
    "Large baseline stored server-side. Full geometry exceeds safe rendering threshold. " +
    `Using simplified preview (${previewCount.toLocaleString()} of ${fullCount.toLocaleString()} points). ` +
    "Use Prism serviceability analysis for large-scale evaluation."
  );
}

function baselinePreviewCivilModel(routeMix: RouteMix, undergroundMix: UndergroundMix): CivilCostModel {
  return {
    inputRouteFeet: 0,
    undergroundFeet: 0,
    aerialFeet: 0,
    existingConduitFeet: 0,
    undergroundMix: normalizePercentMix(undergroundMix),
    routeMix: normalizePercentMix(routeMix),
    undergroundCivilLabor: 0,
    aerialLabor: 0,
    existingConduitLabor: 0,
    restoration: 0,
    makeReady: 0,
    crossings: 0,
    directCivilLabor: 0,
    routeCivilSubtotal: 0,
    civilCostPerFoot: 0,
    weightedCivilPerFt: 0,
    civilLineItems: [],
    warnings: [],
  };
}

function baselinePreviewBomModel(): BomModel {
  return {
    ductCount: 0,
    ductDiameterIn: 0,
    fiberCount: 0,
    materialSubtotal: 0,
    materialEscalation: 0,
    materialsEscalated: 0,
    materialIncludedInBid: false,
    materialCostPerFoot: 0,
    transportEquipment: 0,
    bomLineItems: [],
    materialBreakdown: {
      conduit: 0,
      innerduct: 0,
      fiber: 0,
      tracer: 0,
      handholes: 0,
      vaults: 0,
      spliceClosures: 0,
      restoration: 0,
    },
  };
}

function emptyNodeCounts(): NodeCounts {
  return {
    POP: 0,
    AGG: 0,
    REGEN: 0,
    ILA: 0,
    DCI_HANDOFF: 0,
    ACCESS_HANDOFF: 0,
    GPU_MICRO: 0,
    GPU_POD: 0,
  };
}

function baselinePreviewNodeInfrastructureModel(): NodeInfrastructureModel {
  return {
    nodeLineItems: [],
    opexLineItems: [],
    nodeCapex: 0,
    nodeMonthlyOpex: 0,
    regenCount: 0,
    ilaCount: 0,
    popCount: 0,
    aggCount: 0,
    gpuCandidateCount: 0,
    powerReadinessScore: 0,
    realEstateReadinessScore: 0,
    counts: emptyNodeCounts(),
    warnings: [],
  };
}

function emptySVAResult() {
  return {
    nodes: [] as SVANode[],
    segments: [] as SVASegment[],
    nodeDeployment: new Map<string, { deployment: DeploymentType; score: number }>(),
  };
}

function baselinePreviewFinancialModel(args: {
  fullGeometryCount: number;
  previewRouteCount: number;
  displayMode: "BASELINE_PREVIEW" | "DESIGN";
}): DesignFinancialModel {
  const materialBreakdown = {
    conduit: 0,
    innerduct: 0,
    fiber: 0,
    tracer: 0,
    handholes: 0,
    vaults: 0,
    spliceClosures: 0,
    restoration: 0,
  };

  return {
    routeFeet: 0,
    routeMiles: 0,
    primaryRouteFeet: 0,
    diverseRouteFeet: 0,
    totalBillableFeet: 0,
    civilSubtotal: 0,
    materialSubtotal: 0,
    nodeCapex: 0,
    transportEquipment: 0,
    engineering: 0,
    permitting: 0,
    splicing: 0,
    buildingEntrance: 0,
    isp: 0,
    mobilization: 0,
    programManagement: 0,
    insurance: 0,
    qc: 0,
    contingency: 0,
    riskedCost: 0,
    margin: 0,
    totalBid: 0,
    monthlyRecovery36: 0,
    monthlyRecovery60: 0,
    monthlyRecovery120: 0,
    monthlyOpex: 0,
    totalMonthlyChargeSuggested: 0,
    costPerFoot: 0,
    costPerMile: 0,
    capexPerRouteMile: 0,
    bomLineItems: [],
    civilLineItems: [],
    nodeLineItems: [],
    opexLineItems: [],
    budgetLineItems: [],
    warnings: [],
    assumptions: [
      "Existing network baseline preview",
      `Display mode: ${args.displayMode}`,
      `Full geometry points: ${args.fullGeometryCount.toLocaleString()}`,
      `Preview route points: ${args.previewRouteCount.toLocaleString()}`,
      "Budget not required for existing baseline",
    ],

    directCivilLabor: 0,
    materialsBase: 0,
    materialsEscalated: 0,
    materialsIncludedInBid: false,
    crossings: 0,
    nodes: 0,
    program: 0,
    subtotal: 0,
    recovery60: 0,
    recovery120: 0,
    weightedCivilPerFt: 0,
    ductCount: 0,
    ductDiameterIn: 0,
    regenSites: 0,
    popSites: 0,
    aggSites: 0,
    materialBreakdown,
  };
}

function bboxFromCoords(coords: LonLat[]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLon, minLat, maxLon, maxLat];
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function diagnosticsFromJob(job: IngestionJob): Partial<LargeDatasetDiagnostics> {
  return {
    uploadId: job.uploadId,
    jobId: job.jobId,
    rowsRead: job.rowsRead,
    pointsAccepted: job.pointsAccepted,
    rowsRejected: job.rowsRejected,
    progressPct: job.progressPct,
    baselineId: job.baselineId,
    status: job.status,
    message: job.message,
  };
}

async function runLargeDatasetIngestion(args: {
  file: File;
  metadata: Record<string, unknown>;
  onUpdate: (patch: Partial<LargeDatasetDiagnostics>) => void;
}) {
  console.log("LARGE DATASET MODE ENABLED", { file: args.file.name, size: args.file.size, apiTarget: CHICAGO_API });
  args.onUpdate({
    mode: "Large Dataset Mode",
    apiTarget: CHICAGO_API,
    status: "Uploading",
    message: "Uploading raw file to Chicago.",
  });

  console.log("UPLOAD STARTED", { file: args.file.name });
  const upload = await uploadRawDataset(args.file, args.metadata);
  console.log("UPLOAD COMPLETE", upload);
  args.onUpdate({
    uploadId: upload.uploadId,
    status: "Uploaded",
    message: "Raw upload complete.",
  });

  const startedJob = await startIngestion(upload.uploadId, args.metadata);
  console.log("INGESTION JOB STARTED", startedJob);
  args.onUpdate({
    ...diagnosticsFromJob(startedJob),
    status: startedJob.status === "Queued" ? "Queued" : startedJob.status,
  });

  let job = startedJob;
  while (!["Complete", "Failed", "Canceled"].includes(job.status)) {
    await sleep(2000);
    job = await getIngestionJob(job.jobId);
    console.log("INGESTION PROGRESS", job);
    args.onUpdate(diagnosticsFromJob(job));
  }

  if (job.status === "Complete") console.log("INGESTION COMPLETE", job);
  return job;
}

export default function DMdesigndev(props: DesignModeProps) {
  const {
    corridorId,
    segmentId,
    scopeVersionId,
    setScopeVersionId,
    routeCoords,
    setRouteCoords,
    sites,
    setSites,
    designStations,
    setDesignStations,
    opportunityBatch,
  } = props;
  console.log("DMREDLINE SETTER IDENTITY", setRouteCoords);
  console.log(
    "DMREDLINE SETTER MATCHES APP",
    typeof window !== "undefined" ? (window as any).__hyperlinxAppSetRouteCoords === setRouteCoords : "no-window"
  );
  console.log("DMREDLINE ROUTE PROP LENGTH DURING RENDER", routeCoords?.length ?? 0);

  const mapRef = useRef<MapLibreMap | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const previousRouteCoordsRef = useRef<LonLat[] | null>(null);

  const [status, setStatus] = useState("Ready");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [translateStatus, setTranslateStatus] = useState("Translate ready");
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [translatePreview, setTranslatePreview] = useState<NormalizedPreview | null>(null);
  const [forceLargeDatasetMode, setForceLargeDatasetMode] = useState(false);
  const [translateLargeDataset, setTranslateLargeDataset] = useState<LargeDatasetDiagnostics>(() =>
    initialLargeDatasetDiagnostics()
  );
  const [designIngestionDiagnostics, setDesignIngestionDiagnostics] = useState<LargeDatasetDiagnostics>(() =>
    initialLargeDatasetDiagnostics()
  );
  const [baseRouteCoords, setBaseRouteCoords] = useState<LonLat[] | null>(null);
  const [assembledSpine, setAssembledSpine] = useState<LonLat[] | null>(null);
  const [isImportedFiber, setIsImportedFiber] = useState(false);

  const [networkType, setNetworkType] = useState<NetworkDesignType>(DEFAULTS.networkType);
  const [productType, setProductType] = useState<ProductType>(DEFAULTS.productType);
  const [diversityModel, setDiversityModel] = useState<DiversityModel>(NETWORK_PRESETS[DEFAULTS.networkType].defaultDiversity);

  const preset = NETWORK_PRESETS[networkType];
  const role = roleFromNetworkType(networkType);

  const [showStationing, setShowStationing] = useState(DEFAULTS.showStationing);
  const [stationSpacingFt, setStationSpacingFt] = useState(preset.stationSpacingFt);
  const [snapToStreets, setSnapToStreets] = useState(DEFAULTS.snapToStreets);
  const [waypointSpacingMiles, setWaypointSpacingMiles] = useState(DEFAULTS.waypointSpacingMiles);
  const [corridorSeparationMiles, setCorridorSeparationMiles] = useState(DEFAULTS.corridorSeparationMiles);
  const [protectionRouteMultiplier, setProtectionRouteMultiplier] = useState(DEFAULTS.protectionRouteMultiplier);
  const [protectionRouteLengthOverrideMiles, setProtectionRouteLengthOverrideMiles] = useState(
    DEFAULTS.protectionRouteLengthOverrideMiles
  );
  const [diversityPremiumPercent, setDiversityPremiumPercent] = useState(DEFAULTS.diversityPremiumPercent);

  const [routeMix, setRouteMix] = useState<RouteMix>(preset.routeMix);
  const [undergroundMix, setUndergroundMix] = useState<UndergroundMix>(preset.undergroundMix);
  const normalizedRouteMix = useMemo(() => normalizePercentMix(routeMix), [routeMix]);
  const normalizedUndergroundMix = useMemo(() => normalizePercentMix(undergroundMix), [undergroundMix]);
  const [urbanRestorationPct, setUrbanRestorationPct] = useState(35);
  const [ruralRestorationPct, setRuralRestorationPct] = useState(45);
  const [aerialMakeReadyCount, setAerialMakeReadyCount] = useState(DEFAULTS.aerialMakeReadyCount);
  const [poleTransferCount, setPoleTransferCount] = useState(DEFAULTS.poleTransferCount);
  const [roadCrossings, setRoadCrossings] = useState(DEFAULTS.roadCrossings);
  const [railCrossings, setRailCrossings] = useState(DEFAULTS.railCrossings);
  const [waterCrossings, setWaterCrossings] = useState(DEFAULTS.waterCrossings);
  const [bridgeCrossings, setBridgeCrossings] = useState(DEFAULTS.bridgeCrossings);

  const [ductConfig, setDuctConfig] = useState<DuctConfig>(preset.ductConfig);
  const [customDuctCount, setCustomDuctCount] = useState(4);
  const [customDuctDiameterIn, setCustomDuctDiameterIn] = useState(1.5);
  const [fiberCountOption, setFiberCountOption] = useState<FiberCountOption>(preset.fiberCount);
  const [customFiberCount, setCustomFiberCount] = useState(864);
  const [ownerFurnishedMaterials, setOwnerFurnishedMaterials] = useState(DEFAULTS.ownerFurnishedMaterials);
  const [materialsEscalationPercent, setMaterialsEscalationPercent] = useState(DEFAULTS.materialsEscalationPercent);
  const [expansionReservePct, setExpansionReservePct] = useState(preset.expansionReservePct);

  const [includeRegens, setIncludeRegens] = useState(true);
  const [includePops, setIncludePops] = useState(true);
  const [includeAgg, setIncludeAgg] = useState(true);
  const [spanMiles, setSpanMiles] = useState(preset.spanMiles);
  const [popCount, setPopCount] = useState(preset.popCount);
  const [aggCount, setAggCount] = useState(preset.aggCount);
  const [gpuMicroCount, setGpuMicroCount] = useState(0);
  const [gpuPodCount, setGpuPodCount] = useState(0);
  const [powerAvailability, setPowerAvailability] = useState(65);
  const [realEstateAvailability, setRealEstateAvailability] = useState(60);

  const [riskPercent, setRiskPercent] = useState(DEFAULTS.riskPercent);
  const [marginPercent, setMarginPercent] = useState(DEFAULTS.marginPercent);
  const [engineeringPerFt, setEngineeringPerFt] = useState(preset.engineeringPerFt);
  const [permittingPerFt, setPermittingPerFt] = useState(preset.permittingPerFt);
  const [splicingPerFt, setSplicingPerFt] = useState(DEFAULTS.splicingPerFt);
  const [buildingEntranceUnitCost, setBuildingEntranceUnitCost] = useState(DEFAULTS.buildingEntranceUnitCost);
  const [ispUnitCost, setIspUnitCost] = useState(DEFAULTS.ispUnitCost);
  const [mobilization, setMobilization] = useState(DEFAULTS.mobilization);
  const [pmOverheadPercent, setPmOverheadPercent] = useState(DEFAULTS.pmOverheadPercent);
  const [insurancePercent, setInsurancePercent] = useState(DEFAULTS.insurancePercent);
  const [qcPercent, setQcPercent] = useState(DEFAULTS.qcPercent);

  const [icdeMode, setIcdeMode] = useState(false);
  const [svaEnabled, setSvaEnabled] = useState(false);
  const [svaThreshold, setSvaThreshold] = useState(60);
  const [haaInputs, setHaaInputs] = useState<AdjacencyInputs>({
    hyperscalerProximity: 70,
    latencyBand: 65,
    powerAvailability: 55,
    routeCohesion: 70,
    capitalEfficiencyDelta: 60,
  });

  const [demandSets, setDemandSets] = useState<DemandSet[]>([initialDemandSet()]);
  const [expandedSections, setExpandedSections] = useState({
    design: true,
    ingest: true,
    route: true,
    civil: false,
    bom: false,
    nodes: false,
    demand: false,
    financial: true,
    scope: true,
  });

  const [accountId, setAccountId] = useState("fiberlight-beta");
  const [baselineName, setBaselineName] = useState("FiberLight existing network");
  const [storedBaselines, setStoredBaselines] = useState<StoredBaselineMetadata[]>([]);
  const [selectedBaselineDatasetId, setSelectedBaselineDatasetId] = useState("");
  const [currentDatasetType, setCurrentDatasetType] = useState<DatasetType | null>(null);
  const [currentBaselineScopeVersionId, setCurrentBaselineScopeVersionId] = useState<string | null>(null);
  const currentBaselineGraphRef = useRef<BaselineGraph | null>(null);
  const [currentBaselineGraphVersion, setCurrentBaselineGraphVersion] = useState(0);
  const [currentBaselineGraphStats, setCurrentBaselineGraphStats] = useState<{
    baselineId: string;
    nodes: number;
    edges: number;
    stations: number;
    fullGeometryCount: number;
  } | null>(null);
  const currentBaselineGraph = currentBaselineGraphRef.current;
  function setCurrentBaselineGraph(graph: BaselineGraph | null) {
    const hadGraph = Boolean(currentBaselineGraphRef.current);
    currentBaselineGraphRef.current = graph;
    if (graph) {
      const stats = {
        baselineId: graph.baselineId,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        stations: graph.stations.length,
        fullGeometryCount: countGeometryPoints(graph.fullGeometry),
      };
      if (!hadGraph) console.log("GRAPH MEMORY STORE CREATED", { baselineId: graph.baselineId });
      console.log("GRAPH MEMORY STORE UPDATED", stats);
      setCurrentBaselineGraphStats(stats);
    } else {
      setCurrentBaselineGraphStats(null);
    }
    setCurrentBaselineGraphVersion((version) => version + 1);
  }
  const [lastRouteSourceFilename, setLastRouteSourceFilename] = useState<string | undefined>();
  const activeBaseline = storedBaselines.find((baseline) => baseline.datasetId === selectedBaselineDatasetId) ?? null;
  const isBaselineGraph = currentDatasetType === "BASELINE_GRAPH" || Boolean(currentBaselineGraphStats);
  const fullGeometryCount = currentBaselineGraphStats
    ? currentBaselineGraphStats.fullGeometryCount
    : (baseRouteCoords?.length ?? routeCoords?.length ?? 0);
  const previewRouteCount = routeCoords?.length ?? 0;
  const isLargeStoredBaseline =
    ((activeBaseline as any)?.datasetType === "EXISTING_NETWORK" || currentDatasetType === "EXISTING_NETWORK") &&
    fullGeometryCount > LARGE_GEOMETRY_RENDER_LIMIT;
  const designProcessingDisabled = isBaselineGraph || isLargeStoredBaseline;
  const baselineRenderMetadata = {
    fullGeometryCount,
    previewRouteCount,
    budgetRequired: designProcessingDisabled || currentDatasetType === "EXISTING_NETWORK" ? false : true,
    datasetType: isBaselineGraph
      ? "BASELINE_GRAPH"
      : isLargeStoredBaseline || currentDatasetType === "EXISTING_NETWORK"
        ? "EXISTING_NETWORK"
        : (currentDatasetType ?? "DESIGN_INPUT"),
    displayMode: designProcessingDisabled ? ("BASELINE_PREVIEW" as const) : ("DESIGN" as const),
  };

  if (designProcessingDisabled) {
    if (isBaselineGraph) console.log("BASELINE GRAPH RENDER MODE ENABLED", baselineRenderMetadata);
    if (isLargeStoredBaseline) console.log("LARGE BASELINE RENDER MODE ENABLED", baselineRenderMetadata);
    console.log("SKIPPING HEAVY DESIGN CALCS FOR STORED BASELINE");
  }

  useEffect(() => {
    const nextPreset = NETWORK_PRESETS[networkType];
    setStationSpacingFt(nextPreset.stationSpacingFt);
    setDiversityModel(nextPreset.defaultDiversity);
    setRouteMix(nextPreset.routeMix);
    setUndergroundMix(nextPreset.undergroundMix);
    setDuctConfig(nextPreset.ductConfig);
    setFiberCountOption(nextPreset.fiberCount);
    setExpansionReservePct(nextPreset.expansionReservePct);
    setEngineeringPerFt(nextPreset.engineeringPerFt);
    setPermittingPerFt(nextPreset.permittingPerFt);
    setSpanMiles(nextPreset.spanMiles);
    setPopCount(nextPreset.popCount);
    setAggCount(nextPreset.aggCount);
    setProductType(productDefaultForNetwork(networkType));
    setGpuMicroCount(networkType === "GPU_CLUSTER_INTERCONNECT" ? 1 : 0);
    setGpuPodCount(0);
    setCorridorSeparationMiles((m) => (m === 0 ? DEFAULTS.corridorSeparationMiles : m));
  }, [networkType]);

  useEffect(() => {
    console.log("LOCAL UI USING CHICAGO API", CHICAGO_API);
    void refreshStoredBaselines();
  }, []);

  useEffect(() => {
    const length = routeCoords?.length ?? 0;
    const sameReference = routeCoords === previousRouteCoordsRef.current;
    console.log("ROUTECOORDS SET", routeCoords?.length ?? 0);
    console.log("ROUTECOORDS PROP RECEIVED LENGTH", length);
    console.log("ROUTECOORDS PROP RECEIVED SOURCE", "DMredlinedev");
    console.log("ROUTECOORDS PROP RECEIVED SAME REFERENCE", sameReference);
    console.log("ROUTECOORDS REFERENCE", sameReference);
    previousRouteCoordsRef.current = routeCoords;
  }, [routeCoords]);

  useEffect(() => {
    const length = routeCoords?.length ?? 0;
    console.log("MAP COMPONENT RECEIVED ROUTE LENGTH", length);
    console.log("MAP COMPONENT RECEIVED ROUTE SOURCE", "DMredlinedev map-panel");
    console.log("MAP COMPONENT RECEIVED ROUTE MAPLOADED", mapLoaded);
    console.log("MAP COMPONENT RECEIVED ROUTE HAS MAP", Boolean(mapRef.current));
    console.log("MAP COMPONENT RECEIVED ROUTE HAS ROUTE SOURCE", Boolean(mapRef.current?.getSource("route")));
  }, [routeCoords, mapLoaded]);

  useEffect(() => {
    if (!opportunityBatch) return;

    let cancelled = false;
    async function hydrateOpportunityBatchBaseline() {
      try {
        const baselines = await refreshStoredBaselines();
        const baselineMeta =
          baselines.find((item) => item.baselineScopeVersionId === opportunityBatch.baselineScopeVersionId) ?? null;
        const baseline = baselineMeta ? await loadBaseline(baselineMeta.datasetId) : null;
        if (cancelled) return;

        setCurrentDatasetType("OPPORTUNITY_BATCH");
        setCurrentBaselineScopeVersionId(opportunityBatch.baselineScopeVersionId);
        setSelectedBaselineDatasetId(baselineMeta?.datasetId ?? "");

        const graph = baseline?.datasetType === "BASELINE_GRAPH" ? baseline.graph : null;
        const fullGeometry = baseline?.routeCoords ?? [];
        const previewRoute = !graph && fullGeometry.length ? createSimplifiedRoutePreview(fullGeometry) : [];

        if (graph) {
          console.log("BASELINE STATE UPDATE", {
            graphEdges: graph.edges.length,
            graphNodes: graph.nodes.length,
            fullGeometry: countGeometryPoints(graph.fullGeometry),
          });
          setCurrentBaselineGraph(graph);
          setBaseRouteCoords(null);
          setRouteCoords(null);
          setIsImportedFiber(true);
          setAssembledSpine(null);
          setDesignStations([]);
        } else {
          setCurrentBaselineGraph(null);
        }

        if (!graph && fullGeometry.length) {
          console.log("BASELINE STATE UPDATE", {
            fullGeometry: fullGeometry.length,
            previewRoute: previewRoute.length,
          });
          setBaseRouteCoords(fullGeometry);
          setRouteCoords((prev) => {
            console.log("SETROUTECOORDS COMMIT REQUEST");
            console.log("SETROUTECOORDS COMMIT REQUEST SOURCE", "DMredlinedev.opportunityBatchBaseline");
            console.log("SETROUTECOORDS COMMIT REQUEST PREV LENGTH", prev?.length ?? 0);
            console.log("SETROUTECOORDS COMMIT REQUEST NEXT LENGTH", previewRoute.length);
            return previewRoute;
          });
          console.log("ROUTECOORDS SET", previewRoute.length);
          setIsImportedFiber(true);
          setAssembledSpine(null);
          const isLargeBaselinePreview = previewRoute.length !== fullGeometry.length;
          setDesignStations(
            baseline.stations?.length
                ? baseline.stations
                : isLargeBaselinePreview
                  ? []
                  : designStationsFromRoute(previewRoute, stationSpacingFt)
          );
        }

        setSites(
          opportunityBatch.selectedSites.map((site, index) => ({
            name: site.name || site.siteId,
            lat: site.lat,
            lon: site.lon,
            order: index + 1,
          }))
        );
        setStatus(
          graph
            ? `${baselineGraphDisplayMessage(graph)} Opportunity batch loaded: ${opportunityBatch.selectedSites.length} selected sites.`
            : fullGeometry.length > LARGE_GEOMETRY_RENDER_LIMIT
            ? `${largeBaselinePreviewMessage(fullGeometry.length, previewRoute.length)} Opportunity batch loaded: ${opportunityBatch.selectedSites.length} selected sites.`
            : `Opportunity batch loaded: ${opportunityBatch.selectedSites.length} selected sites. Budget is required for reconfiguration.`
        );
      } catch (err: any) {
        if (!cancelled) {
          setStatus(`Opportunity batch baseline load failed: ${err?.message ?? String(err)}`);
        }
      }
    }

    void hydrateOpportunityBatchBaseline();
    return () => {
      cancelled = true;
    };
  }, [opportunityBatch, setDesignStations, setRouteCoords, setSites, stationSpacingFt]);

  const primaryRouteFeet = useMemo(() => {
    if (designProcessingDisabled) return 0;
    return routeCoords?.length ? calcRouteFeet(routeCoords) : 0;
  }, [routeCoords, designProcessingDisabled]);
  const diverseRouteFeet = useMemo(
    () => {
      if (designProcessingDisabled) return 0;
      return computeDiverseRouteFeet({
        primaryRouteFeet,
        diversityModel,
        protectionRouteLengthOverrideMiles,
        protectionRouteMultiplier,
      });
    },
    [designProcessingDisabled, primaryRouteFeet, diversityModel, protectionRouteLengthOverrideMiles, protectionRouteMultiplier]
  );
  const totalBillableFeet = primaryRouteFeet + diverseRouteFeet;
  const routeMiles = primaryRouteFeet / 5280;
  const totalBillableMiles = totalBillableFeet / 5280;

  const protectionRouteCoords = useMemo(() => {
    if (designProcessingDisabled) return null;
    if (!routeCoords?.length || diversityModel === "LINEAR") return null;
    const offset =
      diversityModel === "SAME_ROUTE_REDUNDANT_DUCT"
        ? Math.max(0.03, corridorSeparationMiles * 0.2)
        : Math.max(0.05, corridorSeparationMiles);
    return offsetLineForCorridor(routeCoords, offset);
  }, [routeCoords, diversityModel, corridorSeparationMiles, designProcessingDisabled]);

  const nodeCountSeed = useMemo<Partial<NodeCounts>>(
    () => {
      if (designProcessingDisabled) return emptyNodeCounts();
      return {
        POP: includePops ? popCount : 0,
        AGG: includeAgg ? aggCount : 0,
        ILA:
          includeRegens && ["LONGHAUL", "MIDDLE_MILE", "HYPERSCALER_BACKBONE"].includes(networkType)
            ? computeIntermediateSites(totalBillableMiles, spanMiles)
            : 0,
        REGEN:
          includeRegens && ["LONGHAUL", "MIDDLE_MILE", "HYPERSCALER_BACKBONE"].includes(networkType)
            ? computeIntermediateSites(totalBillableMiles, Math.max(spanMiles * 3, 120))
            : 0,
        DCI_HANDOFF:
          networkType === "DCI" || networkType === "GPU_CLUSTER_INTERCONNECT"
            ? Math.max(preset.dciHandoffCount, diversityModel === "PROTECTED_DCI" ? 4 : 2)
            : 0,
        ACCESS_HANDOFF: networkType === "ACCESS" ? preset.accessHandoffCount : 0,
        GPU_MICRO: gpuMicroCount,
        GPU_POD: gpuPodCount,
      };
    },
    [
      designProcessingDisabled,
      includePops,
      popCount,
      includeAgg,
      aggCount,
      includeRegens,
      networkType,
      totalBillableMiles,
      spanMiles,
      preset.dciHandoffCount,
      preset.accessHandoffCount,
      diversityModel,
      gpuMicroCount,
      gpuPodCount,
    ]
  );

  const routeNodes = useMemo(() => {
    if (designProcessingDisabled) return [];
    return routeCoords?.length ? buildRouteNodes(routeCoords, nodeCountSeed) : [];
  }, [routeCoords, nodeCountSeed, designProcessingDisabled]);

  const civilModel = useMemo(
    () => {
      if (designProcessingDisabled) return baselinePreviewCivilModel(normalizedRouteMix, normalizedUndergroundMix);
      return buildCivilModel({
        totalBillableFeet,
        routeMix: normalizedRouteMix,
        undergroundMix: normalizedUndergroundMix,
        urbanRestorationPct,
        ruralRestorationPct,
        aerialMakeReadyCount,
        poleTransferCount,
        roadCrossings,
        railCrossings,
        waterCrossings,
        bridgeCrossings,
        networkType,
        preset,
      });
    },
    [
      designProcessingDisabled,
      totalBillableFeet,
      normalizedRouteMix,
      normalizedUndergroundMix,
      urbanRestorationPct,
      ruralRestorationPct,
      aerialMakeReadyCount,
      poleTransferCount,
      roadCrossings,
      railCrossings,
      waterCrossings,
      bridgeCrossings,
      networkType,
      preset,
    ]
  );

  const bomModel = useMemo(
    () => {
      if (designProcessingDisabled) return baselinePreviewBomModel();
      return buildBomModel({
        totalBillableFeet,
        primaryRouteFeet,
        diversityModel,
        ductConfig,
        customDuctCount,
        customDuctDiameterIn,
        fiberCountOption,
        customFiberCount,
        handholeSpacingFt: preset.handholeSpacingFt,
        vaultSpacingFt: preset.vaultSpacingFt,
        ownerFurnishedMaterials,
        materialsEscalationPercent,
        productType,
        networkType,
        expansionReservePct,
      });
    },
    [
      designProcessingDisabled,
      totalBillableFeet,
      primaryRouteFeet,
      diversityModel,
      ductConfig,
      customDuctCount,
      customDuctDiameterIn,
      fiberCountOption,
      customFiberCount,
      preset.handholeSpacingFt,
      preset.vaultSpacingFt,
      ownerFurnishedMaterials,
      materialsEscalationPercent,
      productType,
      networkType,
      expansionReservePct,
    ]
  );

  const nodeInfrastructureModel = useMemo(
    () => {
      if (designProcessingDisabled) return baselinePreviewNodeInfrastructureModel();
      return buildNodeInfrastructureModel({
        totalBillableMiles,
        networkType,
        diversityModel,
        includeRegens,
        includePops,
        includeAgg,
        spanMiles,
        popCount,
        aggCount,
        gpuMicroCount,
        gpuPodCount,
        powerAvailability,
        realEstateAvailability,
        preset,
      });
    },
    [
      designProcessingDisabled,
      totalBillableMiles,
      networkType,
      diversityModel,
      includeRegens,
      includePops,
      includeAgg,
      spanMiles,
      popCount,
      aggCount,
      gpuMicroCount,
      gpuPodCount,
      powerAvailability,
      realEstateAvailability,
      preset,
    ]
  );

  const corridorScore = useMemo(() => (icdeMode ? computeAdjacencyScore(haaInputs, DEFAULT_WEIGHTS) : null), [icdeMode, haaInputs]);
  const corridorTier = useMemo(() => (corridorScore === null ? null : tierFromScore(corridorScore)), [corridorScore]);

  const svaResult = useMemo(
    () => {
      if (designProcessingDisabled) return emptySVAResult();
      return buildSVAResult({
        routeCoords,
        icdeMode,
        svaEnabled,
        corridorScore,
        sites,
        counts: nodeCountSeed,
      });
    },
    [routeCoords, icdeMode, svaEnabled, corridorScore, sites, nodeCountSeed, designProcessingDisabled]
  );

  const svaCounts = useMemo(() => {
    const c: Record<DeploymentType, number> = {
      Transport: 0,
      Regen: 0,
      ILA: 0,
      "GPU Micro": 0,
      "GPU POD": 0,
    };
    for (const n of svaResult.nodes) {
      const dep = svaResult.nodeDeployment.get(n.id);
      const score = dep?.score ?? 0;
      if (score < svaThreshold) continue;
      c[dep?.deployment ?? "Transport"] += 1;
    }
    return c;
  }, [svaResult, svaThreshold]);

  const financialWarnings = useMemo(
    () => {
      if (designProcessingDisabled) return [];
      return diversityWarnings({
        diversityModel,
        corridorSeparationMiles,
        hasProtectionGeometry: Boolean(protectionRouteCoords?.length),
        networkType,
      });
    },
    [diversityModel, corridorSeparationMiles, protectionRouteCoords, networkType, designProcessingDisabled]
  );

  const financial = useMemo(
    () => {
      if (designProcessingDisabled) {
        return baselinePreviewFinancialModel({
          fullGeometryCount,
          previewRouteCount,
          displayMode: "BASELINE_PREVIEW",
        });
      }

      return buildFinancialModel({
        routeFeet: primaryRouteFeet,
        primaryRouteFeet,
        diverseRouteFeet,
        civilModel,
        bomModel,
        nodeModel: nodeInfrastructureModel,
        engineeringPerFt,
        permittingPerFt,
        splicingPerFt,
        buildingEntranceCount: preset.buildingEntranceCount,
        buildingEntranceUnitCost,
        ispRequired: preset.ispRequired,
        ispUnitCost,
        mobilization,
        pmOverheadPercent,
        insurancePercent,
        qcPercent,
        riskPercent,
        marginPercent,
        diversityPremiumPercent,
        diversityModel,
        networkType,
        preset,
        warnings: financialWarnings,
        demandSets,
      });
    },
    [
      designProcessingDisabled,
      fullGeometryCount,
      previewRouteCount,
      primaryRouteFeet,
      diverseRouteFeet,
      civilModel,
      bomModel,
      nodeInfrastructureModel,
      engineeringPerFt,
      permittingPerFt,
      splicingPerFt,
      preset,
      buildingEntranceUnitCost,
      ispUnitCost,
      mobilization,
      pmOverheadPercent,
      insurancePercent,
      qcPercent,
      riskPercent,
      marginPercent,
      diversityPremiumPercent,
      diversityModel,
      networkType,
      financialWarnings,
      demandSets,
    ]
  );

  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    setMapLoaded(false);
    const map = new maplibregl.Map({
      container,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-96.797, 32.7767],
      zoom: 9,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const resizeMap = () => {
      requestAnimationFrame(() => {
        map.resize();
      });
    };
    const resizeObserver = new ResizeObserver(resizeMap);
    resizeObserver.observe(container);
    window.addEventListener("resize", resizeMap);

    map.on("load", () => {
      console.log("DESIGN MAP LOAD COMPLETE");
      console.log("MAP STYLE LOADED", map.isStyleLoaded());
      map.addSource("candidateRoute", { type: "geojson", data: featureCollection([]) });
      map.addSource("protectionRoute", { type: "geojson", data: featureCollection([]) });
      map.addSource("route", { type: "geojson", data: featureCollection([]) });
      map.addSource("baseline-graph-source", { type: "geojson", data: featureCollection([]) });
      console.log("BASELINE GRAPH SOURCE CREATED");
      map.addSource("baseline-graph-stations-source", { type: "geojson", data: featureCollection([]) });
      map.addSource("stations", { type: "geojson", data: featureCollection([]) });
      map.addSource("sites", { type: "geojson", data: featureCollection([]) });
      map.addSource("nodes", { type: "geojson", data: featureCollection([]) });
      map.addSource("svaNodes", { type: "geojson", data: featureCollection([]) });

      map.addLayer({
        id: "candidate-route-line",
        type: "line",
        source: "candidateRoute",
        paint: { "line-width": 2, "line-color": "#64748b", "line-dasharray": [2, 2], "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "protection-route-line",
        type: "line",
        source: "protectionRoute",
        paint: { "line-width": 3, "line-color": "#f472b6", "line-dasharray": [3, 2], "line-opacity": 0.8 },
      });
      map.addLayer({
        id: "baseline-graph-layer",
        type: "line",
        source: "baseline-graph-source",
        layout: { visibility: "none" },
        paint: {
          "line-width": 1.6,
          "line-color": "#22c55e",
          "line-opacity": 0.78,
        },
      });
      console.log("BASELINE GRAPH LAYER CREATED");
      map.addLayer({
        id: "baseline-graph-station-dots",
        type: "circle",
        source: "baseline-graph-stations-source",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": 2.5,
          "circle-color": "#f8fafc",
          "circle-stroke-width": 1,
          "circle-stroke-color": "#166534",
          "circle-opacity": 0.92,
        },
      });
      map.addLayer({
        id: "baseline-graph-station-labels",
        type: "symbol",
        source: "baseline-graph-stations-source",
        layout: {
          visibility: "none",
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-offset": [0, -0.9],
          "text-anchor": "top",
        },
        paint: { "text-color": "#064e3b", "text-halo-color": "#ecfdf5", "text-halo-width": 1.5 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-width": 4, "line-color": "#00f5ff" },
      });
      map.addLayer({
        id: "stations-dots",
        type: "circle",
        source: "stations",
        paint: { "circle-radius": 3, "circle-color": "#ff6a00" },
      });
      map.addLayer({
        id: "stations-labels",
        type: "symbol",
        source: "stations",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, -1.1],
          "text-anchor": "top",
        },
        paint: { "text-color": "#111", "text-halo-color": "#fff", "text-halo-width": 2 },
      });
      map.addLayer({
        id: "sites-points",
        type: "circle",
        source: "sites",
        paint: {
          "circle-radius": 6,
          "circle-color": "#00ff7f",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#003b24",
        },
      });
      map.addLayer({
        id: "network-nodes",
        type: "circle",
        source: "nodes",
        paint: {
          "circle-radius": ["case", ["==", ["get", "nodeType"], "GPU_POD"], 10, ["==", ["get", "nodeType"], "GPU_MICRO"], 9, 7],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0b1220",
          "circle-opacity": 0.9,
        },
      });
      map.addLayer({
        id: "network-node-labels",
        type: "symbol",
        source: "nodes",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, -1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#0b1220", "text-halo-color": "#ffffff", "text-halo-width": 2 },
      });
      map.addLayer({
        id: "sva-nodes",
        type: "circle",
        source: "svaNodes",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "deployment"], "GPU POD"],
            11,
            ["==", ["get", "deployment"], "GPU Micro"],
            10,
            ["==", ["get", "deployment"], "ILA"],
            9,
            8,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#020617",
          "circle-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "sva-nodes-label",
        type: "symbol",
        source: "svaNodes",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, -1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#0b1220", "text-halo-color": "#ffffff", "text-halo-width": 2 },
      });

      mapRef.current = map;
      console.log("MAP SOURCES READY", {
        route: Boolean(map.getSource("route")),
        baselineGraph: Boolean(map.getSource("baseline-graph-source")),
        candidateRoute: Boolean(map.getSource("candidateRoute")),
        protectionRoute: Boolean(map.getSource("protectionRoute")),
      });
      console.log("MAP INITIALIZED");
      setMapLoaded(true);
      resizeMap();
    });

    resizeMap();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeMap);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      mapRef.current?.resize();
    });
    return () => cancelAnimationFrame(frame);
  }, [routeCoords, sites, translatePreview, translateStatus, expandedSections, svaEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    const sourceId = "baseline-graph-source";
    const layerId = "baseline-graph-layer";

    if (!mapLoaded || !map) return;

    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!currentBaselineGraph) {
      source?.setData(featureCollection([]));
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", "none");
      updateBaselineGraphStationLayer(map, null);
      return;
    }

    try {
      console.log("BASELINE GRAPH RENDER START", {
        baselineId: currentBaselineGraph.baselineId,
        edges: currentBaselineGraph.edges.length,
      });

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: "geojson", data: featureCollection([]) });
        console.log("BASELINE GRAPH SOURCE CREATED");
      }

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-width": 1.6,
            "line-color": "#22c55e",
            "line-opacity": 0.78,
          },
        });
        console.log("BASELINE GRAPH LAYER CREATED");
      }

      const graphData = baselineGraphFeatureCollection(currentBaselineGraph);
      console.log("BASELINE GRAPH FEATURE COUNT", graphData.features.length);
      (map.getSource(sourceId) as GeoJSONSource).setData(graphData);
      console.log("BASELINE GRAPH SOURCE UPDATED");
      map.setLayoutProperty(layerId, "visibility", "visible");

      (map.getSource("route") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("candidateRoute") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("protectionRoute") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("stations") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("nodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("svaNodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));

      const bbox = bboxFromBaselineGraph(currentBaselineGraph);
      if (bbox) {
        console.log("BASELINE GRAPH FITBOUNDS", bbox);
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 80, duration: 600 }
        );
      }
      updateBaselineGraphStationLayer(map, currentBaselineGraph);

      console.log("BASELINE GRAPH RENDER COMPLETE", {
        baselineId: currentBaselineGraph.baselineId,
        featureCount: graphData.features.length,
      });
    } catch (err) {
      console.error("BASELINE GRAPH RENDER ERROR", err instanceof Error ? err.stack ?? err.message : err);
    }
  }, [currentBaselineGraphVersion, mapLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;

    const updateStations = () => updateBaselineGraphStationLayer(map, currentBaselineGraph);
    updateStations();
    map.on("zoomend", updateStations);
    map.on("moveend", updateStations);

    return () => {
      map.off("zoomend", updateStations);
      map.off("moveend", updateStations);
    };
  }, [currentBaselineGraphVersion, mapLoaded]);

  console.log("MAP EFFECT SUBSCRIBED routeCoords.length", routeCoords?.length ?? 0);

  useEffect(() => {
    const map = mapRef.current;
    console.log("ROUTE EFFECT ENTER");
    console.log("ROUTE EFFECT TRIGGERED");
    console.log("ROUTE EFFECT routeCoords.length", routeCoords?.length ?? 0);
    console.log("ROUTE EFFECT mapLoaded", mapLoaded);
    console.log("ROUTE EFFECT hasMap", Boolean(map));
    console.log("ROUTE EFFECT hasRouteSource", Boolean(map?.getSource("route")));
    console.log("DESIGN MAP ROUTE EFFECT routeCoords.length", routeCoords?.length ?? 0);
    console.log("DESIGN MAP ROUTE EFFECT previewRoute.length", routeCoords?.length ?? 0);
    console.log("DESIGN MAP ROUTE EFFECT full route count", baseRouteCoords?.length ?? routeCoords?.length ?? 0);
    console.log("DESIGN MAP ROUTE EFFECT preview route count", routeCoords?.length ?? 0);
    if (!mapLoaded) {
      console.log("DESIGN MAP ROUTE EFFECT skipped: mapLoaded false");
      return;
    }
    if (!map) {
      console.log("DESIGN MAP ROUTE EFFECT skipped: map not initialized");
      return;
    }

    const styleLoaded = map.isStyleLoaded();
    console.log("DESIGN MAP ROUTE EFFECT style loaded", styleLoaded);
    const routeSource = map.getSource("route") as GeoJSONSource | undefined;
    const candidateSource = map.getSource("candidateRoute") as GeoJSONSource | undefined;
    const protectionSource = map.getSource("protectionRoute") as GeoJSONSource | undefined;
    if (!routeSource || !candidateSource || !protectionSource) {
      console.log("DESIGN MAP ROUTE EFFECT skipped: sources not ready", {
        styleLoaded,
        hasRouteSource: Boolean(routeSource),
        hasCandidateSource: Boolean(candidateSource),
        hasProtectionSource: Boolean(protectionSource),
      });
      return;
    }
    if (!styleLoaded) {
      console.log("DESIGN MAP ROUTE EFFECT continuing with existing sources while styleLoaded is transiently false");
    }

    if (!routeCoords?.length) {
      console.log("DESIGN MAP ROUTE EFFECT clearing route sources because routeCoords is empty");
      routeSource.setData(featureCollection([]));
      candidateSource.setData(featureCollection([]));
      protectionSource.setData(featureCollection([]));
      (map.getSource("stations") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("nodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("svaNodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      return;
    }

    console.log("DESIGN MAP POLYLINE CREATED routeCoords.length", routeCoords.length);
    console.log("DESIGN MAP RENDERED FIRST POINT GeoJSON lon/lat", routeCoords[0]);
    console.log("DESIGN MAP RENDERED LAST POINT GeoJSON lon/lat", routeCoords[routeCoords.length - 1]);
    console.log("DESIGN MAP COORDINATE MODE", "MapLibre GeoJSON expects [lon, lat]; no Leaflet [lat, lon] conversion here.");
    const displayLines = [routeCoords];
    const displayCoords = flattenGeometryLines(displayLines);
    console.log("SOURCE UPDATE ATTEMPT", routeCoords.length);
    try {
      routeSource.setData(featureCollection(displayLines.map(lineStringFromCoords)));
      console.log("SOURCE UPDATED", routeCoords.length);
    } catch (err) {
      console.error("SOURCE UPDATE THREW", err);
      throw err;
    }
    candidateSource.setData(
      !isBaselineGraph && baseRouteCoords?.length && baseRouteCoords !== routeCoords && baseRouteCoords.length <= LARGE_GEOMETRY_RENDER_LIMIT
        ? featureCollection([lineStringFromCoords(baseRouteCoords)])
        : featureCollection([])
    );
    protectionSource.setData(
      protectionRouteCoords?.length ? featureCollection([lineStringFromCoords(protectionRouteCoords)]) : featureCollection([])
    );

    const fitRouteBounds = () => {
      const bbox = bboxFromCoords(displayCoords.length ? displayCoords : routeCoords);
      console.log("DESIGN MAP fitBounds route length", displayCoords.length || routeCoords.length);
      console.log("DESIGN MAP fitBounds bbox", bbox);
      console.log("FITBOUNDS ATTEMPT");
      console.log("fitBounds CALLED", displayCoords.length || routeCoords.length);
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 80, duration: 600 }
      );
    };

    if (designProcessingDisabled) {
      console.log("DESIGN MAP ROUTE EFFECT baseline preview: skipping station/node/SVA generation");
      (map.getSource("stations") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("nodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("svaNodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      if (map.getLayer("stations-dots")) map.setLayoutProperty("stations-dots", "visibility", "none");
      if (map.getLayer("stations-labels")) map.setLayoutProperty("stations-labels", "visibility", "none");
      fitRouteBounds();
      return;
    }

    const stationsGJ = buildStationPoints(routeCoords, Math.max(100, stationSpacingFt));
    (map.getSource("stations") as GeoJSONSource | undefined)?.setData(stationsGJ);

    const stations: DesignStation[] = stationsGJ.features.map((f: any) => {
      const feet = Math.round(f.properties.feet || 0);
      return {
        stationId: `STA-${String(feet).padStart(6, "0")}`,
        station: f.properties.label,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        feet,
      };
    });
    setDesignStations(stations);

    const showStationLabels = showStationing && stations.length <= 300;
    const showStationDots = showStationing && stations.length <= 5000;
    if (map.getLayer("stations-dots")) {
      map.setLayoutProperty("stations-dots", "visibility", showStationDots ? "visible" : "none");
    }
    if (map.getLayer("stations-labels")) {
      map.setLayoutProperty("stations-labels", "visibility", showStationLabels ? "visible" : "none");
    }

    fitRouteBounds();
  }, [
    routeCoords,
    baseRouteCoords,
    protectionRouteCoords,
    showStationing,
    stationSpacingFt,
    setDesignStations,
    mapLoaded,
    isBaselineGraph,
    designProcessingDisabled,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("sites") as GeoJSONSource | undefined;
    if (!src) return;
    const feats = sites.map((s) => turf.point([s.lon, s.lat], { name: s.name ?? "" }));
    src.setData(featureCollection(feats));
  }, [sites]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("nodes") as GeoJSONSource | undefined;
    if (!src) return;
    const feats = routeNodes.map((node) =>
      turf.point(node.coord, {
        id: node.id,
        nodeType: node.type,
        color: nodeVisualColor(node.type),
        label: nodeLabel(node.type),
      })
    );
    src.setData(featureCollection(feats));
  }, [routeNodes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("svaNodes") as GeoJSONSource | undefined;
    if (!src) return;

    if (!svaResult.nodes.length || !icdeMode || !svaEnabled || corridorScore === null) {
      src.setData(featureCollection([]));
      map.setLayoutProperty("sva-nodes", "visibility", "none");
      map.setLayoutProperty("sva-nodes-label", "visibility", "none");
      return;
    }

    const feats = svaResult.nodes
      .map((node) => {
        const dep = svaResult.nodeDeployment.get(node.id);
        const score = dep?.score ?? 0;
        if (score < svaThreshold) return null;
        const deployment = dep?.deployment ?? "Transport";
        return turf.point(node.coord, {
          id: node.id,
          nodeType: node.type,
          score,
          deployment,
          color: nodeVisualColor(deployment),
          label: `${nodeLabel(node.type)} / ${deployment} / ${score}`,
        });
      })
      .filter(Boolean) as any[];

    src.setData(featureCollection(feats));
    map.setLayoutProperty("sva-nodes", "visibility", "visible");
    map.setLayoutProperty("sva-nodes-label", "visibility", "visible");
  }, [svaResult, icdeMode, svaEnabled, corridorScore, svaThreshold]);

  async function ingestNetworkInventoryFile(file: File, source: "design" | "translate") {
    const metadata = {
      accountId: accountId.trim() || "fiberlight-beta",
      name: baselineName.trim() || file.name,
      datasetType: "EXISTING_NETWORK",
      sourceFilename: file.name,
      source,
    };
    const setDiagnostics = source === "translate" ? setTranslateLargeDataset : setDesignIngestionDiagnostics;

    try {
      if (source === "design") setStatus("Large dataset mode: uploading network inventory to Chicago...");
      const job = await runLargeDatasetIngestion({
        file,
        metadata,
        onUpdate: (patch) => {
          setDiagnostics((prev) => ({ ...prev, ...patch }));
          if (source === "translate" && patch.status) setTranslateStatus(patch.status);
        },
      });

      if (job.status !== "Complete") {
        const message = job.status === "Canceled" ? "Large dataset ingestion canceled." : job.message || "Large dataset ingestion failed.";
        if (source === "design") setStatus(message);
        if (source === "translate") {
          setTranslateStatus(job.status);
          setTranslateError(message);
        }
        return job;
      }

      const baselines = await refreshStoredBaselines();
      const baselineMeta =
        baselines.find(
          (baseline) =>
            baseline.datasetId === job.baselineId ||
            baseline.apiId === job.baselineId ||
            baseline.baselineScopeVersionId === job.baselineId
        ) ?? null;

      if (baselineMeta) {
        setSelectedBaselineDatasetId(baselineMeta.datasetId);
        setCurrentDatasetType("EXISTING_NETWORK");
        setCurrentBaselineScopeVersionId(baselineMeta.baselineScopeVersionId);
        setCurrentBaselineGraph(null);
        setScopeVersionId(baselineMeta.baselineScopeVersionId);
      }

      window.dispatchEvent(new Event("hyperlinx:baselinesChanged"));

      if (source === "design") {
        console.log("ROUTECOORDS CLEAR REQUEST");
        console.log("ROUTECOORDS CLEAR REQUEST SOURCE", "DMredlinedev.ingestNetworkInventoryFile.designLargeDatasetIngestion");
        console.log("ROUTECOORDS CLEAR REQUEST PREV LENGTH", routeCoords?.length ?? 0);
        console.log("ROUTECOORDS CLEAR REQUEST NEXT LENGTH", 0);
        setRouteCoords(null);
        setBaseRouteCoords(null);
        setCurrentBaselineGraph(null);
        setAssembledSpine(null);
        setIsImportedFiber(true);
        setDesignStations([]);
        setStatus(
          "Large baseline stored server-side. Full geometry may be expensive to render. Use Prism serviceability analysis or simplified preview first."
        );
      }

      return job;
    } catch (err: any) {
      const message = err?.message ?? String(err);
      setDiagnostics((prev) => ({ ...prev, status: "Failed", message }));
      if (source === "design") setStatus(`Large dataset ingestion failed: ${message}`);
      if (source === "translate") {
        setTranslateStatus("Failed");
        setTranslateError(message);
      }
      throw err;
    }
  }

  async function handleUploadRoute(file: File) {
    try {
      setStatus("Importing route...");
      setDesignIngestionDiagnostics(initialLargeDatasetDiagnostics());
      if (shouldUseLargeDatasetMode(file)) {
        await ingestNetworkInventoryFile(file, "design");
        return;
      }

      const name = file.name.toLowerCase();
      if (name.endsWith(".kmz") || name.endsWith(".kml")) {
        await handleImportBaselineGraph(file);
        return;
      }
      const importedFiber = false;
      let gj: any;
      let coords: LonLat[] | null = null;

      if (name.endsWith(".kmz")) {
        gj = await parseKMZToGeoJSON(file);
      } else if (name.endsWith(".kml")) {
        gj = await parseKMLTextToGeoJSON(await readFileText(file));
      } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
        gj = JSON.parse(await readFileText(file));
      } else if (name.endsWith(".csv")) {
        const parsed = Papa.parse<Record<string, any>>(await readFileText(file), { header: true, skipEmptyLines: true });
        coords = routeCoordsFromCsvRows(parsed.data as any);
      } else {
        throw new Error("Unsupported route file. Use .geojson/.json/.csv for proposed routes, or the baseline graph importer for KMZ/KML.");
      }

      coords = coords ?? pickLongestLine(getAllLineCoordsFromGeoJSON(gj));
      if (!coords?.length || coords.length < 2) throw new Error("No route geometry found in uploaded route.");

      setBaseRouteCoords(coords);
      setCurrentBaselineGraph(null);
      setIsImportedFiber(importedFiber);
      setLastRouteSourceFilename(file.name);
      setCurrentDatasetType(null);
      setCurrentBaselineScopeVersionId(null);

      if (snapToStreets && !importedFiber) {
        setStatus("Snapping route to streets (OSRM)...");
        const waypoints = sampleWaypointsAlongLine(coords, waypointSpacingMiles);
        setRouteCoords(await osrmRouteThroughWaypoints(waypoints));
      } else {
        setRouteCoords(coords);
      }

      setStatus(importedFiber ? "Imported fiber route loaded." : "Route loaded.");
    } catch (e: any) {
      setStatus(`Route import failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleImportBaselineGraph(file: File) {
    try {
      console.log("BASELINE GRAPH IMPORT STARTED", { file: file.name, size: file.size });
      setStatus("Importing existing network as baseline graph...");
      setDesignIngestionDiagnostics(initialLargeDatasetDiagnostics());

      const name = file.name.toLowerCase();
      const baselineId = `baseline-${safeUUID()}`;
      const graphName = baselineName.trim() || file.name.replace(/\.[^/.]+$/, "");
      const graphMetadata = {
        accountId: accountId.trim() || "fiberlight-beta",
        datasetType: "BASELINE_GRAPH",
        readOnly: true,
        authoritativeStatus: "BASELINE_GRAPH",
      };
      let graph: BaselineGraph;

      if (name.endsWith(".kmz")) {
        const kmlText = await readKMLTextFromKMZ(file);
        const kmlXml = parseKMLTextToXML(kmlText);
        console.log("RECURSIVE WALK INVOKED", { source: "KMZ", file: file.name });
        const lineStrings = extractLineStringsRecursive(kmlXml);
        console.log("GRAPH BUILD INVOKED", { source: "KMZ", lineStrings: lineStrings.length });
        graph = buildBaselineGraph({
          baselineId,
          name: graphName,
          lineStrings,
          sourceFilename: file.name,
          metadata: graphMetadata,
        });
        console.log("GRAPH BUILD COMPLETE", {
          source: "KMZ",
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          routes: graph.geometry.length,
        });
      } else if (name.endsWith(".kml")) {
        console.log("KML FILE SELECTED", file.name);
        const kmlText = await readFileText(file);
        console.log("KML XML LENGTH", kmlText.length);
        const kmlXml = parseKMLTextToXML(kmlText);
        console.log("RECURSIVE WALK INVOKED", { source: "KML", file: file.name });
        const lineStrings = extractLineStringsRecursive(kmlXml);
        console.log("GRAPH BUILD INVOKED", { source: "KML", lineStrings: lineStrings.length });
        graph = buildBaselineGraph({
          baselineId,
          name: graphName,
          lineStrings,
          sourceFilename: file.name,
          metadata: graphMetadata,
        });
        console.log("GRAPH BUILD COMPLETE", {
          source: "KML",
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          routes: graph.geometry.length,
        });
      } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
        console.log("GRAPH BUILD INVOKED", { source: "GeoJSON", file: file.name });
        graph = buildBaselineGraphFromGeoJSON({
          baselineId,
          name: graphName,
          geojson: JSON.parse(await readFileText(file)),
          sourceFilename: file.name,
          metadata: graphMetadata,
        });
        console.log("GRAPH BUILD COMPLETE", {
          source: "GeoJSON",
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          routes: graph.geometry.length,
        });
      } else {
        throw new Error("Unsupported baseline graph file. Use .geojson/.json/.kml/.kmz");
      }

      console.log("BASELINE GRAPH PARSED", {
        baselineId,
        routeCount: graph.geometry.length,
        pointCount: countGeometryPoints(graph.fullGeometry),
      });
      console.log("BASELINE GRAPH NODES CREATED", graph.nodes.length);
      console.log("BASELINE GRAPH EDGES CREATED", graph.edges.length);

      if (!graph.geometry.length || !graph.edges.length) {
        throw new Error("No LineString or MultiLineString geometry found in baseline graph upload.");
      }

      const inventoryId = `inventory-${safeUUID()}`;
      const importedAt = new Date().toISOString();
      const graphSummary = baselineGraphSummary(graph);
      const savedGraph = await createBaselineGraph({
        inventoryId,
        name: graphName,
        graphSummary,
        nodes: graph.nodes,
        edges: graph.edges,
        stations: graph.stations,
        routes: graph.geometry,
        sourceFile: file.name,
        importedAt,
        metadata: {
          ...(graph.metadata ?? {}),
          accountId: accountId.trim() || "fiberlight-beta",
          datasetType: "BASELINE_GRAPH",
          inventoryScopeVersionType: "INVENTORY_SCOPEVERSION",
          budgetRequired: false,
          readOnly: true,
        },
      });

      setSelectedBaselineDatasetId("");
      setCurrentDatasetType("BASELINE_GRAPH");
      setCurrentBaselineScopeVersionId(savedGraph.inventoryScopeVersion?.scopeVersionId ?? null);
      setCurrentBaselineGraph(graph);
      setBaseRouteCoords(null);
      setRouteCoords(null);
      setAssembledSpine(null);
      setIsImportedFiber(true);
      setSites([]);
      setDesignStations([]);
      setLastRouteSourceFilename(file.name);
      window.dispatchEvent(new Event("hyperlinx:baselineGraphsChanged"));
      setStatus(
        `${baselineGraphDisplayMessage(graph)} Inventory ScopeVersion: ${
          savedGraph.inventoryScopeVersion?.scopeVersionId ?? "created"
        }.`
      );
      requestAnimationFrame(() => mapRef.current?.resize());
    } catch (e: any) {
      console.error("KMZ IMPORT ERROR", e instanceof Error ? e.stack ?? e.message : e);
      setStatus(`Baseline graph import failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleUploadSites(file: File) {
    try {
      setStatus("Importing sites...");
      if (shouldUseLargeDatasetMode(file)) {
        const metadata = {
          accountId: accountId.trim() || "fiberlight-beta",
          name: file.name,
          datasetType: "TARGET_SITE_LIST",
          sourceFilename: file.name,
          source: "design-sites",
        };
        const job = await runLargeDatasetIngestion({
          file,
          metadata,
          onUpdate: (patch) => setDesignIngestionDiagnostics((prev) => ({ ...prev, ...patch })),
        });
        setStatus(
          job.status === "Complete"
            ? "Large site dataset stored server-side. Use a smaller candidate extract for local route synthesis."
            : `Large site dataset ingestion ${job.status.toLowerCase()}.`
        );
        return;
      }

      const name = file.name.toLowerCase();
      let pts: UploadedSitesRow[] = [];

      if (name.endsWith(".csv")) {
        const parsed = Papa.parse<Record<string, any>>(await readFileText(file), { header: true, skipEmptyLines: true });
        const rows = parsed.data
          .map((r) => {
            const lat = Number(r.lat ?? r.latitude);
            const lon = Number(r.lon ?? r.lng ?? r.longitude);
            const order = r.order !== undefined ? Number(r.order) : undefined;
            const nm = r.name ?? r.site ?? r.id;
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
            return { lat, lon, order, name: nm ? String(nm) : undefined } as UploadedSitesRow;
          })
          .filter(Boolean) as UploadedSitesRow[];
        pts = rows.some((r) => Number.isFinite(r.order)) ? rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : rows;
      } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
        const points = getPointsFromGeoJSON(JSON.parse(await readFileText(file)));
        if (!points.length) throw new Error("No points found in the GeoJSON.");
        pts = points.map(([lon, lat], i) => ({ lon, lat, order: i + 1 }));
      } else {
        throw new Error("Unsupported sites file. Use .csv or .geojson/.json");
      }

      if (pts.length < 2) throw new Error("Need at least 2 sites to build a route.");
      setSites(pts);
      setCurrentDatasetType(null);
      setCurrentBaselineScopeVersionId(null);
      setCurrentBaselineGraph(null);

      const waypoints: LonLat[] = pts.map((p) => [p.lon, p.lat]);
      setBaseRouteCoords(waypoints);
      setIsImportedFiber(false);
      setStatus(snapToStreets ? "Routing through sites (OSRM)..." : "Building route from sites...");
      setRouteCoords(snapToStreets ? await osrmRouteThroughWaypoints(waypoints) : waypoints);
      setStatus("Sites loaded; route built.");
    } catch (e: any) {
      setStatus(`Sites import failed: ${e?.message ?? String(e)}`);
    }
  }

  async function applyRouteFromTranslate(coords: LonLat[]) {
    try {
      setStatus("Applying Translate route to Design...");
      setBaseRouteCoords(coords);
      setIsImportedFiber(false);
      setCurrentDatasetType(null);
      setCurrentBaselineScopeVersionId(null);
      setCurrentBaselineGraph(null);
      if (snapToStreets) {
        const waypoints = sampleWaypointsAlongLine(coords, waypointSpacingMiles);
        setRouteCoords(await osrmRouteThroughWaypoints(waypoints));
      } else {
        setRouteCoords(coords);
      }
      setStatus("Translate route applied to Design.");
    } catch (e: any) {
      setStatus(`Translate route application failed: ${e?.message ?? String(e)}`);
    }
  }

  async function applySitesFromTranslate(sitesData: UploadedSitesRow[]) {
    try {
      if (sitesData.length < 2) throw new Error("Need at least 2 sites to build a route.");
      setSites(sitesData);
      setCurrentDatasetType(null);
      setCurrentBaselineScopeVersionId(null);
      setCurrentBaselineGraph(null);
      const waypoints: LonLat[] = sitesData.map((p) => [p.lon, p.lat]);
      setBaseRouteCoords(waypoints);
      setIsImportedFiber(false);
      setStatus(snapToStreets ? "Routing through Translate sites (OSRM)..." : "Applying Translate sites...");
      setRouteCoords(snapToStreets ? await osrmRouteThroughWaypoints(waypoints) : waypoints);
      setStatus("Translate sites applied; route built.");
    } catch (e: any) {
      setStatus(`Translate sites application failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleTranslateUpload(file: File) {
    try {
      setTranslateLargeDataset(initialLargeDatasetDiagnostics());
      setTranslateStatus("Translating file...");
      setTranslateError(null);
      if (shouldUseLargeDatasetMode(file, forceLargeDatasetMode)) {
        const job = await ingestNetworkInventoryFile(file, "translate");
        if (job?.status === "Complete") {
          setTranslatePreview({
            ...inferCustomerAndProjectFromFilename(file.name),
            serverBaselineId: job.baselineId,
            largeDatasetMode: true,
            notes:
              "Large baseline stored server-side. Full geometry may be expensive to render. Use Prism serviceability analysis or simplified preview first.",
          });
          setTranslateStatus("Complete");
        }
        return;
      }

      const preview = await parseTranslateFile(file);
      setTranslatePreview(preview);
      setTranslateStatus("Translate preview ready");
    } catch (e: any) {
      setTranslatePreview(null);
      setTranslateStatus("Translate failed");
      setTranslateError(e?.message ?? String(e));
    }
  }

  async function applyTranslatePreview() {
    if (!translatePreview) return;
    if (translatePreview.serverBaselineId) {
      const baselines = await refreshStoredBaselines();
      const baselineMeta =
        baselines.find(
          (baseline) =>
            baseline.datasetId === translatePreview.serverBaselineId ||
            baseline.apiId === translatePreview.serverBaselineId ||
            baseline.baselineScopeVersionId === translatePreview.serverBaselineId
        ) ?? null;
      if (baselineMeta) {
        setSelectedBaselineDatasetId(baselineMeta.datasetId);
        setCurrentDatasetType("EXISTING_NETWORK");
        setCurrentBaselineScopeVersionId(baselineMeta.baselineScopeVersionId);
        setCurrentBaselineGraph(null);
        setScopeVersionId(baselineMeta.baselineScopeVersionId);
      }
      setStatus(
        "Large baseline stored server-side. Full geometry may be expensive to render. Use Prism serviceability analysis or simplified preview first."
      );
      setTranslateStatus("Large dataset baseline linked to Design");
      return;
    }
    if (isValidRouteCoords(translatePreview.routeCoords)) await applyRouteFromTranslate(translatePreview.routeCoords);
    if (isUploadedSiteRowArray(translatePreview.sites)) await applySitesFromTranslate(translatePreview.sites);
    if (translatePreview.inferredNetworkType) setNetworkType(translatePreview.inferredNetworkType);
    if (!translatePreview.inferredNetworkType && translatePreview.inferredRole) {
      setNetworkType(
        translatePreview.inferredRole === "metro"
          ? "METRO"
          : translatePreview.inferredRole === "longhaul"
            ? "LONGHAUL"
            : "MIDDLE_MILE"
      );
    }
    if (translatePreview.inferredProductType) setProductType(translatePreview.inferredProductType);
    mapPreviewBudgetToDesign(translatePreview, {
      setRiskPercent,
      setMarginPercent,
      setEngineeringPerFt,
      setPermittingPerFt,
      setMobilization,
      setPmOverheadPercent,
      setInsurancePercent,
      setQcPercent,
      setMaterialsEscalationPercent,
    });
    setTranslateStatus("Translate inputs applied to Design ingest pipeline");
  }

  function clearTranslatePreview() {
    setTranslatePreview(null);
    setTranslateStatus("Translate ready");
    setTranslateError(null);
    setTranslateLargeDataset(initialLargeDatasetDiagnostics());
  }

  function handleAssembleSpine() {
    if (!routeCoords?.length) {
      setStatus("No route available to assemble.");
      return;
    }
    setAssembledSpine(routeCoords);
    setBaseRouteCoords(routeCoords);
    setStatus("Spine assembled and locked.");
  }

  async function resnapCurrent() {
    try {
      if (!baseRouteCoords?.length) {
        setStatus("Nothing to snap yet (upload route or sites first).");
        return;
      }
      if (isImportedFiber) {
        setRouteCoords(baseRouteCoords);
        setStatus("Imported fiber uses base geometry; re-snap is disabled.");
        return;
      }
      if (!snapToStreets) {
        setRouteCoords(baseRouteCoords);
        setStatus("Snap disabled; showing base geometry.");
        return;
      }
      setStatus("Snapping (OSRM)...");
      const waypoints = baseRouteCoords.length <= 25 ? baseRouteCoords : sampleWaypointsAlongLine(baseRouteCoords, waypointSpacingMiles);
      setRouteCoords(await osrmRouteThroughWaypoints(waypoints));
      setStatus("Snapped.");
    } catch (e: any) {
      setStatus(`Snap failed: ${e?.message ?? String(e)}`);
    }
  }

  function approveDesign() {
    if (isBaselineGraph) {
      setStatus("Baseline graph inventory does not create or approve ScopeVersion design routes.");
      return;
    }

    if (currentDatasetType === "EXISTING_NETWORK") {
      setStatus("Existing baseline inventory does not require IOF approval or /scope/assemble submission.");
      return;
    }

    const activeRoute = assembledSpine?.length ? assembledSpine : routeCoords;
    if (!activeRoute || activeRoute.length === 0) {
      alert("Route not defined");
      return;
    }
    if (!designStations || designStations.length === 0) {
      alert("Stations not generated");
      return;
    }

    const resolvedScopeVersionId = scopeVersionId ?? safeUUID();
    const engineeringAssumptions = {
      networkType,
      productType,
      role,
      stationSpacingFt,
      spanMiles,
      handholeSpacingFt: preset.handholeSpacingFt,
      vaultSpacingFt: preset.vaultSpacingFt,
      expansionReservePct,
      routeMix: normalizedRouteMix,
      undergroundMix: normalizedUndergroundMix,
    };
    const demandProfile = demandSets.map((demand) => {
      const expectedRevenue = demand.expectedMrc * demand.termMonths + demand.nrc;
      const weightedRevenue = expectedRevenue * (clamp(demand.probability, 0, 100) / 100);
      const estimatedMargin = weightedRevenue - (demand.buildCost || financial.totalBid);
      const paybackMonths = demand.expectedMrc > 0 ? (demand.buildCost || financial.totalBid) / demand.expectedMrc : 0;
      return { ...demand, expectedRevenue, weightedRevenue, estimatedMargin, paybackMonths };
    });

    const designBudgetModel = {
      ...financial,
      budgetLineItems: financial.budgetLineItems.map(toBudgetLineItem),
    };

    const iofPackage = createApprovedScopePackage({
      corridorId,
      segmentId,
      scopeVersionId: resolvedScopeVersionId,
      route: activeRoute,
      stations: designStations.map((s) => ({
        stationId: s.stationId,
        station: s.station,
        lat: s.lat,
        lon: s.lon,
        feet: s.feet ?? null,
      })),
      role,
      routeFeet: financial.routeFeet,
      financialContext: {
        designBudgetModel,
        civilModel,
        bomModel,
        nodeInfrastructureModel,
        diversityModel: {
          type: diversityModel,
          label: DIVERSITY_LABELS[diversityModel],
          primaryRouteFeet,
          diverseRouteFeet,
          totalBillableFeet,
          protectionRouteMultiplier,
          protectionRouteLengthOverrideMiles,
          corridorSeparationMiles,
          diversityPremiumPercent,
          sharedRiskWarnings: financialWarnings,
        },
        networkType,
        productType,
        demandProfile,
        engineeringAssumptions,
        datasetContext: {
          datasetType: currentDatasetType ?? "OPPORTUNITY_ROUTE",
          baselineScopeVersionId: currentBaselineScopeVersionId,
          opportunityBatchId: currentDatasetType === "OPPORTUNITY_BATCH" ? opportunityBatch?.batchId ?? null : null,
          campaignId: currentDatasetType === "OPPORTUNITY_BATCH" ? opportunityBatch?.campaignId ?? null : null,
          selectedSiteCount: currentDatasetType === "OPPORTUNITY_BATCH" ? opportunityBatch?.selectedSites.length ?? 0 : 0,
          selectedSites:
            currentDatasetType === "OPPORTUNITY_BATCH"
              ? (opportunityBatch?.selectedSites.map((site) => ({
                  siteId: site.siteId,
                  name: site.name,
                  lat: site.lat,
                  lon: site.lon,
                  serviceabilityClass: site.serviceabilityClass,
                  estimatedLateralFeet: site.estimatedLateralFeet,
                  estimatedLateralCost: site.estimatedLateralCost,
                })) ?? [])
              : [],
        },
        warnings: financial.warnings,
      },
    });

    console.log("IOF PACKAGE", iofPackage);
    console.log("========== IOF PACKAGE JSON ==========");
    console.log(JSON.stringify(iofPackage, null, 2));
    console.log("======================================");
    console.log("FETCH ABOUT TO RUN");
    const payload = JSON.stringify(iofPackage);
    console.log("IOF PACKAGE SIZE KB", (new Blob([payload]).size / 1024).toFixed(2));

    fetch(`${IOF_API}/scope/assemble`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("IOF RESPONSE", data);
        setScopeVersionId(resolvedScopeVersionId);
      })
      .catch((err) => {
        console.error("IOF ERROR", err);
      });

    setStatus("Design Approved: IOF Package Created");
  }

  function toBudgetLineItem(item: LineItem) {
    return {
      id: item.id,
      label: item.label,
      unit: item.unit,
      quantity: item.quantity,
      budgetUnitCost: item.unitCost,
      budgetAmount: item.amount,
      category: item.category,
      notes: item.notes,
    };
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function updateDemandSet(id: string, patch: Partial<DemandSet>) {
    setDemandSets((prev) => prev.map((demand) => (demand.id === id ? { ...demand, ...patch } : demand)));
  }

  async function refreshStoredBaselines() {
    try {
      const baselines = await listBaselines();
      setStoredBaselines(baselines);
      return baselines;
    } catch (err: any) {
      setStatus(`Baseline refresh failed: ${err?.message ?? String(err)}`);
      return [] as StoredBaselineMetadata[];
    }
  }

  async function saveCurrentRouteAsBaseline() {
    if (isBaselineGraph) {
      setStatus("Baseline graph is already registered as read-only inventory. No design route was created.");
      return;
    }

    const activeRoute = routeCoords?.length ? routeCoords : baseRouteCoords;
    if (!activeRoute?.length) {
      setStatus("Upload or load a route before registering an existing network inventory.");
      return;
    }

    try {
      setStatus("Registering network inventory in Chicago...");
      const resolvedBaselineScopeVersionId = currentBaselineScopeVersionId ?? `baseline-${safeUUID()}`;
      const stationsForBaseline =
        designStations.length > 0 ? designStations : designStationsFromRoute(activeRoute, stationSpacingFt);
      const saved = await createBaseline({
        accountId: accountId.trim() || "fiberlight-beta",
        baselineScopeVersionId: resolvedBaselineScopeVersionId,
        datasetType: "EXISTING_NETWORK",
        name: baselineName.trim() || `Existing network ${new Date().toLocaleDateString()}`,
        routeCoords: activeRoute,
        stations: stationsForBaseline,
        sourceFilename: lastRouteSourceFilename,
        metadata: {
          routePointCount: activeRoute.length,
          stationCount: stationsForBaseline.length,
          authoritativeStatus: "STORED_BASELINE",
          budgetRequired: false,
        },
      });
      const baselines = await refreshStoredBaselines();
      window.dispatchEvent(new Event("hyperlinx:baselinesChanged"));
      const baselineMeta = baselines.find((item) => item.datasetId === saved.datasetId) ?? saved;
      setSelectedBaselineDatasetId(baselineMeta.datasetId);
      setCurrentDatasetType("EXISTING_NETWORK");
      setCurrentBaselineScopeVersionId(baselineMeta.baselineScopeVersionId);
      setCurrentBaselineGraph(null);
      setScopeVersionId(baselineMeta.baselineScopeVersionId);
      setDesignStations(stationsForBaseline);
      setStatus("Network inventory registered in Chicago. Budget not required.");
    } catch (err: any) {
      setStatus(`Network inventory registration failed: ${err?.message ?? String(err)}`);
    }
  }

  async function loadStoredBaseline() {
    const baselineMeta = storedBaselines.find((item) => item.datasetId === selectedBaselineDatasetId);
    if (!baselineMeta) {
      setStatus("Select a stored baseline to load.");
      return;
    }

    try {
      setStatus("Loading baseline geometry from Chicago...");
      const baseline = await loadBaseline(baselineMeta.datasetId);
      console.log("BASELINE LOADED", baseline);
      setAccountId(baseline.accountId);
      setBaselineName(baseline.name);

      if (baseline.datasetType === "BASELINE_GRAPH") {
        const graph = baseline.graph;
        if (!graph?.edges.length) {
          setStatus(`Loaded baseline graph metadata: ${baseline.name}. No graph edges returned by Chicago.`);
          return;
        }

        setCurrentDatasetType("BASELINE_GRAPH");
        setCurrentBaselineScopeVersionId(null);
        setCurrentBaselineGraph(graph);
        setBaseRouteCoords(null);
        setRouteCoords(null);
        setAssembledSpine(null);
        setIsImportedFiber(true);
        setSites([]);
        setDesignStations([]);
        setStatus(`${baselineGraphDisplayMessage(graph)} No ScopeVersion route created.`);
        requestAnimationFrame(() => mapRef.current?.resize());
        return;
      }

      setCurrentDatasetType("EXISTING_NETWORK");
      setCurrentBaselineScopeVersionId(baseline.baselineScopeVersionId);
      setCurrentBaselineGraph(null);
      setScopeVersionId(baseline.baselineScopeVersionId);

      if (!baseline.routeCoords.length) {
        setStatus(`Loaded baseline metadata: ${baseline.name}. No geometry returned by Chicago.`);
        return;
      }

      const fullGeometry = baseline.routeCoords;
      const previewRoute = createSimplifiedRoutePreview(fullGeometry);
      const usingSimplifiedPreview = previewRoute.length !== fullGeometry.length;

      console.log("BASELINE STATE UPDATE", {
        fullGeometry: fullGeometry.length,
        previewRoute: previewRoute.length,
      });
      setBaseRouteCoords(fullGeometry);
      setRouteCoords((prev) => {
        console.log("SETROUTECOORDS COMMIT REQUEST");
        console.log("SETROUTECOORDS COMMIT REQUEST SOURCE", "DMredlinedev.loadStoredBaseline");
        console.log("SETROUTECOORDS COMMIT REQUEST PREV LENGTH", prev?.length ?? 0);
        console.log("SETROUTECOORDS COMMIT REQUEST NEXT LENGTH", previewRoute.length);
        return previewRoute;
      });
      console.log("ROUTECOORDS SET", previewRoute.length);
      setAssembledSpine(null);
      setIsImportedFiber(true);
      setSites([]);
      setDesignStations(
        baseline.stations?.length ? baseline.stations : usingSimplifiedPreview ? [] : designStationsFromRoute(previewRoute, stationSpacingFt)
      );
      setStatus(
        usingSimplifiedPreview
          ? largeBaselinePreviewMessage(fullGeometry.length, previewRoute.length)
          : `Loaded baseline: ${baseline.name}. Budget not required.`
      );
      requestAnimationFrame(() => mapRef.current?.resize());
    } catch (err: any) {
      setStatus(`Baseline load failed: ${err?.message ?? String(err)}`);
    }
  }

  const statusBadge = (text: string, color = "#38bdf8"): CSSProperties => ({
    display: "inline-block",
    padding: "2px 6px",
    background: `${color}20`,
    border: `1px solid ${color}`,
    borderRadius: 4,
    fontSize: 11,
    color,
    fontWeight: 700,
  });

  const cardStyle: CSSProperties = {
    padding: 12,
    borderRadius: 8,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  const buttonStylePrimary: CSSProperties = {
    padding: "10px 12px",
    background: "#38bdf8",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
    color: "#020617",
    fontSize: 12,
  };

  const buttonStyleSecondary: CSSProperties = {
    padding: "10px 12px",
    background: "#0bd18a",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
    color: "#020617",
    fontSize: 12,
  };

  const buttonStyleWarning: CSSProperties = {
    padding: "10px 12px",
    background: "#f59e0b",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 700,
    color: "#020617",
    fontSize: 12,
  };

  const buttonStyleOutline: CSSProperties = {
    padding: "10px 12px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6,
    cursor: "pointer",
    color: "#e5e7eb",
    fontSize: 12,
  };

  const inputStyle: CSSProperties = {
    padding: "6px",
    borderRadius: 4,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "#f8fafc",
    color: "#020617",
    minWidth: 0,
  };

  const sectionHeaderStyle: CSSProperties = { fontSize: 13, fontWeight: 800, marginBottom: 8 };

  const CollapsibleSection = ({
    title,
    section,
    badge,
    children,
  }: {
    title: string;
    section: keyof typeof expandedSections;
    badge?: { text: string; color: string } | null;
    children: ReactNode;
  }) => (
    <div style={cardStyle}>
      <button
        onClick={() => toggleSection(section)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          color: "white",
          cursor: "pointer",
          padding: "0 0 8px 0",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
          <span style={sectionHeaderStyle}>{title}</span>
          {badge && <div style={statusBadge(badge.text, badge.color)}>{badge.text}</div>}
        </div>
        <span style={{ fontSize: 16, opacity: 0.6 }}>{expandedSections[section] ? "v" : ">"}</span>
      </button>
      {expandedSections[section] && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>}
    </div>
  );

  console.log("MAP RENDER routeCoords.length", routeCoords?.length ?? 0);

  return (
    <div
      className="stellaos-design-shell"
      style={{
        display: "grid",
        gridTemplateColumns: "420px minmax(0, 1fr) 420px",
        width: "100%",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        className="design-panel"
        style={{
          width: "420px",
          minWidth: 0,
          height: "100%",
          background: "linear-gradient(180deg, #061a2b 0%, #07111b 100%)",
          color: "white",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          borderRight: "1px solid rgba(255,255,255,0.08)",
          overflowY: "auto",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>StellaOS Design</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3, lineHeight: 1.3 }}>
            FiberLight beta design authority
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
            Status: <span style={statusBadge(status, "#38bdf8")}>{status}</span>
          </div>
        </div>

        <CollapsibleSection title="Design Controls" section="design" badge={{ text: NETWORK_LABELS[networkType], color: "#38bdf8" }}>
          <SelectField label="Network type" value={networkType} onChange={(value) => setNetworkType(value as NetworkDesignType)}>
            {(Object.keys(NETWORK_LABELS) as NetworkDesignType[]).map((type) => (
              <option key={type} value={type}>
                {NETWORK_LABELS[type]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Product type" value={productType} onChange={(value) => setProductType(value as ProductType)}>
            {(Object.keys(PRODUCT_LABELS) as ProductType[]).map((type) => (
              <option key={type} value={type}>
                {PRODUCT_LABELS[type]}
              </option>
            ))}
          </SelectField>
          <div style={infoBoxStyle}>
            <div>IOF role: {role}</div>
            <div>{preset.warning}</div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Ingest"
          section="ingest"
          badge={
            isBaselineGraph
              ? { text: "Baseline graph", color: "#0bd18a" }
              : routeCoords?.length
                ? { text: "Route loaded", color: "#0bd18a" }
                : null
          }
        >
          <div style={infoBoxStyle}>API Target: {CHICAGO_API}</div>
          <FileField
            label="Import Existing Network (Baseline Graph)"
            note="KMZ, KML, or GeoJSON. Stored as read-only infrastructure; no design generation."
            accept=".geojson,.json,.kml,.kmz"
            onFile={handleImportBaselineGraph}
          />
          <FileField label="Proposed design route (GeoJSON/CSV)" accept=".geojson,.json,.csv" onFile={handleUploadRoute} />
          <FileField label="Sites (CSV or GeoJSON)" note="Headers: lat, lon, name, order" accept=".csv,.geojson,.json" onFile={handleUploadSites} />
          <LargeDatasetDiagnosticsPanel diagnostics={designIngestionDiagnostics} />
          <div style={infoBoxStyle}>
            Dataset: <b>{currentDatasetType ?? "DESIGN_INPUT"}</b>
            {isBaselineGraph && (
              <div>
                Read-only graph: {currentBaselineGraphStats?.nodes.toLocaleString() ?? 0} nodes /{" "}
                {currentBaselineGraphStats?.edges.toLocaleString() ?? 0} edges /{" "}
                {(currentBaselineGraphStats?.stations ?? 0).toLocaleString()} graph stations. No economics, BOM, Design route
                stationing, or ScopeVersion route.
              </div>
            )}
            {currentDatasetType === "EXISTING_NETWORK" && <div>Budget not required for existing baseline.</div>}
            {currentDatasetType === "OPPORTUNITY_BATCH" && <div>Selected opportunity sites are loaded for budget/reconfiguration.</div>}
            {isBaselineGraph && currentBaselineGraph ? (
              <div>
                Graph render: {currentBaselineGraphStats?.edges.toLocaleString() ?? 0} edges / {fullGeometryCount.toLocaleString()} source
                points
              </div>
            ) : designProcessingDisabled && (
              <div>
                Display: {baselineRenderMetadata.displayMode} ({baselineRenderMetadata.previewRouteCount.toLocaleString()} of{" "}
                {baselineRenderMetadata.fullGeometryCount.toLocaleString()} points)
              </div>
            )}
          </div>
          <TextField label="Account ID" value={accountId} onChange={setAccountId} />
          <TextField label="Baseline name" value={baselineName} onChange={setBaselineName} />
          <button onClick={() => void saveCurrentRouteAsBaseline()} style={buttonStyleSecondary}>
            Register Network Inventory
          </button>
          <SelectField label="Carrier network / baseline" value={selectedBaselineDatasetId} onChange={setSelectedBaselineDatasetId}>
            <option value="">Select baseline</option>
            {storedBaselines.map((baseline) => (
              <option key={baseline.datasetId} value={baseline.datasetId}>
                {baseline.name} [{baseline.datasetType}] ({baseline.accountId})
                {baseline.routePointCount ? ` - ${baseline.routePointCount.toLocaleString()} pts` : ""}
              </option>
            ))}
          </SelectField>
          {selectedBaselineDatasetId && (
            <BaselineMetadataPanel baseline={storedBaselines.find((item) => item.datasetId === selectedBaselineDatasetId) ?? null} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={() => void loadStoredBaseline()} style={buttonStylePrimary}>
              Load Geometry
            </button>
            <button onClick={() => void refreshStoredBaselines()} style={buttonStyleOutline}>
              Refresh
            </button>
          </div>
          <button
            onClick={() => {
              console.log("TEST ROUTE BUTTON SETTING ROUTE LENGTH", 2);
              setRouteCoords([[0, 0], [1, 1]] as LonLat[]);
            }}
            style={buttonStyleOutline}
          >
            TEST ROUTE
          </button>
        </CollapsibleSection>

        <CollapsibleSection title="Route + Diversity" section="route" badge={assembledSpine?.length ? { text: "Spine ready", color: "#0bd18a" } : null}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={() => void resnapCurrent()} style={buttonStyleSecondary}>
              Re-snap
            </button>
            <button onClick={handleAssembleSpine} style={buttonStyleWarning}>
              Assemble Spine
            </button>
          </div>
          <CheckboxField label="Snap to streets (OSRM)" checked={snapToStreets} onChange={setSnapToStreets} />
          <NumberField label="Waypoint spacing (miles)" value={waypointSpacingMiles} min={0.5} max={10} step={0.5} onChange={(v) => setWaypointSpacingMiles(clamp(v, 0.5, 10))} />
          <SelectField label="Diversity model" value={diversityModel} onChange={(value) => setDiversityModel(value as DiversityModel)}>
            {(Object.keys(DIVERSITY_LABELS) as DiversityModel[]).map((type) => (
              <option key={type} value={type}>
                {DIVERSITY_LABELS[type]}
              </option>
            ))}
          </SelectField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="Protection override mi" value={protectionRouteLengthOverrideMiles} min={0} step={1} onChange={(v) => setProtectionRouteLengthOverrideMiles(Math.max(0, v))} />
            <NumberField label="Diversity multiplier" value={protectionRouteMultiplier} min={1} max={2.5} step={0.05} onChange={(v) => setProtectionRouteMultiplier(clamp(v, 1, 2.5))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="Corridor sep mi" value={corridorSeparationMiles} min={0} step={0.05} onChange={(v) => setCorridorSeparationMiles(Math.max(0, v))} />
            <NumberField label="Diversity premium %" value={diversityPremiumPercent} min={0} max={50} step={1} onChange={(v) => setDiversityPremiumPercent(clamp(v, 0, 50))} />
          </div>
          <CheckboxField label="Show stationing (0+00)" checked={showStationing} onChange={setShowStationing} />
          <NumberField label="Station spacing (ft)" value={stationSpacingFt} min={100} step={100} onChange={(v) => setStationSpacingFt(Math.max(100, v))} />
          <div style={infoBoxStyle}>
            Primary: {fmtMi(primaryRouteFeet / 5280)} | Protection: {fmtMi(diverseRouteFeet / 5280)} | Billable:{" "}
            {fmtMi(totalBillableFeet / 5280)}
          </div>
          {financialWarnings.length > 0 && <WarningList warnings={financialWarnings} />}
        </CollapsibleSection>

        <CollapsibleSection title="Civil Model" section="civil" badge={{ text: `${fmtMoney(civilModel.routeCivilSubtotal)}`, color: "#f59e0b" }}>
          <div style={subheadStyle}>Top-level route mix</div>
          <SliderField label="Underground" value={routeMix.undergroundPct} onChange={(v) => setRouteMix((m) => ({ ...m, undergroundPct: v }))} normalized={normalizedRouteMix.undergroundPct} />
          <SliderField label="Aerial" value={routeMix.aerialPct} onChange={(v) => setRouteMix((m) => ({ ...m, aerialPct: v }))} normalized={normalizedRouteMix.aerialPct} />
          <SliderField label="Existing conduit" value={routeMix.existingConduitPct} onChange={(v) => setRouteMix((m) => ({ ...m, existingConduitPct: v }))} normalized={normalizedRouteMix.existingConduitPct} />

          <div style={subheadStyle}>Underground method mix</div>
          <SliderField label="Plow" value={undergroundMix.plowPct} onChange={(v) => setUndergroundMix((m) => ({ ...m, plowPct: v }))} normalized={normalizedUndergroundMix.plowPct} />
          <SliderField label="Trench" value={undergroundMix.trenchPct} onChange={(v) => setUndergroundMix((m) => ({ ...m, trenchPct: v }))} normalized={normalizedUndergroundMix.trenchPct} />
          <SliderField label="HDD" value={undergroundMix.hddPct} onChange={(v) => setUndergroundMix((m) => ({ ...m, hddPct: v }))} normalized={normalizedUndergroundMix.hddPct} />
          <SliderField label="Rock trench" value={undergroundMix.rockTrenchPct} onChange={(v) => setUndergroundMix((m) => ({ ...m, rockTrenchPct: v }))} normalized={normalizedUndergroundMix.rockTrenchPct} />
          <SliderField label="Rock bore" value={undergroundMix.rockBorePct} onChange={(v) => setUndergroundMix((m) => ({ ...m, rockBorePct: v }))} normalized={normalizedUndergroundMix.rockBorePct} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="Urban restoration %" value={urbanRestorationPct} min={0} max={100} step={1} onChange={(v) => setUrbanRestorationPct(clamp(v, 0, 100))} />
            <NumberField label="Rural restoration %" value={ruralRestorationPct} min={0} max={100} step={1} onChange={(v) => setRuralRestorationPct(clamp(v, 0, 100))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="Make-ready count" value={aerialMakeReadyCount} min={0} step={1} onChange={(v) => setAerialMakeReadyCount(Math.max(0, v))} />
            <NumberField label="Pole transfers" value={poleTransferCount} min={0} step={1} onChange={(v) => setPoleTransferCount(Math.max(0, v))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="Road crossings" value={roadCrossings} min={0} step={1} onChange={(v) => setRoadCrossings(Math.max(0, v))} />
            <NumberField label="Rail crossings" value={railCrossings} min={0} step={1} onChange={(v) => setRailCrossings(Math.max(0, v))} />
            <NumberField label="Water crossings" value={waterCrossings} min={0} step={1} onChange={(v) => setWaterCrossings(Math.max(0, v))} />
            <NumberField label="Bridge specials" value={bridgeCrossings} min={0} step={1} onChange={(v) => setBridgeCrossings(Math.max(0, v))} />
          </div>
          <MetricGrid
            items={[
              ["UG", fmtFt(civilModel.undergroundFeet)],
              ["Aerial", fmtFt(civilModel.aerialFeet)],
              ["Existing", fmtFt(civilModel.existingConduitFeet)],
              ["Civil/ft", fmtMoney(civilModel.civilCostPerFoot)],
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="BOM Model" section="bom" badge={{ text: `${bomModel.fiberCount}ct`, color: "#0bd18a" }}>
          <SelectField label="Duct configuration" value={ductConfig} onChange={(value) => setDuctConfig(value as DuctConfig)}>
            {(["1x1.25", "2x1.25", "3x1.25", "4x1.25", "1x1.5", "2x1.5", "3x1.5", "4x1.5", "custom"] as DuctConfig[]).map((cfg) => (
              <option key={cfg} value={cfg}>
                {cfg === "custom" ? "Custom" : cfg}
              </option>
            ))}
          </SelectField>
          {ductConfig === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <NumberField label="Duct count" value={customDuctCount} min={1} step={1} onChange={(v) => setCustomDuctCount(Math.max(1, v))} />
              <NumberField label="Diameter in" value={customDuctDiameterIn} min={0.75} step={0.25} onChange={(v) => setCustomDuctDiameterIn(Math.max(0.75, v))} />
            </div>
          )}
          <SelectField label="Fiber count" value={fiberCountOption} onChange={(value) => setFiberCountOption(value as FiberCountOption)}>
            {(["48", "96", "144", "288", "432", "864", "custom"] as FiberCountOption[]).map((fiber) => (
              <option key={fiber} value={fiber}>
                {fiber === "custom" ? "Custom" : fiber}
              </option>
            ))}
          </SelectField>
          {fiberCountOption === "custom" && <NumberField label="Custom fiber count" value={customFiberCount} min={12} step={12} onChange={(v) => setCustomFiberCount(Math.max(12, v))} />}
          <NumberField label="Expansion reserve %" value={expansionReservePct} min={0} max={100} step={5} onChange={(v) => setExpansionReservePct(clamp(v, 0, 100))} />
          <NumberField label="Material escalation %" value={materialsEscalationPercent} min={0} max={50} step={1} onChange={(v) => setMaterialsEscalationPercent(clamp(v, 0, 50))} />
          <CheckboxField label="Owner-furnished materials (exclude from bid)" checked={ownerFurnishedMaterials} onChange={setOwnerFurnishedMaterials} />
          <MetricGrid
            items={[
              ["Base BOM", fmtMoney(bomModel.materialSubtotal)],
              ["Escalation", fmtMoney(bomModel.materialEscalation)],
              ["Bid BOM", fmtMoney(financial.materialSubtotal)],
              ["BOM/ft", fmtMoney(bomModel.materialCostPerFoot)],
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Nodes + Power" section="nodes" badge={{ text: `${nodeInfrastructureModel.ilaCount} ILA`, color: "#38bdf8" }}>
          <CheckboxField label="Regens / ILA enabled" checked={includeRegens} onChange={setIncludeRegens} />
          <NumberField label="Span miles" value={spanMiles} min={10} step={5} onChange={(v) => setSpanMiles(Math.max(10, v))} />
          <CheckboxField label="POP sites" checked={includePops} onChange={setIncludePops} />
          <NumberField label="POP count" value={popCount} min={0} step={1} onChange={(v) => setPopCount(Math.max(0, v))} />
          <CheckboxField label="Agg sites" checked={includeAgg} onChange={setIncludeAgg} />
          <NumberField label="Agg count" value={aggCount} min={0} step={1} onChange={(v) => setAggCount(Math.max(0, v))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="GPU Micro count" value={gpuMicroCount} min={0} step={1} onChange={(v) => setGpuMicroCount(Math.max(0, v))} />
            <NumberField label="GPU POD count" value={gpuPodCount} min={0} step={1} onChange={(v) => setGpuPodCount(Math.max(0, v))} />
          </div>
          <SliderField label="Power readiness" value={powerAvailability} onChange={setPowerAvailability} normalized={powerAvailability} />
          <SliderField label="Real estate readiness" value={realEstateAvailability} onChange={setRealEstateAvailability} normalized={realEstateAvailability} />
          <MetricGrid
            items={[
              ["Node capex", fmtMoney(nodeInfrastructureModel.nodeCapex)],
              ["Monthly opex", fmtMoney(nodeInfrastructureModel.nodeMonthlyOpex)],
              ["Regen", String(nodeInfrastructureModel.regenCount)],
              ["GPU cand.", String(nodeInfrastructureModel.gpuCandidateCount)],
            ]}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Demand Sets" section="demand" badge={{ text: `${demandSets.length} set`, color: "#a855f7" }}>
          {demandSets.map((demand) => (
            <div key={demand.id} style={{ ...infoBoxStyle, display: "flex", flexDirection: "column", gap: 6 }}>
              <SelectField label="Demand profile" value={demand.type} onChange={(value) => updateDemandSet(demand.id, { type: value as DemandType })}>
                {(["Enterprise", "Tower", "Data Center", "Hyperscaler", "GPU / AI Cluster", "Wholesale carrier", "Residential / FTTH", "School / SLD", "Healthcare / Government"] as DemandType[]).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </SelectField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <NumberField label="Expected MRC" value={demand.expectedMrc} min={0} step={1000} onChange={(v) => updateDemandSet(demand.id, { expectedMrc: Math.max(0, v) })} />
                <NumberField label="NRC" value={demand.nrc} min={0} step={10000} onChange={(v) => updateDemandSet(demand.id, { nrc: Math.max(0, v) })} />
                <NumberField label="Term months" value={demand.termMonths} min={1} step={1} onChange={(v) => updateDemandSet(demand.id, { termMonths: Math.max(1, v) })} />
                <NumberField label="Probability %" value={demand.probability} min={0} max={100} step={5} onChange={(v) => updateDemandSet(demand.id, { probability: clamp(v, 0, 100) })} />
              </div>
              <SelectField label="Required diversity" value={demand.requiredDiversity} onChange={(value) => updateDemandSet(demand.id, { requiredDiversity: value as DiversityModel })}>
                {(Object.keys(DIVERSITY_LABELS) as DiversityModel[]).map((type) => (
                  <option key={type} value={type}>
                    {DIVERSITY_LABELS[type]}
                  </option>
                ))}
              </SelectField>
            </div>
          ))}
          <button onClick={() => setDemandSets((prev) => [...prev, initialDemandSet()])} style={buttonStyleOutline}>
            Add demand set
          </button>
        </CollapsibleSection>

        <CollapsibleSection title="Financial Output" section="financial" badge={{ text: fmtMoney(financial.totalBid), color: "#f59e0b" }}>
          {isBaselineGraph && (
            <div style={infoBoxStyle}>Baseline graph inventory: economics and construction assumptions are disabled.</div>
          )}
          {currentDatasetType === "EXISTING_NETWORK" && (
            <div style={infoBoxStyle}>Budget not required for existing baseline.</div>
          )}
          <MetricGrid
            items={[
              ["Total bid", fmtMoney(financial.totalBid)],
              ["Cost/ft", fmtMoney(financial.costPerFoot)],
              ["Cost/mi", fmtMoney(financial.costPerMile)],
              ["60 mo", fmtMoney(financial.monthlyRecovery60)],
              ["Opex/mo", fmtMoney(financial.monthlyOpex)],
              ["Suggested MRC", fmtMoney(financial.totalMonthlyChargeSuggested)],
            ]}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumberField label="Engineering $/ft" value={engineeringPerFt} min={0} step={0.05} onChange={(v) => setEngineeringPerFt(Math.max(0, v))} />
            <NumberField label="Permitting $/ft" value={permittingPerFt} min={0} step={0.05} onChange={(v) => setPermittingPerFt(Math.max(0, v))} />
            <NumberField label="Splicing $/ft" value={splicingPerFt} min={0} step={0.05} onChange={(v) => setSplicingPerFt(Math.max(0, v))} />
            <NumberField label="Mobilization" value={mobilization} min={0} step={10000} onChange={(v) => setMobilization(Math.max(0, v))} />
            <NumberField label="PM %" value={pmOverheadPercent} min={0} max={30} step={0.5} onChange={(v) => setPmOverheadPercent(clamp(v, 0, 30))} />
            <NumberField label="Insurance %" value={insurancePercent} min={0} max={15} step={0.5} onChange={(v) => setInsurancePercent(clamp(v, 0, 15))} />
            <NumberField label="QA/QC %" value={qcPercent} min={0} max={15} step={0.5} onChange={(v) => setQcPercent(clamp(v, 0, 15))} />
            <NumberField label="Contingency %" value={riskPercent} min={0} max={50} step={1} onChange={(v) => setRiskPercent(clamp(v, 0, 50))} />
            <NumberField label="Margin %" value={marginPercent} min={0} max={60} step={1} onChange={(v) => setMarginPercent(clamp(v, 0, 60))} />
            <NumberField label="Entrance unit" value={buildingEntranceUnitCost} min={0} step={5000} onChange={(v) => setBuildingEntranceUnitCost(Math.max(0, v))} />
            <NumberField label="ISP unit" value={ispUnitCost} min={0} step={5000} onChange={(v) => setIspUnitCost(Math.max(0, v))} />
          </div>
          {financial.warnings.length > 0 && <WarningList warnings={financial.warnings} />}
        </CollapsibleSection>

        <CollapsibleSection title="Scope + SVA" section="scope" badge={designStations.length ? { text: `${designStations.length} stations`, color: "#0bd18a" } : null}>
          <button
            onClick={approveDesign}
            style={{
              ...buttonStylePrimary,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 900,
              background: currentDatasetType === "EXISTING_NETWORK" || isBaselineGraph ? "#64748b" : "#3fa9ff",
              width: "100%",
              opacity: currentDatasetType === "EXISTING_NETWORK" || isBaselineGraph ? 0.72 : 1,
              cursor: currentDatasetType === "EXISTING_NETWORK" || isBaselineGraph ? "not-allowed" : "pointer",
            }}
            disabled={currentDatasetType === "EXISTING_NETWORK" || isBaselineGraph}
          >
            {isBaselineGraph
              ? "Baseline Graph Stored - No Approval Required"
              : currentDatasetType === "EXISTING_NETWORK"
                ? "Baseline Stored - No Approval Required"
                : "Approve Design"}
          </button>
          <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.4 }}>
            {isBaselineGraph
              ? "Baseline graph is read-only reference infrastructure. Future ScopeVersions should reference its baselineId and store extensions separately."
              : currentDatasetType === "EXISTING_NETWORK"
              ? "Stored baseline inventory is reusable context and does not post to /scope/assemble."
              : "Approve Design is the only action that creates an IOF package and posts to /scope/assemble."}
          </div>
          <CheckboxField label="Enable ICDE Mode" checked={icdeMode} onChange={setIcdeMode} />
          <CheckboxField label="Enable SVA Simulation" checked={svaEnabled} onChange={setSvaEnabled} disabled={!icdeMode} />
          {icdeMode && (
            <div style={infoBoxStyle}>
              Score: <b>{corridorScore ?? "-"}</b> | Tier: <b>{corridorTier ?? "-"}</b>
            </div>
          )}
          {icdeMode && svaEnabled && (
            <>
              {(Object.keys(haaInputs) as Array<keyof AdjacencyInputs>).map((key) => (
                <SliderField
                  key={key}
                  label={key}
                  value={haaInputs[key]}
                  normalized={haaInputs[key]}
                  onChange={(v) => setHaaInputs((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
              <NumberField label={`Node threshold (score >= ${svaThreshold})`} value={svaThreshold} min={0} max={100} step={1} onChange={(v) => setSvaThreshold(clamp(v, 0, 100))} />
              <div style={infoBoxStyle}>
                GPU POD: {svaCounts["GPU POD"]} | GPU Micro: {svaCounts["GPU Micro"]} | ILA: {svaCounts.ILA} | Regen:{" "}
                {svaCounts.Regen}
              </div>
            </>
          )}
        </CollapsibleSection>
      </div>

      <div
        className="map-panel"
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          background: "#dbeafe",
        }}
      />

      <div
        className="translate-panel"
        style={{
          width: "420px",
          minWidth: 0,
          height: "100%",
          background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
          color: "white",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          overflowY: "auto",
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>StellaOS Translate</div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3, lineHeight: 1.3 }}>
            Advisory normalization only
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
            Status: <span style={statusBadge(translateStatus, translatePreview ? "#0bd18a" : "#38bdf8")}>{translateStatus}</span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Ingestion Zone</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 12, lineHeight: 1.3 }}>
            Upload PDF, DOCX, TXT, CSV, XLSX, JSON, KMZ/KML, or route exports. Translate can send advisory inputs to Design, but cannot approve scope.
          </div>
          <CheckboxField
            label="Force Large Dataset Mode"
            checked={forceLargeDatasetMode}
            onChange={setForceLargeDatasetMode}
          />
          <div style={{ height: 8 }} />
          <LargeDatasetDiagnosticsPanel diagnostics={translateLargeDataset} />
          <div style={{ height: 12 }} />
          <div
            style={{
              border: "2px dashed rgba(56,189,248,0.3)",
              borderRadius: 8,
              padding: 20,
              textAlign: "center",
              background: "rgba(56,189,248,0.05)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => document.getElementById("translate-file-input")?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "rgba(56,189,248,0.8)";
              e.currentTarget.style.background = "rgba(56,189,248,0.1)";
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "rgba(56,189,248,0.3)";
              e.currentTarget.style.background = "rgba(56,189,248,0.05)";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "rgba(56,189,248,0.3)";
              e.currentTarget.style.background = "rgba(56,189,248,0.05)";
              const files = Array.from(e.dataTransfer.files);
              if (files.length > 0) void handleTranslateUpload(files[0]);
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Drop files here</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>or click to browse</div>
          </div>
          <input
            id="translate-file-input"
            type="file"
            accept=".pdf,.docx,.txt,.csv,.xlsx,.json,.kml,.kmz,.geojson"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleTranslateUpload(f);
              e.currentTarget.value = "";
            }}
            style={{ display: "none" }}
          />
        </div>

        {translateError && (
          <div style={{ color: "#f87171", fontSize: 12, padding: 8, background: "rgba(248,113,113,0.1)", borderRadius: 4 }}>
            {translateError}
          </div>
        )}

        {translatePreview && (
          <>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>AI Narration</div>
              <div style={consoleBoxStyle}>
                <NarrationLine label="Translate AI" text="Analyzed document structure and extracted advisory infrastructure signals." />
                <NarrationLine label="Translate AI" text={`Detected ${translatePreview.sites?.length || 0} candidate sites with coordinates.`} />
                <NarrationLine
                  label="Translate AI"
                  text={`Identified route topology: ${translatePreview.routeCoords?.length ? `${translatePreview.routeCoords.length} waypoints` : "no route detected"}.`}
                />
                <NarrationLine label="Translate AI" text={`Inferred network: ${translatePreview.inferredNetworkType ? NETWORK_LABELS[translatePreview.inferredNetworkType] : "unknown"}.`} />
                <NarrationLine label="Translate AI" text={`Found ${translatePreview.productHints?.length || 0} product/technology hints.`} />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Extracted Preview</div>
              <div style={{ fontSize: 11, lineHeight: 1.4, whiteSpace: "pre-wrap", background: "rgba(255,255,255,0.05)", padding: 8, borderRadius: 4, maxHeight: 180, overflowY: "auto" }}>
                {formatPreview(translatePreview)}
              </div>
            </div>

            {translatePreview.sites?.length ? (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Sites ({translatePreview.sites.length})</div>
                <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 11 }}>
                  {translatePreview.sites.slice(0, 5).map((site, i) => (
                    <div key={`${site.lat}-${site.lon}-${i}`} style={miniRowStyle}>
                      {site.name || `Site ${i + 1}`}: {site.lat.toFixed(4)}, {site.lon.toFixed(4)}
                    </div>
                  ))}
                  {translatePreview.sites.length > 5 && <div style={{ fontSize: 10, opacity: 0.6 }}>and {translatePreview.sites.length - 5} more sites</div>}
                </div>
              </div>
            ) : null}

            {translatePreview.routeCoords?.length ? (
              <div style={cardStyle}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Route ({translatePreview.routeCoords.length} points)</div>
                <div style={{ fontSize: 11, padding: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4 }}>
                  Start: {translatePreview.routeCoords[0][1].toFixed(4)}, {translatePreview.routeCoords[0][0].toFixed(4)}
                  <br />
                  End: {translatePreview.routeCoords[translatePreview.routeCoords.length - 1][1].toFixed(4)},{" "}
                  {translatePreview.routeCoords[translatePreview.routeCoords.length - 1][0].toFixed(4)}
                </div>
              </div>
            ) : null}

            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Design Payload Preview</div>
              <div style={consoleBoxStyle}>
                {JSON.stringify(
                  {
                    routeCoords: translatePreview.routeCoords ? `${translatePreview.routeCoords.length} points` : null,
                    sites: translatePreview.sites ? `${translatePreview.sites.length} sites` : null,
                    serverBaselineId: translatePreview.serverBaselineId,
                    inferredNetworkType: translatePreview.inferredNetworkType,
                    inferredRole: translatePreview.inferredRole,
                    inferredProductType: translatePreview.inferredProductType,
                    budgetAssumptions: translatePreview.budgetAssumptions,
                    productHints: translatePreview.productHints,
                    constraints: translatePreview.constraints,
                    notes: translatePreview.notes,
                  },
                  null,
                  2
                )}
              </div>
            </div>

            <button onClick={applyTranslatePreview} style={{ ...buttonStylePrimary, width: "100%", padding: "12px 16px", fontSize: 14 }}>
              Send to Design
            </button>
            <div style={{ fontSize: 11, opacity: 0.6, textAlign: "center", lineHeight: 1.3 }}>
              Sends advisory inputs into Design. It does not create an authoritative route or submit IOF.
            </div>
            <button onClick={clearTranslatePreview} style={{ ...buttonStyleOutline, width: "100%" }}>
              Clear Preview
            </button>
          </>
        )}
      </div>
    </div>
  );

  function SelectField({
    label,
    value,
    onChange,
    children,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
  }) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={fieldLabelStyle}>{label}</div>
        <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          {children}
        </select>
      </label>
    );
  }

  function NumberField({
    label,
    value,
    min,
    max,
    step,
    onChange,
  }: {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
  }) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={fieldLabelStyle}>{label}</div>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          style={inputStyle}
        />
      </label>
    );
  }

  function TextField({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={fieldLabelStyle}>{label}</div>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      </label>
    );
  }

  function SliderField({
    label,
    value,
    normalized,
    onChange,
  }: {
    label: string;
    value: number;
    normalized: number;
    onChange: (value: number) => void;
  }) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={fieldLabelStyle}>
          {label}: <b>{fmtPct(normalized)}</b>
        </div>
        <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    );
  }

  function CheckboxField({
    label,
    checked,
    onChange,
    disabled,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
  }) {
    return (
      <label style={{ display: "flex", gap: 10, alignItems: "center", opacity: disabled ? 0.5 : 1 }}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <div style={{ fontSize: 12, fontWeight: 700 }}>{label}</div>
      </label>
    );
  }

  function FileField({
    label,
    note,
    accept,
    onFile,
  }: {
    label: string;
    note?: string;
    accept: string;
    onFile: (file: File) => void | Promise<void>;
  }) {
    return (
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={fieldLabelStyle}>{label}</div>
        {note && <div style={{ fontSize: 11, opacity: 0.65 }}>{note}</div>}
        <input
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.currentTarget.value = "";
          }}
        />
      </label>
    );
  }

  function MetricGrid({ items }: { items: Array<[string, string]> }) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {items.map(([label, value]) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.05)", padding: 8, borderRadius: 4 }}>
            <div style={{ fontSize: 10, opacity: 0.65 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>
    );
  }
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {warnings.slice(0, 5).map((warning, index) => (
        <div key={`${warning}-${index}`} style={{ fontSize: 11, color: "#fbbf24", background: "rgba(251,191,36,0.08)", padding: 6, borderRadius: 4 }}>
          {warning}
        </div>
      ))}
    </div>
  );
}

function LargeDatasetDiagnosticsPanel({ diagnostics }: { diagnostics: LargeDatasetDiagnostics }) {
  const progress =
    diagnostics.progressPct === undefined
      ? "-"
      : `${Math.round(diagnostics.progressPct <= 1 ? diagnostics.progressPct * 100 : diagnostics.progressPct)}%`;
  const rows: Array<[string, string]> = [
    ["Mode", diagnostics.mode],
    ["API Target", diagnostics.apiTarget],
    ["Upload ID", diagnostics.uploadId ?? "-"],
    ["Job ID", diagnostics.jobId ?? "-"],
    ["Rows Read", diagnostics.rowsRead?.toLocaleString() ?? "-"],
    ["Points Accepted", diagnostics.pointsAccepted?.toLocaleString() ?? "-"],
    ["Rows Rejected", diagnostics.rowsRejected?.toLocaleString() ?? "-"],
    ["Progress %", progress],
    ["Baseline ID", diagnostics.baselineId ?? "-"],
    ["Status", diagnostics.status],
  ];

  return (
    <div style={infoBoxStyle}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span>{label}</span>
          <b style={{ textAlign: "right", wordBreak: "break-word" }}>{value}</b>
        </div>
      ))}
      {diagnostics.message && <div style={{ marginTop: 6, color: "#bae6fd" }}>{diagnostics.message}</div>}
    </div>
  );
}

function BaselineMetadataPanel({ baseline }: { baseline: StoredBaselineMetadata | null }) {
  if (!baseline) return null;
  return (
    <div style={infoBoxStyle}>
      <div>
        <b>{baseline.name}</b>
      </div>
      <div>Dataset type: {baseline.datasetType}</div>
      <div>Baseline ID: {baseline.baselineId}</div>
      <div>Dataset ID: {baseline.datasetId}</div>
      <div>Scope/Baseline ID: {baseline.baselineScopeVersionId}</div>
      <div>Account: {baseline.accountId}</div>
      <div>Route points: {baseline.routePointCount?.toLocaleString() ?? "metadata only"}</div>
      <div>Stations: {baseline.stationCount?.toLocaleString() ?? "-"}</div>
      {baseline.status && <div>Status: {baseline.status}</div>}
    </div>
  );
}

function NarrationLine({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <b style={{ color: "#22c55e" }}>{label}:</b> {text}
    </div>
  );
}

const fieldLabelStyle: CSSProperties = { fontSize: 12, opacity: 0.8 };
const subheadStyle: CSSProperties = { fontSize: 12, fontWeight: 800, opacity: 0.9, marginTop: 2 };
const infoBoxStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.82,
  background: "rgba(255,255,255,0.05)",
  padding: 8,
  borderRadius: 4,
  lineHeight: 1.4,
};
const consoleBoxStyle: CSSProperties = {
  background: "#020617",
  border: "1px solid #1e293b",
  borderRadius: 8,
  padding: 12,
  maxHeight: 190,
  overflowY: "auto",
  fontSize: 11,
  lineHeight: 1.4,
  whiteSpace: "pre-wrap",
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
};
const miniRowStyle: CSSProperties = {
  marginBottom: 4,
  padding: 4,
  background: "rgba(255,255,255,0.05)",
  borderRadius: 4,
};
