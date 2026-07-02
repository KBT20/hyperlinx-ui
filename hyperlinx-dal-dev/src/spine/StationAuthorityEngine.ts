import type {
  AuthorizedStation,
  MeasuredSpine,
  StationAuthority,
  StationClass,
  StationIndex,
  StationToCoordinateMap,
} from "./SpineAuthorityContracts";
import { coordinateAtMeasureOnSpine } from "./MeasuredSpineEngine";

export const ENGINEERING_STATION_INTERVAL_FEET = 100;
export const MAJOR_STATION_INTERVAL_FEET = 5280;

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function stationIntervalForClass(stationClass: StationClass) {
  return stationClass === "MAJOR" ? MAJOR_STATION_INTERVAL_FEET : ENGINEERING_STATION_INTERVAL_FEET;
}

export function stationLabelForMeasure(measureFeet: number) {
  const roundedFeet = Math.max(0, Math.round(measureFeet));
  const station = Math.floor(roundedFeet / 100);
  const remainder = roundedFeet % 100;
  return `${station}+${String(remainder).padStart(2, "0")}`;
}

export function expectedStationCount(routeLengthFeet: number, intervalFeet: number) {
  if (routeLengthFeet <= 0 || intervalFeet <= 0) return 0;
  const baseCount = Math.floor(routeLengthFeet / intervalFeet) + 1;
  const finalIsOnInterval = Math.abs(routeLengthFeet - (baseCount - 1) * intervalFeet) < 0.001;
  return finalIsOnInterval ? baseCount : baseCount + 1;
}

function stationMeasures(routeLengthFeet: number, intervalFeet: number) {
  const measures: number[] = [];
  const boundedInterval = Math.max(1, intervalFeet);
  for (let measure = 0; measure < routeLengthFeet; measure += boundedInterval) {
    measures.push(round(measure));
  }
  if (!measures.length || Math.abs(measures[measures.length - 1] - routeLengthFeet) > 0.001) {
    measures.push(round(routeLengthFeet));
  }
  return measures;
}

export function createStationAuthority(args: {
  measuredSpine: MeasuredSpine;
  intervalFeet?: number;
  stationClass?: StationClass;
}): StationAuthority {
  const stationClass = args.stationClass ?? "ENGINEERING";
  const intervalFeet = args.intervalFeet ?? stationIntervalForClass(stationClass);
  const measures = stationMeasures(args.measuredSpine.routeLengthFeet, intervalFeet);
  const stations: AuthorizedStation[] = measures.map((measureFeet, index) => {
    const positioned = coordinateAtMeasureOnSpine(args.measuredSpine, measureFeet);
    return {
      stationId: `${args.measuredSpine.packageId}:STATION:${String(index).padStart(6, "0")}`,
      spineId: args.measuredSpine.spineId,
      routeId: args.measuredSpine.routeId,
      packageId: args.measuredSpine.packageId,
      measureFeet,
      stationFeet: measureFeet,
      stationLabel: stationLabelForMeasure(measureFeet),
      stationIndex: index,
      coordinate: positioned.coordinate,
      lat: positioned.coordinate[1],
      lng: positioned.coordinate[0],
      segmentId: positioned.segmentId,
      cumulativeMeasureFeet: measureFeet,
      stationClass,
      authority: "STATION_AUTHORITY",
      geometryHash: args.measuredSpine.geometryHash,
    };
  });

  const byStationId: Record<string, number> = {};
  const byMeasureFeet: Record<string, string> = {};
  const stationIdsBySegment: Record<string, string[]> = {};
  stations.forEach((station, index) => {
    byStationId[station.stationId] = index;
    byMeasureFeet[String(Math.round(station.measureFeet))] = station.stationId;
    stationIdsBySegment[station.segmentId] = [...(stationIdsBySegment[station.segmentId] ?? []), station.stationId];
  });

  const stationIndex: StationIndex = {
    indexId: `${args.measuredSpine.packageId}:STATION-INDEX:${args.measuredSpine.geometryHash}`,
    packageId: args.measuredSpine.packageId,
    spineId: args.measuredSpine.spineId,
    routeId: args.measuredSpine.routeId,
    geometryHash: args.measuredSpine.geometryHash,
    intervalFeet,
    stationCount: stations.length,
    orderedStationIds: stations.map((station) => station.stationId),
    byStationId,
    byMeasureFeet,
    stationIdsBySegment,
    authority: "STATION_AUTHORITY",
  };

  const entries = stations.map((station) => ({
    stationId: station.stationId,
    stationLabel: station.stationLabel,
    measureFeet: station.measureFeet,
    coordinate: station.coordinate,
    lat: station.lat,
    lng: station.lng,
    segmentId: station.segmentId,
    geometryHash: station.geometryHash,
  }));
  const stationToCoordinateMap: StationToCoordinateMap = {
    mapId: `${args.measuredSpine.packageId}:STATION-COORDINATE-MAP:${args.measuredSpine.geometryHash}`,
    packageId: args.measuredSpine.packageId,
    spineId: args.measuredSpine.spineId,
    routeId: args.measuredSpine.routeId,
    geometryHash: args.measuredSpine.geometryHash,
    byStationId: Object.fromEntries(entries.map((entry) => [entry.stationId, entry])),
    entries,
    authority: "STATION_AUTHORITY",
  };

  return {
    authorityId: `${args.measuredSpine.packageId}:STATION-AUTHORITY:${args.measuredSpine.geometryHash}`,
    packageId: args.measuredSpine.packageId,
    spineId: args.measuredSpine.spineId,
    routeId: args.measuredSpine.routeId,
    geometryHash: args.measuredSpine.geometryHash,
    intervalFeet,
    stationClass,
    stationCount: stations.length,
    stations,
    stationIndex,
    stationToCoordinateMap,
    authority: "STATION_AUTHORITY",
  };
}
