import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import {
  MAP_LAYER_ORDER,
  resolveLayerStates,
  primitiveRenderKey,
  type MapFeatureRef,
  type MapKernelPrimitive,
  type MapKernelRenderSpec,
  type MapLayerVisibility,
} from "./MapLayerManager";
import { auditMapKernelRenderAuthority, renderMapKernelPrimitives, summarizeMapKernelMetrics, type MapKernelMetrics } from "./MapRenderer";
import { createMapSelection, MapSelectionContext, type MapSelection } from "./MapSelectionManager";
import { boundsFromPrimitives, MapViewportContext, type MapBounds, type MapViewportRequest } from "./MapViewportManager";
import { resolvePrimitiveStyle } from "./MapStyleManager";
import { isGeographicReferenceLayerId } from "../reference/ReferenceLayerManager";
import { centerFromCoordinates, isCoordinate, lonLatToWorld, normalizeTileX, tileCount, validTileY, worldToLonLat, worldToTile, zoomForCoordinates } from "../gis/geo";

// Constitutional guardrail: MapKernel renders ScopeVersion/IOF truth only.
// It owns viewport, selection, and presentation state; it does not create authoritative geometry.
export type MapKernelMode = "topology" | "geographic";
export type MapKernelBaseLayer = "street" | "satellite" | "hybrid" | "terrain";

export type MapKernelProps = {
  specs: MapKernelRenderSpec[];
  layerVisibility?: MapLayerVisibility;
  stationDensityFeet?: number;
  showStationLabels?: boolean;
  height?: number;
  initialMode?: MapKernelMode;
  initialBaseLayer?: MapKernelBaseLayer;
  editableRoute?: MapKernelEditableRoute;
  onSelectionChange?: (selection: MapSelection | null) => void;
  onMetricsChange?: (metrics: MapKernelMetrics) => void;
};

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 560;
const TILE_SIZE = 256;
const EMPTY_BOUNDS: MapBounds = { west: -100, south: 30, east: -99, north: 31 };
const DEFAULT_CENTER: [number, number] = [-97.7431, 30.2672];
const MAP_KERNEL_VIEW_STATE_KEY = "hyperlinx-dal-dev:map-kernel:engineering-view-state:v1";
const FEET_PER_MILE = 5280;

type Tile = {
  key: string;
  x: number;
  y: number;
  z: number;
  left: number;
  top: number;
};

type TileSource = {
  label: string;
  attribution: string;
  opacity?: number;
  url: (z: number, x: number, y: number) => string;
};

type GeographicViewState = {
  center: [number, number];
  zoom: number;
  bearing: number;
};

type PersistedMapKernelViewState = {
  centerLon: number;
  centerLat: number;
  zoom: number;
  bearing: number;
  activeLayers: string[];
  mode?: MapKernelMode;
  baseLayer?: MapKernelBaseLayer;
  updatedAt: string;
};

type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCenterWorld: { x: number; y: number };
  moved: boolean;
};

const BASE_LAYERS: Record<MapKernelBaseLayer, { label: string; sources: TileSource[] }> = {
  street: {
    label: "Street",
    sources: [
      {
        label: "OpenStreetMap",
        attribution: "OpenStreetMap",
        url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      },
    ],
  },
  satellite: {
    label: "Satellite",
    sources: [
      {
        label: "Esri World Imagery",
        attribution: "Esri World Imagery",
        url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      },
    ],
  },
  hybrid: {
    label: "Hybrid",
    sources: [
      {
        label: "Esri World Imagery",
        attribution: "Esri World Imagery + OpenStreetMap",
        url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
      },
      {
        label: "OpenStreetMap Labels",
        attribution: "Esri World Imagery + OpenStreetMap",
        opacity: 0.46,
        url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
      },
    ],
  },
  terrain: {
    label: "Terrain",
    sources: [
      {
        label: "OpenTopoMap",
        attribution: "OpenTopoMap",
        url: (z, x, y) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
      },
    ],
  },
};

export type MapKernelEditableRoute = {
  routeId: string;
  geometry: [number, number][];
  enabled?: boolean;
  selectedVertexIndex?: number | null;
  onGeometryChange?: (geometry: [number, number][]) => void;
  onVertexSelect?: (index: number | null) => void;
};

