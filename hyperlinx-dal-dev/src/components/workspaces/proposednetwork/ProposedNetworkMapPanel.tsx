import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import BasemapLayer from "../../../gis/BasemapLayer";
import { centerFromCoordinates, lonLatToWorld, pathData, worldToLonLat, worldToTile, zoomForCoordinates } from "../../../gis/geo";
import type { CorridorInventoryObject, CorridorInventoryObjectType } from "../../../corridor/CorridorInventoryObject";
import type { CorridorStation } from "../../../corridor/CorridorStation";
import type { DALCoordinate } from "../../../types/dal";
import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";
import type { ProposedGraphEdge } from "../../../proposedGraph/ProposedGraphEdge";
import type { ProposedGraphNode } from "../../../proposedGraph/ProposedGraphNode";
import { sourceLayerIdsForVisibleDomain, visibleCommercialMapLayerIds, type CommercialMapLayer } from "../../../commercial/CommercialMapLayerManager";
import type { CustomerTwinLayer, CustomerTwinObjectType, CustomerTwinRenderableState, CustomerTwinStation } from "../../../customerTwin/CustomerTwin";

export type ProposedNetworkSelection =
  | { type: "node"; value: ProposedGraphNode }
  | { type: "edge"; value: ProposedGraphEdge }
  | { type: "station"; value: CorridorStation }
  | { type: "object"; value: CorridorInventoryObject }
  | null;

type LayerState = {
  originalCorridor: boolean;
  route: boolean;
  stations: boolean;
  labels: boolean;
  vaults: boolean;
  regenSites: boolean;
  crossings: boolean;
  ductFiberObjects: boolean;
  constraints: boolean;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  centerWorld: { x: number; y: number };
};

type ControlDragState = {
  pointerId: number;
  index: number;
  kind: "via" | "segment";
  affectedSegmentId?: string;
};

type ViewState = {
  center: DALCoordinate;
  zoom: number;
};

type ProjectedLabel = {
  key: string;
  text: string;
  x: number;
  y: number;
  priority: number;
  fill: string;
  fontSize: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
};

type SalesDragTarget = {
  edge: ProposedGraphEdge | null;
  bendCoordinate: DALCoordinate;
  bendIndex: number;
  distance: number;
};

export type ProposedNetworkCompareOverlay = {
  secondaryGraph: ProposedGraph;
  sharedCoordinates?: DALCoordinate[];
  primaryLabel?: string;
  secondaryLabel?: string;
};

export type ProposedNetworkRedlineMode =
  | "REVIEW"
  | "EDIT_CORRIDOR"
  | "ADD_VIA_POINT"
  | "AVOID_AREA"
  | "PROTECT_SEGMENT"
  | "COMPARE";

export type ProposedNetworkRedlineControls = {
  mode: ProposedNetworkRedlineMode;
  presentationMode?: "SALES" | "ENGINEERING";
  pendingViaPoints?: DALCoordinate[];
  avoidancePolygon?: DALCoordinate[];
  lockedSegmentIds?: string[];
  originalGeometry?: DALCoordinate[];
  revisionGeometry?: DALCoordinate[];
  revisionCount?: number;
  selectedRevisionLabel?: string;
  onModeChange?: (mode: ProposedNetworkRedlineMode) => void;
  onAddViaPoint?: (coordinate: DALCoordinate) => void;
  onMoveViaPoint?: (index: number, coordinate: DALCoordinate) => void;
  onDeleteLastControlPoint?: () => void;
  onAddAvoidancePoint?: (coordinate: DALCoordinate) => void;
  onProtectSelectedSegment?: () => void;
  onResetSelectedSegment?: () => void;
  onSplitSelectedSegment?: () => void;
  onRedlineDragComplete?: (coordinate?: DALCoordinate, affectedSegmentId?: string) => void;
  onSaveRevision?: () => void;
  saveRevisionLabel?: string;
  onDiscardRevision?: () => void;
  onSelectRevisionForProposal?: () => void;
};

export type CommercialMapOpportunityOverlay = {
  draftType?: "NEW_GRAPH_CORRIDOR" | "EXISTING_GRAPH_EXTENSION";
  candidateCoordinate?: DALCoordinate;
  candidateLabel?: string;
  azPoints?: Array<{ id: string; label: string; coordinate: DALCoordinate; role: "A" | "Z" }>;
  attachmentCandidates?: Array<{ id: string; label: string; coordinate: DALCoordinate; selected?: boolean }>;
  corridorGeometry?: DALCoordinate[];
  quickQuoteLabel?: string;
  confidence?: number;
};

const MIN_ZOOM = 4;
const MAX_ZOOM = 19;

function collectCoordinates(graph: ProposedGraph) {
  return [
    ...graph.nodes.map((node) => [node.lng, node.lat] as DALCoordinate),
    ...graph.edges.flatMap((edge) => edge.coordinates),
    ...(graph.centerlineRoute?.geometry ?? []),
    ...(graph.stationedCorridor?.stations.map((station) => station.coordinate) ?? []),
    ...(graph.stationedCorridor?.inventoryObjects.map((object) => [object.lng, object.lat] as DALCoordinate) ?? []),
  ];
}

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
}

function nodeColor(type: ProposedGraphNode["type"]) {
  if (type === "A_SITE") return "#22c55e";
  if (type === "Z_SITE") return "#ef4444";
  if (type === "VAULT") return "#f59e0b";
  if (type === "REGENERATION_SITE") return "#8b5cf6";
  return "#38bdf8";
}

function objectColor(type: CorridorInventoryObjectType) {
  if (type === "REGEN_SITE") return "#7c3aed";
  if (type === "VAULT" || type === "HANDHOLE") return "#f59e0b";
  if (type.includes("CROSSING") || type === "UNKNOWN_CONSTRAINT") return "#ef4444";
  if (type === "DUCT" || type === "FIBER") return "#64748b";
  return "#0ea5e9";
}

function customerTwinFeatureColor(type: CustomerTwinObjectType) {
  if (type === "POP" || type === "FACILITY") return "#facc15";
  if (type === "SPLICE_CASE") return "#a855f7";
  if (type === "HANDHOLE" || type === "VAULT") return "#f59e0b";
  if (type === "BUILDING") return "#38bdf8";
  if (type === "REGENERATION_SITE") return "#7c3aed";
  if (type === "CAMPUS" || type === "CUSTOMER_FACILITY") return "#22c55e";
  return "#e5e7eb";
}

function customerTwinLayerRank(layer: CustomerTwinLayer) {
  if (layer.domain === "EXISTING_INVENTORY") return 10;
  if (layer.domain === "CUSTOMER_PROPOSED") return 20;
  return 30;
}

