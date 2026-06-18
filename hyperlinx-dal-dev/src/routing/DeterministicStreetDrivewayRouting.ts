import { haversineFeet } from "../affinity/geo";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate } from "../types/dal";
import type { StreetCenterline } from "../street/streetTypes";

export type DeterministicRoutingMode = "REFERENCE_CENTERLINE_ROUTING" | "DETERMINISTIC_STREET_DRIVEWAY" | "DIRECT_FALLBACK";
export type DeterministicRoutingClassification = "CENTERLINE_ASSISTED" | "STREET_DRIVEWAY_DETERMINISTIC" | "DIRECT_SEGMENT_FALLBACK";

export type DeterministicSiteRouteResult = {
  geometry: DALCoordinate[];
  distanceFeet: number;
  routingMode: DeterministicRoutingMode;
  routingClassification: DeterministicRoutingClassification;
  pathConfidence: "LOW" | "MEDIUM" | "HIGH";
  confidence: number;
  roadSegmentCount: number;
  roadNamesTraversed: string[];
  roadClassesTraversed: string[];
  attachmentMethod: "CERTIFIED_FIBER_ATTACHMENT" | "STATION_CONNECTION" | "DIRECT_FALLBACK_ATTACHMENT";
  missingDependencies: Array<"road graph" | "centerline dataset" | "routing engine" | "street topology index">;
  accessPoints: {
    buildingEntrance?: DALCoordinate;
    drivewayAccess?: DALCoordinate;
    parkingAccess?: DALCoordinate;
    roadAccess?: DALCoordinate;
    streetSnap?: DALCoordinate;
    stationConnection?: DALCoordinate;
  };
};

type ProjectedStreetPoint = {
  street: StreetCenterline;
  coordinate: DALCoordinate;
  distanceFeet: number;
  segmentIndex: number;
};

const FEET_PER_DEGREE_LAT = 364000;

function validCoordinate(coordinate?: DALCoordinate | null): coordinate is DALCoordinate {
  return Array.isArray(coordinate) && Number.isFinite(Number(coordinate[0])) && Number.isFinite(Number(coordinate[1]));
}

function feetPerDegreeLon(lat: number) {
  return Math.max(1, Math.cos((lat * Math.PI) / 180) * FEET_PER_DEGREE_LAT);
}

function moveToward(start: DALCoordinate, end: DALCoordinate, distanceFeet: number): DALCoordinate {
  const total = haversineFeet(start, end);
  if (!Number.isFinite(total) || total <= 1) return start;
  const ratio = Math.max(0, Math.min(1, distanceFeet / total));
  return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
}

function projectPointToSegment(target: DALCoordinate, start: DALCoordinate, end: DALCoordinate) {
  const centerLat = (target[1] + start[1] + end[1]) / 3;
  const fx = feetPerDegreeLon(centerLat);
  const point = { x: target[0] * fx, y: target[1] * FEET_PER_DEGREE_LAT };
  const a = { x: start[0] * fx, y: start[1] * FEET_PER_DEGREE_LAT };
  const b = { x: end[0] * fx, y: end[1] * FEET_PER_DEGREE_LAT };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  const coordinate: DALCoordinate = [(a.x + dx * t) / fx, (a.y + dy * t) / FEET_PER_DEGREE_LAT];
  return { coordinate, distanceFeet: haversineFeet(target, coordinate) };
}

function nearestPointOnStreet(point: DALCoordinate, street: StreetCenterline): ProjectedStreetPoint | null {
  let best: ProjectedStreetPoint | null = null;
  for (let index = 1; index < street.geometry.length; index += 1) {
    const start = street.geometry[index - 1];
    const end = street.geometry[index];
    if (!validCoordinate(start) || !validCoordinate(end)) continue;
    const projected = projectPointToSegment(point, start, end);
    if (!best || projected.distanceFeet < best.distanceFeet) {
      best = { street, coordinate: projected.coordinate, distanceFeet: projected.distanceFeet, segmentIndex: index - 1 };
    }
  }
  return best;
}

function nearestStreet(point: DALCoordinate, streets: StreetCenterline[] = []) {
  return streets
    .map((street) => nearestPointOnStreet(point, street))
    .filter((item): item is ProjectedStreetPoint => Boolean(item))
    .sort((a, b) => a.distanceFeet - b.distanceFeet)[0];
}

