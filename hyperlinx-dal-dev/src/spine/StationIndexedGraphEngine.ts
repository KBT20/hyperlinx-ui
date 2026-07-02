import type {
  MeasuredSpine,
  StationAuthority,
  StationIndexedGraph,
  StationIndexedGraphEdge,
} from "./SpineAuthorityContracts";

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function createStationIndexedGraph(args: {
  packageId?: string;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
}): StationIndexedGraph {
  const packageId = args.packageId ?? args.measuredSpine.packageId;
  const edges: StationIndexedGraphEdge[] = args.stationAuthority.stations.slice(0, -1).map((station, index) => {
    const next = args.stationAuthority.stations[index + 1];
    return {
      edgeId: `${packageId}:STATION-GRAPH-EDGE:${String(index + 1).padStart(6, "0")}`,
      fromStationId: station.stationId,
      toStationId: next.stationId,
      fromMeasureFeet: station.measureFeet,
      toMeasureFeet: next.measureFeet,
      segmentId: station.segmentId === next.segmentId ? station.segmentId : `${station.segmentId}->${next.segmentId}`,
      spineId: args.measuredSpine.spineId,
      routeId: args.measuredSpine.routeId,
      packageId,
      geometryHash: args.measuredSpine.geometryHash,
      edgeLengthFeet: round(next.measureFeet - station.measureFeet),
      authority: "STATION_INDEXED_GRAPH_AUTHORITY",
    };
  });

  return {
    graphId: `${packageId}:STATION-INDEXED-GRAPH:${args.measuredSpine.geometryHash}`,
    packageId,
    spineId: args.measuredSpine.spineId,
    routeId: args.measuredSpine.routeId,
    geometryHash: args.measuredSpine.geometryHash,
    stationCount: args.stationAuthority.stations.length,
    edgeCount: edges.length,
    edges,
    authority: "STATION_INDEXED_GRAPH_AUTHORITY",
  };
}
