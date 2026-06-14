import { useEffect, useMemo, useRef, useState } from "react";
import ScopeSelector from "../components/ScopeSelector";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  CircleMarker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";
import { listBaselines, loadBaseline } from "../api/baselines";
import { listBaselineGraphs, loadBaselineGraph } from "../api/baselineGraphs";
import {
  getIngestionJob,
  LARGE_DATASET_THRESHOLD_BYTES,
  startIngestion,
  uploadRawDataset,
  type IngestionJob,
} from "../api/ingestion";
import { CHICAGO_API, IOF_API } from "../config/api";
import type {
  BaselineGraph,
  BaselineGraphDetail,
  BaselineGraphMetadata,
  OpportunitySeed,
  OpportunityBatch,
  SiteCampaign,
  ServiceabilityCandidate,
  SiteServiceabilityResult,
  StoredBaselineMetadata,
  StoredBaselineNetwork,
  UploadedSitesRow as FiberlightSiteRow,
} from "../types/fiberlightBeta";
import {
  buildServiceabilityResults,
  createFiberlightId,
  loadOpportunitySeeds,
  saveOpportunityBatch,
  saveOpportunitySeed,
  saveSiteCampaign,
} from "../types/fiberlightBeta";

const API = IOF_API;
const LARGE_GEOMETRY_RENDER_LIMIT = 100_000;

function createSimplifiedRoutePreview(routeCoords: LonLat[]) {
  if (routeCoords.length <= LARGE_GEOMETRY_RENDER_LIMIT) return routeCoords;
  const stride = Math.max(20, Math.ceil(routeCoords.length / LARGE_GEOMETRY_RENDER_LIMIT));
  const preview = routeCoords.filter((_, idx) => idx % stride === 0);
  const last = routeCoords[routeCoords.length - 1];
  if (last && preview[preview.length - 1] !== last) preview.push(last);
  return preview;
}

function countGeometryPoints(lines: LonLat[][]) {
  return lines.reduce((total, line) => total + line.length, 0);
}

function createSimplifiedGeometryPreview(fullGeometry: LonLat[][]) {
  const total = countGeometryPoints(fullGeometry);
  if (total <= LARGE_GEOMETRY_RENDER_LIMIT) return fullGeometry;
  const stride = Math.max(20, Math.ceil(total / LARGE_GEOMETRY_RENDER_LIMIT));
  return fullGeometry
    .map((line) => {
      const previewLine = line.filter((_, idx) => idx % stride === 0);
      const last = line[line.length - 1];
      if (last && previewLine[previewLine.length - 1] !== last) previewLine.push(last);
      return previewLine;
    })
    .filter((line) => line.length >= 2);
}

function largeBaselinePreviewMessage(fullCount: number, previewCount: number) {
  return (
    "Large baseline stored server-side. Full geometry exceeds safe rendering threshold. " +
    `Using simplified preview (${previewCount.toLocaleString()} of ${fullCount.toLocaleString()} points). ` +
    "Use Prism serviceability analysis for large-scale evaluation."
  );
}

function baselineGraphDetailToStoredBaseline(detail: BaselineGraphDetail): StoredBaselineNetwork {
  return {
    baselineId: detail.metadata.baselineGraphId ?? detail.graph.baselineId,
    accountId: String(detail.graph.metadata?.accountId ?? "fiberlight-beta"),
    baselineScopeVersionId: detail.inventoryScopeVersion?.scopeVersionId ?? detail.metadata.inventoryScopeVersionId ?? detail.metadata.inventoryId,
    datasetId: detail.metadata.inventoryId,
    datasetType: "BASELINE_GRAPH",
    name: detail.metadata.name,
    importedAt: detail.metadata.importedAt,
    sourceFilename: detail.metadata.sourceFile,
    budgetRequired: false,
    authoritativeStatus: "STORED_BASELINE",
    routePointCount: detail.metadata.graphSummary?.sourcePointCount ?? countGeometryPoints(detail.graph.fullGeometry),
    stationCount: detail.stations.length,
    geometryLoaded: true,
    apiId: detail.metadata.inventoryId,
    status: detail.inventoryScopeVersion?.status ?? "ACTIVE",
    routeCoords: [],
    fullGeometry: [],
    stations: [],
  };
}

function graphDiagnostics(graph: BaselineGraph | undefined, metadata: BaselineGraphMetadata | null) {
  if (!graph && !metadata) return null;
  if (!graph) {
    return {
      inventoryName: metadata?.name ?? "Carrier network inventory",
      nodeCount: metadata?.nodeCount ?? 0,
      edgeCount: metadata?.edgeCount ?? 0,
      stationCount: metadata?.stationCount ?? 0,
      routeMiles: metadata?.routeMiles ?? 0,
      connectedComponents: metadata?.connectedComponents ?? 0,
      longestRouteMiles: (metadata?.longestSegment ?? 0) / 5280,
      importedAt: metadata?.importedAt ?? "",
    };
  }
  const routeFeet = graph.edges.reduce((sum, edge) => sum + (Number(edge.lengthFt) || 0), 0);
  const adjacency = new Map<string, string[]>();
  graph.nodes.forEach((node) => adjacency.set(node.nodeId, []));
  graph.edges.forEach((edge) => {
    const a = edge.startNodeId || edge.fromNodeId;
    const b = edge.endNodeId || edge.toNodeId;
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a)!.push(b);
    adjacency.get(b)!.push(a);
  });

  let connectedComponents = 0;
  const visited = new Set<string>();
  for (const nodeId of adjacency.keys()) {
    if (visited.has(nodeId)) continue;
    connectedComponents += 1;
    const stack = [nodeId];
    visited.add(nodeId);
    while (stack.length) {
      const current = stack.pop()!;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
  }

  const longestRouteFeet = graph.edges.reduce((max, edge) => Math.max(max, Number(edge.lengthFt) || 0), 0);
  return {
    inventoryName: metadata?.name ?? graph.name,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    stationCount: graph.stations.length,
    routeMiles: routeFeet / 5280,
    connectedComponents,
    longestRouteMiles: longestRouteFeet / 5280,
    importedAt: metadata?.importedAt ?? "",
  };
}

function serviceabilityCandidatesFromResults(results: SiteServiceabilityResult[]): ServiceabilityCandidate[] {
  return results.map((result) => ({
    candidateId: result.siteId,
    nearestEdgeId: result.nearestGraphEdgeId ?? null,
    nearestNodeId: result.nearestGraphNodeId ?? null,
    distanceFeet: result.distanceToNetworkFeet,
    score: result.confidence,
  }));
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function runPrismLargeDatasetIngestion(args: {
  file: File;
  metadata: Record<string, unknown>;
  onProgress: (job: IngestionJob) => void;
}) {
  console.log("LARGE DATASET MODE ENABLED", { file: args.file.name, size: args.file.size, apiTarget: CHICAGO_API });
  console.log("UPLOAD STARTED", { file: args.file.name });
  const upload = await uploadRawDataset(args.file, args.metadata);
  console.log("UPLOAD COMPLETE", upload);
  let job = await startIngestion(upload.uploadId, args.metadata);
  console.log("INGESTION JOB STARTED", job);
  args.onProgress(job);

  while (!["Complete", "Failed", "Canceled"].includes(job.status)) {
    await sleep(2000);
    job = await getIngestionJob(job.jobId);
    console.log("INGESTION PROGRESS", job);
    args.onProgress(job);
  }

  if (job.status === "Complete") console.log("INGESTION COMPLETE", job);
  return job;
}

/* =========================
   TYPES
========================= */

type LonLat = [number, number];

type CanonicalTruth = {
  scopeVersionId?: string;
  baselineId?: string;
  datasetType?: "BASELINE_GRAPH" | "EXISTING_NETWORK" | "SCOPE_VERSION";
  route?: LonLat[];
  fullGeometry?: LonLat[][];
  graph?: BaselineGraph;
  stations: Station[];
  objects?: any[];
  constraints?: any;
  stateModel?: any;
};

type Station = {
  stationId: string;
  station?: string;
  lat: number;
  lon: number;
  feet?: number;
  [key: string]: any;
};

type TargetProfileType =
  | "hospital"
  | "school_district"
  | "enterprise"
  | "government"
  | "data_center";

type ServiceType =
  | "DIA"
  | "EPL"
  | "EVPL"
  | "Wavelength"
  | "Dark Fiber"
  | "Private Transport";

type OpportunityStage =
  | "in_profile"
  | "reachable"
  | "economically_viable"
  | "strategically_valuable"
  | "recommended"
  | "human_engaged"
  | "commercially_qualified"
  | "close_candidate";

type TargetProfileTemplate = {
  type: TargetProfileType;
  label: string;
  minMonthlyRevenue: number;
  maxBuildDistanceFeet: number;
  requiredMbps: number;
  concurrencyFactor: number;
  serviceType: ServiceType;
  strategicWeight: number;
};

type CapacityBlock = {
  requiredMbps: number;
  concurrencyFactor: number;
  effectiveLoadMbps: number;
};

type BackboneImpact = {
  percentCapacityUsed: number;
  upgradeContributionMonthly: number;
  monthsToUpgradeDelta: number;
};

type ConstraintState = "ready" | "conditional" | "constrained" | "blocked" | "unknown";
type ConstraintConfidence = "high" | "medium" | "low";

type Proposal = {
  id: string;
  scopeVersionId: string;

  accountName: string;
  address: string;
  targetType: TargetProfileType;

  stationId: string;
  stationLabel: string;
  distanceFeet: number;

  serviceType: ServiceType;
  stage: OpportunityStage;
  recommendation: "pursue" | "review" | "reject";

  revenueMonthly: number;
  buildCost: number;
  roi: number;
  paybackMonths: number;

  segmentRevenueMonthly: number;
  sva: number;

  lat: number;
  lon: number;
  routeGeometry: [number, number][];

  capacity: CapacityBlock;
  backboneImpact: BackboneImpact;

  rationale: string[];
  source: "sweep" | "human_asserted";

  constraintState: ConstraintState;
  constraintConfidence: ConstraintConfidence;
};

type FunnelBucket = {
  stage: OpportunityStage;
  count: number;
  totalMonthlyRevenue: number;
  totalBuildCost: number;
  avgROI: number;
  avgSVA: number;
};

type QuickQuoteDraft = {
  lat: number;
  lon: number;
};

type MapClickCaptureProps = {
  enabled: boolean;
  snapEnabled: boolean;
  onMapClick: (lat: number, lon: number) => void;
};

type PrismModeProps = {
  onSendBatchToDesign?: (batch: OpportunityBatch) => void;
};

/* =========================
   CONSTANTS
========================= */

const TARGET_PROFILES: Record<TargetProfileType, TargetProfileTemplate> = {
  hospital: {
    type: "hospital",
    label: "Hospital",
    minMonthlyRevenue: 12000,
    maxBuildDistanceFeet: 8000,
    requiredMbps: 5000,
    concurrencyFactor: 0.7,
    serviceType: "Private Transport",
    strategicWeight: 1.4,
  },
  data_center: {
    type: "data_center",
    label: "Data Center",
    minMonthlyRevenue: 20000,
    maxBuildDistanceFeet: 12000,
    requiredMbps: 10000,
    concurrencyFactor: 0.8,
    serviceType: "Dark Fiber",
    strategicWeight: 1.6,
  },
  school_district: {
    type: "school_district",
    label: "School District",
    minMonthlyRevenue: 5000,
    maxBuildDistanceFeet: 7000,
    requiredMbps: 2000,
    concurrencyFactor: 0.65,
    serviceType: "EPL",
    strategicWeight: 1.2,
  },
  enterprise: {
    type: "enterprise",
    label: "Enterprise",
    minMonthlyRevenue: 3000,
    maxBuildDistanceFeet: 5000,
    requiredMbps: 1000,
    concurrencyFactor: 0.6,
    serviceType: "DIA",
    strategicWeight: 1.0,
  },
  government: {
    type: "government",
    label: "Government",
    minMonthlyRevenue: 6000,
    maxBuildDistanceFeet: 7000,
    requiredMbps: 1500,
    concurrencyFactor: 0.6,
    serviceType: "EVPL",
    strategicWeight: 1.15,
  },
};

const PROFILE_ORDER: TargetProfileType[] = [
  "hospital",
  "data_center",
  "school_district",
  "government",
  "enterprise",
];

const BACKBONE_CAPACITY_TOTAL_MBPS = 10000;
const BACKBONE_UPGRADE_COST = 500000;

/* =========================
   HELPERS
========================= */

function distanceFromRouteFeet(
  route: [number, number][],
  point: { lat: number; lon: number }
) {
  let best = Infinity;

  for (const [lat, lon] of route) {
    const d = distanceFeet({ lat, lon }, point);
    if (d < best) best = d;
  }

  return best;
}

function distanceFeet(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dx = a.lat - b.lat;
  const dy = a.lon - b.lon;
  return Math.sqrt(dx * dx + dy * dy) * 364000;
}

function isValidLatLon(lat?: number, lon?: number) {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon);
}