function streetSubpath(start: ProjectedStreetPoint, end: ProjectedStreetPoint): DALCoordinate[] {
  if (start.street.streetId !== end.street.streetId) return [start.coordinate, end.coordinate];
  const coordinates = start.street.geometry.filter(validCoordinate);
  if (!coordinates.length) return [start.coordinate, end.coordinate];
  if (start.segmentIndex <= end.segmentIndex) {
    return [start.coordinate, ...coordinates.slice(start.segmentIndex + 1, end.segmentIndex + 1), end.coordinate];
  }
  return [start.coordinate, ...coordinates.slice(end.segmentIndex + 1, start.segmentIndex + 1).reverse(), end.coordinate];
}

function deterministicRoadAccess(candidate: DALCoordinate, attachment: DALCoordinate): DALCoordinate {
  const grid = 0.00045;
  const horizontal: DALCoordinate = [Math.round(candidate[0] / grid) * grid, candidate[1]];
  const vertical: DALCoordinate = [candidate[0], Math.round(candidate[1] / grid) * grid];
  const horizontalTowardAttachment = haversineFeet(horizontal, attachment) <= haversineFeet(vertical, attachment);
  return horizontalTowardAttachment ? horizontal : vertical;
}

function deterministicStreetPath(start: DALCoordinate, end: DALCoordinate, variant = "primary"): DALCoordinate[] {
  const lonDelta = end[0] - start[0];
  const latDelta = end[1] - start[1];
  const bias = Math.abs(lonDelta) >= Math.abs(latDelta) ? "EW" : "NS";
  const offsetSign = variant.includes("avoid") || variant.includes("utility") ? -1 : 1;
  const offset = Math.min(0.0028, Math.max(0.00035, (Math.abs(lonDelta) + Math.abs(latDelta)) * 0.08)) * offsetSign;
  if (bias === "EW") {
    const corridorLat = start[1] + offset;
    return [start, [start[0], corridorLat], [end[0], corridorLat], end];
  }
  const corridorLon = start[0] + offset;
  return [start, [corridorLon, start[1]], [corridorLon, end[1]], end];
}

function centerlinePath(candidateStreet: ProjectedStreetPoint, attachmentStreet: ProjectedStreetPoint): DALCoordinate[] {
  if (candidateStreet.street.streetId === attachmentStreet.street.streetId) return streetSubpath(candidateStreet, attachmentStreet);
  const candidateEnd =
    haversineFeet(candidateStreet.street.geometry[0], attachmentStreet.coordinate) <
    haversineFeet(candidateStreet.street.geometry[candidateStreet.street.geometry.length - 1], attachmentStreet.coordinate)
      ? candidateStreet.street.geometry[0]
      : candidateStreet.street.geometry[candidateStreet.street.geometry.length - 1];
  const attachmentEnd =
    haversineFeet(attachmentStreet.street.geometry[0], candidateEnd) <
    haversineFeet(attachmentStreet.street.geometry[attachmentStreet.street.geometry.length - 1], candidateEnd)
      ? attachmentStreet.street.geometry[0]
      : attachmentStreet.street.geometry[attachmentStreet.street.geometry.length - 1];
  const connector = deterministicStreetPath(candidateEnd, attachmentEnd, "centerline-connector");
  return [candidateStreet.coordinate, candidateEnd, ...connector.slice(1, -1), attachmentEnd, attachmentStreet.coordinate];
}

function uniqueCoordinates(coordinates: DALCoordinate[]) {
  const result: DALCoordinate[] = [];
  for (const coordinate of coordinates) {
    if (!validCoordinate(coordinate)) continue;
    const previous = result[result.length - 1];
    if (previous && haversineFeet(previous, coordinate) < 6) continue;
    result.push([coordinate[0], coordinate[1]]);
  }
  return result;
}

function pathLengthFeet(geometry: DALCoordinate[]) {
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) total += haversineFeet(geometry[index - 1], geometry[index]);
  return Math.round(total);
}

function namesFor(streets: Array<StreetCenterline | undefined>, deterministic: boolean) {
  const names = streets
    .map((street) => street?.streetName)
    .filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
  return Array.from(new Set([...(deterministic ? ["Building entrance", "Driveway access", "Parking access lane", "Deterministic local street"] : []), ...names]));
}

function classesFor(streets: Array<StreetCenterline | undefined>, deterministic: boolean) {
  const classes = streets
    .map((street) => street?.streetClass)
    .filter((name): name is StreetCenterline["streetClass"] => typeof name === "string" && Boolean(name.trim()));
  return Array.from(new Set([...(deterministic ? ["Building Entrance", "Driveway", "Parking Access", "Local"] : []), ...classes]));
}

