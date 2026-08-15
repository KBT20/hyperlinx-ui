import { createContext } from "react";
import type { MapFeatureKind, MapFeatureRef } from "./MapLayerManager";

export type MapSelection = {
  selectionId: string;
  kind: MapFeatureKind;
  selectionType?: "ROUTE" | "STATION_RANGE" | "SEGMENT" | "STATION" | "OBJECT" | "FACILITY" | "CONDITION" | "CROSSING" | "WORK" | "CLOSURE";
  canonicalId?: string;
  routeId?: string;
  station?: number;
  stationRange?: { startFeet: number; endFeet: number };
  coordinate?: [number, number];
  sourceAuthority?: string;
  lens?: string;
  featureRef: MapFeatureRef;
  payload?: unknown;
  selectedAt: string;
};

export type MapSelectionContextValue = {
  selection: MapSelection | null;
  setSelection: (selection: MapSelection | null) => void;
};

export const MapSelectionContext = createContext<MapSelectionContextValue>({
  selection: null,
  setSelection: () => undefined,
});

export function createMapSelection(featureRef: MapFeatureRef, payload?: unknown, context: Partial<MapSelection> = {}): MapSelection {
  return {
    selectionId: `${featureRef.kind}:${featureRef.id}`,
    kind: featureRef.kind,
    featureRef,
    payload,
    selectedAt: new Date().toISOString(),
    ...context,
  };
}

export type GraphExtensionSnapCandidate = {
  candidateId: string;
  kind: "NearestNode" | "NearestEdge" | "NearestStation";
  featureRef: MapFeatureRef;
  distanceFeet?: number;
  confidenceScore?: number;
  payload?: unknown;
};

export type GraphExtensionSnapHooks = {
  findNearestNode?: (coordinate: [number, number]) => GraphExtensionSnapCandidate | null;
  findNearestEdge?: (coordinate: [number, number]) => GraphExtensionSnapCandidate | null;
  findNearestStation?: (coordinate: [number, number]) => GraphExtensionSnapCandidate | null;
};