function project(bounds: MapBounds, coordinate: [number, number]) {
  const width = Math.max(bounds.east - bounds.west, 0.0001);
  const height = Math.max(bounds.north - bounds.south, 0.0001);
  const x = ((coordinate[0] - bounds.west) / width) * SVG_WIDTH;
  const y = SVG_HEIGHT - ((coordinate[1] - bounds.south) / height) * SVG_HEIGHT;
  return { x, y };
}

function unproject(bounds: MapBounds, x: number, y: number): [number, number] {
  const width = Math.max(bounds.east - bounds.west, 0.0001);
  const height = Math.max(bounds.north - bounds.south, 0.0001);
  const lon = bounds.west + (x / SVG_WIDTH) * width;
  const lat = bounds.south + ((SVG_HEIGHT - y) / SVG_HEIGHT) * height;
  return [lon, lat];
}

function linePoints(bounds: MapBounds, coordinates: [number, number][]) {
  return coordinates.map((coordinate) => {
    const point = project(bounds, coordinate);
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).join(" ");
}

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function readPersistedViewState(): PersistedMapKernelViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MAP_KERNEL_VIEW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedMapKernelViewState>;
    const centerLon = safeNumber(parsed.centerLon);
    const centerLat = safeNumber(parsed.centerLat);
    const zoom = safeNumber(parsed.zoom);
    if (centerLon === undefined || centerLat === undefined || zoom === undefined) return null;
    if (!isCoordinate([centerLon, centerLat])) return null;
    return {
      centerLon,
      centerLat,
      zoom: Math.max(3, Math.min(20, Math.round(zoom))),
      bearing: safeNumber(parsed.bearing) ?? 0,
      activeLayers: Array.isArray(parsed.activeLayers) ? parsed.activeLayers.map(String) : [],
      mode: parsed.mode === "geographic" || parsed.mode === "topology" ? parsed.mode : undefined,
      baseLayer:
        parsed.baseLayer === "street" || parsed.baseLayer === "satellite" || parsed.baseLayer === "hybrid" || parsed.baseLayer === "terrain"
          ? parsed.baseLayer
          : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch (error) {
    console.warn("MAP KERNEL VIEW STATE LOAD FAILED", error);
    return null;
  }
}

function writePersistedViewState(state: PersistedMapKernelViewState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MAP_KERNEL_VIEW_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("MAP KERNEL VIEW STATE SAVE FAILED", error);
  }
}

function coordinatesFromBounds(bounds: MapBounds): [number, number][] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}

function viewForCoordinates(coordinates: [number, number][], width: number, height: number): GeographicViewState {
  return {
    center: centerFromCoordinates(coordinates, DEFAULT_CENTER),
    zoom: zoomForCoordinates(coordinates, width, height),
    bearing: 0,
  };
}

function visibleBoundsFromView(view: GeographicViewState, width: number, height: number): MapBounds {
  const centerWorld = lonLatToWorld(view.center, view.zoom);
  const northwest = worldToLonLat({ x: centerWorld.x - width / 2, y: centerWorld.y - height / 2 }, view.zoom);
  const southeast = worldToLonLat({ x: centerWorld.x + width / 2, y: centerWorld.y + height / 2 }, view.zoom);
  return {
    west: Math.min(northwest[0], southeast[0]),
    south: Math.min(northwest[1], southeast[1]),
    east: Math.max(northwest[0], southeast[0]),
    north: Math.max(northwest[1], southeast[1]),
  };
}

