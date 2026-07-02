import type { DALCoordinate } from "../types/dal";

export const SPINE_AUTHORITY_LABELS = {
  measuredSpine: "MEASURED_SPINE_AUTHORITY",
  stationAuthority: "STATION_AUTHORITY",
  objectStationAttachment: "OBJECT_STATION_ATTACHMENT_AUTHORITY",
  stationIndexedGraph: "STATION_INDEXED_GRAPH_AUTHORITY",
} as const;

export type SpineAuthorityLabel = typeof SPINE_AUTHORITY_LABELS[keyof typeof SPINE_AUTHORITY_LABELS];

export type StationClass = "ENGINEERING" | "MAJOR";

export interface SpineSiteReference {
  siteId: string;
  label?: string;
  role?: "A" | "Z" | string;
  coordinate: DALCoordinate;
}

export interface MeasuredSpineSegment {
  segmentId: string;
  startCoordinate: DALCoordinate;
  endCoordinate: DALCoordinate;
  segmentLengthFeet: number;
  cumulativeStartFeet: number;
  cumulativeEndFeet: number;
  bearing: number;
  geometryIndexStart: number;
  geometryIndexEnd: number;
}

export interface MeasuredSpineMeasureIndexEntry {
  segmentId: string;
  geometryIndexStart: number;
  geometryIndexEnd: number;
  cumulativeStartFeet: number;
  cumulativeEndFeet: number;
}

export interface MeasuredSpine {
  spineId: string;
  packageId: string;
  routeId: string;
  geometryHash: string;
  sourceGeometryRef: string;
  originSiteId: string;
  terminalSiteId: string;
  routeLengthFeet: number;
  routeLengthMiles: number;
  coordinateCount: number;
  segments: MeasuredSpineSegment[];
  cumulativeMeasureIndex: MeasuredSpineMeasureIndexEntry[];
  authority: "MEASURED_SPINE_AUTHORITY";
}

export interface AuthorizedStation {
  stationId: string;
  spineId: string;
  routeId: string;
  packageId: string;
  measureFeet: number;
  stationFeet: number;
  stationLabel: string;
  stationIndex: number;
  coordinate: DALCoordinate;
  lat: number;
  lng: number;
  segmentId: string;
  cumulativeMeasureFeet: number;
  stationClass: StationClass;
  authority: "STATION_AUTHORITY";
  geometryHash: string;
}

export interface StationIndex {
  indexId: string;
  packageId: string;
  spineId: string;
  routeId: string;
  geometryHash: string;
  intervalFeet: number;
  stationCount: number;
  orderedStationIds: string[];
  byStationId: Record<string, number>;
  byMeasureFeet: Record<string, string>;
  stationIdsBySegment: Record<string, string[]>;
  authority: "STATION_AUTHORITY";
}

export interface StationToCoordinateMapEntry {
  stationId: string;
  stationLabel: string;
  measureFeet: number;
  coordinate: DALCoordinate;
  lat: number;
  lng: number;
  segmentId: string;
  geometryHash: string;
}

export interface StationToCoordinateMap {
  mapId: string;
  packageId: string;
  spineId: string;
  routeId: string;
  geometryHash: string;
  byStationId: Record<string, StationToCoordinateMapEntry>;
  entries: StationToCoordinateMapEntry[];
  authority: "STATION_AUTHORITY";
}

export interface StationAuthority {
  authorityId: string;
  packageId: string;
  spineId: string;
  routeId: string;
  geometryHash: string;
  intervalFeet: number;
  stationClass: StationClass;
  stationCount: number;
  stations: AuthorizedStation[];
  stationIndex: StationIndex;
  stationToCoordinateMap: StationToCoordinateMap;
  authority: "STATION_AUTHORITY";
}

export type ObjectStationAttachmentMethod =
  | "EXPLICIT_STATION"
  | "EXPLICIT_MEASURE"
  | "EXPLICIT_COORDINATE_NEAREST_STATION"
  | "DERIVED_FROM_PARENT_SEGMENT"
  | "DERIVED_FROM_DOCTRINE_RULE"
  | "UNRESOLVED";

export type ObjectStationAttachmentStatus = "ATTACHED" | "UNRESOLVED" | "EXCEPTED";

export interface ObjectStationAttachment {
  attachmentId: string;
  objectId: string;
  packageId: string;
  spineId: string;
  routeId: string;
  stationId?: string;
  stationLabel?: string;
  measureFeet?: number;
  coordinate?: DALCoordinate;
  attachmentMethod: ObjectStationAttachmentMethod;
  attachmentStatus: ObjectStationAttachmentStatus;
  parentReference?: string;
  geometryHash: string;
  authority: "OBJECT_STATION_ATTACHMENT_AUTHORITY";
  reason?: string;
}

export interface StationIndexedGraphEdge {
  edgeId: string;
  fromStationId: string;
  toStationId: string;
  fromMeasureFeet: number;
  toMeasureFeet: number;
  segmentId: string;
  spineId: string;
  routeId: string;
  packageId: string;
  geometryHash: string;
  edgeLengthFeet: number;
  authority: "STATION_INDEXED_GRAPH_AUTHORITY";
}

export interface StationIndexedGraph {
  graphId: string;
  packageId: string;
  spineId: string;
  routeId: string;
  geometryHash: string;
  stationCount: number;
  edgeCount: number;
  edges: StationIndexedGraphEdge[];
  authority: "STATION_INDEXED_GRAPH_AUTHORITY";
}

export interface SpineRegenerationAudit {
  auditId: string;
  packageId: string;
  routeId: string;
  reason: string;
  actor: string;
  previousGeometryHash?: string;
  newGeometryHash: string;
  measuredSpineId: string;
  stationAuthorityId: string;
  stationIndexedGraphId: string;
  regeneratedStationCount: number;
  regeneratedGraphEdgeCount: number;
  regeneratedObjectAttachmentCount: number;
  generatedAt: string;
  authority: "MEASURED_SPINE_AUTHORITY";
}
