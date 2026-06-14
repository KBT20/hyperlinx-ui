// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import JSZip from "jszip";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import Papa from "papaparse";
import * as turf from "@turf/turf";


type LonLat = [number, number];

type UploadedSitesRow = {
  name?: string;
  lat: number;
  lon: number;
  order?: number;
};

type SurfaceMix = {
  plowPct: number;
  trenchPct: number;
  hddPct: number;
  rockPct: number;
};

type RouteRole = "longhaul" | "middlemile" | "metro";

type DuctConfig =
  | "3x1.5"
  | "2x1.5"
  | "4x1.5"
  | "3x1.25"
  | "2x1.25"
  | "4x1.25";

type FinancialModel = {
  routeFeet: number;
  routeMiles: number;

  directCivilLabor: number;

  materialsBase: number;
  materialsEscalated: number;
  materialsIncludedInBid: boolean;

  engineering: number;
  permitting: number;

  crossings: number;
  nodes: number;

  program: number;

  subtotal: number;
  contingency: number;
  riskedCost: number;
  margin: number;
  totalBid: number;

  costPerFoot: number;
  costPerMile: number;

  recovery60: number;
  recovery120: number;

  weightedCivilPerFt: number;

  ductCount: number;
  ductDiameterIn: number;

  regenSites: number;
  popSites: number;
  aggSites: number;

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

// --- Labor $/ft ---
const LABOR_PER_FT = {
  plow: 4.75,
  trench: 14.75,
  hdd: 22.0,
  rock: 35.0,
};

// --- Discrete crossing costs ---
const CROSSING_UNIT_COST = {
  road: 25000,
  rail: 150000,
  water: 100000,
};

// --- Defaults ---
const DEFAULTS = {
  showStationing: true,
  stationSpacingFt: 2000,

  snapToStreets: true,
  waypointSpacingMiles: 2.0,

  corridorSeparationMiles: 0.25,

  surfaceMix: { plowPct: 60, trenchPct: 20, hddPct: 10, rockPct: 10 } as SurfaceMix,

  role: "middlemile" as RouteRole,

  riskPercent: 10,
  marginPercent: 12,

  engineeringPerFt: 1.25,
  permittingPerFt: 1.0,

  mobilization: 250000,
  pmOverheadPercent: 4,
  insurancePercent: 1.5,
  qcPercent: 1.0,

  roadsCrossings: 4,
  railCrossings: 1,
  waterCrossings: 0,

  ownerFurnishedMaterials: false,
  materialsEscalationPercent: 6,
  ductConfig: "3x1.5" as DuctConfig,

  materialUnit: {
    conduitPerFt_1p25: 0.95,
    conduitPerFt_1p5: 1.1,
    innerductPerFt_1p25: 0.38,
    innerductPerFt_1p5: 0.45,

    fiberPerFt: 0.32,
    tracerWirePerFt: 0.08,

    handhole: 2500,
    vault: 15000,
    spliceClosure: 1800,

    restorationPerFt: 0.6,
  },

  spanMiles: 55,
  includeRegens: true,
  includePops: true,
  includeAgg: true,

  popCount: 2,
  aggCount: 0,

  regenUnitCost: 250000,
  popUnitCost: 250000,
  aggUnitCost: 150000,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function stationLabelFromFeet(feetFromOrigin: number) {
  const s = Math.max(0, Math.round(feetFromOrigin));
  const hundreds = Math.floor(s / 100);
  const remainder = s % 100;
  return `${hundreds}+${remainder.toString().padStart(2, "0")}`;
}

function ensureMixSumsTo100(m: SurfaceMix): SurfaceMix {
  const sum = m.plowPct + m.trenchPct + m.hddPct + m.rockPct;
  if (sum === 100) return m;
  const scale = sum === 0 ? 0 : 100 / sum;
  const plow = Math.round(m.plowPct * scale);
  const trench = Math.round(m.trenchPct * scale);
  const hdd = Math.round(m.hddPct * scale);
  const rock = Math.max(0, 100 - (plow + trench + hdd));
  return { plowPct: plow, trenchPct: trench, hddPct: hdd, rockPct: rock };
}

function lineStringFromCoords(coords: LonLat[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coords },
  };
}
function featureCollection(features: any[]) {
  return { type: "FeatureCollection" as const, features };
}

function getLineCoordsFromGeoJSON(gj: any): LonLat[] | null {
  const features: any[] =
    gj?.type === "FeatureCollection"
      ? gj.features
      : gj?.type === "Feature"
      ? [gj]
      : gj?.type
      ? [{ type: "Feature", properties: {}, geometry: gj }]
      : [];

  const flattened: LonLat[] = [];
  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "LineString") return g.coordinates as LonLat[];
    if (g.type === "MultiLineString") {
      for (const part of g.coordinates as LonLat[][]) for (const c of part) flattened.push(c);
      if (flattened.length) return flattened;
    }
  }
  return null;
}

function getPointsFromGeoJSON(gj: any): LonLat[] {
  const pts: LonLat[] = [];
  const features: any[] =
    gj?.type === "FeatureCollection"
      ? gj.features
      : gj?.type === "Feature"
      ? [gj]
      : gj?.type
      ? [{ type: "Feature", properties: {}, geometry: gj }]
      : [];
  for (const f of features) {
    const g = f?.geometry;
    if (!g) continue;
    if (g.type === "Point") pts.push(g.coordinates as LonLat);
    if (g.type === "MultiPoint") for (const c of g.coordinates as LonLat[]) pts.push(c);
  }
  return pts;
}

async function readFileText(file: File) {
  return await file.text();
}
async function readFileArrayBuffer(file: File) {
  return await file.arrayBuffer();
}
async function parseKMLTextToGeoJSON(kmlText: string) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(kmlText, "text/xml");
  return kmlToGeoJSON(xml);
}
async function parseKMZToGeoJSON(file: File) {
  const ab = await readFileArrayBuffer(file);
  const zip = await JSZip.loadAsync(ab);
  const kmlName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".kml"));
  if (!kmlName) throw new Error("KMZ did not contain a .kml file");
  const kmlText = await zip.files[kmlName].async("string");
  return await parseKMLTextToGeoJSON(kmlText);
}

function calcRouteFeet(coords: LonLat[]) {
  const line = turf.lineString(coords);
  const km = turf.length(line, { units: "kilometers" });
  return km * 1000 * 3.28084;
}