function distanceFeet(a: [number, number], b: [number, number]) {
  const radiusFeet = 20902231;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const deltaLat = ((b[1] - a[1]) * Math.PI) / 180;
  const deltaLon = ((b[0] - a[0]) * Math.PI) / 180;
  const hav =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return 2 * radiusFeet * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function lineLengthFeet(coordinates: [number, number][]) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceFeet(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function formatDistance(feet: number) {
  if (!Number.isFinite(feet)) return "n/a";
  if (feet >= FEET_PER_MILE) return `${(feet / FEET_PER_MILE).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi`;
  return `${Math.round(feet).toLocaleString()} ft`;
}

function collectPrimitiveCoordinates(primitives: MapKernelPrimitive[], editableRoute?: MapKernelEditableRoute) {
  const coordinates: [number, number][] = [];
  primitives.forEach((primitive) => {
    if (primitive.coordinate && isCoordinate(primitive.coordinate)) coordinates.push(primitive.coordinate);
    primitive.coordinates?.forEach((coordinate) => {
      if (isCoordinate(coordinate)) coordinates.push(coordinate);
    });
    primitive.rings?.forEach((ring) => {
      ring.forEach((coordinate) => {
        if (isCoordinate(coordinate)) coordinates.push(coordinate);
      });
    });
  });
  editableRoute?.geometry.forEach((coordinate) => {
    if (isCoordinate(coordinate)) coordinates.push(coordinate);
  });
  return coordinates;
}

function primitiveSelectionRef(primitive: MapKernelPrimitive): MapFeatureRef {
  return {
    ...primitive.ref,
    sourceLayer: primitive.renderIdentity?.sourceLayer ?? primitive.ref.sourceLayer,
    rootScopeVersionId: primitive.renderIdentity?.rootScopeVersionId ?? primitive.ref.rootScopeVersionId,
    parentScopeVersionId: primitive.renderIdentity?.parentScopeVersionId ?? primitive.ref.parentScopeVersionId,
    renderKey: primitive.renderIdentity?.key ?? primitive.ref.renderKey,
  };
}

export default function MapKernel({
  specs,
  layerVisibility,
  stationDensityFeet = 300,
  showStationLabels = true,
  height = 560,
  initialMode = "topology",
  initialBaseLayer = "hybrid",
  editableRoute,
  onSelectionChange,
  onMetricsChange,
}: MapKernelProps) {
  const persistedViewState = useMemo(() => readPersistedViewState(), []);
  const [selection, setSelectionState] = useState<MapSelection | null>(null);
  const [viewportRequest, requestViewport] = useState<MapViewportRequest | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<MapKernelMode>(persistedViewState?.mode ?? initialMode);
  const [baseLayer, setBaseLayer] = useState<MapKernelBaseLayer>(persistedViewState?.baseLayer ?? initialBaseLayer);
  const [geoSize, setGeoSize] = useState({ width: SVG_WIDTH, height });
  const [geoView, setGeoView] = useState<GeographicViewState>({
    center: persistedViewState ? [persistedViewState.centerLon, persistedViewState.centerLat] : DEFAULT_CENTER,
    zoom: persistedViewState?.zoom ?? 16,
    bearing: persistedViewState?.bearing ?? 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panDragRef = useRef<PanDragState | null>(null);
  const suppressNextSelectionRef = useRef(false);
  const autoFitInitializedRef = useRef(Boolean(persistedViewState));
  const routeEditLocked = Boolean(editableRoute?.enabled);
  const primitives = useMemo(
    () => renderMapKernelPrimitives(specs, { layerVisibility, stationDensityFeet, showStationLabels }),
    [layerVisibility, showStationLabels, specs, stationDensityFeet]
  );
  const metrics = useMemo(
    () => summarizeMapKernelMetrics(specs, { layerVisibility, stationDensityFeet, showStationLabels }),
    [layerVisibility, showStationLabels, specs, stationDensityFeet]
  );
  const renderAudit = useMemo(
    () => auditMapKernelRenderAuthority(specs, { layerVisibility, stationDensityFeet, showStationLabels }),
    [layerVisibility, showStationLabels, specs, stationDensityFeet]
  );
  const bounds = useMemo(() => {
    if (viewportRequest?.bounds) return viewportRequest.bounds;
    const editPrimitive: MapKernelPrimitive | null = editableRoute?.geometry.length
      ? {
          id: editableRoute.routeId,
          layerId: "lateral",
          kind: "line",
          ref: { kind: "Lateral", id: editableRoute.routeId },
          coordinates: editableRoute.geometry,
          metadata: { selectable: false, source: "editable-route" },
        }
      : null;
    return boundsFromPrimitives(editPrimitive ? [...primitives, editPrimitive] : primitives) ?? EMPTY_BOUNDS;
  }, [editableRoute?.geometry, editableRoute?.routeId, primitives, viewportRequest?.bounds]);
  const layerStates = useMemo(() => resolveLayerStates(layerVisibility), [layerVisibility]);
  const focusCoordinates = useMemo(() => collectPrimitiveCoordinates(primitives, editableRoute), [editableRoute, primitives]);
  const candidateCoordinates = useMemo(
    () => collectPrimitiveCoordinates(primitives.filter((primitive) => primitive.ref.kind === "Site" || primitive.layerId === "site")),
    [primitives]
  );
  const attachmentCoordinates = useMemo(
    () => collectPrimitiveCoordinates(primitives.filter((primitive) => primitive.ref.kind === "Attachment" || primitive.layerId === "attachment")),
    [primitives]
  );
  const routeCoordinates = useMemo(
    () =>
      collectPrimitiveCoordinates(
        primitives.filter((primitive) => primitive.ref.kind === "Route" || primitive.ref.kind === "Lateral" || primitive.layerId === "lateral")
      ),
    [primitives]
  );
  const certifiedRouteCoordinates = useMemo(
    () =>
      collectPrimitiveCoordinates(
        primitives.filter((primitive) => {
          const authority = String(primitive.metadata?.renderAuthority ?? "");
          return primitive.layerId === "lateral" || authority.includes("Certified");
        })
      ),
    [primitives]
  );
  const visibleGeoBounds = useMemo(() => visibleBoundsFromView(geoView, geoSize.width, geoSize.height), [geoSize.height, geoSize.width, geoView]);
  const viewWidthFeet = useMemo(
    () => distanceFeet([visibleGeoBounds.west, geoView.center[1]], [visibleGeoBounds.east, geoView.center[1]]),
    [geoView.center, visibleGeoBounds.east, visibleGeoBounds.west]
  );
  const viewHeightFeet = useMemo(
    () => distanceFeet([geoView.center[0], visibleGeoBounds.south], [geoView.center[0], visibleGeoBounds.north]),
    [geoView.center, visibleGeoBounds.north, visibleGeoBounds.south]
  );
  const routeLengthFeet = useMemo(() => lineLengthFeet(routeCoordinates), [routeCoordinates]);
  const activeLayerIds = useMemo(() => layerStates.filter((layer) => layer.visible).map((layer) => layer.layerId), [layerStates]);
  const geoCenterWorld = useMemo(() => lonLatToWorld(geoView.center, geoView.zoom), [geoView.center, geoView.zoom]);
  const geoTiles = useMemo<Tile[]>(() => {
    const leftWorld = geoCenterWorld.x - geoSize.width / 2;
    const topWorld = geoCenterWorld.y - geoSize.height / 2;
    const startX = worldToTile(leftWorld) - 1;
    const endX = worldToTile(geoCenterWorld.x + geoSize.width / 2) + 1;
    const startY = worldToTile(topWorld) - 1;
    const endY = worldToTile(geoCenterWorld.y + geoSize.height / 2) + 1;
    const nextTiles: Tile[] = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
        nextTiles.push({
          key: `${geoView.zoom}-${x}-${y}`,
          x,
          y,
          z: geoView.zoom,
          left: x * TILE_SIZE - leftWorld,
          top: y * TILE_SIZE - topWorld,
        });
      }
    }
    return nextTiles;
  }, [geoCenterWorld.x, geoCenterWorld.y, geoSize.height, geoSize.width, geoView.zoom]);

  useEffect(() => {
    onMetricsChange?.(metrics);
  }, [metrics, onMetricsChange]);

  useEffect(() => {
    if (renderAudit.status === "PASS") return;
    console.warn("MAP KERNEL RENDER AUTHORITY VALIDATION FAILED", {
      duplicateKeyCount: renderAudit.duplicateKeyCount,
      duplicateObjectCount: renderAudit.duplicateObjectCount,
      duplicateRenderAuthorityCount: renderAudit.duplicateRenderAuthorityCount,
      duplicateKeys: renderAudit.duplicateKeys.slice(0, 10),
      duplicateRenderAuthorities: renderAudit.duplicateRenderAuthorities.slice(0, 10),
    });
  }, [renderAudit]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width && rect?.height) setGeoSize({ width: rect.width, height: rect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    writePersistedViewState({
      centerLon: geoView.center[0],
      centerLat: geoView.center[1],
      zoom: geoView.zoom,
      bearing: geoView.bearing,
      activeLayers: activeLayerIds,
      mode,
      baseLayer,
      updatedAt: new Date().toISOString(),
    });
  }, [activeLayerIds, baseLayer, geoView.bearing, geoView.center, geoView.zoom, mode]);

  useEffect(() => {
    if (mode !== "geographic" || routeEditLocked || autoFitInitializedRef.current || !focusCoordinates.length) return;
    autoFitInitializedRef.current = true;
    setGeoView(viewForCoordinates(focusCoordinates, geoSize.width, geoSize.height));
  }, [focusCoordinates, geoSize.height, geoSize.width, mode, routeEditLocked]);

  useEffect(() => {
    if (mode !== "geographic" || routeEditLocked || !viewportRequest?.bounds) return;
    setGeoView(viewForCoordinates(coordinatesFromBounds(viewportRequest.bounds), geoSize.width, geoSize.height));
  }, [geoSize.height, geoSize.width, mode, routeEditLocked, viewportRequest]);

  function setSelection(selectionValue: MapSelection | null) {
    setSelectionState(selectionValue);
    onSelectionChange?.(selectionValue);
  }

  function selectPrimitive(primitive: MapKernelPrimitive) {
    if (suppressNextSelectionRef.current) {
      suppressNextSelectionRef.current = false;
      return;
    }
    if (primitive.metadata?.selectable === false) return;
    setSelection(createMapSelection(primitiveSelectionRef(primitive), primitive.payload));
  }

  function setGeoCenterFromWorld(point: { x: number; y: number }) {
    setGeoView((prev) => ({
      ...prev,
      center: worldToLonLat(point, prev.zoom),
    }));
  }

  function beginMapPan(event: PointerEvent<SVGSVGElement>) {
    if (draggingVertexIndex !== null) return;
    if (event.button !== 0 && event.button !== 1) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCenterWorld: geoCenterWorld,
      moved: false,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function updateMapPan(event: PointerEvent<SVGSVGElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      drag.moved = true;
      suppressNextSelectionRef.current = true;
    }
    setGeoCenterFromWorld({
      x: drag.startCenterWorld.x - dx,
      y: drag.startCenterWorld.y - dy,
    });
  }

  function endMapPan(event?: PointerEvent<SVGSVGElement>) {
    const drag = panDragRef.current;
    if (event && drag?.pointerId === event.pointerId) event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag?.moved) {
      suppressNextSelectionRef.current = true;
      window.setTimeout(() => {
        suppressNextSelectionRef.current = false;
      }, 0);
    }
    panDragRef.current = null;
    setIsPanning(false);
  }

  function handleGeographicWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      if (routeEditLocked) return;
      const nextZoom = Math.max(3, Math.min(20, geoView.zoom + (event.deltaY < 0 ? 1 : -1)));
      if (nextZoom === geoView.zoom) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const cursorWorldBefore = {
        x: geoCenterWorld.x - geoSize.width / 2 + cursorX,
        y: geoCenterWorld.y - geoSize.height / 2 + cursorY,
      };
      const cursorCoordinate = worldToLonLat(cursorWorldBefore, geoView.zoom);
      const cursorWorldAfter = lonLatToWorld(cursorCoordinate, nextZoom);
      const nextCenterWorld = {
        x: cursorWorldAfter.x - cursorX + geoSize.width / 2,
        y: cursorWorldAfter.y - cursorY + geoSize.height / 2,
      };
      setGeoView({
        center: worldToLonLat(nextCenterWorld, nextZoom),
        zoom: nextZoom,
        bearing: geoView.bearing,
      });
      return;
    }
    setGeoCenterFromWorld({
      x: geoCenterWorld.x + event.deltaX,
      y: geoCenterWorld.y + event.deltaY,
    });
  }

  function updateEditableVertex(event: MouseEvent<SVGSVGElement>) {
    if (!editableRoute?.enabled || draggingVertexIndex === null || !editableRoute.onGeometryChange || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const targetWidth = mode === "geographic" ? geoSize.width : SVG_WIDTH;
    const targetHeight = mode === "geographic" ? geoSize.height : SVG_HEIGHT;
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * targetWidth;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * targetHeight;
    const nextCoordinate =
      mode === "geographic"
        ? worldToLonLat(
            {
              x: geoCenterWorld.x - geoSize.width / 2 + x,
              y: geoCenterWorld.y - geoSize.height / 2 + y,
            },
            geoView.zoom
          )
        : unproject(bounds, x, y);
    const next = editableRoute.geometry.map((coordinate, index) => (index === draggingVertexIndex ? nextCoordinate : coordinate));
    editableRoute.onGeometryChange(next);
  }

  function pointFor(coordinate: [number, number]) {
    if (mode === "geographic") {
      const point = lonLatToWorld(coordinate, geoView.zoom);
      return {
        x: point.x - geoCenterWorld.x + geoSize.width / 2,
        y: point.y - geoCenterWorld.y + geoSize.height / 2,
      };
    }
    return project(bounds, coordinate);
  }

  function linePointsFor(coordinates: [number, number][]) {
    return coordinates
      .map((coordinate) => {
        const point = pointFor(coordinate);
        return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      })
      .join(" ");
  }

  function renderEditableRoute() {
    if (!editableRoute?.geometry.length) return null;
    const selectedIndex = editableRoute.selectedVertexIndex ?? draggingVertexIndex;
    return (
      <g key={`editable-route:${editableRoute.routeId}`} className="dal-map-kernel-editable-route">
        <polyline
          points={linePointsFor(editableRoute.geometry)}
          fill="none"
          stroke="#dc2626"
          strokeWidth={4}
          strokeDasharray="8 5"
          opacity={0.95}
        />
        {editableRoute.geometry.map((coordinate, index) => {
          const point = pointFor(coordinate);
          const selected = selectedIndex === index;
          return (
            <circle
              key={`${editableRoute.routeId}:vertex:${index}`}
              cx={point.x}
              cy={point.y}
              r={selected ? 8 : 6}
              fill={selected ? "#dc2626" : "#ffffff"}
              stroke="#dc2626"
              strokeWidth={3}
              opacity={editableRoute.enabled === false ? 0.55 : 1}
              style={{ cursor: editableRoute.enabled === false ? "default" : "grab" }}
              onPointerDown={(event) => {
                if (editableRoute.enabled === false) return;
                event.stopPropagation();
                setDraggingVertexIndex(index);
                editableRoute.onVertexSelect?.(index);
              }}
              onMouseDown={(event) => {
                if (editableRoute.enabled === false) return;
                event.stopPropagation();
                setDraggingVertexIndex(index);
                editableRoute.onVertexSelect?.(index);
              }}
              onClick={(event) => {
                event.stopPropagation();
                editableRoute.onVertexSelect?.(index);
              }}
            >
              <title>{`Route vertex ${index + 1}`}</title>
            </circle>
          );
        })}
      </g>
    );
  }

  function renderPrimitive(primitive: MapKernelPrimitive) {
    const isReferencePrimitive = isGeographicReferenceLayerId(primitive.layerId) || primitive.metadata?.referenceLayer === true;
    if (isReferencePrimitive && mode !== "geographic") return null;
    if (mode === "geographic" && (isReferencePrimitive || primitive.metadata?.minZoom !== undefined || primitive.metadata?.maxZoom !== undefined)) {
      const minZoom = Number(primitive.metadata?.minZoom ?? 0);
      const maxZoom = Number(primitive.metadata?.maxZoom ?? 24);
      if (geoView.zoom < minZoom || geoView.zoom > maxZoom) return null;
    }
    const style = resolvePrimitiveStyle(primitive.layerId, primitive.kind, primitive.style);
    const selected = selection?.featureRef.renderKey
      ? selection.featureRef.renderKey === primitive.renderIdentity?.key
      : selection?.featureRef.id === primitive.ref.id && selection?.featureRef.kind === primitive.ref.kind;
    const strokeWidth = selected ? style.strokeWidth + 2 : style.strokeWidth;
    if (primitive.kind === "line" && primitive.coordinates?.length) {
      return (
        <polyline
          key={primitiveRenderKey(primitive)}
          points={linePointsFor(primitive.coordinates)}
          fill="none"
          stroke={style.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={style.dasharray}
          opacity={style.opacity}
          onClick={() => selectPrimitive(primitive)}
        />
      );
    }
    if (primitive.kind === "polygon" && primitive.rings?.[0]?.length) {
      return (
        <polygon
          key={primitiveRenderKey(primitive)}
          points={linePointsFor(primitive.rings[0])}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={strokeWidth}
          opacity={style.opacity}
          onClick={() => selectPrimitive(primitive)}
        />
      );
    }
    if (primitive.coordinate && primitive.kind === "label") {
      const point = pointFor(primitive.coordinate);
      return (
        <text
          key={primitiveRenderKey(primitive)}
          x={point.x + 6}
          y={point.y - 6}
          fill={style.fill}
          fontSize={style.fontSize}
          fontWeight={style.fontWeight}
          onClick={() => selectPrimitive(primitive)}
        >
          {primitive.label}
        </text>
      );
    }
    if (primitive.coordinate) {
      const point = pointFor(primitive.coordinate);
      return (
        <circle
          key={primitiveRenderKey(primitive)}
          cx={point.x}
          cy={point.y}
          r={selected ? style.radius + 2 : style.radius}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={strokeWidth}
          opacity={style.opacity}
          onClick={() => selectPrimitive(primitive)}
        />
      );
    }
    return null;
  }

  function fitGeographicView(coordinates: [number, number][], requestMode: MapViewportRequest["mode"], targetId: string) {
    if (routeEditLocked || !coordinates.length) return;
    const nextView = viewForCoordinates(coordinates, geoSize.width, geoSize.height);
    setGeoView(nextView);
    requestViewport({
      mode: requestMode,
      bounds: boundsFromPrimitives([
        {
          id: `${targetId}:fit-bounds`,
          layerId: "object",
          kind: "line",
          ref: { kind: "Object", id: targetId },
          coordinates,
          metadata: { selectable: false, source: "map-kernel-fit" },
        },
      ]) ?? undefined,
      targetId,
      requestedAt: new Date().toISOString(),
    });
  }

  function zoomGeographicView(delta: number) {
    if (routeEditLocked) return;
    setGeoView((prev) => ({ ...prev, zoom: Math.max(3, Math.min(20, prev.zoom + delta)) }));
  }

  function renderBaseTiles(source: TileSource) {
    return geoTiles
      .filter((tile) => validTileY(tile.y, tile.z))
      .map((tile) => {
        const x = normalizeTileX(tile.x, tile.z);
        const y = Math.max(0, Math.min(tileCount(tile.z) - 1, tile.y));
        return (
          <img
            key={`${source.label}:${tile.key}`}
            className="dal-map-kernel-tile"
            src={source.url(tile.z, x, y)}
            style={{ left: tile.left, top: tile.top, opacity: source.opacity ?? 1 }}
            loading="lazy"
            alt=""
          />
        );
      });
  }

  function renderTopologyView() {
    return (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label="Hyperlinx topology truth map"
        onMouseMove={updateEditableVertex}
        onMouseUp={() => setDraggingVertexIndex(null)}
        onMouseLeave={() => setDraggingVertexIndex(null)}
      >
        <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="#f8fafc" />
        {primitives.map(renderPrimitive)}
        {renderEditableRoute()}
      </svg>
    );
  }

  function renderGeographicView() {
    const layer = BASE_LAYERS[baseLayer];
    return (
      <div ref={containerRef} className="dal-map-kernel-geo-stage" style={{ minHeight: height }}>
        <div className={`dal-map-kernel-basemap ${baseLayer}`} aria-hidden="true">
          {layer.sources.map((source) => renderBaseTiles(source))}
        </div>
        <svg
          ref={svgRef}
          className={`dal-map-kernel-geographic-svg ${isPanning ? "panning" : ""}`}
          width={geoSize.width}
          height={geoSize.height}
          role="img"
          aria-label="Hyperlinx geographic engineering map"
          onPointerDown={beginMapPan}
          onPointerMove={updateMapPan}
          onPointerUp={(event) => endMapPan(event)}
          onPointerCancel={(event) => endMapPan(event)}
          onWheel={handleGeographicWheel}
          onMouseMove={updateEditableVertex}
          onMouseUp={() => {
            setDraggingVertexIndex(null);
          }}
          onMouseLeave={() => {
            setDraggingVertexIndex(null);
            endMapPan();
          }}
        >
          {primitives.map(renderPrimitive)}
          {renderEditableRoute()}
        </svg>
        <div className="dal-map-kernel-geo-zoom">
          <button type="button" onClick={() => zoomGeographicView(1)} disabled={routeEditLocked} title="Zoom in">
            +
          </button>
          <button type="button" onClick={() => zoomGeographicView(-1)} disabled={routeEditLocked} title="Zoom out">
            -
          </button>
          <button
            type="button"
            onClick={() => fitGeographicView(candidateCoordinates, "FIT_CANDIDATE", "candidate")}
            disabled={routeEditLocked || !candidateCoordinates.length}
          >
            Fit Candidate
          </button>
          <button
            type="button"
            onClick={() => fitGeographicView(attachmentCoordinates, "FIT_ATTACHMENT", "attachment")}
            disabled={routeEditLocked || !attachmentCoordinates.length}
          >
            Fit Attachment
          </button>
          <button
            type="button"
            onClick={() => fitGeographicView(routeCoordinates, "FIT_ROUTE", "route")}
            disabled={routeEditLocked || !routeCoordinates.length}
          >
            Fit Route
          </button>
          <button
            type="button"
            onClick={() => fitGeographicView(certifiedRouteCoordinates, "FIT_CERTIFIED_ROUTE", "certified-route")}
            disabled={routeEditLocked || !certifiedRouteCoordinates.length}
          >
            Fit Certified Route
          </button>
          <button
            type="button"
            onClick={() => fitGeographicView(focusCoordinates, "FIT_ENTIRE_NETWORK", "entire-network")}
            disabled={routeEditLocked || !focusCoordinates.length}
          >
            Fit Entire Network
          </button>
        </div>
        <div className="dal-map-kernel-engineering-extent">
          <span>Route Length: {formatDistance(routeLengthFeet)}</span>
          <span>View Width: {formatDistance(viewWidthFeet)}</span>
          <span>View Height: {formatDistance(viewHeightFeet)}</span>
          <span>Scale: 1 px = {formatDistance(viewWidthFeet / Math.max(geoSize.width, 1))}</span>
          <span>Zoom: {geoView.zoom}</span>
          <span>Bearing: {Math.round(geoView.bearing)} deg</span>
          {routeEditLocked ? <span>Route Edit Lock: ON</span> : <span>Route Edit Lock: OFF</span>}
        </div>
        <div className="dal-map-kernel-attribution">{layer.sources[0]?.attribution ?? layer.label}</div>
      </div>
    );
  }

  return (
    <MapSelectionContext.Provider value={{ selection, setSelection }}>
      <MapViewportContext.Provider value={{ viewportRequest, requestViewport }}>
        <div className="dal-map-kernel" style={{ minHeight: height }}>
          <div className="dal-map-kernel-toolbar">
            <div className="dal-map-kernel-mode-controls">
              <button type="button" className={mode === "topology" ? "active-toggle" : undefined} onClick={() => setMode("topology")}>
                Topology View
              </button>
              <button type="button" className={mode === "geographic" ? "active-toggle" : undefined} onClick={() => setMode("geographic")}>
                Geographic Engineering View
              </button>
              {mode === "geographic" ? (
                <select value={baseLayer} onChange={(event) => setBaseLayer(event.target.value as MapKernelBaseLayer)} aria-label="Geographic base layer">
                  {Object.entries(BASE_LAYERS).map(([id, layer]) => (
                    <option key={id} value={id}>
                      {layer.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            {MAP_LAYER_ORDER.map((layerId) => {
              const layer = layerStates.find((item) => item.layerId === layerId);
              return (
                <span key={layerId} className={`dal-map-kernel-layer ${layer?.visible ? "visible" : "hidden"}`}>
                  {layer?.label ?? layerId}
                </span>
              );
            })}
          </div>
          {mode === "geographic" ? renderGeographicView() : renderTopologyView()}
          <div className="dal-map-kernel-footer">
            <span>Mode: {mode === "geographic" ? "Geographic Truth" : "Topological Truth"}</span>
            {mode === "geographic" ? <span>Base Layer: {BASE_LAYERS[baseLayer].label}</span> : null}
            <span>ScopeVersions: {metrics.visibleScopeVersions.toLocaleString()}</span>
            <span>IOF Packages: {metrics.visibleIofPackages.toLocaleString()}</span>
            <span>Routes: {metrics.visibleRoutes.toLocaleString()}</span>
            <span>Stations: {metrics.visibleStations.toLocaleString()}</span>
            <span>Nodes: {metrics.visibleNodes.toLocaleString()}</span>
            <span>Objects: {metrics.visibleObjects.toLocaleString()}</span>
            <span>Render Authority: {metrics.renderAuthorityStatus}</span>
            <span>Duplicate Keys: {metrics.duplicateKeyCount.toLocaleString()}</span>
            <span>Duplicate Render Authorities: {metrics.duplicateRenderAuthorityCount.toLocaleString()}</span>
          </div>
        </div>
      </MapViewportContext.Provider>
    </MapSelectionContext.Provider>
  );
}
