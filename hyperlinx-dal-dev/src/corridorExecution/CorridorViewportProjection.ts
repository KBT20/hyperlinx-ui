import { geometryForViewport, shouldRenderMajorStations, shouldRenderMinorObjects, type ViewportBounds } from "../performance/MapVirtualization";
import type { CorridorSegment, CorridorViewportProjection } from "./CorridorExecutionTypes";

export function buildCorridorViewportProjection(input: {
  corridorId: string;
  segments: CorridorSegment[];
  viewportBounds?: ViewportBounds | null;
  zoom?: number;
  selectedSegmentId?: string | null;
}): CorridorViewportProjection {
  const zoom = input.zoom ?? 9;
  const selectedSequence = input.selectedSegmentId
    ? input.segments.find((segment) => segment.segmentId === input.selectedSegmentId)?.sequence ?? null
    : null;
  const visibleSegments = input.segments
    .map((segment) => {
      const virtualized = geometryForViewport(segment.simplifiedGeometry, input.viewportBounds ?? null, zoom);
      return {
        segment,
        virtualized,
      };
    })
    .filter(({ virtualized, segment }) => (
      virtualized.geometry.length >= 2 ||
      segment.segmentId === input.selectedSegmentId ||
      selectedSequence === null ||
      Math.abs(segment.sequence - selectedSequence) <= 1
    ));
  const lod = visibleSegments[0]?.virtualized.lod ?? geometryForViewport([], input.viewportBounds ?? null, zoom).lod;
  const visibleGeometry = visibleSegments.flatMap(({ virtualized }) => virtualized.geometry);
  const adjacentSegmentIds = selectedSequence === null
    ? []
    : input.segments
        .filter((segment) => Math.abs(segment.sequence - selectedSequence) === 1)
        .map((segment) => segment.segmentId);

  return {
    projectionId: `CORRIDOR-VIEWPORT-${input.corridorId}-${Date.now()}`,
    corridorId: input.corridorId,
    viewportBounds: input.viewportBounds ?? null,
    zoom,
    lod,
    visibleSegmentIds: visibleSegments.map(({ segment }) => segment.segmentId),
    visibleSegmentCount: visibleSegments.length,
    visibleGeometry,
    renderedStationCount: shouldRenderMajorStations(zoom)
      ? visibleSegments.reduce((total, { segment }) => total + segment.stationSummary.stationCount, 0)
      : Math.min(visibleSegments.length * 2, 200),
    renderedObjectCount: shouldRenderMinorObjects(zoom)
      ? visibleSegments.reduce((total, { segment }) => total + segment.materialSummary.handholes + segment.materialSummary.vaults + segment.ILASummary.ilaCount, 0)
      : visibleSegments.reduce((total, { segment }) => total + segment.bookendSummary.bookendCount + segment.ILASummary.ilaCount, 0),
    materializedTier: lod === "HIGH" ? "HOT" : lod === "MEDIUM" ? "WARM" : "COLD",
    selectedSegmentId: input.selectedSegmentId ?? null,
    adjacentSegmentIds,
    generatedAt: new Date().toISOString(),
  };
}
