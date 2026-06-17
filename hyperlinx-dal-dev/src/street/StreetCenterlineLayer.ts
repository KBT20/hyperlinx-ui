import { haversineFeet } from "../affinity/geo";
import type { MapKernelRenderSpec } from "../mapkernel";
import type { DALCoordinate } from "../types/dal";
import { createStreetCenterlineReference, renderStreetCenterlineReferenceLayer } from "../reference/StreetCenterlineReferenceLayer";
import type { StreetCenterline, StreetClass } from "./streetTypes";

function pathLengthFeet(geometry: DALCoordinate[]) {
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) total += haversineFeet(geometry[index - 1], geometry[index]);
  return Math.round(total);
}

function normalizeStreetClass(value?: string): StreetClass {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("interstate")) return "Interstate";
  if (normalized.includes("highway") || normalized.includes("us ") || normalized.includes("state ")) return "Highway";
  if (normalized.includes("arterial")) return "Arterial";
  if (normalized.includes("collector")) return "Collector";
  if (normalized.includes("private")) return "Private";
  return "Local";
}

export function createStreetCenterline(args: {
  streetId: string;
  streetName?: string;
  streetClass?: string;
  geometry: DALCoordinate[];
  jurisdiction?: string;
  source?: StreetCenterline["source"];
}): StreetCenterline {
  return {
    streetId: args.streetId,
    streetName: args.streetName?.trim() || "Unnamed street centerline",
    streetClass: normalizeStreetClass(args.streetClass),
    geometry: args.geometry,
    lengthFeet: pathLengthFeet(args.geometry),
    jurisdiction: args.jurisdiction ?? "Unknown",
    source: args.source ?? "IMPORTED",
  };
}

export function buildDeterministicStreetCenterlines(args: {
  candidateId: string;
  candidateCoordinate: DALCoordinate;
  snappedCoordinate: DALCoordinate;
  streetName?: string;
  streetClass?: string;
}): StreetCenterline[] {
  const [candidateLon, candidateLat] = args.candidateCoordinate;
  const [snapLon, snapLat] = args.snappedCoordinate;
  const snappedEastWest = Math.abs(snapLat - candidateLat) < Math.abs(snapLon - candidateLon);
  const span = 0.0045;
  const geometry: DALCoordinate[] = snappedEastWest
    ? [
        [snapLon - span, snapLat],
        [snapLon + span, snapLat],
      ]
    : [
        [snapLon, snapLat - span],
        [snapLon, snapLat + span],
      ];
  return [
    createStreetCenterline({
      streetId: `street-${args.candidateId}`,
      streetName: args.streetName ?? "Deterministic ROW centerline",
      streetClass: args.streetClass ?? "Local",
      geometry,
      jurisdiction: "Unverified ROW Grid",
      source: "DETERMINISTIC_CENTERLINE",
    }),
  ];
}

export function renderStreetCenterlineLayer(streets: StreetCenterline[], sourceId = "street-centerlines"): MapKernelRenderSpec {
  return renderStreetCenterlineReferenceLayer(
    streets.map((street) =>
      createStreetCenterlineReference({
        streetId: street.streetId,
        streetName: street.streetName,
        streetClass: street.streetClass,
        geometry: street.geometry,
        jurisdiction: street.jurisdiction,
      })
    ),
    sourceId
  );
}