function fmtMoney(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

function normalizeRoutePositions(route?: LonLat[]) {
  console.log("PRISM MAP normalizeRoutePositions input routeCoords.length", route?.length ?? 0);
  if (!route || route.length === 0) {
    console.log("PRISM MAP normalizeRoutePositions output previewRoute.length", 0);
    return [] as [number, number][];
  }

  const positions = route.map(([lon, lat]) => [lat, lon] as [number, number]);
  console.log("PRISM MAP normalizeRoutePositions raw first lon/lat", route[0]);
  console.log("PRISM MAP normalizeRoutePositions rendered first lat/lon", positions[0]);
  console.log("PRISM MAP normalizeRoutePositions previewRoute.length", positions.length);
  return positions;
}

function normalizeGeometryPositionLines(fullGeometry?: LonLat[][], route?: LonLat[]) {
  const lines = fullGeometry?.length ? fullGeometry : route?.length ? [route] : [];
  return lines
    .map((line) => line.map(([lon, lat]) => [lat, lon] as [number, number]))
    .filter((line) => line.length >= 2);
}

function buildLineFromStationToTarget(
  station: Station,
  target: { lat: number; lon: number }
): [number, number][] {
  return [
    [station.lat, station.lon],
    [target.lat, target.lon],
  ];
}

function findNearestStation(stations: Station[], point: { lat: number; lon: number }) {
  if (!stations.length) return null;

  let best: Station | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const station of stations) {
    const d = distanceFeet({ lat: station.lat, lon: station.lon }, point);
    if (d < bestDistance) {
      bestDistance = d;
      best = station;
    }
  }

  if (!best) return null;

  return {
    station: best,
    distanceFeet: bestDistance,
  };
}

function classifySyntheticTarget(i: number): TargetProfileType {
  return PROFILE_ORDER[i % PROFILE_ORDER.length];
}

function estimatedMonthlyRevenue(profile: TargetProfileTemplate, i: number) {
  const bump = (i * 1377) % 7000;
  return profile.minMonthlyRevenue + bump;
}

function accountNameFromProfile(profile: TargetProfileTemplate, i: number) {
  switch (profile.type) {
    case "hospital":
      return `Regional Hospital ${i + 1}`;
    case "data_center":
      return `Data Center ${i + 1}`;
    case "school_district":
      return `School District ${i + 1}`;
    case "government":
      return `Government Campus ${i + 1}`;
    case "enterprise":
    default:
      return `Enterprise Campus ${i + 1}`;
  }
}

function accountAddressFromProfile(profile: TargetProfileTemplate, i: number) {
  return `${1000 + i * 25} ${profile.label} Blvd`;
}

async function snapPoint(point: any) {
  try {
    let lat: number;
    let lon: number;

    // 🔍 Normalize input
    if (Array.isArray(point)) {
      const a = Number(point[0]);
      const b = Number(point[1]);

      if (Math.abs(a) > 90) {
        lon = a;
        lat = b;
      } else {
        lat = a;
        lon = b;
      }
    } else {
      lat = Number(point?.lat);
      lon = Number(point?.lon);
    }

    // 🚫 Hard guard
    if (!isFinite(lat) || !isFinite(lon)) {
      console.warn("Invalid point → using raw:", point);
      return { lat, lon }; // ✅ NEVER return null
    }

    const url = `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("OSRM failed:", res.status);
      return { lat, lon }; // ✅ fallback
    }

    const data = await res.json();
    const snapped = data?.waypoints?.[0]?.location;

    if (!snapped) {
      console.warn("No snap result → using raw");
      return { lat, lon }; // ✅ fallback
    }

    return {
      lat: snapped[1],
      lon: snapped[0],
    };

  } catch (err) {
    console.warn("snapPoint error → using raw:", err);

    // 🔥 CRITICAL: never return null
    if (point?.lat && point?.lon) {
      return { lat: point.lat, lon: point.lon };
    }

    if (Array.isArray(point) && point.length === 2) {
      return { lat: point[0], lon: point[1] };
    }

    return null; // last resort only
  }
}

async function osrmRouteBetweenPoints(
  start: { lat: number; lon: number },
  end: { lat: number; lon: number }
): Promise<[number, number][]> {
  try {
    // 🔥 FORCE NUMBERS + CORRECT ORDER
    const startLon = Number(start.lon);
    const startLat = Number(start.lat);
    const endLon = Number(end.lon);
    const endLat = Number(end.lat);

    if (
      !isFinite(startLat) ||
      !isFinite(startLon) ||
      !isFinite(endLat) ||
      !isFinite(endLon)
    ) {
      console.warn("Invalid OSRM input", { start, end });
      return [
        [startLat, startLon],
        [endLat, endLon],
      ];
    }

    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn("OSRM failed", res.status);
      throw new Error("Route failed");
    }

    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates;

    if (!coords) {
      return [
        [startLat, startLon],
        [endLat, endLon],
      ];
    }

    // 🔥 CONVERT [lon,lat] → [lat,lon]
    return coords.map(([lon, lat]: [number, number]) => [lat, lon]);

  } catch (err) {
    console.warn("OSRM fallback", err);
    return [
      [start.lat, start.lon],
      [end.lat, end.lon],
    ];
  }
}

function calcRouteFeetFromCoords(coords: [number, number][]) {
  let total = 0;

  for (let i = 1; i < coords.length; i++) {
    const [lat1, lon1] = coords[i - 1];
    const [lat2, lon2] = coords[i];
    const dx = lat2 - lat1;
    const dy = lon2 - lon1;
    total += Math.sqrt(dx * dx + dy * dy) * 364000;
  }

  return total;
}

function buildProposalFromStation(
  scopeVersionId: string,
  station: Station,
  i: number,
  searchRadiusFeet: number
): Proposal | null {
  const profileType = classifySyntheticTarget(i);
  const profile = TARGET_PROFILES[profileType];

  const lat = station.lat + 0.005 + i * 0.00015;
  const lon = station.lon + 0.005 + i * 0.00015;

  const dist = distanceFeet({ lat: station.lat, lon: station.lon }, { lat, lon });
  if (dist > Math.min(profile.maxBuildDistanceFeet, searchRadiusFeet)) return null;

  const revenueMonthly = estimatedMonthlyRevenue(profile, i);
  if (revenueMonthly < profile.minMonthlyRevenue) return null;

  const buildCost = dist * 10;
  const roi = revenueMonthly / Math.max(buildCost, 1);
  const segmentRevenueMonthly = revenueMonthly * (1.8 + profile.strategicWeight);
  const paybackMonths = buildCost / Math.max(segmentRevenueMonthly, 1);
  const sva = (segmentRevenueMonthly / Math.max(buildCost, 1)) * 10 * profile.strategicWeight;

  const effectiveLoadMbps = profile.requiredMbps * profile.concurrencyFactor;
  const percentCapacityUsed = effectiveLoadMbps / BACKBONE_CAPACITY_TOTAL_MBPS;
  const upgradeContributionMonthly = revenueMonthly * 0.3;
  const monthsToUpgradeDelta =
    upgradeContributionMonthly > 0
      ? BACKBONE_UPGRADE_COST / (upgradeContributionMonthly * 12)
      : 0;

  let stage: OpportunityStage = "in_profile";
  if (dist <= profile.maxBuildDistanceFeet) stage = "reachable";
  if (roi >= 0.12) stage = "economically_viable";
  if (sva >= 2.5) stage = "strategically_valuable";
  if (roi >= 0.12 && sva >= 2.5) stage = "recommended";

  let constraintState: ConstraintState = "ready";
  let constraintConfidence: ConstraintConfidence = "high";

  const r = Math.random();
  if (r > 0.85) {
    constraintState = "blocked";
    constraintConfidence = "high";
  } else if (r > 0.65) {
    constraintState = "constrained";
    constraintConfidence = "medium";
  } else if (r > 0.45) {
    constraintState = "conditional";
    constraintConfidence = "medium";
  } else if (r > 0.25) {
    constraintState = "unknown";
    constraintConfidence = "low";
  }

  let recommendation: Proposal["recommendation"] = "review";
  if (constraintState === "blocked") {
    recommendation = "reject";
  } else if (constraintState === "ready") {
    recommendation = "pursue";
  }

  return {
    id: `P-${scopeVersionId}-${station.stationId}-${i}`,
    scopeVersionId,
    accountName: accountNameFromProfile(profile, i),
    address: accountAddressFromProfile(profile, i),
    targetType: profile.type,
    stationId: station.stationId,
    stationLabel: station.station || station.stationId,
    distanceFeet: dist,
    serviceType: profile.serviceType,
    stage,
    recommendation,
    revenueMonthly,
    buildCost,
    roi,
    paybackMonths,
    segmentRevenueMonthly,
    sva,
    lat,
    lon,
    routeGeometry: buildLineFromStationToTarget(station, { lat, lon }),
    capacity: {
      requiredMbps: profile.requiredMbps,
      concurrencyFactor: profile.concurrencyFactor,
      effectiveLoadMbps,
    },
    backboneImpact: {
      percentCapacityUsed,
      upgradeContributionMonthly,
      monthsToUpgradeDelta,
    },
    rationale: [
      `Profile match: ${profile.label}`,
      `Nearest anchor: ${station.stationId}`,
      `Build distance: ${Math.round(dist).toLocaleString()} ft`,
      `Service: ${profile.serviceType}`,
    ],
    source: "sweep",
    constraintState,
    constraintConfidence,
  };
}

function buildProposalFromLLMTarget(
  scopeVersionId: string,
  truth: CanonicalTruth,
  target: any,
  i: number
): Proposal | null {
  if (!target?.lat || !target?.lon) return null;

  const nearest = findNearestStation(truth.stations || [], {
    lat: target.lat,
    lon: target.lon,
  });

  if (!nearest) return null;

  const { station: nearestStation, distanceFeet: dist } = nearest;

  const buildCost = dist * 10;
  const revenueMonthly = 1500;
  const roi = revenueMonthly / Math.max(buildCost, 1);

  return {
    id: `LLM-${scopeVersionId}-${i}`,
    scopeVersionId,
    accountName: target.label || "LLM Target",
    address: "Generated Target",
    targetType: "enterprise",
    stationId: nearestStation.stationId,
    stationLabel: nearestStation.station || nearestStation.stationId,
    distanceFeet: dist,
    serviceType: "DIA",
    stage: "reachable",
    recommendation: "review",
    revenueMonthly,
    buildCost,
    roi,
    paybackMonths: buildCost / revenueMonthly,
    segmentRevenueMonthly: revenueMonthly * 2,
    sva: roi * 10,
    lat: target.lat,
    lon: target.lon,
    routeGeometry: buildLineFromStationToTarget(nearestStation, target),
    capacity: {
      requiredMbps: 1000,
      concurrencyFactor: 1,
      effectiveLoadMbps: 1000,
    },
    backboneImpact: {
      percentCapacityUsed: 0,
      upgradeContributionMonthly: 0,
      monthsToUpgradeDelta: 0,
    },
    rationale: ["LLM-discovered target"],
    source: "sweep",
    constraintState: "unknown",
    constraintConfidence: "low",
  };
}

function generateProposals(
  scopeVersionId: string,
  truth: CanonicalTruth,
  searchRadiusFeet: number
): Proposal[] {
  return (truth.stations || [])
    .map((station, i) => buildProposalFromStation(scopeVersionId, station, i, searchRadiusFeet))
    .filter((p): p is Proposal => p !== null)
    .filter((p) => p.recommendation !== "reject")
    .sort((a, b) => {
      const constraintFactor = (state: string) => {
        if (state === "ready") return 1.0;
        if (state === "conditional") return 0.8;
        if (state === "constrained") return 0.6;
        if (state === "unknown") return 0.7;
        if (state === "blocked") return 0;
        return 1;
      };

      const confidenceFactor = (conf: string) => {
        if (conf === "high") return 1.0;
        if (conf === "medium") return 0.85;
        if (conf === "low") return 0.7;
        return 1;
      };

      const scoreA =
        (a.revenueMonthly - a.buildCost) *
        constraintFactor(a.constraintState) *
        confidenceFactor(a.constraintConfidence);

      const scoreB =
        (b.revenueMonthly - b.buildCost) *
        constraintFactor(b.constraintState) *
        confidenceFactor(b.constraintConfidence);

      return scoreB - scoreA;
    });
}

async function recordSimEvent(data: any) {
  console.log("SIM EVENT:", data);
}

async function runSimpleSim(routeCoords: LonLat[] | null | undefined) {
  if (!routeCoords || routeCoords.length === 0) return;

  const pt = routeCoords[Math.floor(Math.random() * routeCoords.length)];
  const decision = Math.random() > 0.5 ? "yes" : "no";

  const event = {
    decision,
    coord: pt,
    timestamp: Date.now(),
  };

  await recordSimEvent(event);
}

async function persistEdge(p: Proposal, scopeVersionId: string) {
  if (p.recommendation !== "pursue") return;

  try {
    await fetch(`${API}/graph/edge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeVersionId,
        fromStationId: p.stationId,
        to: {
          lat: p.lat,
          lon: p.lon,
        },
        geometry: p.routeGeometry,
        revenue: p.revenueMonthly,
        cost: p.buildCost,
      }),
    });
  } catch (e) {
    console.warn("edge persist failed", e);
  }
}

