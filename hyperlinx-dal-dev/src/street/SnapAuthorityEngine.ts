import { haversineFeet } from "../affinity/geo";
import type { DALCoordinate } from "../types/dal";
import type { SnapAuthorityMethod, SnapAuthorityResult, SnapCertificationSnapshot, SnapCertificationState, StreetCenterline } from "./streetTypes";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nearestPointOnSegment(point: DALCoordinate, start: DALCoordinate, end: DALCoordinate) {
  const [px, py] = point;
  const [ax, ay] = start;
  const [bx, by] = end;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator));
  return [ax + t * dx, ay + t * dy] as DALCoordinate;
}

function nearestPointOnLine(point: DALCoordinate, geometry: DALCoordinate[]) {
  let best: { coordinate: DALCoordinate; distanceFeet: number } | null = null;
  for (let index = 1; index < geometry.length; index += 1) {
    const coordinate = nearestPointOnSegment(point, geometry[index - 1], geometry[index]);
    const distanceFeet = haversineFeet(point, coordinate);
    if (!best || distanceFeet < best.distanceFeet) best = { coordinate, distanceFeet };
  }
  return best;
}

function confidenceFor(distanceFeet: number, method: SnapAuthorityMethod) {
  const methodBase: Record<SnapAuthorityMethod, number> = {
    STREET_CENTERLINE_SNAP: 0.82,
    STATION_SNAP: 0.68,
    NODE_SNAP: 0.62,
    EDGE_SNAP: 0.58,
    ROUTE_SEGMENT_SNAP: 0.54,
    CERTIFIED_ATTACHMENT_SNAP: 0.88,
    CONSTRUCTABILITY_AWARE_SNAP: 0.76,
    DIRECT_ROUTE_SNAP: 0.42,
  };
  const distancePenalty = Math.min(0.4, distanceFeet / 1200);
  return Math.max(0.12, Math.min(0.98, Number((methodBase[method] - distancePenalty).toFixed(2))));
}

export function resolveSnapAuthority(args: {
  candidateCoordinate: DALCoordinate;
  attachmentCoordinate: DALCoordinate;
  streetCenterlines?: StreetCenterline[];
  stationCoordinate?: DALCoordinate;
  nodeCoordinate?: DALCoordinate;
  edgeCoordinate?: DALCoordinate;
  routeCoordinate?: DALCoordinate;
}): SnapAuthorityResult {
  const streetMatches = (args.streetCenterlines ?? [])
    .map((street) => {
      const nearest = nearestPointOnLine(args.candidateCoordinate, street.geometry);
      return nearest ? { street, ...nearest } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.distanceFeet - b.distanceFeet);

  if (streetMatches[0]) {
    const match = streetMatches[0];
    return {
      snapAuthority: "STREET_CENTERLINE",
      snapMethod: "STREET_CENTERLINE_SNAP",
      snapConfidence: confidenceFor(match.distanceFeet, "STREET_CENTERLINE_SNAP"),
      streetId: match.street.streetId,
      streetName: match.street.streetName,
      streetClass: match.street.streetClass,
      snappedStreet: match.street.streetName,
      snappedStreetClass: match.street.streetClass,
      snappedCoordinate: match.coordinate,
      attachmentCoordinate: args.attachmentCoordinate,
      distanceToStreetFeet: Math.round(match.distanceFeet),
      distanceToAttachmentFeet: Math.round(haversineFeet(match.coordinate, args.attachmentCoordinate)),
    };
  }

  const candidates = [
    { method: "STATION_SNAP" as const, authority: "INVENTORY_STATION" as const, coordinate: args.stationCoordinate },
    { method: "NODE_SNAP" as const, authority: "INVENTORY_NODE" as const, coordinate: args.nodeCoordinate },
    { method: "EDGE_SNAP" as const, authority: "INVENTORY_EDGE" as const, coordinate: args.edgeCoordinate },
    { method: "DIRECT_ROUTE_SNAP" as const, authority: "INVENTORY_ROUTE" as const, coordinate: args.routeCoordinate },
  ]
    .filter((candidate): candidate is typeof candidate & { coordinate: DALCoordinate } => Boolean(candidate.coordinate))
    .map((candidate) => ({
      ...candidate,
      distanceFeet: haversineFeet(args.candidateCoordinate, candidate.coordinate),
    }))
    .sort((a, b) => a.distanceFeet - b.distanceFeet);

  const fallback = candidates[0] ?? {
    method: "DIRECT_ROUTE_SNAP" as const,
    authority: "INVENTORY_ROUTE" as const,
    coordinate: args.attachmentCoordinate,
    distanceFeet: haversineFeet(args.candidateCoordinate, args.attachmentCoordinate),
  };

  return {
    snapAuthority: fallback.authority,
    snapMethod: fallback.method,
    snapConfidence: confidenceFor(fallback.distanceFeet, fallback.method),
    snappedCoordinate: fallback.coordinate,
    attachmentCoordinate: args.attachmentCoordinate,
    distanceToStreetFeet: undefined,
    distanceToAttachmentFeet: Math.round(haversineFeet(fallback.coordinate, args.attachmentCoordinate)),
  };
}

export function updateSnapAuthorityCoordinate(result: SnapAuthorityResult, snappedCoordinate: DALCoordinate): SnapAuthorityResult {
  const constructabilityAware = Boolean(result.snapId || result.snapEvidence || result.attachmentCandidates?.length);
  return {
    ...result,
    snapAuthority: constructabilityAware ? result.snapAuthority : result.streetId ? "STREET_CENTERLINE" : result.snapAuthority,
    snapMethod: constructabilityAware ? result.snapMethod : result.streetId ? "STREET_CENTERLINE_SNAP" : result.snapMethod,
    snappedCoordinate,
    snapConfidence: Math.max(0.2, Math.min(0.95, result.snapConfidence + 0.08)),
    distanceToAttachmentFeet: Math.round(haversineFeet(snappedCoordinate, result.attachmentCoordinate)),
  };
}

export function createSnapCertificationSnapshot(args: {
  snapAuthority: SnapAuthorityResult;
  status: SnapCertificationState;
  engineerName: string;
  certificationNotes: string;
  manuallyRelocated?: boolean;
  snapCertificationId?: string;
}): SnapCertificationSnapshot {
  const certifiedAt = args.status === "CERTIFIED_SNAP" || args.status === "REJECTED_SNAP" ? new Date().toISOString() : undefined;
  return {
    ...args.snapAuthority,
    snapCertificationId: args.snapCertificationId ?? createId("snap-cert"),
    status: args.status,
    engineerName: args.engineerName,
    certifiedBy: args.engineerName,
    certifiedAt,
    certificationNotes: args.certificationNotes,
    manuallyRelocated: Boolean(args.manuallyRelocated),
  };
}

export function canUseSnapForRoute(snapshot: SnapCertificationSnapshot | null | undefined): snapshot is SnapCertificationSnapshot {
  return Boolean(snapshot?.status === "CERTIFIED_SNAP" && snapshot.snapConfidence > 0 && snapshot.engineerName.trim() && snapshot.certificationNotes.trim());
}