function customerTwinLineStyle(layer: CustomerTwinLayer, index: number) {
  if (layer.domain === "CUSTOMER_PROPOSED") {
    return { stroke: "#7c3aed", strokeDasharray: "10 7", opacity: 0.5 };
  }
  if (layer.routeUse === "DIVERSITY_CONSTRAINT") {
    return { stroke: "#be123c", strokeDasharray: "10 8", opacity: 0.58 };
  }
  if (layer.routeUse === "AVOIDANCE_CONSTRAINT") {
    return { stroke: "#a16207", strokeDasharray: "3 7", opacity: 0.5 };
  }
  return {
    stroke: index % 2 === 0 ? "#0f766e" : "#475569",
    strokeDasharray: index % 2 === 0 ? "7 6" : "4 6",
    opacity: 0.52,
  };
}

function objectVisible(type: CorridorInventoryObjectType, layers: LayerState, zoom: number) {
  if (type === "REGEN_SITE") return layers.regenSites;
  if (type === "VAULT" || type === "HANDHOLE") return layers.vaults && zoom >= 9;
  if (type.includes("CROSSING")) return layers.crossings && zoom >= 8;
  if (type === "UNKNOWN_CONSTRAINT") return layers.constraints && zoom >= 11;
  if (type === "DUCT" || type === "FIBER" || type === "SPLICE_POINT") return layers.ductFiberObjects && zoom >= 14;
  return zoom >= 14;
}

function customerTwinObjectVisible(type: CustomerTwinObjectType, zoom: number) {
  if (zoom < 9) return type === "POP" || type === "FACILITY" || type === "CUSTOMER_FACILITY" || type === "CAMPUS";
  if (zoom < 12) return ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS", "BUILDING", "REGENERATION_SITE"].includes(type);
  if (zoom < 14) return !["HANDHOLE"].includes(type);
  return true;
}

function stationRenderSpacingFeet(zoom: number) {
  if (zoom < 10) return Number.POSITIVE_INFINITY;
  if (zoom < 11) return 5 * 5280;
  if (zoom < 13) return 1000;
  if (zoom < 15) return 250;
  return 0;
}

function visibleStationsForZoom(stations: CorridorStation[], zoom: number) {
  if (zoom < 10) return [];
  const spacingFeet = stationRenderSpacingFeet(zoom);
  if (spacingFeet === 0) return stations;
  let lastRenderedFeet = -Number.POSITIVE_INFINITY;
  return stations.filter((station, index) => {
    const endpoint = index === 0 || index === stations.length - 1;
    if (endpoint || station.stationFeet - lastRenderedFeet >= spacingFeet) {
      lastRenderedFeet = station.stationFeet;
      return true;
    }
    return false;
  });
}

function visibleCustomerTwinStationsForZoom(stations: CustomerTwinStation[], zoom: number) {
  if (zoom < 11) return [];
  const step = zoom < 13 ? 20 : zoom < 15 ? 5 : 1;
  return stations.filter((station) => station.stationIndex === 0 || station.stationIndex % step === 0);
}

function inViewport(point: { x: number; y: number }, width: number, height: number, pad = 48) {
  return point.x >= -pad && point.x <= width + pad && point.y >= -pad && point.y <= height + pad;
}

function labelsWithoutCollisions(labels: ProjectedLabel[]) {
  const accepted: ProjectedLabel[] = [];
  const boxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  [...labels]
    .sort((a, b) => b.priority - a.priority)
    .forEach((label) => {
      const width = Math.max(38, label.text.length * (label.fontSize * 0.58));
      const height = label.fontSize + 6;
      const box = { x1: label.x, y1: label.y - height, x2: label.x + width, y2: label.y + 4 };
      const overlaps = boxes.some((existing) => !(box.x2 < existing.x1 || box.x1 > existing.x2 || box.y2 < existing.y1 || box.y1 > existing.y2));
      if (!overlaps) {
        boxes.push(box);
        accepted.push(label);
      }
    });
  return accepted.sort((a, b) => a.priority - b.priority);
}

function distanceToScreenSegment(point: ProjectedPoint, start: ProjectedPoint, end: ProjectedPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return { distance: Math.hypot(point.x - start.x, point.y - start.y), t: 0 };
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const closest = { x: start.x + t * dx, y: start.y + t * dy };
  return { distance: Math.hypot(point.x - closest.x, point.y - closest.y), t };
}

function bendScore(previous: ProjectedPoint, current: ProjectedPoint, next: ProjectedPoint) {
  const ax = previous.x - current.x;
  const ay = previous.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const aLength = Math.hypot(ax, ay);
  const bLength = Math.hypot(bx, by);
  if (!aLength || !bLength) return 0;
  const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (aLength * bLength)));
  return Math.PI - Math.acos(cosine);
}

function debugMapEvent(event: string, details: Record<string, unknown>) {
  console.debug("[PROPOSED_NETWORK_MAP]", { event, ...details });
}