async function runLLMSweep(truth: CanonicalTruth, searchRadiusFeet: number) {
  try {
    console.log("Running LLM Sweep...");

    const route = truth?.route || [];

    if (!route.length) {
      console.warn("No route provided to LLM sweep");
      return [];
    }

    const res = await fetch(`${CHICAGO_API}/api/twin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        routeCoords: route.slice(0, 50), // or even 25
        radiusFeet: searchRadiusFeet
      }),
    });

    // Handle HTTP errors explicitly
    if (!res.ok) {
      const text = await res.text();
      console.error("LLM API ERROR:", res.status, text);
      return fallbackTargets(route);
    }

    const data = await res.json();

    console.log("PRISM TARGETS:", data);

    // Validate structure
    if (!data || !Array.isArray(data.targets)) {
      console.warn("Invalid LLM response format, using fallback");
      return fallbackTargets(route);
    }

    return data.targets;

  } catch (err) {
    console.error("LLM sweep failed:", err);
    return fallbackTargets(truth?.route || []);
  }
}

function fallbackTargets(route: any[]) {
  if (!route || !route.length) return [];

  const [lon, lat] = route[0]; // use YOUR route

  return [
    { lat, lon, type: "enterprise", confidence: 0.8 },
    { lat: lat + 0.01, lon: lon + 0.01, type: "enterprise", confidence: 0.7 },
    { lat: lat - 0.01, lon: lon - 0.01, type: "enterprise", confidence: 0.6 }
  ];
}

function findNearestPointOnRoute(
  route: [number, number][],
  point: { lat: number; lon: number }
) {
  let best = null;
  let bestDist = Infinity;

  for (const [lat, lon] of route) {
    const dx = lat - point.lat;
    const dy = lon - point.lon;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < bestDist) {
      bestDist = dist;
      best = { lat, lon };
    }
  }

  return best;
}

async function parseSiteCampaignFile(file: File): Promise<FiberlightSiteRow[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, any>>(await file.text(), { header: true, skipEmptyLines: true });
    return siteRowsFromRecords(parsed.data as any[]);
  }

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    const json = JSON.parse(await file.text());
    if (Array.isArray(json)) return siteRowsFromRecords(json);
    if (Array.isArray(json.sites)) return siteRowsFromRecords(json.sites);
    if (Array.isArray(json.points)) return siteRowsFromRecords(json.points);
    return siteRowsFromGeoJson(json);
  }

  throw new Error("Unsupported site campaign file. Use .csv, .geojson, or .json.");
}

function siteRowsFromRecords(records: any[]): FiberlightSiteRow[] {
  return records
    .map((row, index) => {
      const lat = Number(row.lat ?? row.latitude);
      const lon = Number(row.lon ?? row.lng ?? row.longitude);
      const rawName = row.name ?? row.site ?? row.account;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        id: String(row.id ?? row.siteId ?? row.site_id ?? index + 1),
        name: rawName ? String(rawName) : undefined,
        lat,
        lon,
        order: Number(row.order ?? row.index ?? index + 1),
      };
    })
    .filter(Boolean) as FiberlightSiteRow[];
}

function siteRowsFromGeoJson(json: any): FiberlightSiteRow[] {
  const features: any[] =
    json?.type === "FeatureCollection"
      ? json.features
      : json?.type === "Feature"
        ? [json]
        : json?.type
          ? [{ type: "Feature", properties: {}, geometry: json }]
          : [];

  const sites: FiberlightSiteRow[] = [];
  for (const feature of features) {
    const geometry = feature?.geometry;
    const properties = feature?.properties ?? {};
    if (!geometry) continue;
    if (geometry.type === "Point") {
      const [lon, lat] = geometry.coordinates;
      const rawName = properties.name ?? properties.site;
      sites.push({
        id: String(properties.id ?? properties.siteId ?? sites.length + 1),
        name: rawName ? String(rawName) : undefined,
        lat: Number(lat),
        lon: Number(lon),
        order: sites.length + 1,
      });
    }
    if (geometry.type === "MultiPoint") {
      for (const [lon, lat] of geometry.coordinates) {
        const rawName = properties.name ?? properties.site;
        sites.push({
          id: String(properties.id ?? properties.siteId ?? sites.length + 1),
          name: rawName ? String(rawName) : undefined,
          lat: Number(lat),
          lon: Number(lon),
          order: sites.length + 1,
        });
      }
    }
  }

  return sites.filter((site) => Number.isFinite(site.lat) && Number.isFinite(site.lon));
}

function serviceabilityColor(result: SiteServiceabilityResult) {
  switch (result.serviceabilityClass) {
    case "ON_NET":
    case "NEAR_NET":
      return "#22c55e";
    case "BUILD_REQUIRED":
      return "#f59e0b";
    case "OUT_OF_FOOTPRINT":
    default:
      return "#ef4444";
  }
}

function serviceabilityRank(result: SiteServiceabilityResult) {
  const classRank =
    result.serviceabilityClass === "ON_NET"
      ? 4
      : result.serviceabilityClass === "NEAR_NET"
        ? 3
        : result.serviceabilityClass === "BUILD_REQUIRED"
          ? 2
          : 1;
  return classRank * 100000 - (result.distanceToNetworkFeet ?? 999999) + result.confidence;
}

async function generateQuickQuote(
  scopeVersionId: string,
  truth: CanonicalTruth,
  z: QuickQuoteDraft,
  profileType: TargetProfileType
): Promise<Proposal | null> {

  const constraintState: ConstraintState = "ready";

  // 🔥 ROUTE (BACKBONE)
  const routePositions = (truth?.route || []).map(
    ([lon, lat]) => [lat, lon] as [number, number]
  );
  if (!routePositions.length) {
    console.warn("No route positions available");
    return null;
  }

  // 🔥 RAW CLICK
  const rawTarget = {
    lat: Number(z.lat),
    lon: Number(z.lon),
  };

  if (!isFinite(rawTarget.lat) || !isFinite(rawTarget.lon)) {
    console.warn("Invalid quick quote point");
    return null;
  }

  // 🔥 SNAP TO STREET
  const streetTarget = await snapPoint(rawTarget) ?? rawTarget;

  // 🔥 FIND BACKBONE ANCHOR
  const nearest = findNearestStation(truth.stations || [], streetTarget);
    if (!nearest) {
    console.warn("No station found");
    return null;
    }

    const { station } = nearest;

    const anchorRaw = {
    lat: station.lat,
    lon: station.lon,
    };
    if (!anchorRaw) {
    console.warn("No anchor found");
    return null;
    }

// 🔥 CRITICAL: snap backbone point to street network
  const anchor = (await snapPoint(anchorRaw)) ?? anchorRaw;

  const profile = TARGET_PROFILES[profileType];

  // 🔥 TRY REAL ROUTE (OSRM)
  const routedPath = await osrmRouteBetweenPoints(
    { lat: anchor.lat, lon: anchor.lon },
    { lat: streetTarget.lat, lon: streetTarget.lon }
  );

  // 🔥 FALLBACK IF OSRM FAILS
  const finalPath: [number, number][] =
    Array.isArray(routedPath) && routedPath.length >= 2
      ? routedPath
      : [
          [anchor.lat, anchor.lon],
          [streetTarget.lat, streetTarget.lon],
        ];

  // 🔥 DISTANCE
  const distanceFeetRouted = calcRouteFeetFromCoords(finalPath);
  const buildCost = distanceFeetRouted * 10;

  const revenueMonthly = profile.minMonthlyRevenue * 1.15;
  const roi = revenueMonthly / Math.max(buildCost, 1);
  const segmentRevenueMonthly = revenueMonthly * (1.8 + profile.strategicWeight);
  const paybackMonths = buildCost / Math.max(segmentRevenueMonthly, 1);

  const sva =
    (segmentRevenueMonthly / Math.max(buildCost, 1)) *
    10 *
    profile.strategicWeight;

  const effectiveLoadMbps =
    profile.requiredMbps * profile.concurrencyFactor;

  const percentCapacityUsed =
    effectiveLoadMbps / BACKBONE_CAPACITY_TOTAL_MBPS;

  const upgradeContributionMonthly = revenueMonthly * 0.3;

  const monthsToUpgradeDelta =
    upgradeContributionMonthly > 0
      ? BACKBONE_UPGRADE_COST / (upgradeContributionMonthly * 12)
      : 0;

  let stage: OpportunityStage = "in_profile";
  if (distanceFeetRouted <= profile.maxBuildDistanceFeet) stage = "reachable";
  if (roi >= 0.12) stage = "economically_viable";
  if (sva >= 2.5) stage = "strategically_valuable";
  if (roi >= 0.12 && sva >= 2.5) stage = "recommended";

  let recommendation: Proposal["recommendation"] = "review";
  if (constraintState === "ready") recommendation = "pursue";

  return {
    id: `QQ-${scopeVersionId}-${Math.round(z.lat * 10000)}-${Math.round(z.lon * 10000)}`,
    scopeVersionId,

    accountName: `Human-Asserted ${profile.label}`,
    address: `Pinned Z Loc (${z.lat.toFixed(5)}, ${z.lon.toFixed(5)})`,

    targetType: profile.type,

    // 🔥 NO MORE STATION DEPENDENCY
    stationId: "ANCHOR",
    stationLabel: "Backbone Anchor",

    distanceFeet: distanceFeetRouted,
    serviceType: profile.serviceType,

    stage,
    recommendation,

    revenueMonthly,
    buildCost,
    roi,
    paybackMonths,
    segmentRevenueMonthly,
    sva,

    lat: z.lat,
    lon: z.lon,

    routeGeometry: finalPath,

    capacity: {
      requiredMbps: profile.requiredMbps,
      concurrencyFactor: profile.concurrencyFactor,
      effectiveLoadMbps,
    },

    backboneImpact: {
      percentCapacityUsed,
      upgradeContributionMonthly,
      monthsToUpgradeDelta,
    },

    rationale: [
      "Human-directed quick quote",
      "Snapped to street",
      "Anchored to backbone",
      `Service: ${profile.serviceType}`,
    ],

    source: "human_asserted",
    constraintState,
    constraintConfidence: "high",
  };
}
function buildFunnel(proposals: Proposal[]): FunnelBucket[] {
  const stageOrder: OpportunityStage[] = [
    "in_profile",
    "reachable",
    "economically_viable",
    "strategically_valuable",
    "recommended",
    "human_engaged",
    "commercially_qualified",
    "close_candidate",
  ];

  return stageOrder.map((stage) => {
    const items = proposals.filter((p) => p.stage === stage);
    const count = items.length;
    const totalMonthlyRevenue = items.reduce((sum, p) => sum + p.revenueMonthly, 0);
    const totalBuildCost = items.reduce((sum, p) => sum + p.buildCost, 0);
    const avgROI = count ? items.reduce((sum, p) => sum + p.roi, 0) / count : 0;
    const avgSVA = count ? items.reduce((sum, p) => sum + p.sva, 0) / count : 0;

    return {
      stage,
      count,
      totalMonthlyRevenue,
      totalBuildCost,
      avgROI,
      avgSVA,
    };
  });
}

function MapClickCapture({ enabled, snapEnabled, onMapClick }: MapClickCaptureProps) {
  useMapEvents({
    async click(e) {
      if (!enabled) return;

      const lat = e.latlng.lat;
      const lon = e.latlng.lng;

      if (!snapEnabled) {
        onMapClick(lat, lon);
        return;
      }

      const snapped = await snapPoint([lat, lon]);
        if (!snapped) return;

        onMapClick(snapped.lat, snapped.lon);
    },
  });

  return null;
}

/* =========================
   UI HELPERS
========================= */

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 13,
        fontWeight: 600,
        color: "#1e3a8a",
      }}
    >
      {label}: {value}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
};

const primaryAction: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryAction: React.CSSProperties = {
  border: "1px solid #475569",
  background: "#0f172a",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

const ghostAction: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};

const smallLine: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.82,
};

/* =========================
   COMPONENT
========================= */

export default function PrismMode({ onSendBatchToDesign }: PrismModeProps = {}) {
  const [scopeVersion, setScopeVersion] = useState<string | null>(null);
  const [truth, setTruth] = useState<CanonicalTruth | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [quickQuote, setQuickQuote] = useState<Proposal | null>(null);

  const [mode, setMode] = useState<"sweep" | "quick_quote">("sweep");
  const [quickQuoteProfile, setQuickQuoteProfile] =
    useState<TargetProfileType>("enterprise");
  const [draftZLoc, setDraftZLoc] = useState<QuickQuoteDraft | null>(null);
  const [lockedZLoc, setLockedZLoc] = useState<QuickQuoteDraft | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [networkType, setNetworkType] = useState<"metro" | "middle" | "longhaul">("metro");
  const [searchRadiusFeet, setSearchRadiusFeet] = useState(5000);

  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const [storedBaselines, setStoredBaselines] = useState<StoredBaselineMetadata[]>([]);
  const [selectedBaselineDatasetId, setSelectedBaselineDatasetId] = useState("");
  const [baselineGraphInventory, setBaselineGraphInventory] = useState<BaselineGraphMetadata[]>([]);
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [activeInventoryMetadata, setActiveInventoryMetadata] = useState<BaselineGraphMetadata | null>(null);
  const [activeBaseline, setActiveBaseline] = useState<StoredBaselineNetwork | null>(null);
  const [campaignAccountId, setCampaignAccountId] = useState("fiberlight-beta");
  const [campaignName, setCampaignName] = useState("FiberLight target site campaign");
  const [activeCampaign, setActiveCampaign] = useState<SiteCampaign | null>(null);
  const [serviceabilityResults, setServiceabilityResults] = useState<SiteServiceabilityResult[]>([]);
  const [lateralCostPerFoot, setLateralCostPerFoot] = useState(18);
  const [latestBatch, setLatestBatch] = useState<OpportunityBatch | null>(null);
  const [opportunitySeeds, setOpportunitySeeds] = useState<OpportunitySeed[]>(() => loadOpportunitySeeds());
  const [campaignStatus, setCampaignStatus] = useState("Load a stored baseline, then upload target sites.");

  const mapRef = useRef<L.Map | null>(null);
  const graphMemoryRef = useRef<BaselineGraph | null>(null);

  async function handleChatSend() {
    if (!chatInput.trim() || !truth) return;

    const currentInput = chatInput;

    setChatHistory((h) => [...h, { role: "user", content: currentInput }]);
    setChatInput("");
    setChatHistory((h) => [
      ...h,
      { role: "assistant", content: "Analyzing route and targets..." },
    ]);

    try {
      const res = await fetch(`${CHICAGO_API}/api/twin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
        message: currentInput,
        context: {
            scopeVersionId: truth.scopeVersionId,  // 🔥 ADD THIS LINE

            route: truth.route?.slice(0, 10) || [],

            targets: proposals.slice(0, 5).map((p) => ({
            lat: p.lat,
            lon: p.lon,
            revenue: p.revenueMonthly,
            })),
        },
        }) 
      });

      const data = await res.json();
      const reply = data?.result || "No response from Prism AI";

      setChatHistory((h) => {
        const updated = [...h];
        updated[updated.length - 1] = {
          role: "assistant",
          content: reply,
        };
        return updated;
      });
    } catch (err) {
      console.error("Chat failed:", err);

      setChatHistory((h) => {
        const updated = [...h];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Error reaching Prism AI service.",
        };
        return updated;
      });
    }
  }

  async function refreshStoredBaselines() {
    try {
      const baselines = await listBaselines();
      setStoredBaselines(baselines);
      return baselines;
    } catch (err: any) {
      setCampaignStatus(`Baseline refresh failed: ${err?.message ?? String(err)}`);
      return [] as StoredBaselineMetadata[];
    }
  }

  async function refreshBaselineGraphInventory() {
    try {
      const inventory = await listBaselineGraphs();
      setBaselineGraphInventory(inventory);
      return inventory;
    } catch (err: any) {
      setCampaignStatus(`Baseline graph inventory refresh failed: ${err?.message ?? String(err)}`);
      return [] as BaselineGraphMetadata[];
    }
  }

  async function loadSelectedInventory() {
    const metadata = baselineGraphInventory.find((item) => item.inventoryId === selectedInventoryId);
    if (!metadata) {
      setCampaignStatus("Select carrier network inventory first.");
      return;
    }

    try {
      console.log("PRISM INVENTORY SELECTED", metadata);
      setCampaignStatus("Loading carrier network inventory graph...");
      const detail = await loadBaselineGraph(metadata.inventoryId);
      const baseline = baselineGraphDetailToStoredBaseline(detail);
      const displayGeometry = createSimplifiedGeometryPreview(detail.graph.fullGeometry);
      const usingSimplifiedPreview = countGeometryPoints(displayGeometry) !== countGeometryPoints(detail.graph.fullGeometry);
      if (!graphMemoryRef.current) console.log("GRAPH MEMORY STORE CREATED", { inventoryId: detail.metadata.inventoryId });
      graphMemoryRef.current = detail.graph;
      console.log("GRAPH MEMORY STORE UPDATED", {
        inventoryId: detail.metadata.inventoryId,
        nodes: detail.graph.nodes.length,
        edges: detail.graph.edges.length,
        stations: detail.graph.stations.length,
      });

      setActiveInventoryMetadata(detail.metadata);
      setSelectedBaselineDatasetId("");
      setActiveBaseline(baseline);
      setScopeVersion(baseline.baselineScopeVersionId);
      setTruth({
        scopeVersionId: baseline.baselineScopeVersionId,
        baselineId: baseline.baselineId,
        datasetType: "BASELINE_GRAPH",
        route: [],
        fullGeometry: displayGeometry,
        stations: [],
        objects: [],
      });
      setProposals([]);
      setSelected(null);
      setDraftZLoc(null);
      setLockedZLoc(null);
      setQuickQuote(null);
      setServiceabilityResults([]);
      setLatestBatch(null);
      setCampaignStatus(
        usingSimplifiedPreview
          ? largeBaselinePreviewMessage(countGeometryPoints(detail.graph.fullGeometry), countGeometryPoints(displayGeometry))
          : `Loaded carrier network inventory ${detail.metadata.name}. Upload target sites to score serviceability.`
      );
    } catch (err: any) {
      setCampaignStatus(`Carrier network inventory load failed: ${err?.message ?? String(err)}`);
    }
  }

  function scoreServiceabilityForSites(sites: FiberlightSiteRow[], baseline: StoredBaselineNetwork) {
    console.log("PRISM SERVICEABILITY START", {
      baselineId: baseline.baselineId,
      inventoryId: activeInventoryMetadata?.inventoryId ?? baseline.datasetId,
      candidateCount: sites.length,
      graphMode: baseline.datasetType === "BASELINE_GRAPH",
    });
    const scoringBaseline =
      baseline.datasetType === "BASELINE_GRAPH" && graphMemoryRef.current
        ? { ...baseline, graph: graphMemoryRef.current }
        : baseline;
    const results = buildServiceabilityResults({ sites, baseline: scoringBaseline, lateralCostPerFoot });
    const serviceabilityCandidates = serviceabilityCandidatesFromResults(results);
    console.log("PRISM SERVICEABILITY COMPLETE", {
      candidateCount: serviceabilityCandidates.length,
      onNet: results.filter((result) => result.serviceabilityClass === "ON_NET").length,
      nearNet: results.filter((result) => result.serviceabilityClass === "NEAR_NET").length,
      buildRequired: results.filter((result) => result.serviceabilityClass === "BUILD_REQUIRED").length,
      outOfFootprint: results.filter((result) => result.serviceabilityClass === "OUT_OF_FOOTPRINT").length,
      sample: serviceabilityCandidates.slice(0, 5),
    });
    return results;
  }

  async function loadSelectedBaseline() {
    const baselineMeta = storedBaselines.find((item) => item.datasetId === selectedBaselineDatasetId);
    if (!baselineMeta) {
      setCampaignStatus("Select a stored baseline first.");
      return;
    }

    try {
      setCampaignStatus("Loading baseline geometry from Chicago...");
      const baseline = await loadBaseline(baselineMeta.datasetId);
      console.log("BASELINE LOADED", baseline);

      if (baseline.datasetType === "BASELINE_GRAPH") {
        const graph = baseline.graph;
        if (!graph?.edges.length) {
          setCampaignStatus(`Loaded baseline graph metadata for ${baseline.name}, but Chicago returned no graph edges.`);
          return;
        }

        const displayGeometry = createSimplifiedGeometryPreview(graph.fullGeometry);
        const usingSimplifiedPreview = countGeometryPoints(displayGeometry) !== countGeometryPoints(graph.fullGeometry);
        const graphStats = graphDiagnostics(graph, null);
        const graphlessBaseline: StoredBaselineNetwork = {
          ...baseline,
          graph: undefined,
          routeCoords: [],
          fullGeometry: [],
          stations: [],
        };
        const legacyMetadata: BaselineGraphMetadata = {
          inventoryId: baseline.datasetId,
          name: baseline.name,
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          stationCount: graph.stations.length,
          routeMiles: graphStats?.routeMiles ?? graph.edges.reduce((sum, edge) => sum + (Number(edge.lengthFt) || 0), 0) / 5280,
          connectedComponents: graphStats?.connectedComponents ?? 0,
          longestSegment: (graphStats?.longestRouteMiles ?? 0) * 5280,
          importedAt: baseline.importedAt,
          baselineGraphId: baseline.baselineId,
          inventoryScopeVersionId: baseline.baselineScopeVersionId,
          sourceFile: baseline.sourceFilename,
        };

        if (!graphMemoryRef.current) console.log("GRAPH MEMORY STORE CREATED", { inventoryId: baseline.datasetId });
        graphMemoryRef.current = graph;
        console.log("GRAPH MEMORY STORE UPDATED", {
          inventoryId: baseline.datasetId,
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          stations: graph.stations.length,
        });

        setActiveBaseline(graphlessBaseline);
        setActiveInventoryMetadata(legacyMetadata);
        setSelectedInventoryId("");
        setScopeVersion(baseline.baselineScopeVersionId);
        setTruth({
          scopeVersionId: baseline.baselineScopeVersionId,
          baselineId: baseline.baselineId,
          datasetType: "BASELINE_GRAPH",
          route: [],
          fullGeometry: displayGeometry,
          stations: [],
          objects: [],
        });
        setProposals([]);
        setSelected(null);
        setDraftZLoc(null);
        setLockedZLoc(null);
        setQuickQuote(null);
        console.log("PRISM BASELINE GRAPH LOADED", {
          baselineId: baseline.baselineId,
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          lines: graph.geometry.length,
        });
        setCampaignStatus(
          usingSimplifiedPreview
            ? largeBaselinePreviewMessage(countGeometryPoints(graph.fullGeometry), countGeometryPoints(displayGeometry))
            : `Loaded baseline graph ${baseline.name}. Upload target sites to score serviceability against graph edges.`
        );
        return;
      }

      if (!baseline.routeCoords.length) {
        setCampaignStatus(`Loaded baseline metadata for ${baseline.name}, but Chicago returned no geometry.`);
        return;
      }

      const displayRoute = createSimplifiedRoutePreview(baseline.routeCoords);
      const usingSimplifiedPreview = displayRoute.length !== baseline.routeCoords.length;

      setActiveBaseline(baseline);
      setActiveInventoryMetadata(null);
      setSelectedInventoryId("");
      graphMemoryRef.current = null;
      setScopeVersion(baseline.baselineScopeVersionId);
      setTruth({
        scopeVersionId: baseline.baselineScopeVersionId,
        baselineId: baseline.baselineId,
        datasetType: "EXISTING_NETWORK",
        route: displayRoute,
        stations: baseline.stations ?? [],
        objects: [],
      });
      setProposals([]);
      setSelected(null);
      setDraftZLoc(null);
      setLockedZLoc(null);
      setQuickQuote(null);
      setCampaignStatus(
        usingSimplifiedPreview
          ? largeBaselinePreviewMessage(baseline.routeCoords.length, displayRoute.length)
          : `Loaded baseline ${baseline.name}. Upload target sites to score serviceability.`
      );
    } catch (err: any) {
      setCampaignStatus(`Baseline load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handleCampaignUpload(file: File) {
    try {
      if (!activeBaseline) {
        setCampaignStatus("Load a stored baseline before uploading a target site campaign.");
        return;
      }

      if (file.size > LARGE_DATASET_THRESHOLD_BYTES) {
        setCampaignStatus("Large dataset mode: uploading target site campaign to Chicago...");
        const job = await runPrismLargeDatasetIngestion({
          file,
          metadata: {
            accountId: campaignAccountId.trim() || activeBaseline.accountId || "fiberlight-beta",
            name: campaignName.trim() || file.name,
            datasetType: "TARGET_SITE_LIST",
            baselineId: activeBaseline.baselineId,
            baselineScopeVersionId: activeBaseline.baselineScopeVersionId,
            sourceFilename: file.name,
            source: "prism-target-sites",
          },
          onProgress: (progress) => {
            setCampaignStatus(
              `Ingestion ${progress.status}: rows ${progress.rowsRead?.toLocaleString() ?? "-"}, accepted ${
                progress.pointsAccepted?.toLocaleString() ?? "-"
              }, rejected ${progress.rowsRejected?.toLocaleString() ?? "-"}`
            );
          },
        });
        setCampaignStatus(
          job.status === "Complete"
            ? "Large target site dataset stored server-side. Use a smaller candidate extract for local serviceability scoring."
            : `Large target site ingestion ${job.status.toLowerCase()}.`
        );
        return;
      }

      const sites = await parseSiteCampaignFile(file);
      if (!sites.length) throw new Error("No valid lat/lon sites found.");

      const campaign: SiteCampaign = {
        accountId: campaignAccountId.trim() || activeBaseline.accountId || "fiberlight-beta",
        campaignId: createFiberlightId("campaign"),
        baselineId: activeBaseline.baselineId,
        baselineScopeVersionId: activeBaseline.baselineScopeVersionId,
        datasetId: createFiberlightId("dataset"),
        datasetType: "TARGET_SITE_LIST",
        name: campaignName.trim() || file.name,
        sites,
        importedAt: new Date().toISOString(),
        sourceFilename: file.name,
        budgetRequired: false,
      };

      saveSiteCampaign(campaign);
      setActiveCampaign(campaign);
      setLatestBatch(null);
      setServiceabilityResults(scoreServiceabilityForSites(sites, activeBaseline));
      setCampaignStatus(`Stored campaign ${campaign.name}: ${sites.length} sites scored against baseline.`);
    } catch (err: any) {
      setCampaignStatus(`Campaign upload failed: ${err?.message ?? String(err)}`);
    }
  }

  function updateServiceabilitySelection(select: (result: SiteServiceabilityResult, index: number) => boolean) {
    setServiceabilityResults((prev) => prev.map((result, index) => ({ ...result, selected: select(result, index) })));
    setLatestBatch(null);
  }

  function selectClass(...classes: SiteServiceabilityResult["serviceabilityClass"][]) {
    updateServiceabilitySelection((result) => classes.includes(result.serviceabilityClass));
  }

  function selectTop(count: number) {
    const topIds = new Set(
      [...serviceabilityResults]
        .sort((a, b) => serviceabilityRank(b) - serviceabilityRank(a))
        .slice(0, count)
        .map((result) => result.siteId)
    );
    updateServiceabilitySelection((result) => topIds.has(result.siteId));
  }

  function createOpportunityBatch() {
    if (!activeCampaign || !activeBaseline) {
      setCampaignStatus("Load a baseline and campaign before creating a batch.");
      return null;
    }
    if (activeBaseline.datasetType === "BASELINE_GRAPH") {
      setCampaignStatus("Baseline Graph mode creates Opportunity Seeds only in this phase. No Design batch generated.");
      return null;
    }

    const selectedSites = serviceabilityResults.filter((result) => result.selected);
    if (!selectedSites.length) {
      setCampaignStatus("Select at least one serviceability result before creating a batch.");
      return null;
    }

    const batch: OpportunityBatch = {
      accountId: activeCampaign.accountId,
      batchId: createFiberlightId("batch"),
      campaignId: activeCampaign.campaignId,
      baselineId: activeBaseline.baselineId,
      baselineScopeVersionId: activeBaseline.baselineScopeVersionId,
      datasetType: "OPPORTUNITY_BATCH",
      selectedSites,
      createdAt: new Date().toISOString(),
      budgetRequired: true,
    };

    saveOpportunityBatch(batch);
    setLatestBatch(batch);
    setCampaignStatus(`Opportunity batch created: ${selectedSites.length} selected sites. Budget required in Design.`);
    return batch;
  }

  function createOpportunitySeed(result: SiteServiceabilityResult) {
    if (!activeBaseline || activeBaseline.datasetType !== "BASELINE_GRAPH") {
      setCampaignStatus("Opportunity seeds require a loaded carrier network inventory graph.");
      return null;
    }

    const inventoryId = activeInventoryMetadata?.inventoryId ?? activeBaseline.datasetId;
    const seed: OpportunitySeed = {
      opportunityId: createFiberlightId("opp-seed"),
      candidateId: result.siteId,
      nearestNodeId: result.nearestGraphNodeId ?? null,
      nearestEdgeId: result.nearestGraphEdgeId ?? null,
      distanceFeet: result.distanceToNetworkFeet,
      inventoryId,
      status: "DISCOVERED",
    };

    saveOpportunitySeed(seed);
    setOpportunitySeeds((prev) => [seed, ...prev.filter((item) => item.opportunityId !== seed.opportunityId)]);
    console.log("OPPORTUNITY SEED CREATED", seed);
    setCampaignStatus(`Opportunity seed created for ${result.name || result.siteId}. No route, budget, BOM, or economics generated.`);
    return seed;
  }

  function createOpportunitySeedsFromSelected() {
    const selectedSites = serviceabilityResults.filter((result) => result.selected);
    if (!selectedSites.length) {
      setCampaignStatus("Select at least one serviceability result before creating opportunity seeds.");
      return;
    }
    selectedSites.forEach(createOpportunitySeed);
    setCampaignStatus(`Opportunity seeds created: ${selectedSites.length}. No Design routes or economics generated.`);
  }

  function sendBatchToDesign() {
    const batch = latestBatch ?? createOpportunityBatch();
    if (!batch) return;
    onSendBatchToDesign?.(batch);
    setCampaignStatus(`Sent batch ${batch.batchId} to Design.`);
  }

  useEffect(() => {
    if (networkType === "metro") setSearchRadiusFeet(5000);
    if (networkType === "middle") setSearchRadiusFeet(10000);
    if (networkType === "longhaul") setSearchRadiusFeet(20000);
  }, [networkType]);

  useEffect(() => {
    console.log("LOCAL UI USING CHICAGO API", CHICAGO_API);
    void refreshStoredBaselines();
    void refreshBaselineGraphInventory();
    const refresh = () => {
      void refreshStoredBaselines();
      void refreshBaselineGraphInventory();
    };
    window.addEventListener("hyperlinx:baselinesChanged", refresh);
    window.addEventListener("hyperlinx:baselineGraphsChanged", refresh);
    return () => {
      window.removeEventListener("hyperlinx:baselinesChanged", refresh);
      window.removeEventListener("hyperlinx:baselineGraphsChanged", refresh);
    };
  }, []);

  useEffect(() => {
    if (!activeBaseline || !activeCampaign) return;
    setServiceabilityResults(scoreServiceabilityForSites(activeCampaign.sites, activeBaseline));
  }, [activeBaseline, activeCampaign, lateralCostPerFoot, activeInventoryMetadata]);

  useEffect(() => {
    if (!scopeVersion) return;
    if (activeBaseline?.baselineScopeVersionId === scopeVersion) return;

    fetch(`${API}/scope/${scopeVersion}`)
      .then((res) => res.json())
      .then((data) => {
        const t = data.canonicalTruth || data;
        setTruth(t);

        setProposals([]);
        setSelected(null);
        setDraftZLoc(null);
        setLockedZLoc(null);
        setQuickQuote(null);
        setActiveBaseline(null);
      })
      .catch((err) => {
        console.error("Prism scope load failed", err);
        setTruth(null);
        setProposals([]);
      });
  }, [scopeVersion, searchRadiusFeet, activeBaseline]);

  useEffect(() => {
    if (!mapRef.current || !truth) return;

    const routePoints = normalizeGeometryPositionLines(truth.fullGeometry, truth.route).flatMap((line) => line);
    console.log("PRISM MAP fitBounds route length", routePoints.length);
    const stationPoints = (truth.stations || []).map(
      (s) => [s.lat, s.lon] as [number, number]
    );
    const campaignPoints = serviceabilityResults.map((site) => [site.lat, site.lon] as [number, number]);
    const all = [...routePoints, ...stationPoints, ...campaignPoints];

    if (all.length) {
      const bounds = L.latLngBounds(all);
      console.log("PRISM MAP fitBounds bounds", bounds);
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [truth, serviceabilityResults]);

  useEffect(() => {
    if (!selected || !mapRef.current) return;
    mapRef.current.setView([selected.lat, selected.lon], 14);
  }, [selected]);

  const routePositionLines = useMemo(() => {
    console.log("PRISM MAP POLYLINE truth.route length", truth?.route?.length ?? 0);
    const lines = normalizeGeometryPositionLines(truth?.fullGeometry, truth?.route);
    if (!lines.length) {
      console.log("PRISM MAP POLYLINE positions length", 0);
      return [];
    }
    console.log("PRISM MAP POLYLINE positions length", lines.reduce((total, line) => total + line.length, 0));
    console.log("PRISM MAP POLYLINE first rendered point lat/lon", lines[0]?.[0]);
    return lines;
  }, [truth]);

  const routePositions = useMemo(() => routePositionLines.flatMap((line) => line), [routePositionLines]);
  const activeBaselineIsGraph = activeBaseline?.datasetType === "BASELINE_GRAPH";
  const activeGraphDiagnostics = useMemo(
    () => (activeBaselineIsGraph ? graphDiagnostics(undefined, activeInventoryMetadata) : null),
    [activeBaselineIsGraph, activeInventoryMetadata]
  );
  const serviceabilityCandidates = useMemo(
    () => serviceabilityCandidatesFromResults(serviceabilityResults),
    [serviceabilityResults]
  );

  const activeList = useMemo(() => {
    if (mode === "quick_quote") {
      return quickQuote ? [quickQuote] : [];
    }
    return proposals;
  }, [mode, proposals, quickQuote]);

  const funnel = useMemo(() => buildFunnel(proposals), [proposals]);

  const totalRevenue = useMemo(
    () => proposals.reduce((sum, p) => sum + p.revenueMonthly, 0),
    [proposals]
  );

  const totalCapacity = useMemo(
    () => proposals.reduce((sum, p) => sum + p.capacity.effectiveLoadMbps, 0),
    [proposals]
  );

  const totalUpgradeContribution = useMemo(
    () =>
      proposals.reduce(
        (sum, p) => sum + p.backboneImpact.upgradeContributionMonthly,
        0
      ),
    [proposals]
  );

  const selectedServiceabilityResults = useMemo(
    () => serviceabilityResults.filter((result) => result.selected),
    [serviceabilityResults]
  );

  const serviceabilityCounts = useMemo(
    () =>
      serviceabilityResults.reduce(
        (acc, result) => {
          acc[result.serviceabilityClass] += 1;
          return acc;
        },
        { ON_NET: 0, NEAR_NET: 0, BUILD_REQUIRED: 0, OUT_OF_FOOTPRINT: 0 }
      ),
    [serviceabilityResults]
  );

  const runQuickQuote = async () => {
    if (activeBaselineIsGraph) {
      setCampaignStatus("Baseline graph mode uses serviceability against graph edges; quick quote does not create graph extensions yet.");
      return;
    }
    if (!scopeVersion || !truth || !lockedZLoc) return;
    const quote = await generateQuickQuote(
      scopeVersion,
      truth,
      lockedZLoc,
      quickQuoteProfile
    );
    setQuickQuote(quote);
    setSelected(quote);
  };

  const selectedBorderColor = (proposal: Proposal) => {
    if (proposal.constraintState === "blocked") return "#dc2626";
    if (proposal.constraintState === "constrained") return "#f59e0b";
    if (proposal.constraintState === "conditional") return "#eab308";
    if (proposal.constraintState === "unknown") return "#64748b";
    if (proposal.constraintState === "ready") return "#16a34a";
    return "#334155";
  };

  const handleRunSweep = async () => {
    setMode("sweep");
    setDraftZLoc(null);
    setLockedZLoc(null);
    setQuickQuote(null);
    setSelected(null);

    if (activeBaselineIsGraph) {
      setCampaignStatus("Baseline graph mode uses uploaded site campaigns for serviceability; sweep economics are disabled.");
      return;
    }

    if (!truth || !scopeVersion) return;

    console.log("Running LLM Sweep...");
    const targets = await runLLMSweep(truth, searchRadiusFeet);
    console.log("LLM Targets:", targets);

    const built = await Promise.all(
      targets.map(async (t: any, i: number) => {
        const rawTarget = {
          lat: Number(t.lat),
          lon: Number(t.lon),
        };

        if (!isFinite(rawTarget.lat) || !isFinite(rawTarget.lon)) return null;

        const streetTarget = await snapPoint(rawTarget);

        const distFromRoute = distanceFromRouteFeet(routePositions, streetTarget);
        if (distFromRoute < 750) {
        console.warn("Close to route — ACCEPTING");
        }

        // 🔥 DEFINE ANCHOR (this is what you are missing)
        const anchor = findNearestPointOnRoute(routePositions, streetTarget);
        if (!anchor) return null;

        const nearest = findNearestStation(truth.stations || [], streetTarget);
        if (!nearest) return null;

        const { station } = nearest;

        const routedRaw = await osrmRouteBetweenPoints(
            { lat: anchor.lat, lon: anchor.lon },
            { lat: streetTarget.lat, lon: streetTarget.lon }
            );

        console.log("ROUTE RAW:", routedRaw);

        const routedPath =
          Array.isArray(routedRaw) && routedRaw.length >= 2
            ? routedRaw
                .map((pt: any) => {
                  if (!Array.isArray(pt) || pt.length < 2) return null;

                  const a = Number(pt[0]);
                  const b = Number(pt[1]);

                  if (Math.abs(a) > 90) return [b, a] as [number, number];
                  return [a, b] as [number, number];
                })
                .filter(Boolean) as [number, number][]
            : [];

        const finalPath =
          routedPath.length >= 2
            ? routedPath
            : [
                [anchor.lat, anchor.lon],
                [streetTarget.lat, streetTarget.lon],
              ];

        console.log("FINAL PATH:", finalPath);

        const routedFeet = calcRouteFeetFromCoords(finalPath);

        const revenueMonthly = 1500;
        const buildCost = routedFeet * 10;
        const roi = revenueMonthly / Math.max(buildCost, 1);
        const paybackMonths = buildCost / Math.max(revenueMonthly, 1);
        const segmentRevenueMonthly = revenueMonthly * 2;
        const demandScore =
          typeof t.confidence === "number" ? t.confidence : 0.5;
        const sva = Number((roi * 50 + demandScore * 50).toFixed(2));

        const proposal: Proposal = {
          id: `LLM-${scopeVersion}-${i}`,
          scopeVersionId: scopeVersion,
          accountName: t.type
            ? `AI ${String(t.type).replace("_", " ")}`
            : "AI Target",
          address: `${streetTarget.lat.toFixed(5)}, ${streetTarget.lon.toFixed(5)}`,
          targetType: (t.type || "enterprise") as TargetProfileType,
          stationId: station.stationId,
          stationLabel: station.station || station.stationId,
          distanceFeet: routedFeet,
          serviceType: "DIA" as ServiceType,
          stage: "reachable" as OpportunityStage,
          recommendation: "review",
          revenueMonthly,
          buildCost,
          roi: isFinite(roi) ? roi : 0,
          paybackMonths: isFinite(paybackMonths) ? paybackMonths : 0,
          segmentRevenueMonthly,
          sva: isFinite(sva) ? sva : 0,
          lat: streetTarget.lat,
          lon: streetTarget.lon,
          routeGeometry: finalPath,
          capacity: {
            requiredMbps: 1000,
            concurrencyFactor: 1,
            effectiveLoadMbps: 1000,
          },
          backboneImpact: {
            percentCapacityUsed: 0,
            upgradeContributionMonthly: 0,
            monthsToUpgradeDelta: 0,
          },
          rationale:
            t.rationale || [
              "AI-discovered target",
              "Snapped to street",
              "Routed from nearest station",
            ],
          source: "sweep",
          constraintState: "unknown",
          constraintConfidence: "low",
        };

        return proposal;
      })
    );

    const next = built.filter((p): p is Proposal => p !== null);
    console.log("Converted Proposals:", next);
    setProposals(next);
  };

  const leftRailStyle: React.CSSProperties = {
    padding: 16,
    overflowY: "auto",
    borderRight: "1px solid rgba(148,163,184,0.15)",
    background: "linear-gradient(180deg, #071224 0%, #08162d 100%)",
  };

  const cardStyle: React.CSSProperties = {
    background: "#0b1220",
    borderRadius: 12,
    padding: 16,
    border: "1px solid rgba(148,163,184,0.12)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "360px minmax(0, 1fr)",
        position: "fixed",
        top: 50,
        left: 0,
        right: 0,
        height: "calc(100vh - 50px)",
        background: "#0b1220",
        color: "#e5eefc",
        zIndex: 1,
      }}
    >
      <aside style={leftRailStyle}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>StellaOS Prism</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: "#94a3b8" }}>
            Governance + Canonical Truth
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <ScopeSelector
            onSelect={(id) => {
              setActiveBaseline(null);
              setScopeVersion(id);
            }}
          />
        </div>

        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>FiberLight Campaign</div>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Account ID</label>
            <input
              value={campaignAccountId}
              onChange={(e) => setCampaignAccountId(e.target.value)}
              style={inputStyle}
            />

            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Carrier Network Inventory</label>
            <select
              value={selectedInventoryId}
              onChange={(e) => setSelectedInventoryId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select inventory</option>
              {baselineGraphInventory.map((inventory) => (
                <option key={inventory.inventoryId} value={inventory.inventoryId}>
                  {inventory.name} | {inventory.nodeCount.toLocaleString()} nodes | {inventory.edgeCount.toLocaleString()} edges |{" "}
                  {inventory.stationCount.toLocaleString()} stations
                </option>
              ))}
            </select>
            {selectedInventoryId && (
              <div style={smallLine}>
                {(() => {
                  const inventory = baselineGraphInventory.find((item) => item.inventoryId === selectedInventoryId);
                  if (!inventory) return "No inventory metadata selected.";
                  return `Inventory: ${inventory.inventoryId} | Nodes ${inventory.nodeCount.toLocaleString()} | Edges ${inventory.edgeCount.toLocaleString()} | Stations ${inventory.stationCount.toLocaleString()} | Imported ${
                    inventory.importedAt || "-"
                  }`;
                })()}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={() => void loadSelectedInventory()} style={primaryAction}>
                Load Inventory
              </button>
              <button type="button" onClick={() => void refreshBaselineGraphInventory()} style={secondaryAction}>
                Refresh Inventory
              </button>
            </div>

            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Legacy Carrier Network / Baseline Selector</label>
            <select
              value={selectedBaselineDatasetId}
              onChange={(e) => setSelectedBaselineDatasetId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select baseline</option>
              {storedBaselines.map((baseline) => (
                <option key={baseline.datasetId} value={baseline.datasetId}>
                  {baseline.name} [{baseline.datasetType}] ({baseline.accountId})
                  {baseline.routePointCount ? ` - ${baseline.routePointCount.toLocaleString()} pts` : ""}
                </option>
              ))}
            </select>
            {selectedBaselineDatasetId && (
              <div style={smallLine}>
                {(() => {
                  const baseline = storedBaselines.find((item) => item.datasetId === selectedBaselineDatasetId);
                  if (!baseline) return "No baseline metadata selected.";
                  return `Metadata: ${baseline.datasetId} | ${baseline.datasetType} | ${
                    baseline.routePointCount?.toLocaleString() ?? "geometry on demand"
                  } points`;
                })()}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={() => void loadSelectedBaseline()} style={primaryAction}>
                Load Geometry
              </button>
              <button type="button" onClick={() => void refreshStoredBaselines()} style={secondaryAction}>
                Refresh
              </button>
            </div>

            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Campaign Name</label>
            <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} style={inputStyle} />

            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Lateral Cost $/ft</label>
            <input
              type="number"
              min={0}
              step={1}
              value={lateralCostPerFoot}
              onChange={(e) => setLateralCostPerFoot(Math.max(0, Number(e.target.value || 0)))}
              style={inputStyle}
            />

            <label style={{ fontSize: 13, color: "#cbd5e1" }}>Target Sites</label>
            <input
              type="file"
              accept=".csv,.geojson,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleCampaignUpload(file);
                e.currentTarget.value = "";
              }}
            />

            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.45 }}>{campaignStatus}</div>

            {activeBaseline && (
              <div style={smallLine}>
                Baseline: {activeBaseline.name} | {activeBaseline.datasetType}
                {activeBaseline.datasetType === "BASELINE_GRAPH"
                  ? activeGraphDiagnostics
                    ? ` | ${activeGraphDiagnostics.nodeCount.toLocaleString()} nodes / ${activeGraphDiagnostics.edgeCount.toLocaleString()} edges`
                    : " | graph metadata pending"
                  : ` | ${activeBaseline.routeCoords.length.toLocaleString()} route points`}
              </div>
            )}

            {activeGraphDiagnostics && (
              <div style={{ background: "#111827", border: "1px solid #334155", borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800, color: "#e2e8f0" }}>Graph Diagnostics</div>
                <MetricChip label="Inventory Name" value={activeGraphDiagnostics.inventoryName} />
                <MetricChip label="Node Count" value={activeGraphDiagnostics.nodeCount.toLocaleString()} />
                <MetricChip label="Edge Count" value={activeGraphDiagnostics.edgeCount.toLocaleString()} />
                <MetricChip label="Station Count" value={activeGraphDiagnostics.stationCount.toLocaleString()} />
                <MetricChip label="Route Miles" value={activeGraphDiagnostics.routeMiles.toFixed(2)} />
                <MetricChip label="Connected Components" value={activeGraphDiagnostics.connectedComponents.toLocaleString()} />
                <MetricChip label="Longest Route" value={`${activeGraphDiagnostics.longestRouteMiles.toFixed(2)} mi`} />
                <MetricChip label="Imported Date" value={activeGraphDiagnostics.importedAt || "-"} />
              </div>
            )}

            {activeCampaign && (
              <div style={{ display: "grid", gap: 6 }}>
                <MetricChip label="Campaign Sites" value={String(serviceabilityResults.length)} />
                <MetricChip label="Serviceability Candidates" value={String(serviceabilityCandidates.length)} />
                <MetricChip label="Selected" value={String(selectedServiceabilityResults.length)} />
                <MetricChip label="Opportunity Seeds" value={String(opportunitySeeds.length)} />
                <div style={smallLine}>
                  ON {serviceabilityCounts.ON_NET} | NEAR {serviceabilityCounts.NEAR_NET} | BUILD{" "}
                  {serviceabilityCounts.BUILD_REQUIRED} | OUT {serviceabilityCounts.OUT_OF_FOOTPRINT}
                </div>
                {selectedServiceabilityResults.length > 50 && (
                  <div style={{ color: "#fbbf24", fontSize: 12 }}>
                    Selected batch exceeds 50 sites. Consider a smaller batch.
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => selectClass("ON_NET")} style={secondaryAction}>
                    ON_NET
                  </button>
                  <button type="button" onClick={() => selectClass("NEAR_NET")} style={secondaryAction}>
                    NEAR_NET
                  </button>
                  <button type="button" onClick={() => selectClass("ON_NET", "NEAR_NET")} style={secondaryAction}>
                    ON + NEAR
                  </button>
                  <button type="button" onClick={() => selectTop(10)} style={secondaryAction}>
                    Top 10
                  </button>
                  <button type="button" onClick={() => selectTop(25)} style={secondaryAction}>
                    Top 25
                  </button>
                  <button type="button" onClick={() => selectTop(50)} style={secondaryAction}>
                    Top 50
                  </button>
                  <button type="button" onClick={() => updateServiceabilitySelection(() => false)} style={ghostAction}>
                    Clear
                  </button>
                  {activeBaselineIsGraph && (
                    <button type="button" onClick={createOpportunitySeedsFromSelected} style={secondaryAction}>
                      Create Seeds
                    </button>
                  )}
                </div>
                {activeBaselineIsGraph ? (
                  <div style={smallLine}>
                    Baseline Graph mode creates Opportunity Seeds only. No Design route, BOM, budget, or economics is generated in this phase.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button type="button" onClick={createOpportunityBatch} style={secondaryAction}>
                      Create Batch
                    </button>
                    <button type="button" onClick={sendBatchToDesign} style={primaryAction}>
                      Send to Design
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!scopeVersion && (
          <div style={{ color: "#cbd5e1" }}>
            Select an approved scopeVersion to begin.
          </div>
        )}

        {truth && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={cardStyle}>
              <div style={{ display: "grid", gap: 10 }}>
                <MetricChip label="Approved Scope" value={scopeVersion || "—"} />
                <MetricChip label="Targets" value={String(proposals.length)} />
                <MetricChip label="Revenue Impact" value={fmtMoney(totalRevenue)} />
                <MetricChip
                  label="Capacity Load"
                  value={`${Math.round(totalCapacity).toLocaleString()} Mbps`}
                />
                <MetricChip
                  label="Upgrade Contribution"
                  value={`${fmtMoney(totalUpgradeContribution)}/mo`}
                />
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Controls</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={handleRunSweep}
                  style={mode === "sweep" ? primaryAction : secondaryAction}
                  disabled={activeBaselineIsGraph}
                >
                  Sweep
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("quick_quote");
                    setSelected(null);
                  }}
                  style={mode === "quick_quote" ? primaryAction : secondaryAction}
                >
                  Quick Quote
                </button>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <button
                  onClick={() => setSnapEnabled((prev) => !prev)}
                  style={{
                    padding: "8px 10px",
                    background: snapEnabled ? "#16a34a" : "#334155",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Snap: {snapEnabled ? "ON" : "OFF"}
                </button>

                <label style={{ fontSize: 13, color: "#cbd5e1" }}>Network Type</label>
                <select
                  value={networkType}
                  onChange={(e) =>
                    setNetworkType(e.target.value as "metro" | "middle" | "longhaul")
                  }
                  style={inputStyle}
                >
                  <option value="metro">Metro</option>
                  <option value="middle">Middle Mile</option>
                  <option value="longhaul">Longhaul</option>
                </select>

                <label style={{ fontSize: 13, color: "#cbd5e1" }}>
                  Search Radius (ft): {searchRadiusFeet.toLocaleString()}
                </label>
                <input
                  type="range"
                  min={1000}
                  max={20000}
                  step={500}
                  value={searchRadiusFeet}
                  onChange={(e) => setSearchRadiusFeet(Number(e.target.value))}
                />

                {mode === "quick_quote" && (
                  <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                    <label style={{ fontSize: 13, color: "#cbd5e1" }}>Target Profile</label>
                    <select
                      value={quickQuoteProfile}
                      onChange={(e) =>
                        setQuickQuoteProfile(e.target.value as TargetProfileType)
                      }
                      style={inputStyle}
                    >
                      {PROFILE_ORDER.map((p) => (
                        <option key={p} value={p}>
                          {TARGET_PROFILES[p].label}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (draftZLoc) setLockedZLoc(draftZLoc);
                        }}
                        style={secondaryAction}
                        disabled={!draftZLoc}
                      >
                        Lock Z
                      </button>

                      <button
                        type="button"
                        onClick={runQuickQuote}
                        style={primaryAction}
                        disabled={!lockedZLoc || activeBaselineIsGraph}
                      >
                        Run Quick Quote
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraftZLoc(null);
                          setLockedZLoc(null);
                          setQuickQuote(null);
                          setSelected(null);
                        }}
                        style={ghostAction}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Prism Chat</div>

              <div
                style={{
                  background: "#020617",
                  border: "1px solid #1e293b",
                  borderRadius: 8,
                  padding: 8,
                  height: 180,
                  overflowY: "auto",
                  marginBottom: 8,
                  color: "white",
                  fontSize: 12,
                }}
              >
                {chatHistory.map((m, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <b style={{ color: m.role === "user" ? "#38bdf8" : "#22c55e" }}>
                      {m.role === "user" ? "You" : "Prism"}:
                    </b>{" "}
                    {m.content}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{ flex: 1, ...inputStyle }}
                  placeholder="Ask Prism anything..."
                />
                <button style={primaryAction} onClick={handleChatSend}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) 360px",
          gap: 16,
          padding: 16,
          minHeight: 0,
        }}
      >
        <div style={{ ...cardStyle, padding: 10, minHeight: 0 }}>
          <MapContainer
            center={[37, -95]}
            zoom={5}
            style={{ height: "100%", width: "100%", minHeight: 500, borderRadius: 10 }}
            whenReady={(e) => {
              mapRef.current = e.target;
            }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            <MapClickCapture
              enabled={mode === "quick_quote"}
              snapEnabled={snapEnabled}
              onMapClick={(lat, lon) => setDraftZLoc({ lat, lon })}
            />

            {routePositionLines.map((positions, index) => (
              <Polyline key={`baseline-line-${index}`} positions={positions} color={activeBaselineIsGraph ? "#06b6d4" : "#2563eb"} weight={4} />
            ))}

            {serviceabilityResults
              .filter((site) => site.selected && site.nearestRoutePoint)
              .map((site) => (
                <Polyline
                  key={`lateral-${site.siteId}`}
                  positions={[
                    [site.lat, site.lon],
                    [site.nearestRoutePoint![1], site.nearestRoutePoint![0]],
                  ]}
                  pathOptions={{
                    color: "#f59e0b",
                    weight: 2,
                    opacity: 0.8,
                    dashArray: "5,5",
                  }}
                />
              ))}

            {serviceabilityResults.map((site) => (
              <CircleMarker
                key={site.siteId}
                center={[site.lat, site.lon]}
                radius={site.selected ? 8 : 5}
                pathOptions={{
                  color: activeBaselineIsGraph || site.selected ? "#ffffff" : serviceabilityColor(site),
                  weight: site.selected ? 3 : 1,
                  fillColor: serviceabilityColor(site),
                  fillOpacity: site.selected ? 0.95 : 0.72,
                }}
                eventHandlers={{
                  click: () => {
                    setLatestBatch(null);
                    setServiceabilityResults((prev) =>
                      prev.map((result) =>
                        result.siteId === site.siteId ? { ...result, selected: !result.selected } : result
                      )
                    );
                  },
                }}
              >
                <Popup>
                  <div>
                    <div style={{ fontWeight: 700 }}>{site.name || site.siteId}</div>
                    <div>{site.serviceabilityClass}</div>
                    <div>{site.distanceToNetworkFeet?.toLocaleString() ?? "-"} ft to network</div>
                    {site.nearestGraphEdgeId && <div>Edge: {site.nearestGraphEdgeId}</div>}
                    {site.nearestGraphNodeId && <div>Node: {site.nearestGraphNodeId}</div>}
                    <div>{site.estimatedLateralCost === null ? "-" : fmtMoney(site.estimatedLateralCost ?? 0)} lateral</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {(truth?.stations || []).map((s) => (
              <Marker key={s.stationId} position={[s.lat, s.lon]}>
                <Popup>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.station || s.stationId}</div>
                    <div>{s.stationId}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {mode === "quick_quote" &&
              isValidLatLon(draftZLoc?.lat, draftZLoc?.lon) &&
              draftZLoc && (
                <Marker position={[draftZLoc.lat, draftZLoc.lon]}>
                  <Popup>Draft Z Loc</Popup>
                </Marker>
              )}

            {lockedZLoc && mode === "quick_quote" && (
              <Marker position={[lockedZLoc.lat, lockedZLoc.lon]}>
                <Popup>Locked Z Loc</Popup>
              </Marker>
            )}

            {proposals.map((p) =>
              Array.isArray(p.routeGeometry) && p.routeGeometry.length >= 2 ? (
                <Polyline
                  key={`route-${p.id}`}
                  positions={p.routeGeometry.filter(
                    (pt) => Array.isArray(pt) && pt.length === 2
                  )}
                  pathOptions={{
                    color: "#ff0000",
                    weight: 6,
                    opacity: 1,
                    dashArray: "8,6",
                  }}
                />
              ) : null
            )}

            {selected?.lat !== undefined && selected?.lon !== undefined && (
              <>
                <Marker position={[selected.lat, selected.lon]}>
                  <Popup>
                    <div>
                      <div style={{ fontWeight: 700 }}>{selected.accountName}</div>
                      <div>{selected.address}</div>
                      <div>{selected.stationId}</div>
                    </div>
                  </Popup>
                </Marker>

                {selected.routeGeometry?.length > 1 && (
                  <Polyline
                    positions={selected.routeGeometry.filter(
                      (p) => Array.isArray(p) && p.length === 2
                    )}
                    color="#f59e0b"
                    weight={5}
                    opacity={0.95}
                    dashArray="6,4"
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateRows: "auto 1fr",
            gap: 16,
            minHeight: 0,
          }}
        >
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, marginBottom: 10, color: "#fff" }}>Funnel</h3>

            <div style={{ display: "grid", gap: 8 }}>
              {funnel
                .filter((b) => b.count > 0)
                .map((bucket) => (
                  <div
                    key={bucket.stage}
                    style={{
                      background: "#111827",
                      borderRadius: 8,
                      padding: 10,
                      color: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{bucket.stage}</div>
                    <div style={smallLine}>Count: {bucket.count}</div>
                    <div style={smallLine}>
                      Revenue: {fmtMoney(bucket.totalMonthlyRevenue)}
                    </div>
                    <div style={smallLine}>Avg ROI: {bucket.avgROI.toFixed(2)}</div>
                    <div style={smallLine}>Avg SVA: {bucket.avgSVA.toFixed(2)}</div>
                  </div>
                ))}
            </div>
          </div>

          <div style={{ ...cardStyle, overflowY: "auto", minHeight: 0 }}>
            <h3 style={{ marginTop: 0, color: "#fff" }}>
              {activeCampaign ? "Site Campaign" : mode === "quick_quote" ? "Quick Quote" : "Ranked Opportunities"}
            </h3>

            {activeCampaign && (
              <div style={{ display: "grid", gap: 10 }}>
                {serviceabilityResults.map((result) => (
                  <label
                    key={result.siteId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: 10,
                      alignItems: "start",
                      background: "#111827",
                      padding: 12,
                      borderRadius: 10,
                      border: `1px solid ${result.selected ? "#ffffff" : serviceabilityColor(result)}`,
                      color: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={result.selected}
                      onChange={(e) => {
                        setLatestBatch(null);
                        setServiceabilityResults((prev) =>
                          prev.map((item) =>
                            item.siteId === result.siteId ? { ...item, selected: e.target.checked } : item
                          )
                        );
                      }}
                    />
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <b>{result.name || result.siteId}</b>
                        <span style={{ color: serviceabilityColor(result), fontWeight: 700 }}>
                          {result.serviceabilityClass}
                        </span>
                      </div>
                      <div style={smallLine}>
                        {result.lat.toFixed(5)}, {result.lon.toFixed(5)}
                      </div>
                      <div style={smallLine}>
                        Distance: {result.distanceToNetworkFeet?.toLocaleString() ?? "-"} ft | Lateral:{" "}
                        {result.estimatedLateralCost === null ? "-" : fmtMoney(result.estimatedLateralCost ?? 0)}
                      </div>
                      <div style={smallLine}>
                        Nearest station: {result.nearestStation ?? "-"} | Confidence: {result.confidence}
                      </div>
                      {result.nearestGraphEdgeId && (
                        <div style={smallLine}>
                          Graph edge: {result.nearestGraphEdgeId} | Graph node: {result.nearestGraphNodeId ?? "-"}
                        </div>
                      )}
                      {activeBaselineIsGraph && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            createOpportunitySeed(result);
                          }}
                          style={{ ...ghostAction, marginTop: 8 }}
                        >
                          Create Seed
                        </button>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {!activeCampaign && activeList.length === 0 && (
              <div style={{ color: "#cbd5e1" }}>
                {mode === "quick_quote"
                  ? "Click the map, lock Z, then run quick quote."
                  : "No qualified opportunities for this approved scopeVersion."}
              </div>
            )}

            {!activeCampaign && activeList.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "#111827",
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 12,
                  border: `1px solid ${selectedBorderColor(p)}`,
                  color: "#fff",
                }}
              >
                <div style={{ fontWeight: 700 }}>{p.accountName}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{p.address}</div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                  {p.stationId} • {Math.round(p.distanceFeet).toLocaleString()} ft •{" "}
                  {p.serviceType}
                </div>

                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div>Revenue: {fmtMoney(p.revenueMonthly)}/mo</div>
                  <div>Cost: {fmtMoney(p.buildCost)}</div>
                  <div>ROI: {p.roi.toFixed(2)}</div>
                  <div>Payback: {p.paybackMonths.toFixed(2)} mo</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div>Segment Revenue: {fmtMoney(p.segmentRevenueMonthly)}/mo</div>
                  <div>SVA: {p.sva.toFixed(2)}</div>
                  <div>Recommendation: {p.recommendation}</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Backbone Impact</div>
                  <div>
                    Capacity: {Math.round(p.capacity.effectiveLoadMbps).toLocaleString()} Mbps
                  </div>
                  <div>
                    Load Impact: {(p.backboneImpact.percentCapacityUsed * 100).toFixed(2)}%
                  </div>
                  <div>
                    Upgrade Contribution: {fmtMoney(p.backboneImpact.upgradeContributionMonthly)}/mo
                  </div>
                  <div>
                    Upgrade Horizon Signal: {p.backboneImpact.monthsToUpgradeDelta.toFixed(1)} yrs
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                  {p.rationale.join(" | ")}
                </div>

                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div>Constraint State: {p.constraintState}</div>
                  <div>Confidence: {p.constraintConfidence}</div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 12,
                  }}
                >
                  <button
                    onClick={() => {
                      setSelected(p);
                      if (mapRef.current) {
                        mapRef.current.setView([p.lat, p.lon], 18);
                      }
                    }}
                    style={{
                      flex: 1,
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    View
                  </button>

                  <button
                    onClick={() => {
                      console.log("FORMALIZE OPPORTUNITY", p);
                      void persistEdge(p, p.scopeVersionId);
                    }}
                    style={{
                      flex: 1,
                      background: "#0f172a",
                      color: "#fff",
                      border: "1px solid #475569",
                      borderRadius: 8,
                      padding: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Formalize
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