function buildStationPoints(coords: LonLat[], spacingFt: number) {
  const line = turf.lineString(coords);
  const totalKm = turf.length(line, { units: "kilometers" });
  const totalFt = totalKm * 1000 * 3.28084;

  const spacingKm = spacingFt / 3.28084 / 1000;
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

function offsetLineForCorridor(coords: LonLat[], offsetMiles: number) {
  if (offsetMiles === 0) return coords;
  const line = turf.lineString(coords);
  const offsetKm = offsetMiles * 1.609344;
  const offset = turf.lineOffset(line, offsetKm, { units: "kilometers" });
  return offset.geometry.coordinates as LonLat[];
}

function sampleWaypointsAlongLine(coords: LonLat[], waypointSpacingMiles: number) {
  const line = turf.lineString(coords);
  const totalKm = turf.length(line, { units: "kilometers" });
  const spacingKm = Math.max(0.25, waypointSpacingMiles * 1.609344);

  const pts: LonLat[] = [];
  for (let d = 0; d <= totalKm + 1e-9; d += spacingKm) {
    const p = turf.along(line, d, { units: "kilometers" });
    pts.push(p.geometry.coordinates as LonLat);
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
    `?overview=full&geometries=geojson&steps=false&continue_straight=false`;

  const res = await (url);
  if (!res.ok) throw new Error(`OSRM route failed: ${res.status}`);
  const data = await res.json();
  const routeCoords = data?.routes?.[0]?.geometry?.coordinates as LonLat[] | undefined;
  if (!routeCoords?.length) throw new Error("OSRM returned no route geometry");
  return routeCoords;
}

function ductConfigToDetails(cfg: DuctConfig): { ductCount: number; ductDiameterIn: number } {
  const [countStr, diaStr] = cfg.split("x");
  return { ductCount: Number(countStr), ductDiameterIn: Number(diaStr) };
}

// regen/ILA count
function computeRegenSites(routeMiles: number, spanMiles: number) {
  const span = Math.max(10, spanMiles || 0);
  if (routeMiles <= span) return 0;
  const segments = Math.ceil(routeMiles / span);
  const intermediate = Math.max(0, segments - 1);
  return intermediate;
}

/**
 * === SVA Node + Segment Simulation (Phase A: visual-only) ===
 * Segment = Node adjacency (Node[i] -> Node[i+1]) in all environments.
 * Node "type" influences scoring but does not define segmentation rules.
 */
type NodeType = "POP" | "AGG" | "REGEN";
type DeploymentType = "Transport" | "Regen" | "ILA" | "GPU Micro" | "GPU POD";

type SVANode = {
  id: string;
  type: NodeType;
  km: number;          // along-route measure
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

function deploymentFromScore(score: number): DeploymentType {
  if (score >= 85) return "GPU POD";
  if (score >= 75) return "GPU Micro";
  if (score >= 60) return "ILA";
  if (score >= 45) return "Regen";
  return "Transport";
}

function nodeVisualColor(dt: DeploymentType) {
  switch (dt) {
    case "GPU POD":
      return "#a855f7";
    case "GPU Micro":
      return "#c084fc";
    case "ILA":
      return "#22c55e";
    case "Regen":
      return "#38bdf8";
    default:
      return "#94a3b8";
  }
}

/**
 * Build an ordered node list along the route line.
 * We place:
 * - POPs: at start/end (and evenly if popCount > 2)
 * - AGGs: evenly in the interior
 * - REGENs: evenly in the interior based on regenSites count
 */
function buildSVANodes(routeCoords: LonLat[], popSites: number, aggSites: number, regenSites: number): SVANode[] {
  const line = turf.lineString(routeCoords);
  const totalKm = turf.length(line, { units: "kilometers" });
  const totalMi = totalKm * 0.621371;

  const nodes: SVANode[] = [];
  const addNodeAtFrac = (type: NodeType, frac: number, idx: number) => {
    const km = totalKm * clamp(frac, 0, 1);
    const pt = turf.along(line, km, { units: "kilometers" });
    const coord = pt.geometry.coordinates as LonLat;
    nodes.push({
      id: `${type}-${idx}-${Math.round(km * 1000)}`,
      type,
      km,
      mi: km * 0.621371,
      coord,
    });
  };

  // POPs
  const pCount = Math.max(0, Math.round(popSites));
  if (pCount >= 2) {
    addNodeAtFrac("POP", 0, 0);
    addNodeAtFrac("POP", 1, pCount - 1);
    if (pCount > 2) {
      // interior POPs evenly spaced
      const interior = pCount - 2;
      for (let i = 1; i <= interior; i++) {
        const frac = i / (interior + 1);
        addNodeAtFrac("POP", frac, i);
      }
    }
  } else if (pCount === 1) {
    // If someone sets 1 POP, we put it at end (not typical, but safe)
    addNodeAtFrac("POP", 1, 0);
  }

  // AGGs (interior only)
  const aCount = Math.max(0, Math.round(aggSites));
  for (let i = 1; i <= aCount; i++) {
    const frac = i / (aCount + 1);
    addNodeAtFrac("AGG", frac, i);
  }

  // REGENs (interior only)
  const rCount = Math.max(0, Math.round(regenSites));
  for (let i = 1; i <= rCount; i++) {
    const frac = i / (rCount + 1);
    addNodeAtFrac("REGEN", frac, i);
  }

  // Sort by along-route distance
  nodes.sort((x, y) => x.km - y.km);

  // Dedup if two nodes land extremely close
  const deduped: SVANode[] = [];
  for (const n of nodes) {
    const last = deduped[deduped.length - 1];
    if (!last) {
      deduped.push(n);
      continue;
    }
    if (Math.abs(last.km - n.km) < Math.max(0.02, totalKm * 0.002)) {
      // If close, prefer higher "importance": POP > AGG > REGEN
      const rank = (t: NodeType) => (t === "POP" ? 3 : t === "AGG" ? 2 : 1);
      if (rank(n.type) > rank(last.type)) deduped[deduped.length - 1] = n;
    } else {
      deduped.push(n);
    }
  }

  // Safety: ensure at least 2 endpoints if a route exists
  if (deduped.length < 2) {
    // Add endpoints as POP placeholders
    addNodeAtFrac("POP", 0, 0);
    addNodeAtFrac("POP", 1, 1);
    return nodes.sort((x, y) => x.km - y.km);
  }

  // Ensure first/last are endpoints (force if they aren't already near ends)
  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (first.km > totalKm * 0.01) {
    const pt = turf.along(line, 0, { units: "kilometers" });
    deduped.unshift({ id: "POP-END-0", type: "POP", km: 0, mi: 0, coord: pt.geometry.coordinates as LonLat });
  }
  if (last.km < totalKm * 0.99) {
    const pt = turf.along(line, totalKm, { units: "kilometers" });
    deduped.push({
      id: "POP-END-1",
      type: "POP",
      km: totalKm,
      mi: totalMi,
      coord: pt.geometry.coordinates as LonLat,
    });
  }

  return deduped;
}

/**
 * Compute a structured "Segment Value Score" without APIs.
 * This is intentionally proxy-based but deterministic & explainable.
 */
function computeSegmentValueScore(args: {
  corridorScore: number;
  segLengthMi: number;
  nodeAType: NodeType;
  nodeBType: NodeType;
  sitesNearMid: number;
}) {
  const { corridorScore, segLengthMi, nodeAType, nodeBType, sitesNearMid } = args;

  // Node adjacency bonus (investment tends to cluster near POP/Agg adjacencies)
  const adjBonus = (t: NodeType) => (t === "POP" ? 10 : t === "AGG" ? 7 : 3);
  const adjacency = adjBonus(nodeAType) + adjBonus(nodeBType);

  // Segment length penalty (very long segments tend to be transport-heavy absent other signals)
  // 0..25 penalty roughly.
  const lengthPenalty = clamp(((segLengthMi - 10) / 70) * 25, 0, 25);

  // Site density proxy (uploaded points near the segment midpoint)
  const siteBonus = clamp(sitesNearMid * 5, 0, 20);

  // Compose + clamp
  const raw = corridorScore + adjacency + siteBonus - lengthPenalty;

  return clamp(Math.round(raw), 0, 100);
}

// ---------------- ICDE Core Logic ----------------

type AdjacencyInputs = {
  hyperscalerProximity: number
  latencyBand: number
  powerAvailability: number
  routeCohesion: number
  capitalEfficiencyDelta: number
}

const DEFAULT_WEIGHTS = {
  hyperscalerProximity: 0.25,
  latencyBand: 0.15,
  powerAvailability: 0.20,
  routeCohesion: 0.15,
  capitalEfficiencyDelta: 0.25
}

function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n))
}