export default function ProposedNetworkMapPanel({
  graph,
  selected,
  onSelect,
  compare,
  redline,
  customerTwinState,
  commercialMapLayers = [],
  commercialOpportunityOverlay,
  mapMinHeight = 560,
  mapTitle = "Proposed Network Map",
  mapBadgeLabel,
  onMapCoordinateClick,
  onCommercialLayerVisibilityToggle,
}: {
  graph: ProposedGraph;
  selected: ProposedNetworkSelection;
  onSelect: (selection: ProposedNetworkSelection) => void;
  compare?: ProposedNetworkCompareOverlay;
  redline?: ProposedNetworkRedlineControls;
  customerTwinState?: CustomerTwinRenderableState | null;
  commercialMapLayers?: CommercialMapLayer[];
  commercialOpportunityOverlay?: CommercialMapOpportunityOverlay;
  mapMinHeight?: number;
  mapTitle?: string;
  mapBadgeLabel?: string;
  onMapCoordinateClick?: (coordinate: DALCoordinate) => void;
  onCommercialLayerVisibilityToggle?: (networkId: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fittedRouteRef = useRef<string | null>(null);
  const previousViewRef = useRef<ViewState | null>(null);
  const [size, setSize] = useState({ width: 960, height: 560 });
  const salesMode = redline?.presentationMode === "SALES";
  const visibleLayerIds = useMemo(() => visibleCommercialMapLayerIds(commercialMapLayers), [commercialMapLayers]);
  const visibleCustomerInventoryRouteLayerIds = useMemo(
    () => sourceLayerIdsForVisibleDomain(commercialMapLayers, "CUSTOMER_INVENTORY", "ROUTES"),
    [commercialMapLayers],
  );
  const visibleCustomerInventoryObjectLayerIds = useMemo(
    () => sourceLayerIdsForVisibleDomain(commercialMapLayers, "CUSTOMER_INVENTORY", "OBJECTS"),
    [commercialMapLayers],
  );
  const visibleCustomerProposedRouteLayerIds = useMemo(
    () => sourceLayerIdsForVisibleDomain(commercialMapLayers, "CUSTOMER_PROPOSED_NETWORK", "ROUTES"),
    [commercialMapLayers],
  );
  const customerTwinLayers = customerTwinState?.layers ?? [];
  const hasCommercialTwinLayerRegistry = commercialMapLayers.some((layer) => Boolean(layer.sourceLayerId));
  const routeVisibleCustomerTwinLayers = useMemo(
    () => customerTwinLayers.filter((layer) => (
      !hasCommercialTwinLayerRegistry && layer.visibleByDefault
    ) || (
      (layer.domain === "EXISTING_INVENTORY" && visibleCustomerInventoryRouteLayerIds.has(layer.layerId)) ||
      (layer.domain === "CUSTOMER_PROPOSED" && visibleCustomerProposedRouteLayerIds.has(layer.layerId))
    )),
    [customerTwinLayers, hasCommercialTwinLayerRegistry, visibleCustomerInventoryRouteLayerIds, visibleCustomerProposedRouteLayerIds],
  );
  const objectVisibleCustomerTwinLayers = useMemo(
    () => customerTwinLayers.filter((layer) => layer.domain === "EXISTING_INVENTORY" && (
      (!hasCommercialTwinLayerRegistry && layer.visibleByDefault) ||
      visibleCustomerInventoryObjectLayerIds.has(layer.layerId)
    )),
    [customerTwinLayers, hasCommercialTwinLayerRegistry, visibleCustomerInventoryObjectLayerIds],
  );
  const salesDraftVisible = visibleLayerIds.has("sales-commercial-draft:active-corridor");
  const graphFeatureRenderingVisible = !salesMode || salesDraftVisible;
  const inventoryCoordinates = useMemo(
    () => routeVisibleCustomerTwinLayers.flatMap((layer) => [
      ...layer.routes.flatMap((route) => route.coordinates),
      ...(!hasCommercialTwinLayerRegistry || visibleCustomerInventoryObjectLayerIds.has(layer.layerId) ? layer.objects.map((object) => object.coordinate) : []),
      ...(!hasCommercialTwinLayerRegistry || visibleCustomerInventoryObjectLayerIds.has(layer.layerId) ? layer.stations.map((station) => station.coordinate) : []),
    ]),
    [hasCommercialTwinLayerRegistry, routeVisibleCustomerTwinLayers, visibleCustomerInventoryObjectLayerIds],
  );
  const inventoryRouteKey = commercialMapLayers
    .map((layer) => `${layer.id}:${layer.visibility}:${layer.renderState}:${layer.featureCount}`)
    .join("|");
  const sortedCustomerTwinRouteLayers = useMemo(
    () => [...routeVisibleCustomerTwinLayers].sort((a, b) => customerTwinLayerRank(a) - customerTwinLayerRank(b)),
    [routeVisibleCustomerTwinLayers],
  );
  const sortedCustomerTwinObjectLayers = useMemo(
    () => [...objectVisibleCustomerTwinLayers].sort((a, b) => customerTwinLayerRank(a) - customerTwinLayerRank(b)),
    [objectVisibleCustomerTwinLayers],
  );
  const mapLayerDockLayers = useMemo(
    () => commercialMapLayers
      .filter((layer) => layer.featureScope !== "BASE")
      .sort((a, b) => b.zIndex - a.zIndex || a.label.localeCompare(b.label)),
    [commercialMapLayers],
  );
  const coordinates = useMemo(
    () => [
      ...(graphFeatureRenderingVisible ? collectCoordinates(graph) : []),
      ...(graphFeatureRenderingVisible && compare ? collectCoordinates(compare.secondaryGraph) : []),
      ...(graphFeatureRenderingVisible ? compare?.sharedCoordinates ?? [] : []),
      ...inventoryCoordinates,
      ...(commercialOpportunityOverlay?.candidateCoordinate ? [commercialOpportunityOverlay.candidateCoordinate] : []),
      ...(commercialOpportunityOverlay?.azPoints?.map((point) => point.coordinate) ?? []),
      ...(commercialOpportunityOverlay?.attachmentCandidates?.map((attachment) => attachment.coordinate) ?? []),
      ...(commercialOpportunityOverlay?.corridorGeometry ?? []),
    ],
    [commercialOpportunityOverlay?.attachmentCandidates, commercialOpportunityOverlay?.azPoints, commercialOpportunityOverlay?.candidateCoordinate, commercialOpportunityOverlay?.corridorGeometry, compare, graph, graphFeatureRenderingVisible, inventoryCoordinates],
  );
  const [view, setView] = useState<ViewState>(() => ({
    center: centerFromCoordinates(coordinates, [-97.7431, 30.2672]),
    zoom: clampZoom(zoomForCoordinates(coordinates, 960, 560)),
  }));
  const [drag, setDrag] = useState<DragState | null>(null);
  const [controlDrag, setControlDrag] = useState<ControlDragState | null>(null);
  const latestControlCoordinateRef = useRef<DALCoordinate | null>(null);
  const [developerLayersOpen, setDeveloperLayersOpen] = useState(false);
  const [layers, setLayers] = useState<LayerState>({
    originalCorridor: true,
    route: true,
    stations: true,
    labels: true,
    vaults: true,
    regenSites: true,
    crossings: true,
    ductFiberObjects: false,
    constraints: true,
  });

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width && rect?.height) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function fitViewForCoordinates(nextCoordinates: DALCoordinate[], reason: string, targetZoom?: number) {
    const nextView = {
      center: centerFromCoordinates(nextCoordinates, view.center),
      zoom: clampZoom(targetZoom ?? zoomForCoordinates(nextCoordinates, size.width, size.height)),
    };
    debugMapEvent("fitBounds", {
      reason,
      zoom: nextView.zoom,
      center: nextView.center,
      coordinateCount: nextCoordinates.length,
    });
    setView(nextView);
  }

  useEffect(() => {
    const routeKey = `${graph.proposedGraphId}:${graph.centerlineRouteId ?? "NO_CENTERLINE"}:${compare?.secondaryGraph.proposedGraphId ?? "SINGLE"}:${inventoryRouteKey}`;
    if (fittedRouteRef.current === routeKey) return;
    fittedRouteRef.current = routeKey;
    fitViewForCoordinates(coordinates, "initial-route-load");
  }, [compare?.secondaryGraph.proposedGraphId, coordinates, graph.centerlineRouteId, graph.proposedGraphId, inventoryRouteKey]);

  useEffect(() => {
    const previous = previousViewRef.current;
    if (previous && previous.zoom !== view.zoom) {
      debugMapEvent("zoomend", { zoom: view.zoom, center: view.center });
    }
    if (previous && (previous.center[0] !== view.center[0] || previous.center[1] !== view.center[1])) {
      debugMapEvent("moveend", { zoom: view.zoom, center: view.center });
    }
    previousViewRef.current = view;
  }, [view]);

  const centerWorld = useMemo(() => lonLatToWorld(view.center, view.zoom), [view.center, view.zoom]);
  const project = (coordinate: DALCoordinate) => {
    const point = lonLatToWorld(coordinate, view.zoom);
    return {
      x: point.x - centerWorld.x + size.width / 2,
      y: point.y - centerWorld.y + size.height / 2,
    };
  };
  const tiles = useMemo(() => {
    const tileSize = 256;
    const leftWorld = centerWorld.x - size.width / 2;
    const topWorld = centerWorld.y - size.height / 2;
    const nextTiles = [];
    for (let x = worldToTile(leftWorld) - 1; x <= worldToTile(centerWorld.x + size.width / 2) + 1; x += 1) {
      for (let y = worldToTile(topWorld) - 1; y <= worldToTile(centerWorld.y + size.height / 2) + 1; y += 1) {
        nextTiles.push({
          key: `${view.zoom}-${x}-${y}`,
          x,
          y,
          z: view.zoom,
          left: x * tileSize - leftWorld,
          top: y * tileSize - topWorld,
        });
      }
    }
    return nextTiles;
  }, [centerWorld.x, centerWorld.y, size.height, size.width, view.zoom]);

  function setZoom(nextZoom: number, reason: string) {
    const zoom = clampZoom(nextZoom);
    if (zoom === view.zoom) return;
    debugMapEvent("zoomstart", { reason, fromZoom: view.zoom, toZoom: zoom, center: view.center });
    setView((prev) => ({ ...prev, zoom }));
  }

  function coordinateFromPointer(event: PointerEvent<SVGElement> | PointerEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const coordinate = worldToLonLat({ x: centerWorld.x + x - size.width / 2, y: centerWorld.y + y - size.height / 2 }, view.zoom);
    return [Number(coordinate[0].toFixed(6)), Number(coordinate[1].toFixed(6))] as DALCoordinate;
  }

  function nearestEdgeToCoordinate(coordinate: DALCoordinate) {
    let bestEdge: ProposedGraphEdge | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    graph.edges.forEach((edge) => {
      edge.coordinates.forEach((point) => {
        const dx = point[0] - coordinate[0];
        const dy = point[1] - coordinate[1];
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestEdge = edge;
        }
      });
    });
    return bestEdge;
  }

  function nearestSalesDragTarget(coordinate: DALCoordinate) {
    const pointer = project(coordinate);
    let best: SalesDragTarget | null = null;
    const setBest = (target: SalesDragTarget) => {
      best = target;
    };

    const inspectPath = (coordinates: DALCoordinate[], edge: ProposedGraphEdge | null) => {
      if (coordinates.length < 2) return;
      let nearestSegmentIndex = 0;
      let nearestSegmentDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < coordinates.length - 1; index += 1) {
        const result = distanceToScreenSegment(pointer, project(coordinates[index]), project(coordinates[index + 1]));
        if (result.distance < nearestSegmentDistance) {
          nearestSegmentDistance = result.distance;
          nearestSegmentIndex = index;
        }
      }

      const candidateIndexes = new Set<number>();
      const windowStart = Math.max(1, nearestSegmentIndex - 12);
      const windowEnd = Math.min(coordinates.length - 2, nearestSegmentIndex + 13);
      for (let index = windowStart; index <= windowEnd; index += 1) candidateIndexes.add(index);
      if (!candidateIndexes.size && coordinates.length > 2) candidateIndexes.add(Math.min(coordinates.length - 2, Math.max(1, nearestSegmentIndex)));

      candidateIndexes.forEach((index) => {
        const point = project(coordinates[index]);
        const pointDistance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
        const score = bendScore(project(coordinates[index - 1]), point, project(coordinates[index + 1]));
        const weightedDistance = pointDistance - Math.min(18, score * 60);
        if (!best || weightedDistance < best.distance) {
          setBest({
            edge,
            bendCoordinate: coordinates[index],
            bendIndex: index,
            distance: weightedDistance,
          });
        }
      });
    };

    graph.edges.forEach((edge) => inspectPath(edge.coordinates, edge));
    if (!best) inspectPath(proposalPath, nearestEdgeToCoordinate(coordinate));
    return best as SalesDragTarget | null;
  }

  function startSalesCorridorDrag(event: PointerEvent<SVGElement>, edge?: ProposedGraphEdge) {
    if (redline?.presentationMode !== "SALES" || redline.mode === "COMPARE" || !redline.onAddViaPoint) return false;
    const coordinate = coordinateFromPointer(event);
    if (!coordinate) return false;
    const target = nearestSalesDragTarget(coordinate);
    const affectedEdge = edge ?? target?.edge ?? nearestEdgeToCoordinate(coordinate);
    if (affectedEdge) onSelect({ type: "edge", value: affectedEdge });
    const bendCoordinate = target?.bendCoordinate ?? coordinate;
    redline.onAddViaPoint(bendCoordinate);
    latestControlCoordinateRef.current = bendCoordinate;
    setControlDrag({
      pointerId: event.pointerId,
      index: 0,
      kind: "segment",
      affectedSegmentId: affectedEdge?.segmentId ?? affectedEdge?.id,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      redline?.presentationMode !== "SALES" &&
      redline?.mode === "EDIT_CORRIDOR" &&
      selected?.type === "edge" &&
      redline.onAddViaPoint &&
      !redline.lockedSegmentIds?.includes(selected.value.segmentId ?? selected.value.id)
    ) {
      const coordinate = coordinateFromPointer(event);
      if (coordinate) redline.onAddViaPoint(coordinate);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerWorld,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (controlDrag) {
      const coordinate = coordinateFromPointer(event);
      if (!coordinate) return;
      latestControlCoordinateRef.current = coordinate;
      redline?.onMoveViaPoint?.(controlDrag.index, coordinate);
      return;
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setView((prev) => ({
      ...prev,
      center: worldToLonLat({ x: drag.centerWorld.x - dx, y: drag.centerWorld.y - dy }, prev.zoom),
    }));
  }

  function clearDrag(event: PointerEvent<HTMLDivElement>) {
    if (controlDrag?.pointerId === event.pointerId) {
      setControlDrag(null);
      redline?.onRedlineDragComplete?.(latestControlCoordinateRef.current ?? undefined, controlDrag.affectedSegmentId);
      latestControlCoordinateRef.current = null;
      return;
    }
    if (drag?.pointerId === event.pointerId) {
      debugMapEvent("moveend", { reason: "pointer-drag", zoom: view.zoom, center: view.center });
      setDrag(null);
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom(view.zoom + (event.deltaY < 0 ? 1 : -1), "mouse-wheel");
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (drag || controlDrag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const coordinate = worldToLonLat(
      {
        x: centerWorld.x + x - size.width / 2,
        y: centerWorld.y + y - size.height / 2,
      },
      view.zoom,
    );
    const point: DALCoordinate = [Number(coordinate[0].toFixed(6)), Number(coordinate[1].toFixed(6))];
    let handled = false;
    if (redline?.mode === "ADD_VIA_POINT") {
      redline.onAddViaPoint?.(point);
      handled = true;
    }
    if (redline?.mode === "AVOID_AREA") {
      redline.onAddAvoidancePoint?.(point);
      handled = true;
    }
    if (!handled) onMapCoordinateClick?.(point);
  }

  function toggleLayer(layer: keyof LayerState) {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  const centerlinePath = graph.centerlineRoute?.geometry ?? [];
  const originalPath = redline?.originalGeometry?.length ? redline.originalGeometry : centerlinePath;
  const secondaryCenterlinePath = compare?.secondaryGraph.centerlineRoute?.geometry ?? [];
  const sharedCenterlinePath = compare?.sharedCoordinates ?? [];
  const revisionPath = redline?.revisionGeometry ?? [];
  const pendingViaPoints = redline?.pendingViaPoints ?? [];
  const avoidancePolygon = redline?.avoidancePolygon ?? [];
  const proposalPath = salesMode && revisionPath.length > 1 ? revisionPath : centerlinePath;
  const stations = graph.stationedCorridor?.stations ?? [];
  const objects = graph.stationedCorridor?.inventoryObjects ?? [];
  const visibleStations = visibleStationsForZoom(stations, view.zoom).filter((station) => inViewport(project(station.coordinate), size.width, size.height));
  const visibleObjects = objects
    .filter((object) => objectVisible(object.objectType, layers, view.zoom))
    .filter((object) => inViewport(project([object.lng, object.lat]), size.width, size.height));
  const visibleCustomerTwinObjects = sortedCustomerTwinObjectLayers.flatMap((layer) => layer.objects)
    .filter((object) => customerTwinObjectVisible(object.objectType, view.zoom))
    .filter((object) => inViewport(project(object.coordinate), size.width, size.height, 40));
  const visibleCustomerTwinStations = sortedCustomerTwinObjectLayers.flatMap((layer) => visibleCustomerTwinStationsForZoom(layer.stations, view.zoom))
    .filter((station) => inViewport(project(station.coordinate), size.width, size.height, 40));
  const siteNodes = graph.nodes.filter((node) => node.type === "A_SITE" || node.type === "Z_SITE" || node.type === "INTERMEDIATE_SITE");
  const regenObjects = objects.filter((object) => object.objectType === "REGEN_SITE");
  const selectedStation = selected?.type === "station" ? selected.value : null;
  const firstRegen = regenObjects[0];
  const selectedSegment = selected?.type === "edge" ? selected.value : null;
  const selectedSegmentCoordinates = selectedSegment?.coordinates ?? [];
  const selectedSegmentMidpoint = selectedSegmentCoordinates.length ? selectedSegmentCoordinates[Math.floor(selectedSegmentCoordinates.length / 2)] : null;
  const stagedRevisionPath = useMemo(() => {
    if (revisionPath.length > 1 || !pendingViaPoints.length) return [];
    const sourcePath = centerlinePath.length > 1 ? centerlinePath : graph.edges.flatMap((edge) => edge.coordinates);
    if (sourcePath.length < 2) return pendingViaPoints;
    if (selectedSegment) {
      const selectedIndex = graph.edges.findIndex((edge) => edge.id === selectedSegment.id);
      if (selectedIndex >= 0) {
        const before = graph.edges.slice(0, selectedIndex).flatMap((edge) => edge.coordinates);
        const segmentStart = selectedSegment.coordinates[0];
        const segmentEnd = selectedSegment.coordinates.at(-1);
        const after = graph.edges.slice(selectedIndex + 1).flatMap((edge) => edge.coordinates);
        return [
          ...before,
          ...(segmentStart ? [segmentStart] : []),
          ...pendingViaPoints,
          ...(segmentEnd ? [segmentEnd] : []),
          ...after,
        ];
      }
    }
    const midpoint = Math.max(1, Math.floor(sourcePath.length / 2));
    return [...sourcePath.slice(0, midpoint), ...pendingViaPoints, ...sourcePath.slice(midpoint)];
  }, [centerlinePath, graph.edges, pendingViaPoints, revisionPath.length, selectedSegment]);
  const visibleRevisionPath = revisionPath.length > 1 ? revisionPath : stagedRevisionPath;
  const originalLabelPoint = originalPath.length > 1 ? project(originalPath[Math.floor(originalPath.length / 2)]) : null;
  const proposalLabelPoint = proposalPath.length > 1 ? project(proposalPath[Math.floor(proposalPath.length / 2)]) : null;
  const renderStationLabels = layers.labels && view.zoom >= 12;
  const renderDetailedLabels = layers.labels && view.zoom >= 14;
  const fitButtonCoordinates = salesMode && !salesDraftVisible && inventoryCoordinates.length
    ? inventoryCoordinates
    : centerlinePath.length > 1
      ? centerlinePath
      : coordinates;
  const opportunityOverlayPoint = commercialOpportunityOverlay?.candidateCoordinate ? project(commercialOpportunityOverlay.candidateCoordinate) : null;
  const opportunityAzPoints = commercialOpportunityOverlay?.azPoints ?? [];
  const opportunityAttachmentCandidates = commercialOpportunityOverlay?.attachmentCandidates ?? [];
  const opportunityOverlayPath = commercialOpportunityOverlay?.corridorGeometry ?? [];
  const projectedLabels = labelsWithoutCollisions([
    ...(layers.labels && view.zoom >= 10
      ? visibleCustomerTwinObjects.map((object) => {
          const point = project(object.coordinate);
          return {
            key: `customer-twin-object-label:${object.objectId}`,
            text: view.zoom >= 12 ? `${object.name} | ${object.objectType.replaceAll("_", " ")}` : object.name,
            x: point.x + 8,
            y: point.y + 4,
            priority: ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS"].includes(object.objectType) ? 92 : 48,
            fill: "#111827",
            fontSize: view.zoom >= 12 ? 11 : 10,
          };
        })
      : []),
    ...(layers.labels && view.zoom >= 12
      ? visibleCustomerTwinStations.map((station) => {
          const point = project(station.coordinate);
          return {
            key: `customer-twin-station-label:${station.stationId}`,
            text: `STA ${Math.round(station.cumulativeFeet).toLocaleString()} ft`,
            x: point.x + 7,
            y: point.y + 4,
            priority: 34,
            fill: "#075985",
            fontSize: 10,
          };
        })
      : []),
    ...(graphFeatureRenderingVisible
      ? siteNodes.map((node) => {
          const point = project([node.lng, node.lat]);
          return {
            key: `node-label:${node.id}`,
            text: node.name,
            x: point.x + 12,
            y: point.y + 4,
            priority: node.type === "A_SITE" || node.type === "Z_SITE" ? 100 : 80,
            fill: "#0f172a",
            fontSize: 12,
          };
        })
      : []),
    ...(graphFeatureRenderingVisible && layers.labels && view.zoom >= 12
      ? regenObjects.map((object) => {
          const point = project([object.lng, object.lat]);
          return {
            key: `regen-label:${object.objectId}`,
            text: "Regen",
            x: point.x + 10,
            y: point.y + 4,
            priority: 86,
            fill: "#3b0764",
            fontSize: 11,
          };
        })
      : []),
    ...(graphFeatureRenderingVisible && renderStationLabels
      ? visibleStations.map((station) => {
          const point = project(station.coordinate);
          return {
            key: `station-label:${station.stationId}`,
            text: station.stationLabel,
            x: point.x + 8,
            y: point.y + 4,
            priority: 30,
            fill: "#1e3a8a",
            fontSize: 11,
          };
        })
      : []),
    ...(graphFeatureRenderingVisible && renderDetailedLabels
      ? visibleObjects
          .filter((object) => !["DUCT", "FIBER", "REGEN_SITE"].includes(object.objectType))
          .map((object) => {
            const point = project([object.lng, object.lat]);
            return {
              key: `object-label:${object.objectId}`,
              text: object.objectType.replaceAll("_", " "),
              x: point.x + 10,
              y: point.y + 4,
              priority: object.objectType.includes("CROSSING") ? 62 : 44,
              fill: "#0f172a",
              fontSize: 11,
            };
          })
      : []),
  ].filter((label) => inViewport(label, size.width, size.height, 80)));

  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>{mapTitle}</h3>
        <span className="dal-badge warning">{mapBadgeLabel ?? (salesMode && !salesDraftVisible ? "Customer inventory" : "Sales route candidate")}</span>
      </div>
      <div className="dal-actions">
        <button type="button" onClick={() => fitViewForCoordinates(fitButtonCoordinates, "fit-entire-route")}>
          {salesMode && !salesDraftVisible ? "Fit Inventory" : salesMode ? "Fit Route" : "Fit Entire Route"}
        </button>
        {!salesMode && (
          <>
            <button type="button" disabled={!graph.centerlineRoute?.aSite.coordinate} onClick={() => graph.centerlineRoute?.aSite.coordinate && fitViewForCoordinates([graph.centerlineRoute.aSite.coordinate], "zoom-to-a-site", 15)}>
              Zoom to A Site
            </button>
            <button type="button" disabled={!graph.centerlineRoute?.zSite.coordinate} onClick={() => graph.centerlineRoute?.zSite.coordinate && fitViewForCoordinates([graph.centerlineRoute.zSite.coordinate], "zoom-to-z-site", 15)}>
              Zoom to Z Site
            </button>
            <button type="button" disabled={!selectedStation} onClick={() => selectedStation && fitViewForCoordinates([selectedStation.coordinate], "zoom-to-selected-station", 15)}>
              Zoom to Selected Station
            </button>
            <button type="button" disabled={!firstRegen} onClick={() => firstRegen && fitViewForCoordinates([[firstRegen.lng, firstRegen.lat]], "zoom-to-regen", 13)}>
              Zoom to Regen
            </button>
            <button type="button" disabled={!selectedSegmentCoordinates.length} onClick={() => selectedSegmentCoordinates.length && fitViewForCoordinates(selectedSegmentCoordinates, "zoom-to-selected-segment", 15)}>
              Zoom to Selected Segment
            </button>
          </>
        )}
      </div>
      {redline && graphFeatureRenderingVisible && (
        <div className="dal-actions">
          {((salesMode ? ["REVIEW", "COMPARE"] : ["REVIEW", "EDIT_CORRIDOR", "AVOID_AREA", "COMPARE"]) as ProposedNetworkRedlineMode[]).map((mode) => (
            <button key={mode} type="button" className={redline.mode === mode ? "primary" : "secondary"} onClick={() => redline.onModeChange?.(mode)}>
              {mode.replaceAll("_", " ")}
            </button>
          ))}
          {!salesMode && (
            <>
              <button type="button" onClick={() => redline.onModeChange?.("ADD_VIA_POINT")}>
                Insert Control Point
              </button>
              <button type="button" onClick={() => redline.onDeleteLastControlPoint?.()} disabled={!redline.pendingViaPoints?.length}>
                Delete Control Point
              </button>
              <button type="button" onClick={() => redline.onSplitSelectedSegment?.()} disabled={!selectedSegment}>
                Split Segment
              </button>
              <button type="button" onClick={() => redline.onProtectSelectedSegment?.()} disabled={!selectedSegment}>
                Engineering Lock
              </button>
              <button type="button" onClick={() => redline.onResetSelectedSegment?.()} disabled={!selectedSegment}>
                Reset Segment
              </button>
            </>
          )}
          <button type="button" onClick={() => redline.onSaveRevision?.()} disabled={!redline.pendingViaPoints?.length && !redline.avoidancePolygon?.length}>
            {redline.saveRevisionLabel ?? "Save Revision"}
          </button>
          <button type="button" onClick={() => redline.onDiscardRevision?.()} disabled={!redline.pendingViaPoints?.length && !redline.avoidancePolygon?.length && !redline.revisionGeometry?.length}>
            Discard Revision
          </button>
          <button type="button" onClick={() => redline.onSelectRevisionForProposal?.()} disabled={!redline.revisionCount}>
            Select Proposal
          </button>
          {!salesMode && (
            <span className="dal-badge warning">
              {redline.mode.replaceAll("_", " ")}
              {redline.revisionCount ? ` | ${redline.revisionCount} revisions` : ""}
            </span>
          )}
        </div>
      )}
      <div
        className={`dal-leaflet-map proposed-network-map${drag ? " panning" : ""}`}
        ref={wrapRef}
        style={{ minHeight: mapMinHeight }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearDrag}
        onPointerCancel={clearDrag}
        onWheel={handleWheel}
        onClick={handleMapClick}
        onDoubleClick={(event) => {
          event.preventDefault();
          setZoom(view.zoom + 1, "double-click");
        }}
      >
        <BasemapLayer tiles={tiles} />
        <svg className="dal-map-svg" width={size.width} height={size.height} role="img" aria-label="Proposed network visualization">
          {sortedCustomerTwinObjectLayers.map((layer) => (
            <g key={`customer-twin-objects-${layer.layerId}`} className="customer-inventory-object-layer" pointerEvents="none">
              {layer.objects
                .filter((object) => customerTwinObjectVisible(object.objectType, view.zoom))
                .filter((object) => inViewport(project(object.coordinate), size.width, size.height, 40))
                .map((object) => {
                  const projected = project(object.coordinate);
                  return (
                    <g key={object.objectId} transform={`translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`}>
                      <circle r={view.zoom >= 10 ? 6 : 4.5} fill={customerTwinFeatureColor(object.objectType)} stroke="#111827" strokeWidth={1.5} opacity={0.9} />
                    </g>
                  );
                })}
              {visibleCustomerTwinStationsForZoom(layer.stations, view.zoom)
                .filter((station) => inViewport(project(station.coordinate), size.width, size.height, 40))
                .map((station) => {
                  const projected = project(station.coordinate);
                  return (
                    <g key={station.stationId} transform={`translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`}>
                      <rect x={-3} y={-3} width={6} height={6} rx={1} fill="#0ea5e9" stroke="#e0f2fe" strokeWidth={1.3} opacity={0.78} />
                    </g>
                  );
                })}
            </g>
          ))}
          {sortedCustomerTwinRouteLayers.map((layer, layerIndex) => {
            const style = customerTwinLineStyle(layer, layerIndex);
            return (
              <g key={`customer-twin-layer-${layer.layerId}`} className="customer-inventory-reference-layer" pointerEvents="none">
                {layer.routes.map((route) => (
                  <path
                    key={route.routeId}
                    d={pathData(route.coordinates, project)}
                    stroke={style.stroke}
                    strokeWidth={layer.domain === "CUSTOMER_PROPOSED" ? 5 : 4}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={style.strokeDasharray}
                    opacity={style.opacity}
                  />
                ))}
              </g>
            );
          })}
          {opportunityOverlayPath.length > 1 && (
            <path
              d={pathData(opportunityOverlayPath, project)}
              stroke={commercialOpportunityOverlay?.draftType === "NEW_GRAPH_CORRIDOR" ? "#7c3aed" : "#f97316"}
              strokeWidth={commercialOpportunityOverlay?.draftType === "NEW_GRAPH_CORRIDOR" ? 6 : 5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={commercialOpportunityOverlay?.draftType === "NEW_GRAPH_CORRIDOR" ? undefined : "10 6"}
              opacity={commercialOpportunityOverlay?.draftType === "NEW_GRAPH_CORRIDOR" ? 0.92 : 0.88}
              pointerEvents="none"
            />
          )}
          {opportunityAttachmentCandidates.map((attachment) => {
            const projected = project(attachment.coordinate);
            return (
              <g
                key={attachment.id}
                className="commercial-opportunity-overlay"
                transform={`translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`}
                pointerEvents="none"
              >
                <circle r={attachment.selected ? 10 : 7} fill={attachment.selected ? "#dbeafe" : "#eff6ff"} stroke={attachment.selected ? "#1d4ed8" : "#60a5fa"} strokeWidth={attachment.selected ? 3 : 2} opacity={0.95} />
                <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke={attachment.selected ? "#1e3a8a" : "#2563eb"} strokeWidth={2} strokeLinecap="round" />
                <text x={12} y={-7} fill="#1e3a8a" fontSize={11} fontWeight="800">
                  {attachment.label}
                </text>
              </g>
            );
          })}
          {opportunityOverlayPoint && (
            <g
              className="commercial-opportunity-overlay"
              transform={`translate(${opportunityOverlayPoint.x.toFixed(1)} ${opportunityOverlayPoint.y.toFixed(1)})`}
              pointerEvents="none"
            >
              <circle r={13} fill="#fff7ed" stroke="#f97316" strokeWidth={3} opacity={0.96} />
              <circle r={5} fill="#ea580c" />
              <text x={15} y={-8} fill="#9a3412" fontSize={12} fontWeight="800">
                {commercialOpportunityOverlay?.candidateLabel ?? "Scout Candidate"}
              </text>
              {commercialOpportunityOverlay?.quickQuoteLabel ? (
                <text x={15} y={8} fill="#7c2d12" fontSize={11} fontWeight="700">
                  {commercialOpportunityOverlay.quickQuoteLabel}
                  {typeof commercialOpportunityOverlay.confidence === "number" ? ` | ${commercialOpportunityOverlay.confidence}%` : ""}
                </text>
              ) : null}
            </g>
          )}
          {opportunityAzPoints.map((point) => {
            const projected = project(point.coordinate);
            return (
              <g
                key={point.id}
                className="commercial-opportunity-overlay"
                transform={`translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`}
                pointerEvents="none"
              >
                <circle r={11} fill={point.role === "A" ? "#dcfce7" : "#fee2e2"} stroke={point.role === "A" ? "#16a34a" : "#dc2626"} strokeWidth={3} opacity={0.95} />
                <text x={-4} y={4} fill="#111827" fontSize={11} fontWeight="900">{point.role}</text>
                <text x={14} y={-6} fill="#111827" fontSize={11} fontWeight="800">{point.label}</text>
              </g>
            );
          })}
          {salesMode && salesDraftVisible && redline?.mode === "COMPARE" && originalPath.length > 1 && (
            <path
              d={pathData(originalPath, project)}
              className="proposed-network-centerline"
              stroke="#64748b"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.42}
            />
          )}
          {salesMode && salesDraftVisible && proposalPath.length > 1 && (
            <path
              d={pathData(proposalPath, project)}
              className="proposed-network-centerline"
              stroke="#2563eb"
              strokeWidth={7}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
              style={{ cursor: redline?.mode === "COMPARE" ? "default" : "grab" }}
              onPointerDown={(event) => {
                event.stopPropagation();
                startSalesCorridorDrag(event);
              }}
            />
          )}
          {!salesMode && layers.route && secondaryCenterlinePath.length > 1 && (
            <path
              d={pathData(secondaryCenterlinePath, project)}
              className="proposed-network-centerline"
              stroke="#16a34a"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.46}
            />
          )}
          {!salesMode && layers.route && centerlinePath.length > 1 && (
            <path
              d={pathData(centerlinePath, project)}
              className="proposed-network-centerline"
              stroke={compare ? "#2563eb" : "#064e3b"}
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.26}
            />
          )}
          {!salesMode && layers.route && sharedCenterlinePath.length > 1 && (
            <path
              d={pathData(sharedCenterlinePath, project)}
              className="proposed-network-centerline"
              stroke="#9333ea"
              strokeWidth={10}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.62}
            />
          )}
          {!salesMode && visibleRevisionPath.length > 1 && (
            <path
              d={pathData(visibleRevisionPath, project)}
              className="proposed-network-centerline"
              stroke="#f97316"
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="10 8"
              opacity={0.82}
            />
          )}
          {!salesMode && avoidancePolygon.length >= 2 && (
            <polygon
              points={avoidancePolygon.map((point) => {
                const projected = project(point);
                return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
              }).join(" ")}
              fill="rgba(239,68,68,0.22)"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="6 5"
            />
          )}
          {!salesMode && avoidancePolygon.map((point, index) => {
            const projected = project(point);
            return (
              <g key={`avoidance-vertex-${index}`} transform={`translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`} pointerEvents="none">
                <circle r={6} fill="#fee2e2" stroke="#ef4444" strokeWidth={2} />
                <text x={9} y={4} fill="#991b1b" fontSize={11} fontWeight="800">
                  !
                </text>
              </g>
            );
          })}
          {!salesMode && pendingViaPoints.map((point, index) => {
            const projected = project(point);
            return (
              <g
                key={`redline-via-${index}`}
                transform={`translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setControlDrag({ pointerId: event.pointerId, index, kind: "via" });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
              >
                <circle r={10} fill="#f8fafc" stroke="#2563eb" strokeWidth={3} />
                <text x={12} y={4} fill="#7c2d12" fontSize={12} fontWeight="800">
                  Via {index + 1}
                </text>
              </g>
            );
          })}
          {!salesMode && redline?.mode === "EDIT_CORRIDOR" && selectedSegmentMidpoint && (
            <g
              transform={`translate(${project(selectedSegmentMidpoint).x.toFixed(1)} ${project(selectedSegmentMidpoint).y.toFixed(1)})`}
              onPointerDown={(event) => {
                event.stopPropagation();
                redline.onAddViaPoint?.(selectedSegmentMidpoint);
                setControlDrag({ pointerId: event.pointerId, index: redline.pendingViaPoints?.length ?? 0, kind: "segment" });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            >
              <circle r={12} fill="#fff" stroke="#2563eb" strokeWidth={3} />
              <circle r={4} fill="#2563eb" />
            </g>
          )}
          {!salesMode && layers.route &&
            graph.edges.map((edge) => {
              const selectedEdge = selected?.type === "edge" && selected.value.id === edge.id;
              const protectedEdge = redline?.lockedSegmentIds?.includes(edge.segmentId ?? edge.id);
              return (
                <path
                  key={edge.id}
                  d={pathData(edge.coordinates, project)}
                  className="proposed-network-segment"
                  stroke={salesMode ? "#2563eb" : protectedEdge ? "#16a34a" : selectedEdge ? "#38bdf8" : compare ? "#2563eb" : "#64748b"}
                  strokeWidth={salesMode ? 7 : protectedEdge ? 8 : selectedEdge ? 7 : 5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onSelect({ type: "edge", value: edge });
                    if (redline?.mode !== "EDIT_CORRIDOR" || !redline.onAddViaPoint || protectedEdge) return;
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;
                    const coordinate = worldToLonLat({ x: centerWorld.x + x - size.width / 2, y: centerWorld.y + y - size.height / 2 }, view.zoom);
                    const point: DALCoordinate = [Number(coordinate[0].toFixed(6)), Number(coordinate[1].toFixed(6))];
                    redline.onAddViaPoint(point);
                    setControlDrag({ pointerId: event.pointerId, index: redline.pendingViaPoints?.length ?? 0, kind: "segment" });
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect({ type: "edge", value: edge });
                  }}
                />
              );
            })}
          {!salesMode && layers.stations &&
            visibleStations.map((station) => {
              const point = project(station.coordinate);
              const stationSelected = selected?.type === "station" && selected.value.stationId === station.stationId;
              return (
                <g
                  key={station.stationId}
                  transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect({ type: "station", value: station });
                  }}
                >
                  <circle r={stationSelected ? 6 : 4} fill="#2563eb" stroke="#eff6ff" strokeWidth={1.5} />
                </g>
              );
            })}
          {!salesMode && visibleObjects.map((object) => {
            const point = project([object.lng, object.lat]);
            const selectedObject = selected?.type === "object" && selected.value.objectId === object.objectId;
            const crossing = object.objectType.includes("CROSSING") || object.objectType === "UNKNOWN_CONSTRAINT";
            return (
              <g
                key={object.objectId}
                transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect({ type: "object", value: object });
                }}
              >
                {crossing && layers.constraints && <circle r={selectedObject ? 12 : 9} fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" />}
                <rect x={selectedObject ? -7 : -5} y={selectedObject ? -7 : -5} width={selectedObject ? 14 : 10} height={selectedObject ? 14 : 10} rx={2} fill={objectColor(object.objectType)} stroke="#fff" strokeWidth={1.5} />
              </g>
            );
          })}
          {graphFeatureRenderingVisible && siteNodes.map((node) => {
            const point = project([node.lng, node.lat]);
            const selectedNode = selected?.type === "node" && selected.value.id === node.id;
            return (
              <g
                key={node.id}
                className="proposed-network-node"
                transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect({ type: "node", value: node });
                }}
              >
                <circle r={selectedNode ? 10 : 7} fill={nodeColor(node.type)} stroke="#fff" strokeWidth={2} />
              </g>
            );
          })}
          <g pointerEvents="none">
            {salesMode && salesDraftVisible && redline?.mode === "COMPARE" && originalLabelPoint && (
              <text x={originalLabelPoint.x.toFixed(1)} y={(originalLabelPoint.y - 14).toFixed(1)} fill="#475569" fontSize={12} fontWeight="800">
                Original Corridor
              </text>
            )}
            {salesMode && salesDraftVisible && proposalLabelPoint && (
              <text x={proposalLabelPoint.x.toFixed(1)} y={(proposalLabelPoint.y + 18).toFixed(1)} fill="#1d4ed8" fontSize={12} fontWeight="800">
                Sales Draft Corridor
              </text>
            )}
            {projectedLabels.map((label) => (
              <text key={label.key} x={label.x.toFixed(1)} y={label.y.toFixed(1)} fill={label.fill} fontSize={label.fontSize} fontWeight="700">
                {label.text}
              </text>
            ))}
          </g>
        </svg>
        {!salesMode && (
          <div className="dal-map-zoom">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setZoom(view.zoom + 1, "zoom-control-plus");
              }}
            >
              +
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                setZoom(view.zoom - 1, "zoom-control-minus");
              }}
            >
              -
            </button>
          </div>
        )}
        {!salesMode && (
          <div
            className="dal-map-layer-controls"
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              display: "grid",
              gap: 4,
              padding: 8,
              background: "rgba(255,255,255,0.92)",
              border: "1px solid rgba(15,23,42,0.14)",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <>
              <b>Corridor</b>
              {([
                ["route", "Original Route / Proposed Revision / Selected Proposal Route"],
                ["stations", "Stationing / Mileposts"],
                ["regenSites", "Regen / ILA Sites"],
              ] as Array<[keyof LayerState, string]>).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
                  <span>{label}</span>
                </label>
              ))}
              <b>Engineering</b>
              {([
                ["crossings", "Crossings"],
                ["vaults", "Vaults / Handholes"],
                ["constraints", "Constraints / Civil Mix / Locked Segments"],
              ] as Array<[keyof LayerState, string]>).map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
                  <span>{label}</span>
                </label>
              ))}
              <b>Reference</b>
              <span>Customer Sites / Existing Network / Existing Facilities</span>
              <b>Base Map</b>
              <span>Roads / Terrain / Satellite / Aerial / Parcels</span>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={developerLayersOpen} onChange={() => setDeveloperLayersOpen((open) => !open)} />
                <span>Developer Layers</span>
              </label>
              {developerLayersOpen &&
                ([
                  ["labels", "Internal Labels"],
                  ["ductFiberObjects", "Duct/Fiber Objects"],
                ] as Array<[keyof LayerState, string]>).map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={layers[key]} onChange={() => toggleLayer(key)} />
                    <span>{label}</span>
                  </label>
              ))}
            </>
          </div>
        )}
        <div
          className="commercial-map-layer-dock"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <b>Commercial Layers</b>
          {mapLayerDockLayers.map((layer) => (
            <label key={layer.id}>
              <input
                type="checkbox"
                checked={layer.visibility === "VISIBLE"}
                disabled={!layer.sourceNetworkId}
                onChange={() => layer.sourceNetworkId && onCommercialLayerVisibilityToggle?.(layer.sourceNetworkId)}
              />
              <span>{layer.label}</span>
            </label>
          ))}
        </div>
        <div className="dal-map-attribution">OpenStreetMap | Zoom {view.zoom}</div>
      </div>
      {compare && (
        <div className="dal-status">
          Compare overlay: primary route blue ({compare.primaryLabel ?? graph.opportunityName}), secondary route green ({compare.secondaryLabel ?? compare.secondaryGraph.opportunityName}), shared corridor estimate purple.
        </div>
      )}
      {!salesMode && (
        <div className="dal-status">
          Fit runs once when the route loads. After that, pan, wheel zoom, and camera buttons own the viewport. Stations and labels progressively render by zoom level.
        </div>
      )}
    </section>
  );
}
