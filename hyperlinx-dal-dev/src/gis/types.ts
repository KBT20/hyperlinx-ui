import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryRoute, InventoryStation } from "../types/dal";

export type ProjectPoint = (coordinate: DALCoordinate) => { x: number; y: number };

export type GISPoint = {
  id: string;
  label?: string;
  coordinate: DALCoordinate;
  kind?: "candidate" | "attachment" | "station" | "crossing" | "parcel" | "node";
  state?: string;
  selected?: boolean;
  current?: boolean;
  muted?: boolean;
  payload?: unknown;
};

export type GISRoute = {
  id: string;
  label?: string;
  coordinates: DALCoordinate[];
  color?: string;
  width?: number;
  payload?: InventoryRoute | unknown;
};

export type GISBuildPath = {
  id: string;
  label?: string;
  coordinates: DALCoordinate[];
  payload?: unknown;
};

export type GISCrossing = GISPoint & {
  crossingType?: "road" | "rail" | "water" | "unknown";
};

export type GISParcel = {
  id: string;
  label?: string;
  polygon?: DALCoordinate[][];
  centroid?: DALCoordinate;
  payload?: unknown;
};

export type DecisionMapFocus = {
  candidate?: CandidateSite | null;
  attachment?: GISPoint | null;
  route?: GISRoute | null;
  buildPath?: GISBuildPath | null;
  station?: InventoryStation | null;
  crossings?: GISCrossing[];
};
