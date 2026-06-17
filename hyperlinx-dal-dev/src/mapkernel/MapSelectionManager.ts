import { createContext } from "react";
import type { MapFeatureKind, MapFeatureRef } from "./MapLayerManager";

export type MapSelection = {
  selectionId: string;
  kind: MapFeatureKind;
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

export function createMapSelection(featureRef: MapFeatureRef, payload?: unknown): MapSelection {
  return {
    selectionId: `${featureRef.kind}:${featureRef.id}`,
    kind: featureRef.kind,
    featureRef,
    payload,
    selectedAt: new Date().toISOString(),
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
