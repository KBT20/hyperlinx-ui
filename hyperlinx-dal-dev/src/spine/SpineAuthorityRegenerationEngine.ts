import type {
  MeasuredSpine,
  ObjectStationAttachment,
  SpineRegenerationAudit,
  SpineSiteReference,
  StationAuthority,
  StationClass,
  StationIndexedGraph,
} from "./SpineAuthorityContracts";
import type { DALCoordinate } from "../types/dal";
import { createMeasuredSpine } from "./MeasuredSpineEngine";
import { createObjectStationAttachments } from "./ObjectStationAttachmentEngine";
import { createStationAuthority } from "./StationAuthorityEngine";
import { createStationIndexedGraph } from "./StationIndexedGraphEngine";

export interface SpineAuthorityRegenerationResult {
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  stationIndex: StationAuthority["stationIndex"];
  stationToCoordinateMap: StationAuthority["stationToCoordinateMap"];
  stationIndexedGraph: StationIndexedGraph;
  objectStationAttachments: ObjectStationAttachment[];
  regenerationAudit: SpineRegenerationAudit;
}

export function regenerateAuthorityFromGeometry(args: {
  packageId: string;
  routeId?: string;
  geometry: DALCoordinate[];
  aSite?: SpineSiteReference | null;
  zSite?: SpineSiteReference | null;
  reason: string;
  actor: string;
  previousGeometryHash?: string;
  objects?: unknown[];
  intervalFeet?: number;
  stationClass?: StationClass;
  generatedAt?: string;
}): SpineAuthorityRegenerationResult {
  const measuredSpine = createMeasuredSpine({
    packageId: args.packageId,
    routeId: args.routeId,
    geometry: args.geometry,
    aSite: args.aSite,
    zSite: args.zSite,
    sourceGeometryRef: `${args.packageId}:regenerated-geometry`,
  });
  const stationAuthority = createStationAuthority({
    measuredSpine,
    intervalFeet: args.intervalFeet,
    stationClass: args.stationClass,
  });
  const stationIndexedGraph = createStationIndexedGraph({
    packageId: args.packageId,
    measuredSpine,
    stationAuthority,
  });
  const objectStationAttachments = createObjectStationAttachments({
    packageId: args.packageId,
    objects: args.objects ?? [],
    stationAuthority,
    stationIndexedGraph,
  });

  return {
    measuredSpine,
    stationAuthority,
    stationIndex: stationAuthority.stationIndex,
    stationToCoordinateMap: stationAuthority.stationToCoordinateMap,
    stationIndexedGraph,
    objectStationAttachments,
    regenerationAudit: {
      auditId: `${args.packageId}:SPINE-REGENERATION:${measuredSpine.geometryHash}`,
      packageId: args.packageId,
      routeId: measuredSpine.routeId,
      reason: args.reason,
      actor: args.actor,
      previousGeometryHash: args.previousGeometryHash,
      newGeometryHash: measuredSpine.geometryHash,
      measuredSpineId: measuredSpine.spineId,
      stationAuthorityId: stationAuthority.authorityId,
      stationIndexedGraphId: stationIndexedGraph.graphId,
      regeneratedStationCount: stationAuthority.stationCount,
      regeneratedGraphEdgeCount: stationIndexedGraph.edgeCount,
      regeneratedObjectAttachmentCount: objectStationAttachments.length,
      generatedAt: args.generatedAt ?? new Date().toISOString(),
      authority: "MEASURED_SPINE_AUTHORITY",
    },
  };
}