function computeAdjacencyScore(
  inputs: AdjacencyInputs,
  weights = DEFAULT_WEIGHTS
) {
  const i = {
    hyperscalerProximity: clamp01to100(inputs.hyperscalerProximity),
    latencyBand: clamp01to100(inputs.latencyBand),
    powerAvailability: clamp01to100(inputs.powerAvailability),
    routeCohesion: clamp01to100(inputs.routeCohesion),
    capitalEfficiencyDelta: clamp01to100(inputs.capitalEfficiencyDelta)
  }

  const score =
    i.hyperscalerProximity * weights.hyperscalerProximity +
    i.latencyBand * weights.latencyBand +
    i.powerAvailability * weights.powerAvailability +
    i.routeCohesion * weights.routeCohesion +
    i.capitalEfficiencyDelta * weights.capitalEfficiencyDelta

  return Math.round(score)
}

function tierFromScore(score: number) {
  if (score >= 80) return "Strategic GPU Candidate"
  if (score >= 65) return "Conditional / JV Candidate"
  if (score >= 50) return "Monitor"
  return "Transport Only"
}


export default function DesignMode() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);

  const [status, setStatus] = useState("Ready");

  const [routeCoords, setRouteCoords] = useState<LonLat[] | null>(null);
  const [baseRouteCoords, setBaseRouteCoords] = useState<LonLat[] | null>(null);

  const [sites, setSites] = useState<UploadedSitesRow[]>([]);

  // Map display controls
  const [showStationing, setShowStationing] = useState(DEFAULTS.showStationing);
  const [stationSpacingFt, setStationSpacingFt] = useState(DEFAULTS.stationSpacingFt);

  const [snapToStreets, setSnapToStreets] = useState(DEFAULTS.snapToStreets);
  const [waypointSpacingMiles, setWaypointSpacingMiles] = useState(DEFAULTS.waypointSpacingMiles);

  const [corridorSeparationMiles, setCorridorSeparationMiles] = useState(DEFAULTS.corridorSeparationMiles);

  // Role (still used for presets & narrative; SVA segmentation does NOT branch by role)
  const [role, setRole] = useState<RouteRole>(DEFAULTS.role);

  // Bid model controls
  const [riskPercent, setRiskPercent] = useState(DEFAULTS.riskPercent);
  const [marginPercent, setMarginPercent] = useState(DEFAULTS.marginPercent);

  const [engineeringPerFt, setEngineeringPerFt] = useState(DEFAULTS.engineeringPerFt);
  const [permittingPerFt, setPermittingPerFt] = useState(DEFAULTS.permittingPerFt);

  const [mobilization, setMobilization] = useState(DEFAULTS.mobilization);
  const [pmOverheadPercent, setPmOverheadPercent] = useState(DEFAULTS.pmOverheadPercent);
  const [insurancePercent, setInsurancePercent] = useState(DEFAULTS.insurancePercent);
  const [qcPercent, setQcPercent] = useState(DEFAULTS.qcPercent);

  const [roadsCrossings, setRoadsCrossings] = useState(DEFAULTS.roadsCrossings);
  const [railCrossings, setRailCrossings] = useState(DEFAULTS.railCrossings);
  const [waterCrossings, setWaterCrossings] = useState(DEFAULTS.waterCrossings);

  // Surface mix
  const [surfaceMix, setSurfaceMix] = useState<SurfaceMix>(DEFAULTS.surfaceMix);
  const normalizedMix = useMemo(() => ensureMixSumsTo100(surfaceMix), [surfaceMix]);

  // Materials controls
  const [ownerFurnishedMaterials, setOwnerFurnishedMaterials] = useState(DEFAULTS.ownerFurnishedMaterials);
  const [materialsEscalationPercent, setMaterialsEscalationPercent] = useState(DEFAULTS.materialsEscalationPercent);
  const [ductConfig, setDuctConfig] = useState<DuctConfig>(DEFAULTS.ductConfig);
  const [materialUnit] = useState(DEFAULTS.materialUnit);

  // Nodes controls
  const [spanMiles, setSpanMiles] = useState(DEFAULTS.spanMiles);
  const [includeRegens, setIncludeRegens] = useState(DEFAULTS.includeRegens);
  const [includePops, setIncludePops] = useState(DEFAULTS.includePops);
  const [includeAgg, setIncludeAgg] = useState(DEFAULTS.includeAgg);

  const [popCount, setPopCount] = useState(DEFAULTS.popCount);
  const [aggCount, setAggCount] = useState(DEFAULTS.aggCount);

  const [regenUnitCost, setRegenUnitCost] = useState(DEFAULTS.regenUnitCost);
  const [popUnitCost, setPopUnitCost] = useState(DEFAULTS.popUnitCost);
  const [aggUnitCost, setAggUnitCost] = useState(DEFAULTS.aggUnitCost);

  // === ICDE / SVA (visual only) ===
  const [icdeMode, setIcdeMode] = useState(false);
  const [svaEnabled, setSvaEnabled] = useState(false);

  const [svaThreshold, setSvaThreshold] = useState(60); // node-level display threshold

  // Demo-mode corridor inputs (0..100)
  const [haaInputs, setHaaInputs] = useState<AdjacencyInputs>({
    hyperscalerProximity: 70,
    latencyBand: 65,
    powerAvailability: 55,
    routeCohesion: 70,
    capitalEfficiencyDelta: 60,
  });

  // --- Role presets (still helpful defaults for L1 assumptions) ---
  useEffect(() => {
    if (role === "metro") {
      setEngineeringPerFt(2.0);
      setPermittingPerFt(1.5);

      setSpanMiles(999);
      setIncludeRegens(false);

      setIncludePops(true);
      setPopCount(2);

      setIncludeAgg(true);
      setAggCount(2);

      setCorridorSeparationMiles((m) => (m === 0 ? 0.1 : m));
    } else if (role === "middlemile") {
      setEngineeringPerFt(1.25);
      setPermittingPerFt(1.0);

      setSpanMiles(80);
      setIncludeRegens(true);

      setIncludePops(true);
      setPopCount(2);

      setIncludeAgg(true);
      setAggCount(1);

      setCorridorSeparationMiles((m) => (m === 0 ? 0.25 : m));
    } else {
      setEngineeringPerFt(0.9);
      setPermittingPerFt(0.75);

      setSpanMiles(55);
      setIncludeRegens(true);

      setIncludePops(true);
      setPopCount(2);

      setIncludeAgg(true);
      setAggCount(0);

      setCorridorSeparationMiles((m) => (m === 0 ? 0.5 : m));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [-96.797, 32.7767],
      zoom: 9,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: featureCollection([]) });
      map.addSource("corridorA", { type: "geojson", data: featureCollection([]) });
      map.addSource("corridorB", { type: "geojson", data: featureCollection([]) });
      map.addSource("stations", { type: "geojson", data: featureCollection([]) });
      map.addSource("sites", { type: "geojson", data: featureCollection([]) });

      // NEW: SVA node overlay source
      map.addSource("svaNodes", { type: "geojson", data: featureCollection([]) });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-width": 4, "line-color": "#00f5ff" },
      });

      map.addLayer({
        id: "corridor-a",
        type: "line",
        source: "corridorA",
        paint: { "line-width": 3, "line-color": "#00f5ff", "line-opacity": 0.5 },
      });

      map.addLayer({
        id: "corridor-b",
        type: "line",
        source: "corridorB",
        paint: { "line-width": 3, "line-color": "#00f5ff", "line-opacity": 0.5 },
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

      // NEW: SVA nodes (filled circles)
      map.addLayer({
        id: "sva-nodes",
        type: "circle",
        source: "svaNodes",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "deployment"], "GPU POD"], 10,
            ["==", ["get", "deployment"], "GPU Micro"], 9,
            ["==", ["get", "deployment"], "ILA"], 8,
            ["==", ["get", "deployment"], "Regen"], 7,
            6,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0b1220",
          "circle-opacity": 0.95,
        },
      });

      // Optional labels (comment out if you don't want text)
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
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update route layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const routeSource = map.getSource("route") as GeoJSONSource | undefined;
    if (!routeSource) return;

    if (!routeCoords?.length) {
      routeSource.setData(featureCollection([]));
      (map.getSource("stations") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("corridorA") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("corridorB") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      (map.getSource("svaNodes") as GeoJSONSource | undefined)?.setData(featureCollection([]));
      return;
    }

    routeSource.setData(featureCollection([lineStringFromCoords(routeCoords)]));

    const a = offsetLineForCorridor(routeCoords, corridorSeparationMiles);
    const b = offsetLineForCorridor(routeCoords, -corridorSeparationMiles);
    (map.getSource("corridorA") as GeoJSONSource | undefined)?.setData(featureCollection([lineStringFromCoords(a)]));
    (map.getSource("corridorB") as GeoJSONSource | undefined)?.setData(featureCollection([lineStringFromCoords(b)]));

    const stationSourceCoords =
      baseRouteCoords?.length ? baseRouteCoords : routeCoords;

    const stationsGJ = stationSourceCoords
      ? buildStationPoints(stationSourceCoords, Math.max(100, stationSpacingFt))
      : featureCollection([]);
    (map.getSource("stations") as GeoJSONSource | undefined)?.setData(stationsGJ);

    map.setLayoutProperty("stations-dots", "visibility", showStationing ? "visible" : "none");
    map.setLayoutProperty("stations-labels", "visibility", showStationing ? "visible" : "none");

    const line = turf.lineString(routeCoords);
    const bbox = turf.bbox(line) as [number, number, number, number];
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 80, duration: 600 }
    );
  }, [routeCoords, showStationing, stationSpacingFt, corridorSeparationMiles]);

  // Update sites layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const src = map.getSource("sites") as GeoJSONSource | undefined;
    if (!src) return;

    if (!sites.length) {
      src.setData(featureCollection([]));
      return;
    }

    const feats = sites.map((s) => turf.point([s.lon, s.lat], { name: s.name ?? "" }));
    src.setData(featureCollection(feats));
  }, [sites]);

  const routeFeet = useMemo(() => (routeCoords?.length ? calcRouteFeet(routeCoords) : 0), [routeCoords]);
  const routeMiles = routeFeet / 5280;

  // --- Financial engine (unchanged) ---
  const financial: FinancialModel = useMemo(() => {
    const { ductCount, ductDiameterIn } = ductConfigToDetails(ductConfig);

    const mix = normalizedMix;
    const weightedCivilPerFt =
      (mix.plowPct / 100) * LABOR_PER_FT.plow +
      (mix.trenchPct / 100) * LABOR_PER_FT.trench +
      (mix.hddPct / 100) * LABOR_PER_FT.hdd +
      (mix.rockPct / 100) * LABOR_PER_FT.rock;

    const directCivilLabor = routeFeet * weightedCivilPerFt;

    const conduitPerFt = ductDiameterIn === 1.25 ? materialUnit.conduitPerFt_1p25 : materialUnit.conduitPerFt_1p5;
    const innerductPerFt =
      ductDiameterIn === 1.25 ? materialUnit.innerductPerFt_1p25 : materialUnit.innerductPerFt_1p5;

    const vaultCount = Math.floor(routeFeet / 10000);
    const handholeCount = Math.floor(routeFeet / 2000);

    const conduit = routeFeet * conduitPerFt;
    const innerduct = routeFeet * innerductPerFt * ductCount;
    const fiber = routeFeet * materialUnit.fiberPerFt;
    const tracer = routeFeet * materialUnit.tracerWirePerFt;
    const vaults = vaultCount * materialUnit.vault;
    const handholes = handholeCount * materialUnit.handhole;
    const spliceClosures = vaultCount * materialUnit.spliceClosure;
    const restoration = routeFeet * materialUnit.restorationPerFt;

    const materialsBase = conduit + innerduct + fiber + tracer + vaults + handholes + spliceClosures + restoration;
    const materialsEscalated = materialsBase * (1 + materialsEscalationPercent / 100);

    const materialsIncludedInBid = !ownerFurnishedMaterials;
    const materialsForBid = materialsIncludedInBid ? materialsEscalated : 0;

    const engineering = routeFeet * engineeringPerFt;
    const permitting = routeFeet * permittingPerFt;

    const crossings =
      roadsCrossings * CROSSING_UNIT_COST.road +
      railCrossings * CROSSING_UNIT_COST.rail +
      waterCrossings * CROSSING_UNIT_COST.water;

    const regenSites = includeRegens ? computeRegenSites(routeMiles, spanMiles) : 0;
    const popSites = includePops ? Math.max(0, Math.round(popCount)) : 0;
    const aggSites = includeAgg ? Math.max(0, Math.round(aggCount)) : 0;

    const nodes =
      regenSites * Math.max(0, regenUnitCost) +
      popSites * Math.max(0, popUnitCost) +
      aggSites * Math.max(0, aggUnitCost);

    const overheadBase = directCivilLabor + materialsForBid + engineering + permitting;
    const pmOverhead = overheadBase * (pmOverheadPercent / 100);
    const insurance = overheadBase * (insurancePercent / 100);
    const qc = overheadBase * (qcPercent / 100);

    const program = mobilization + pmOverhead + insurance + qc;

    const subtotal = directCivilLabor + materialsForBid + engineering + permitting + crossings + nodes + program;
    const contingency = subtotal * (riskPercent / 100);
    const riskedCost = subtotal + contingency;
    const margin = riskedCost * (marginPercent / 100);
    const totalBid = riskedCost + margin;

    const costPerFoot = routeFeet > 0 ? totalBid / routeFeet : 0;
    const costPerMile = routeMiles > 0 ? totalBid / routeMiles : 0;

    const recovery60 = totalBid / 60;
    const recovery120 = totalBid / 120;

    return {
      routeFeet,
      routeMiles,

      directCivilLabor,

      materialsBase,
      materialsEscalated,
      materialsIncludedInBid,

      engineering,
      permitting,

      crossings,
      nodes,

      program,

      subtotal,
      contingency,
      riskedCost,
      margin,
      totalBid,

      costPerFoot,
      costPerMile,

      recovery60,
      recovery120,

      weightedCivilPerFt,

      ductCount,
      ductDiameterIn,

      regenSites,
      popSites,
      aggSites,

      materialBreakdown: {
        conduit,
        innerduct,
        fiber,
        tracer,
        handholes,
        vaults,
        spliceClosures,
        restoration,
      },
    };
  }, [
    routeFeet,
    routeMiles,
    ductConfig,
    normalizedMix,
    materialsEscalationPercent,
    ownerFurnishedMaterials,
    materialUnit,
    engineeringPerFt,
    permittingPerFt,
    roadsCrossings,
    railCrossings,
    waterCrossings,
    mobilization,
    pmOverheadPercent,
    insurancePercent,
    qcPercent,
    riskPercent,
    marginPercent,
    includeRegens,
    includePops,
    includeAgg,
    spanMiles,
    popCount,
    aggCount,
    regenUnitCost,
    popUnitCost,
    aggUnitCost,
  ]);

  // Corridor ICDE score (gate)
  const corridorScore = useMemo(() => {
    if (!icdeMode) return null;
    return computeAdjacencyScore(haaInputs, DEFAULT_WEIGHTS);
  }, [icdeMode, haaInputs]);

  const corridorTier = useMemo(() => {
    if (corridorScore === null) return null;
    return tierFromScore(corridorScore);
  }, [corridorScore]);

  // === Build nodes + segments + node deployments (SVA) ===
  const svaResult = useMemo(() => {
    if (!routeCoords?.length) {
      return {
        nodes: [] as SVANode[],
        segments: [] as SVASegment[],
        nodeDeployment: new Map<string, { deployment: DeploymentType; score: number }>(),
      };
    }

    if (!icdeMode || !svaEnabled || corridorScore === null) {
      return {
        nodes: [] as SVANode[],
        segments: [] as SVASegment[],
        nodeDeployment: new Map<string, { deployment: DeploymentType; score: number }>(),
      };
    }

    const nodes = buildSVANodes(routeCoords, financial.popSites, financial.aggSites, financial.regenSites);

    // Build adjacency segments
    const line = turf.lineString(routeCoords);

    const segments: SVASegment[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const lengthMi = Math.max(0, b.mi - a.mi);

      const midKm = (a.km + b.km) / 2;
      const midPt = turf.along(line, midKm, { units: "kilometers" });
      const midCoord = midPt.geometry.coordinates as LonLat;

      // Sites near mid (proxy for density / value)
      const midPoint = turf.point(midCoord);
      const radiusMi = 2.5; // demo proxy
      let sitesNear = 0;
      if (sites.length) {
        for (const s of sites) {
          const d = turf.distance(midPoint, turf.point([s.lon, s.lat]), { units: "miles" });
          if (d <= radiusMi) sitesNear++;
        }
      }

      const score = computeSegmentValueScore({
        corridorScore,
        segLengthMi: lengthMi,
        nodeAType: a.type,
        nodeBType: b.type,
        sitesNearMid: sitesNear,
      });

      segments.push({
        id: `SEG-${i}-${a.id}-${b.id}`,
        a,
        b,
        lengthMi,
        midCoord,
        score,
      });
    }

    // Node deployment = max adjacent segment score
    const maxScoreByNode = new Map<string, number>();
    for (const seg of segments) {
      maxScoreByNode.set(seg.a.id, Math.max(maxScoreByNode.get(seg.a.id) ?? 0, seg.score));
      maxScoreByNode.set(seg.b.id, Math.max(maxScoreByNode.get(seg.b.id) ?? 0, seg.score));
    }

    const nodeDeployment = new Map<string, { deployment: DeploymentType; score: number }>();
    for (const n of nodes) {
      const sc = maxScoreByNode.get(n.id) ?? 0;
      nodeDeployment.set(n.id, { deployment: deploymentFromScore(sc), score: sc });
    }

    return { nodes, segments, nodeDeployment };
  }, [routeCoords, icdeMode, svaEnabled, corridorScore, haaInputs, sites, financial.popSites, financial.aggSites, financial.regenSites]);

  // Render SVA nodes overlay
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

    // Only show nodes meeting threshold (visual discipline)
    const feats = svaResult.nodes
      .map((n) => {
        const dep = svaResult.nodeDeployment.get(n.id);
        const score = dep?.score ?? 0;
        if (score < svaThreshold) return null;

        const deployment = dep?.deployment ?? "Transport";
        const color = nodeVisualColor(deployment);

        return turf.point(n.coord, {
          id: n.id,
          nodeType: n.type,
          score,
          deployment,
          color,
          label: `${n.type} • ${deployment} • ${score}`,
        });
      })
      .filter(Boolean) as any[];

    src.setData(featureCollection(feats));
    map.setLayoutProperty("sva-nodes", "visibility", "visible");
    map.setLayoutProperty("sva-nodes-label", "visibility", "visible");
  }, [svaResult, icdeMode, svaEnabled, corridorScore, svaThreshold]);

  // Upload handlers
  async function handleUploadRoute(file: File) {
    try {
      setStatus("Importing route…");
      const name = file.name.toLowerCase();
      let gj: any;

      if (name.endsWith(".kmz")) {
        gj = await parseKMZToGeoJSON(file);
      } else if (name.endsWith(".kml")) {
        const txt = await readFileText(file);
        gj = await parseKMLTextToGeoJSON(txt);
      } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
        const txt = await readFileText(file);
        gj = JSON.parse(txt);
      } else {
        throw new Error("Unsupported route file. Use .geojson/.json/.kml/.kmz");
      }

      const coords = getLineCoordsFromGeoJSON(gj);
      if (!coords?.length) throw new Error("No LineString found in uploaded route.");

      setBaseRouteCoords(coords);

      if (snapToStreets) {
        setStatus("Snapping route to streets (OSRM)…");
        const waypoints = sampleWaypointsAlongLine(coords, waypointSpacingMiles);
        const snapped = await osrmRouteThroughWaypoints(waypoints);
        setRouteCoords(snapped);
      } else {
        setRouteCoords(coords);
      }

      setStatus("Route loaded.");
    } catch (e: any) {
      setStatus(`Route import failed: ${e?.message ?? String(e)}`);
    }
  }

  async function handleUploadSites(file: File) {
    try {
      setStatus("Importing sites…");
      const name = file.name.toLowerCase();
      let pts: UploadedSitesRow[] = [];

      if (name.endsWith(".csv")) {
        const txt = await readFileText(file);
        const parsed = Papa.parse<Record<string, any>>(txt, { header: true, skipEmptyLines: true });

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

        const hasOrder = rows.some((r) => Number.isFinite(r.order));
        pts = hasOrder ? rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : rows;
      } else if (name.endsWith(".geojson") || name.endsWith(".json")) {
        const txt = await readFileText(file);
        const gj = JSON.parse(txt);
        const points = getPointsFromGeoJSON(gj);
        if (!points.length) throw new Error("No points found in the GeoJSON.");
        pts = points.map(([lon, lat], i) => ({ lon, lat, order: i + 1 }));
      } else {
        throw new Error("Unsupported sites file. Use .csv or .geojson/.json");
      }

      if (pts.length < 2) throw new Error("Need at least 2 sites to build a route.");
      setSites(pts);

      setStatus("Building route from sites…");
      const waypoints: LonLat[] = pts.map((p) => [p.lon, p.lat]);

      setBaseRouteCoords(waypoints);

      if (snapToStreets) {
        setStatus("Routing through sites (OSRM)…");
        const snapped = await osrmRouteThroughWaypoints(waypoints);
        setRouteCoords(snapped);
      } else {
        setRouteCoords(waypoints);
      }

      setStatus("Sites loaded; route built.");
    } catch (e: any) {
      setStatus(`Sites import failed: ${e?.message ?? String(e)}`);
    }
  }

  async function resnapCurrent() {
    try {
      if (!baseRouteCoords?.length) {
        setStatus("Nothing to snap yet (upload route or sites first).");
        return;
      }
      if (!snapToStreets) {
        setRouteCoords(baseRouteCoords);
        setStatus("Snap disabled; showing base geometry.");
        return;
      }

      setStatus("Snapping (OSRM)…");
      const waypoints =
        baseRouteCoords.length <= 25 ? baseRouteCoords : sampleWaypointsAlongLine(baseRouteCoords, waypointSpacingMiles);

      const snapped = await osrmRouteThroughWaypoints(waypoints);
      setRouteCoords(snapped);
      setStatus("Snapped.");
    } catch (e: any) {
      setStatus(`Snap failed: ${e?.message ?? String(e)}`);
    }
  }

  const cardStyle: React.CSSProperties = {
    padding: 12,
    borderRadius: 10,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
  };

  // Quick counts for sidebar
  const svaCounts = useMemo(() => {
    const c: Record<DeploymentType, number> = {
      "Transport": 0,
      "Regen": 0,
      "ILA": 0,
      "GPU Micro": 0,
      "GPU POD": 0,
    };
    for (const n of svaResult.nodes) {
      const dep = svaResult.nodeDeployment.get(n.id);
      const score = dep?.score ?? 0;
      if (score < svaThreshold) continue;
      const dt = dep?.deployment ?? "Transport";
      c[dt] += 1;
    }
    return c;
  }, [svaResult, svaThreshold]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 410,
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
        <div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>StellaOS Design</div>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
            IOF-Powered Infrastructure Synthesis
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
            Status: <b>{status}</b>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Ingest</div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Upload Route (GeoJSON/KML/KMZ)</div>
            <input
              type="file"
              accept=".geojson,.json,.kml,.kmz"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadRoute(f);
                e.currentTarget.value = "";
              }}
            />
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Upload Sites (CSV or GeoJSON points)</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>
              CSV headers: <code>lat, lon</code> (or <code>latitude, longitude</code>) + optional <code>name</code>,{" "}
              <code>order</code>
            </div>
            <input
              type="file"
              accept=".csv,.geojson,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadSites(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Routing</div>
            <button
              onClick={() => void resnapCurrent()}
              style={{
                padding: "8px 10px",
                background: "#0bd18a",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Re-snap
            </button>
          </div>

          <div style={{ height: 8 }} />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={snapToStreets} onChange={(e) => setSnapToStreets(e.target.checked)} />
            <div style={{ fontSize: 12, fontWeight: 700 }}>Snap to streets (OSRM demo)</div>
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Waypoint spacing (miles)</div>
            <input
              type="number"
              min={0.5}
              max={10}
              step={0.5}
              value={waypointSpacingMiles}
              onChange={(e) => setWaypointSpacingMiles(clamp(Number(e.target.value || 2), 0.5, 10))}
            />
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Corridor separation (miles) — diversity visual</div>
            <input
              type="number"
              min={0}
              step={0.05}
              value={corridorSeparationMiles}
              onChange={(e) => setCorridorSeparationMiles(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Stationing</div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={showStationing} onChange={(e) => setShowStationing(e.target.checked)} />
            <div style={{ fontSize: 12, fontWeight: 700 }}>Show stationing (0+00 origin)</div>
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Station spacing (ft)</div>
            <input
              type="number"
              min={100}
              step={100}
              value={stationSpacingFt}
              onChange={(e) => setStationSpacingFt(Math.max(100, Number(e.target.value || 2000)))}
            />
          </label>
        </div>

        {/* Layer 1 environment controls */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Layer 1 Environment</div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Role (defaults only): Longhaul → Middle Mile → Metro → End User
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value as RouteRole)}>
              <option value="longhaul">Longhaul (Backbone / Intercity)</option>
              <option value="middlemile">Middle Mile (Regional / Aggregation)</option>
              <option value="metro">Metro (Urban / Access Aggregation)</option>
            </select>
          </label>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Route: <b>{fmtFt(financial.routeFeet)}</b> ({fmtMi(financial.routeMiles)})
          </div>

          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            Weighted civil labor: <b>{fmtMoney(financial.weightedCivilPerFt)}/ft</b>
          </div>

          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8, lineHeight: 1.4 }}>
            Segment logic is <b>node adjacency</b> in all environments. Role only sets defaults (span, POP/Agg density).
          </div>
        </div>

        {/* Nodes */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>L1 Nodes: POPs • Agg • Regens / ILAs</div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={includeRegens} onChange={(e) => setIncludeRegens(e.target.checked)} />
            <div style={{ fontSize: 12, fontWeight: 800 }}>Include regen/ILA sites (span-based)</div>
          </label>

          <div style={{ height: 8 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Span miles (regen/ILA spacing assumption)</div>
            <input
              type="number"
              min={10}
              step={5}
              value={spanMiles}
              onChange={(e) => setSpanMiles(Math.max(10, Number(e.target.value || 55)))}
              disabled={!includeRegens}
            />
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={includePops} onChange={(e) => setIncludePops(e.target.checked)} />
            <div style={{ fontSize: 12, fontWeight: 800 }}>Include POP sites (endpoints / meet-me)</div>
          </label>

          <div style={{ height: 8 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>POP count</div>
              <input
                type="number"
                min={0}
                step={1}
                value={popCount}
                onChange={(e) => setPopCount(Math.max(0, Number(e.target.value || 0)))}
                disabled={!includePops}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>POP unit cost</div>
              <input
                type="number"
                min={0}
                step={10000}
                value={popUnitCost}
                onChange={(e) => setPopUnitCost(Math.max(0, Number(e.target.value || 0)))}
                disabled={!includePops}
              />
            </label>
          </div>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={includeAgg} onChange={(e) => setIncludeAgg(e.target.checked)} />
            <div style={{ fontSize: 12, fontWeight: 800 }}>Include aggregation nodes</div>
          </label>

          <div style={{ height: 8 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Agg count</div>
              <input
                type="number"
                min={0}
                step={1}
                value={aggCount}
                onChange={(e) => setAggCount(Math.max(0, Number(e.target.value || 0)))}
                disabled={!includeAgg}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Agg unit cost</div>
              <input
                type="number"
                min={0}
                step={10000}
                value={aggUnitCost}
                onChange={(e) => setAggUnitCost(Math.max(0, Number(e.target.value || 0)))}
                disabled={!includeAgg}
              />
            </label>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
            <div>
              Estimated regen/ILA sites: <b>{financial.regenSites}</b>
            </div>
            <div>
              POP sites: <b>{financial.popSites}</b> • Agg sites: <b>{financial.aggSites}</b>
            </div>
            <div>
              Nodes subtotal: <b>{fmtMoney(financial.nodes)}</b>
            </div>
          </div>
        </div>

        {/* ICDE + SVA Panel */}
        <div style={{ ...cardStyle, border: "1px solid rgba(168,85,247,0.25)", background: "rgba(168,85,247,0.08)" }}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>ICDE / SVA (Elite Module)</div>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={icdeMode} onChange={(e) => setIcdeMode(e.target.checked)} />
            <div style={{ fontSize: 12, fontWeight: 800 }}>Enable ICDE Mode</div>
          </label>

          <div style={{ height: 8 }} />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={svaEnabled}
              onChange={(e) => setSvaEnabled(e.target.checked)}
              disabled={!icdeMode}
            />
            <div style={{ fontSize: 12, fontWeight: 800 }}>Enable Segment Value (SVA) Simulation</div>
          </label>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, opacity: 0.9 }}>
            Corridor Score: <b>{corridorScore ?? "-"}</b> • Tier: <b>{corridorTier ?? "-"}</b>
          </div>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.95 }}>Corridor Inputs (Demo Mode)</div>
          <div style={{ marginTop: 8 }}>
            {(Object.keys(haaInputs) as Array<keyof AdjacencyInputs>).map((k) => (
              <div key={k} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{k}</div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={haaInputs[k]}
                  onChange={(e) =>
                    setHaaInputs((prev) => ({ ...prev, [k]: Number(e.target.value) }))
                  }
                />
                <div style={{ fontSize: 12, opacity: 0.85 }}>{haaInputs[k]}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              Node display threshold (score ≥ {svaThreshold})
            </div>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={svaThreshold}
              onChange={(e) => setSvaThreshold(clamp(Number(e.target.value || 60), 0, 100))}
              disabled={!icdeMode || !svaEnabled}
            />
          </label>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.95, lineHeight: 1.6 }}>
            <div><b>Visible Nodes</b> (thresholded)</div>
            <div>GPU POD: <b>{svaCounts["GPU POD"]}</b></div>
            <div>GPU Micro: <b>{svaCounts["GPU Micro"]}</b></div>
            <div>ILA: <b>{svaCounts["ILA"]}</b></div>
            <div>Regen: <b>{svaCounts["Regen"]}</b></div>
          </div>

          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.8, lineHeight: 1.4 }}>
            Segment = node adjacency everywhere. Segment score is simulated now; later we replace with real datasets/APIs.
          </div>
        </div>

        {/* Civil Mix */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Civil Mix % (auto-normalized)</div>

          {([
            ["Plow", "plowPct"],
            ["Trench", "trenchPct"],
            ["HDD", "hddPct"],
            ["Rock", "rockPct"],
          ] as const).map(([label, key]) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {label}: <b>{(normalizedMix as any)[key]}%</b>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={(surfaceMix as any)[key]}
                onChange={(e) => setSurfaceMix((m) => ({ ...m, [key]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>

        {/* Materials */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Materials</div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Duct configuration</div>
            <select value={ductConfig} onChange={(e) => setDuctConfig(e.target.value as DuctConfig)}>
              <option value="2x1.25">2x1.25"</option>
              <option value="3x1.25">3x1.25"</option>
              <option value="4x1.25">4x1.25"</option>
              <option value="2x1.5">2x1.5"</option>
              <option value="3x1.5">3x1.5"</option>
              <option value="4x1.5">4x1.5"</option>
            </select>
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={ownerFurnishedMaterials}
              onChange={(e) => setOwnerFurnishedMaterials(e.target.checked)}
            />
            <div style={{ fontSize: 12, fontWeight: 800 }}>(Owner-furnished) exclude materials from bid</div>
          </label>

          <div style={{ height: 10 }} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Materials escalation %</div>
            <input
              type="number"
              min={0}
              step={1}
              value={materialsEscalationPercent}
              onChange={(e) => setMaterialsEscalationPercent(clamp(Number(e.target.value || 0), 0, 30))}
            />
          </label>

          <div style={{ height: 10 }} />

          <details>
            <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 12 }}>Material breakdown</summary>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9, lineHeight: 1.6 }}>
              <div>Conduit: {fmtMoney(financial.materialBreakdown.conduit)}</div>
              <div>Innerduct: {fmtMoney(financial.materialBreakdown.innerduct)}</div>
              <div>Fiber: {fmtMoney(financial.materialBreakdown.fiber)}</div>
              <div>Tracer: {fmtMoney(financial.materialBreakdown.tracer)}</div>
              <div>Handholes: {fmtMoney(financial.materialBreakdown.handholes)}</div>
              <div>Vaults: {fmtMoney(financial.materialBreakdown.vaults)}</div>
              <div>Splice closures: {fmtMoney(financial.materialBreakdown.spliceClosures)}</div>
              <div>Restoration: {fmtMoney(financial.materialBreakdown.restoration)}</div>
            </div>
          </details>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
            Materials base: <b>{fmtMoney(financial.materialsBase)}</b>
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Escalated: <b>{fmtMoney(financial.materialsEscalated)}</b>
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Included in bid: <b>{financial.materialsIncludedInBid ? "Yes" : "No"}</b>
          </div>
        </div>

        {/* Indirect + Program */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Indirect + Program</div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Engineering $/ft</div>
            <input
              type="number"
              min={0}
              step={0.05}
              value={engineeringPerFt}
              onChange={(e) => setEngineeringPerFt(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Permitting $/ft</div>
            <input
              type="number"
              min={0}
              step={0.05}
              value={permittingPerFt}
              onChange={(e) => setPermittingPerFt(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Mobilization (fixed)</div>
            <input
              type="number"
              min={0}
              step={10000}
              value={mobilization}
              onChange={(e) => setMobilization(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>

          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800 }}>
            Program adders (% of labor+materials+eng+perm)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>PM %</div>
              <input
                type="number"
                min={0}
                step={0.5}
                value={pmOverheadPercent}
                onChange={(e) => setPmOverheadPercent(clamp(Number(e.target.value || 0), 0, 20))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Insurance %</div>
              <input
                type="number"
                min={0}
                step={0.5}
                value={insurancePercent}
                onChange={(e) => setInsurancePercent(clamp(Number(e.target.value || 0), 0, 10))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>QA/QC %</div>
              <input
                type="number"
                min={0}
                step={0.5}
                value={qcPercent}
                onChange={(e) => setQcPercent(clamp(Number(e.target.value || 0), 0, 10))}
              />
            </label>
          </div>
        </div>

        {/* Crossings */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Crossings</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Road</div>
              <input
                type="number"
                min={0}
                step={1}
                value={roadsCrossings}
                onChange={(e) => setRoadsCrossings(Math.max(0, Number(e.target.value || 0)))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Rail</div>
              <input
                type="number"
                min={0}
                step={1}
                value={railCrossings}
                onChange={(e) => setRailCrossings(Math.max(0, Number(e.target.value || 0)))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Water</div>
              <input
                type="number"
                min={0}
                step={1}
                value={waterCrossings}
                onChange={(e) => setWaterCrossings(Math.max(0, Number(e.target.value || 0)))}
              />
            </label>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Unit costs: road {fmtMoney(CROSSING_UNIT_COST.road)} • rail {fmtMoney(CROSSING_UNIT_COST.rail)} • water{" "}
            {fmtMoney(CROSSING_UNIT_COST.water)}
          </div>
        </div>

        {/* Risk + Margin */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>Risk + Margin</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Contingency %</div>
              <input
                type="number"
                min={0}
                step={1}
                value={riskPercent}
                onChange={(e) => setRiskPercent(clamp(Number(e.target.value || 0), 0, 40))}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Margin %</div>
              <input
                type="number"
                min={0}
                step={1}
                value={marginPercent}
                onChange={(e) => setMarginPercent(clamp(Number(e.target.value || 0), 0, 40))}
              />
            </label>
          </div>
        </div>

                {/* Total */}
                <div style={cardStyle}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>
                    Total Bid: {fmtMoney(financial.totalBid)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Cost/ft: {fmtMoney(financial.costPerFoot)} • Cost/mi: {fmtMoney(financial.costPerMile)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    60 mo recovery: {fmtMoney(financial.recovery60)} • 120 mo: {fmtMoney(financial.recovery120)}
                  </div>
                </div>
              </div>

              {/* Map */}
              <div ref={mapContainer} style={{ flex: 1 }} />
             </div>
          );
        }

