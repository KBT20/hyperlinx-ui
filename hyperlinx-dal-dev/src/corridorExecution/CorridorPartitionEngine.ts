import { simplifyGeometryForZoom } from "../performance/MapVirtualization";
import type { DALCoordinate } from "../types/dal";
import type {
  CorridorBreakpoint,
  CorridorBreakpointType,
  CorridorCacheKeyInput,
  CorridorSegment,
} from "./CorridorExecutionTypes";

export const PREFERRED_SEGMENT_MILES = 25;
export const MAX_SEGMENT_MILES = 50;
export const CORRIDOR_BREAKPOINT_PRIORITY: CorridorBreakpointType[] = [
  "POP",
  "ILA_BOUNDARY",
  "BOOKEND",
  "CONSTRUCTION_METHOD_CHANGE",
  "MUNICIPALITY",
  "COUNTY",
  "STATE",
  "OPERATOR_BREAKPOINT",
];

const FEET_PER_MILE = 5280;
const EARTH_RADIUS_FEET = 20925524.9;

export function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `H${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function geometryHash(geometry: DALCoordinate[]) {
  if (geometry.length < 2) return "missing";
  const sampleStep = Math.max(1, Math.ceil(geometry.length / 1000));
  const sampled = geometry
    .filter((_, index) => index === 0 || index === geometry.length - 1 || index % sampleStep === 0)
    .map(([lon, lat]) => `${round(lon, 6)},${round(lat, 6)}`)
    .join("|");
  return stableHash(`${geometry.length}:${sampled}`);
}

export function buildCorridorCacheKey(input: CorridorCacheKeyInput) {
  return [
    `customerTwinId=${input.customerTwinId}`,
    `customerId=${input.customerId}`,
    `corridorId=${input.corridorId}`,
    `importHash=${input.importHash}`,
    `geometryHash=${input.geometryHash}`,
    `segmentHash=${input.segmentHash}`,
    `workbookHash=${input.workbookHash}`,
  ].join("|");
}

export function feetBetween(a: DALCoordinate, b: DALCoordinate) {
  const lon1 = degreesToRadians(a[0]);
  const lat1 = degreesToRadians(a[1]);
  const lon2 = degreesToRadians(b[0]);
  const lat2 = degreesToRadians(b[1]);
  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const haversine = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_FEET * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function corridorLengthFeet(geometry: DALCoordinate[]) {
  return geometry.reduce((total, coordinate, index) => {
    if (index === 0) return total;
    return total + feetBetween(geometry[index - 1]!, coordinate);
  }, 0);
}

export function partitionCorridor(input: {
  corridorId: string;
  customerId: string;
  customerTwinId: string;
  importHash: string;
  workbookHash: string;
  geometry: DALCoordinate[];
  breakpoints?: CorridorBreakpoint[];
}) {
  const startedAt = nowMs();
  const geometry = input.geometry.filter(isCoordinate);
  if (geometry.length < 2) {
    return {
      segments: [] as CorridorSegment[],
      geometryHash: "missing",
      segmentHash: "missing",
      partitionTimeMs: Math.round((nowMs() - startedAt) * 100) / 100,
    };
  }

  const routeGeometryHash = geometryHash(geometry);
  const segmentGeometrySlices = sliceCorridorByDistanceAndBreakpoints(geometry, input.breakpoints ?? []);
  const segmentHash = stableHash(segmentGeometrySlices.map((slice) => `${slice.sequence}:${slice.startStation}:${slice.endStation}:${slice.geometry.length}`).join("|"));
  const segments = segmentGeometrySlices.map((slice) => {
    const segmentGeometryHash = geometryHash(slice.geometry);
    const cacheKey = buildCorridorCacheKey({
      customerTwinId: input.customerTwinId,
      customerId: input.customerId,
      corridorId: input.corridorId,
      importHash: input.importHash,
      geometryHash: routeGeometryHash,
      segmentHash: segmentGeometryHash,
      workbookHash: input.workbookHash,
    });
    const startCoordinate = slice.geometry[0]!;
    const endCoordinate = slice.geometry.at(-1) ?? startCoordinate;
    return emptySegment({
      corridorId: input.corridorId,
      sequence: slice.sequence,
      startStation: slice.startStation,
      endStation: slice.endStation,
      startCoordinate,
      endCoordinate,
      geometry: slice.geometry,
      geometryHash: segmentGeometryHash,
      cacheKey,
    });
  });

  return {
    segments,
    geometryHash: routeGeometryHash,
    segmentHash,
    partitionTimeMs: Math.round((nowMs() - startedAt) * 100) / 100,
  };
}

function sliceCorridorByDistanceAndBreakpoints(geometry: DALCoordinate[], breakpoints: CorridorBreakpoint[]) {
  const slices: Array<{ sequence: number; startStation: number; endStation: number; geometry: DALCoordinate[] }> = [];
  const preferredFeet = PREFERRED_SEGMENT_MILES * FEET_PER_MILE;
  const maxFeet = MAX_SEGMENT_MILES * FEET_PER_MILE;
  let sequence = 1;
  let currentGeometry: DALCoordinate[] = [geometry[0]!];
  let currentStartStation = 0;
  let currentStation = 0;
  let segmentStartStation = 0;

  for (let index = 1; index < geometry.length; index += 1) {
    const coordinate = geometry[index]!;
    currentStation += feetBetween(geometry[index - 1]!, coordinate);
    currentGeometry.push(coordinate);
    const currentLength = currentStation - segmentStartStation;
    const mustBreak = currentLength >= maxFeet;
    const canBreakAtPreferred = currentLength >= preferredFeet && isDeterministicBreakpoint(currentStation, breakpoints);
    const canBreakByDistance = currentLength >= preferredFeet && currentGeometry.length > 2;
    if ((mustBreak || canBreakAtPreferred || canBreakByDistance) && index < geometry.length - 1) {
      slices.push({
        sequence,
        startStation: currentStartStation,
        endStation: currentStation,
        geometry: currentGeometry,
      });
      sequence += 1;
      currentGeometry = [coordinate];
      currentStartStation = currentStation;
      segmentStartStation = currentStation;
    }
  }

  if (currentGeometry.length >= 2) {
    slices.push({
      sequence,
      startStation: currentStartStation,
      endStation: currentStation,
      geometry: currentGeometry,
    });
  }
  return slices;
}

function isDeterministicBreakpoint(stationFeet: number, breakpoints: CorridorBreakpoint[]) {
  return breakpoints.some((breakpoint) => {
    if (!CORRIDOR_BREAKPOINT_PRIORITY.includes(breakpoint.type)) return false;
    return Math.abs(breakpoint.stationFeet - stationFeet) < 1000;
  });
}

function emptySegment(input: {
  corridorId: string;
  sequence: number;
  startStation: number;
  endStation: number;
  startCoordinate: DALCoordinate;
  endCoordinate: DALCoordinate;
  geometry: DALCoordinate[];
  geometryHash: string;
  cacheKey: string;
}): CorridorSegment {
  const lengthFeet = Math.max(0, input.endStation - input.startStation);
  const segmentId = `${input.corridorId}:SEG-${String(input.sequence).padStart(4, "0")}`;
  return {
    segmentId,
    corridorId: input.corridorId,
    sequence: input.sequence,
    startStation: round(input.startStation, 2),
    endStation: round(input.endStation, 2),
    startNode: {
      nodeId: `${segmentId}:START`,
      coordinate: input.startCoordinate,
      stationFeet: round(input.startStation, 2),
    },
    endNode: {
      nodeId: `${segmentId}:END`,
      coordinate: input.endCoordinate,
      stationFeet: round(input.endStation, 2),
    },
    lengthFeet: round(lengthFeet, 2),
    lengthMiles: round(lengthFeet / FEET_PER_MILE, 3),
    geometryHash: input.geometryHash,
    simplifiedGeometry: simplifyGeometryForZoom(input.geometry, 10),
    visibleGeometry: simplifyGeometryForZoom(input.geometry, 10),
    constructionSummary: {
      dominantMethod: "UNKNOWN",
      plowFeet: 0,
      boreFeet: 0,
      trenchFeet: 0,
      rockFeet: 0,
      unknownFeet: round(lengthFeet, 2),
    },
    materialSummary: {
      conduitFeet: 0,
      fiberFeet: 0,
      handholes: 0,
      vaults: 0,
      spliceCases: 0,
    },
    laborSummary: {
      laborCost: 0,
      productionDays: 0,
      primaryCrew: "UNASSIGNED",
    },
    costSummary: {
      constructionCost: 0,
      materialCost: 0,
      laborCost: 0,
      engineeringCost: 0,
      permitCost: 0,
      contingencyCost: 0,
      totalCost: 0,
    },
    stationSummary: {
      stationCount: Math.max(2, Math.ceil(lengthFeet / FEET_PER_MILE) + 1),
      firstStation: round(input.startStation, 2),
      lastStation: round(input.endStation, 2),
      stationIntervalFeet: FEET_PER_MILE,
    },
    ILASummary: {
      ilaCount: 0,
      candidateCount: 0,
      affectedSpanIds: [],
    },
    bookendSummary: {
      bookendCount: 0,
    },
    constraintSummary: {
      municipalityCount: 0,
      countyCount: 0,
      stateCount: 0,
      constructionMethodChanges: 0,
      operatorBreakpoints: 0,
    },
    riskSummary: {
      unknownCount: 1,
      confidenceScore: 50,
      warnings: ["Segment awaits worker summary."],
    },
    validationState: "WARNING",
    buildStatus: "PENDING",
    checkpointId: null,
    cacheKey: input.cacheKey,
  };
}

function degreesToRadians(value: number) {
  return value * (Math.PI / 180);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isCoordinate(value: DALCoordinate | undefined): value is DALCoordinate {
  return Array.isArray(value) && Number.isFinite(value[0]) && Number.isFinite(value[1]);
}