export function buildDeterministicStreetDrivewayRoute(args: {
  candidateCoordinate: DALCoordinate;
  attachmentCoordinate: DALCoordinate;
  stationCoordinate?: DALCoordinate;
  streetCenterlines?: StreetCenterline[];
  site?: Pick<CandidateSite, "candidateId" | "companyName" | "address" | "city">;
  variant?: string;
}): DeterministicSiteRouteResult {
  const candidate = args.candidateCoordinate;
  const attachment = args.attachmentCoordinate;
  if (!validCoordinate(candidate) || !validCoordinate(attachment)) {
    return {
      geometry: [],
      distanceFeet: 0,
      routingMode: "DIRECT_FALLBACK",
      routingClassification: "DIRECT_SEGMENT_FALLBACK",
      pathConfidence: "LOW",
      confidence: 0.12,
      roadSegmentCount: 0,
      roadNamesTraversed: [],
      roadClassesTraversed: [],
      attachmentMethod: "DIRECT_FALLBACK_ATTACHMENT",
      missingDependencies: ["road graph", "centerline dataset", "routing engine", "street topology index"],
      accessPoints: {},
    };
  }

  const station = validCoordinate(args.stationCoordinate) ? args.stationCoordinate : attachment;
  const streets = (args.streetCenterlines ?? []).filter((street) => street.geometry.filter(validCoordinate).length >= 2);
  const streetTarget = station ?? attachment;
  const candidateStreet = nearestStreet(candidate, streets);
  const attachmentStreet = nearestStreet(streetTarget, streets) ?? nearestStreet(attachment, streets);
  const roadAccess = candidateStreet?.coordinate ?? deterministicRoadAccess(candidate, attachment);
  const buildingEntrance = moveToward(candidate, roadAccess, Math.min(180, Math.max(45, haversineFeet(candidate, roadAccess) * 0.35)));
  const drivewayAccess = moveToward(candidate, roadAccess, Math.min(340, Math.max(95, haversineFeet(candidate, roadAccess) * 0.68)));
  const parkingAccess: DALCoordinate = [drivewayAccess[0], roadAccess[1]];
  const streetPath =
    candidateStreet && attachmentStreet
      ? centerlinePath(candidateStreet, attachmentStreet)
      : deterministicStreetPath(roadAccess, streetTarget, args.variant ?? "primary");
  const stationConnection = validCoordinate(station) && haversineFeet(station, attachment) > 8 ? station : undefined;
  const geometry = uniqueCoordinates([candidate, buildingEntrance, drivewayAccess, parkingAccess, roadAccess, ...streetPath.slice(1), stationConnection ?? attachment, attachment]);
  const distanceFeet = pathLengthFeet(geometry);
  const centerlineAssisted = Boolean(candidateStreet && attachmentStreet);
  const directFallback = geometry.length <= 2;
  return {
    geometry,
    distanceFeet,
    routingMode: directFallback ? "DIRECT_FALLBACK" : centerlineAssisted ? "REFERENCE_CENTERLINE_ROUTING" : "DETERMINISTIC_STREET_DRIVEWAY",
    routingClassification: directFallback ? "DIRECT_SEGMENT_FALLBACK" : centerlineAssisted ? "CENTERLINE_ASSISTED" : "STREET_DRIVEWAY_DETERMINISTIC",
    pathConfidence: centerlineAssisted ? "HIGH" : directFallback ? "LOW" : "MEDIUM",
    confidence: centerlineAssisted ? 0.82 : directFallback ? 0.28 : 0.66,
    roadSegmentCount: Math.max(0, geometry.length - 1),
    roadNamesTraversed: namesFor([candidateStreet?.street, attachmentStreet?.street], !centerlineAssisted),
    roadClassesTraversed: classesFor([candidateStreet?.street, attachmentStreet?.street], !centerlineAssisted),
    attachmentMethod: directFallback ? "DIRECT_FALLBACK_ATTACHMENT" : stationConnection ? "STATION_CONNECTION" : "CERTIFIED_FIBER_ATTACHMENT",
    missingDependencies: centerlineAssisted ? ["road graph", "routing engine", "street topology index"] : ["centerline dataset", "road graph", "routing engine", "street topology index"],
    accessPoints: {
      buildingEntrance,
      drivewayAccess,
      parkingAccess,
      roadAccess,
      streetSnap: candidateStreet?.coordinate ?? roadAccess,
      stationConnection,
    },
  };
}
