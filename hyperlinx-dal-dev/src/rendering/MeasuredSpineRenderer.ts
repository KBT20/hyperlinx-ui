import type { DALCoordinate } from "../types/dal";

export type MeasuredSpineSegmentLike = {
  startCoordinate?: unknown;
  endCoordinate?: unknown;
  cumulativeStartFeet?: unknown;
  cumulativeEndFeet?: unknown;
};

export type MeasuredCenterlineLike = {
  measuredCenterlineId?: unknown;
  measuredSpineId?: unknown;
  spineId?: unknown;
  geometryHash?: unknown;
  routeFeet?: unknown;
  routeLengthFeet?: unknown;
  segments?: unknown;
};

function numeric(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function coordinate(value: unknown): DALCoordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
  return null;
}

function measuredSegments(measuredCenterline: MeasuredCenterlineLike | null | undefined) {
  const rawSegments = Array.isArray(measuredCenterline?.segments) ? measuredCenterline.segments : [];
  return rawSegments
    .map((raw): Required<Pick<MeasuredSpineSegmentLike, "cumulativeStartFeet" | "cumulativeEndFeet">> & { startCoordinate: DALCoordinate; endCoordinate: DALCoordinate } | null => {
      const segment = raw && typeof raw === "object" ? raw as MeasuredSpineSegmentLike : {};
      const startCoordinate = coordinate(segment.startCoordinate);
      const endCoordinate = coordinate(segment.endCoordinate);
      if (!startCoordinate || !endCoordinate) return null;
      return {
        startCoordinate,
        endCoordinate,
        cumulativeStartFeet: numeric(segment.cumulativeStartFeet),
        cumulativeEndFeet: numeric(segment.cumulativeEndFeet),
      };
    })
    .filter((segment): segment is Required<Pick<MeasuredSpineSegmentLike, "cumulativeStartFeet" | "cumulativeEndFeet">> & { startCoordinate: DALCoordinate; endCoordinate: DALCoordinate } => Boolean(segment))
    .filter((segment) => Number(segment.cumulativeEndFeet) > Number(segment.cumulativeStartFeet));
}

function dedupeCoordinates(coordinates: DALCoordinate[]) {
  return coordinates.filter((item, index) => {
    const previous = coordinates[index - 1];
    return !previous || previous[0] !== item[0] || previous[1] !== item[1];
  });
}

export function measuredSpineCoordinates(measuredCenterline: MeasuredCenterlineLike | null | undefined): DALCoordinate[] {
  const segments = measuredSegments(measuredCenterline);
  if (!segments.length) return [];
  const coordinates: DALCoordinate[] = [];
  segments.forEach((segment, index) => {
    if (index === 0) coordinates.push(segment.startCoordinate);
    coordinates.push(segment.endCoordinate);
  });
  return dedupeCoordinates(coordinates);
}

export function coordinateAtMeasure(measuredCenterline: MeasuredCenterlineLike | null | undefined, measureFeet: number): DALCoordinate | null {
  const segments = measuredSegments(measuredCenterline);
  if (!segments.length) return null;
  const routeFeet = numeric(measuredCenterline?.routeLengthFeet, numeric(measuredCenterline?.routeFeet, Number(segments[segments.length - 1].cumulativeEndFeet)));
  const boundedMeasure = Math.max(0, Math.min(routeFeet, measureFeet));
  const segment = segments.find((candidate) => (
    boundedMeasure >= Number(candidate.cumulativeStartFeet) &&
    boundedMeasure <= Number(candidate.cumulativeEndFeet)
  )) ?? segments[segments.length - 1];
  const startFeet = Number(segment.cumulativeStartFeet);
  const endFeet = Number(segment.cumulativeEndFeet);
  const ratio = Math.max(0, Math.min(1, (boundedMeasure - startFeet) / Math.max(0.000001, endFeet - startFeet)));
  const longitude = segment.startCoordinate[0] + (segment.endCoordinate[0] - segment.startCoordinate[0]) * ratio;
  const latitude = segment.startCoordinate[1] + (segment.endCoordinate[1] - segment.startCoordinate[1]) * ratio;
  return [Number(longitude.toFixed(7)), Number(latitude.toFixed(7))];
}

export function clipMeasuredSpineToMeasureRange(
  measuredCenterline: MeasuredCenterlineLike | null | undefined,
  startMeasureFeet: number,
  endMeasureFeet: number,
): DALCoordinate[] {
  const segments = measuredSegments(measuredCenterline);
  if (!segments.length) return [];
  const startMeasure = Math.min(startMeasureFeet, endMeasureFeet);
  const endMeasure = Math.max(startMeasureFeet, endMeasureFeet);
  const startCoordinate = coordinateAtMeasure(measuredCenterline, startMeasure);
  const endCoordinate = coordinateAtMeasure(measuredCenterline, endMeasure);
  if (!startCoordinate || !endCoordinate) return [];
  const coordinates: DALCoordinate[] = [startCoordinate];
  segments.forEach((segment) => {
    const segmentEnd = Number(segment.cumulativeEndFeet);
    if (segmentEnd > startMeasure && segmentEnd < endMeasure) {
      coordinates.push(segment.endCoordinate);
    }
  });
  coordinates.push(endCoordinate);
  return dedupeCoordinates(coordinates);
}
