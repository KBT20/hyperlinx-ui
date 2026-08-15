import type { DALCoordinate } from "../types/dal";
import { clipMeasuredSpineToMeasureRange, type MeasuredCenterlineLike } from "./MeasuredSpineRenderer";

export type MeasureReferencedProjectedSpan = {
  spanId?: unknown;
  startMeasure?: unknown;
  endMeasure?: unknown;
  startStationFeet?: unknown;
  endStationFeet?: unknown;
};

function numeric(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function projectedSpanCoordinates(
  measuredCenterline: MeasuredCenterlineLike | null | undefined,
  span: MeasureReferencedProjectedSpan,
): DALCoordinate[] {
  const startMeasure = numeric(span.startMeasure, numeric(span.startStationFeet));
  const endMeasure = numeric(span.endMeasure, numeric(span.endStationFeet));
  return clipMeasuredSpineToMeasureRange(measuredCenterline, startMeasure, endMeasure);
}

export function renderSpan(
  measuredCenterline: MeasuredCenterlineLike | null | undefined,
  span: MeasureReferencedProjectedSpan,
): DALCoordinate[] {
  return projectedSpanCoordinates(measuredCenterline, span);
}
