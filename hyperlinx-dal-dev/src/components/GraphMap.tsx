import { useEffect, useRef, useState } from "react";
import type { DALCoordinate, InventoryEdge, InventoryGraph, InventoryNode, InventoryRoute, InventoryStation } from "../types/dal";
import type { GraphExtension } from "../types/graphExtension";

export type GraphLayerToggles = {
  inventory?: boolean;
  extensions?: boolean;
  inventoryPath?: boolean;
  candidate?: boolean;
  buildPath?: boolean;
  attachmentPoint?: boolean;
  crossings?: boolean;
  routes: boolean;
  stations: boolean;
  edges: boolean;
  nodes: boolean;
};

type Bounds = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

type BoundsAccumulator = Bounds & {
  count: number;
};

export type RenderedFeature = {
  type:
    | "route"
    | "station"
    | "edge"
    | "node"
    | "extension-route"
    | "extension-station"
    | "extension-edge"
    | "extension-node"
    | "candidate"
    | "build-path"
    | "crossing"
    | "attachment-point";
  id: string;
  x: number;
  y: number;
  payload: unknown;
};

export type GraphMapPoint = {
  id: string;
  label?: string;
  coordinate: DALCoordinate;
  payload?: unknown;
};

export type GraphMapPath = {
  id: string;
  label?: string;
  geometry: DALCoordinate[];
  payload?: unknown;
};

const EMPTY_EXTENSIONS: GraphExtension[] = [];

function emptyBounds(): Bounds {
  return { minLon: -98, maxLon: -96, minLat: 32, maxLat: 34 };
}

function emptyAccumulator(): BoundsAccumulator {
  return { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity, count: 0 };
}

function validCoord(coord: DALCoordinate) {
  const [lon, lat] = coord;
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function coordFromValue(value: unknown): DALCoordinate | null {
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    const coord: DALCoordinate = [value[0], value[1]];
    return validCoord(coord) ? coord : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const lon = typeof record.lon === "number" ? record.lon : typeof record.lng === "number" ? record.lng : undefined;
    const lat = typeof record.lat === "number" ? record.lat : undefined;
    if (typeof lon === "number" && typeof lat === "number") {
      const coord: DALCoordinate = [lon, lat];
      return validCoord(coord) ? coord : null;
    }
  }
  return null;
}

function visitCoordinates(
  source: unknown,
  visitor: (coord: DALCoordinate) => boolean | void,
  options: { maxDepth?: number; maxCoordinates?: number } = {}
) {
  const maxDepth = options.maxDepth ?? 12;
  const maxCoordinates = options.maxCoordinates ?? 250000;
  const stack: Array<{ value: unknown; depth: number }> = [{ value: source, depth: 0 }];
  const seen = typeof WeakSet !== "undefined" ? new WeakSet<object>() : null;
  let count = 0;
  let circularReferences = 0;
  let malformed = 0;

  while (stack.length && count < maxCoordinates) {
    const { value, depth } = stack.pop()!;
    const coord = coordFromValue(value);
    if (coord) {
      count += 1;
      if (visitor(coord) === false) break;
      continue;
    }

    if (!value || typeof value !== "object") {
      if (value !== undefined && value !== null) malformed += 1;
      continue;
    }

    if (seen) {
      if (seen.has(value)) {
        circularReferences += 1;
        continue;
      }
      seen.add(value);
    }

    if (depth >= maxDepth) {
      malformed += 1;
      continue;
    }

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) stack.push({ value: value[i], depth: depth + 1 });
      continue;
    }

    const record = value as Record<string, unknown>;
    if (record.coordinates !== undefined) stack.push({ value: record.coordinates, depth: depth + 1 });
  }

  return { count, circularReferences, malformed, truncated: count >= maxCoordinates };
}

function extendBounds(acc: BoundsAccumulator, coord: DALCoordinate) {
  acc.minLon = Math.min(acc.minLon, coord[0]);
  acc.maxLon = Math.max(acc.maxLon, coord[0]);
  acc.minLat = Math.min(acc.minLat, coord[1]);
  acc.maxLat = Math.max(acc.maxLat, coord[1]);
  acc.count += 1;
}

function finalizeBounds(acc: BoundsAccumulator): Bounds {
  if (!acc.count) return emptyBounds();
  const bounds = {
    minLon: acc.minLon,
    maxLon: acc.maxLon,
    minLat: acc.minLat,
    maxLat: acc.maxLat,
  };
  const lonPad = Math.max((bounds.maxLon - bounds.minLon) * 0.08, 0.01);
  const latPad = Math.max((bounds.maxLat - bounds.minLat) * 0.08, 0.01);
  return {
    minLon: bounds.minLon - lonPad,
    maxLon: bounds.maxLon + lonPad,
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
  };
}

function graphStats(graph: InventoryGraph | null, extensions: GraphExtension[]) {
  const extensionGeometries = extensions.reduce((sum, extension) => sum + extension.nodes.length + extension.edges.length + extension.stations.length + extension.routes.length, 0);
  return {
    routes: graph?.routes.length ?? 0,
    placemarks: graph?.routes.length ?? 0,
    edges: graph?.edges.length ?? 0,
    nodes: graph?.nodes.length ?? 0,
    stations: graph?.stations.length ?? 0,
    extensionGeometries,
    totalGeometries: (graph?.routes.length ?? 0) + (graph?.edges.length ?? 0) + (graph?.nodes.length ?? 0) + (graph?.stations.length ?? 0) + extensionGeometries,
  };
}

function graphBounds(graph: InventoryGraph | null, extensions: GraphExtension[] = []): Bounds {
  const acc = emptyAccumulator();
  const routeCount = graph?.routes.length ?? 0;
  const routeStep = Math.max(1, Math.ceil(routeCount / 50000));
  let diagnostics = { coordinates: 0, circularReferences: 0, malformed: 0, truncated: 0 };

  for (let i = 0; graph && i < graph.routes.length; i += routeStep) {
    const result = visitCoordinates(
      graph.routes[i]?.coordinates,
      (coord) => {
        extendBounds(acc, coord);
      },
      { maxCoordinates: Math.max(500, Math.ceil(250000 / Math.max(routeCount / routeStep, 1))) }
    );
    diagnostics.coordinates += result.count;
    diagnostics.circularReferences += result.circularReferences;
    diagnostics.malformed += result.malformed;
    if (result.truncated) diagnostics.truncated += 1;
  }

  const stationStep = Math.max(1, Math.ceil((graph?.stations.length ?? 0) / 50000));
  for (let i = 0; graph && i < graph.stations.length; i += stationStep) {
    const station = graph.stations[i];
    if (station) extendBounds(acc, [station.lon, station.lat]);
  }

  for (const extension of extensions) {
    for (const node of extension.nodes) extendBounds(acc, [node.lng, node.lat]);
    for (const station of extension.stations) extendBounds(acc, [station.lng, station.lat]);
    for (const edge of extension.edges) visitCoordinates(edge.geometry, (coord) => extendBounds(acc, coord), { maxCoordinates: 10000 });
    for (const route of extension.routes) visitCoordinates(route.geometry, (coord) => extendBounds(acc, coord), { maxCoordinates: 10000 });
  }

  if (diagnostics.circularReferences || diagnostics.malformed || diagnostics.truncated) {
    console.warn("GRAPHMAP GEOMETRY DIAGNOSTICS", diagnostics);
  }

  return finalizeBounds(acc);
}

function coordInBounds(coord: DALCoordinate, bounds: Bounds) {
  return validCoord(coord) && coord[0] >= bounds.minLon && coord[0] <= bounds.maxLon && coord[1] >= bounds.minLat && coord[1] <= bounds.maxLat;
}

function routeInBounds(route: InventoryRoute, bounds: Bounds) {
  let found = false;
  visitCoordinates(
    route.coordinates,
    (coord) => {
      found = coordInBounds(coord, bounds);
      return !found;
    },
    { maxCoordinates: 10000 }
  );
  return found;
}

function geometryInBounds(coordinates: unknown, bounds: Bounds) {
  let found = false;
  visitCoordinates(
    coordinates,
    (coord) => {
      found = coordInBounds(coord, bounds);
      return !found;
    },
    { maxCoordinates: 10000 }
  );
  return found;
}

function coordToScreen(coord: DALCoordinate, bounds: Bounds, width: number, height: number) {
  const lonRange = Math.max(bounds.maxLon - bounds.minLon, 0.000001);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.000001);
  return {
    x: ((coord[0] - bounds.minLon) / lonRange) * width,
    y: height - ((coord[1] - bounds.minLat) / latRange) * height,
  };
}

function screenToCoord(x: number, y: number, bounds: Bounds, width: number, height: number): DALCoordinate {
  const lon = bounds.minLon + (x / Math.max(width, 1)) * (bounds.maxLon - bounds.minLon);
  const lat = bounds.minLat + ((height - y) / Math.max(height, 1)) * (bounds.maxLat - bounds.minLat);
  return [lon, lat];
}

function zoomBounds(bounds: Bounds, factor: number) {
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const lonHalf = ((bounds.maxLon - bounds.minLon) * factor) / 2;
  const latHalf = ((bounds.maxLat - bounds.minLat) * factor) / 2;
  return {
    minLon: centerLon - lonHalf,
    maxLon: centerLon + lonHalf,
    minLat: centerLat - latHalf,
    maxLat: centerLat + latHalf,
  };
}

function sampled<T>(items: T[], maxItems: number) {
  if (items.length <= maxItems) return items;
  const step = Math.ceil(items.length / maxItems);
  return items.filter((_, index) => index % step === 0);
}

function sampledVisible<T>(items: T[], maxItems: number, predicate: (item: T) => boolean) {
  const step = Math.max(1, Math.ceil(items.length / Math.max(maxItems, 1)));
  const output: T[] = [];
  for (let i = 0; i < items.length && output.length < maxItems; i += step) {
    const item = items[i];
    if (item !== undefined && predicate(item)) output.push(item);
  }
  return output;
}

function collectVisibleCoords(source: unknown, bounds: Bounds, maxPoints: number) {
  const coords: DALCoordinate[] = [];
  const maxScan = Math.max(maxPoints * 24, 250);
  visitCoordinates(
    source,
    (coord) => {
      if (coordInBounds(coord, bounds)) coords.push(coord);
      return coords.length < maxScan;
    },
    { maxCoordinates: maxScan }
  );
  return simplifiedCoords(coords, maxPoints);
}

function simplifiedCoords(coords: DALCoordinate[], maxPoints: number) {
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const output = coords.filter((_, index) => index % step === 0);
  const last = coords[coords.length - 1];
  if (output[output.length - 1] !== last) output.push(last);
  return output;
}

export default function GraphMap({
  graph,
  extensions = EMPTY_EXTENSIONS,
  candidatePoints = [],
  buildPaths = [],
  attachmentPoints = [],
  crossingPoints = [],
  layers,
  onSelectFeature,
  onMapCoordinateClick,
}: {
  graph: InventoryGraph | null;
  extensions?: GraphExtension[];
  candidatePoints?: GraphMapPoint[];
  buildPaths?: GraphMapPath[];
  attachmentPoints?: GraphMapPoint[];
  crossingPoints?: GraphMapPoint[];
  layers: GraphLayerToggles;
  onSelectFeature: (feature: RenderedFeature | null) => void;
  onMapCoordinateClick?: (coord: DALCoordinate) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderedFeaturesRef = useRef<RenderedFeature[]>([]);
  const [bounds, setBounds] = useState<Bounds>(() => emptyBounds());
  const [fullBounds, setFullBounds] = useState<Bounds>(() => emptyBounds());
  const [size, setSize] = useState({ width: 960, height: 520 });

  useEffect(() => {
    const stats = graphStats(graph, extensions);
    console.info("GRAPHMAP GRAPH SIZE", stats);
    if (stats.totalGeometries > 50000) console.info("GRAPHMAP LARGE GRAPH MODE", stats.totalGeometries);
    const nextBounds = graphBounds(graph, extensions);
    setFullBounds(nextBounds);
    setBounds(nextBounds);
  }, [graph, extensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas?.parentElement) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.max(320, rect.width), height: Math.max(360, rect.height) });
    });
    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#06111f";
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.strokeStyle = "#173149";
    ctx.lineWidth = 1;
    for (let x = 0; x < size.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.height);
      ctx.stroke();
    }
    for (let y = 0; y < size.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size.width, y);
      ctx.stroke();
    }

    const features: RenderedFeature[] = [];
    const viewportRatio = Math.max((bounds.maxLon - bounds.minLon) / Math.max(fullBounds.maxLon - fullBounds.minLon, 0.000001), 0.001);
    const highDetail = viewportRatio < 0.2;
    const routeMax = highDetail ? 120000 : 18000;
    const pointMax = highDetail ? 35000 : 3000;
    const edgeMax = highDetail ? 50000 : 5000;

    const showInventory = layers.inventory !== false;
    const showExtensions = layers.extensions !== false;
    const showInventoryPath = layers.inventoryPath !== false;
    const showCandidates = layers.candidate !== false;
    const showBuildPaths = layers.buildPath !== false;
    const showAttachmentPoints = layers.attachmentPoint !== false;
    const showCrossings = layers.crossings !== false;

    if (showInventory && showInventoryPath && layers.routes) {
      const visibleRoutes = sampledVisible(graph.routes, routeMax, (route) => routeInBounds(route, bounds));
      ctx.strokeStyle = "#30d5ff";
      ctx.lineWidth = highDetail ? 2.4 : 1.5;
      visibleRoutes.forEach((route) => {
        const coords = collectVisibleCoords(route.coordinates, bounds, highDetail ? 500 : 80);
        if (coords.length < 2) return;
        ctx.beginPath();
        coords.forEach((coord, index) => {
          const pt = coordToScreen(coord, bounds, size.width, size.height);
          if (index === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        const mid = coordToScreen(coords[Math.floor(coords.length / 2)], bounds, size.width, size.height);
        features.push({ type: "route", id: route.routeId, x: mid.x, y: mid.y, payload: route });
      });
    }

    if (showInventory && layers.edges) {
      const visibleEdges = sampledVisible(graph.edges, edgeMax, (edge) => geometryInBounds(edge.coordinates, bounds));
      ctx.strokeStyle = "rgba(255, 214, 102, 0.5)";
      ctx.lineWidth = 1;
      visibleEdges.forEach((edge: InventoryEdge) => {
        const [a, b] = collectVisibleCoords(edge.coordinates, bounds, 2);
        if (!a || !b) return;
        const pa = coordToScreen(a, bounds, size.width, size.height);
        const pb = coordToScreen(b, bounds, size.width, size.height);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        features.push({ type: "edge", id: edge.edgeId, x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, payload: edge });
      });
    }

    if (showInventory && layers.stations) {
      const visibleStations = sampledVisible(graph.stations, pointMax, (station) => coordInBounds([station.lon, station.lat], bounds));
      ctx.fillStyle = "#b7f7c1";
      visibleStations.forEach((station: InventoryStation) => {
        const pt = coordToScreen([station.lon, station.lat], bounds, size.width, size.height);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, highDetail ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
        features.push({ type: "station", id: station.stationId, x: pt.x, y: pt.y, payload: station });
      });
    }

    if (showInventory && layers.nodes) {
      const visibleNodes = sampledVisible(graph.nodes, highDetail ? 50000 : 2500, (node) => coordInBounds([node.lon, node.lat], bounds));
      ctx.fillStyle = "#ff8bb3";
      visibleNodes.forEach((node: InventoryNode) => {
        const pt = coordToScreen([node.lon, node.lat], bounds, size.width, size.height);
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        features.push({ type: "node", id: node.nodeId, x: pt.x, y: pt.y, payload: node });
      });
    }

    if (showExtensions && layers.routes) {
      const extensionRoutes: Array<{ extension: GraphExtension; route: GraphExtension["routes"][number] }> = [];
      for (const extension of extensions) {
        for (const route of extension.routes) {
          if (geometryInBounds(route.geometry, bounds)) extensionRoutes.push({ extension, route });
        }
      }
      const visibleExtensionRoutes = sampled(extensionRoutes, highDetail ? 5000 : 1000);
      ctx.strokeStyle = "#ff9f1c";
      ctx.lineWidth = highDetail ? 3.5 : 2.4;
      visibleExtensionRoutes.forEach(({ extension, route }) => {
        const coords = collectVisibleCoords(route.geometry, bounds, highDetail ? 500 : 80);
        if (coords.length < 2) return;
        ctx.beginPath();
        coords.forEach((coord, index) => {
          const pt = coordToScreen(coord, bounds, size.width, size.height);
          if (index === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        const mid = coordToScreen(coords[Math.floor(coords.length / 2)], bounds, size.width, size.height);
        features.push({ type: "extension-route", id: route.extensionRouteId, x: mid.x, y: mid.y, payload: { extension, route } });
      });
    }

    if (showExtensions && layers.edges) {
      const extensionEdges: Array<{ extension: GraphExtension; edge: GraphExtension["edges"][number] }> = [];
      for (const extension of extensions) {
        for (const edge of extension.edges) {
          if (geometryInBounds(edge.geometry, bounds)) extensionEdges.push({ extension, edge });
        }
      }
      const visibleExtensionEdges = sampled(extensionEdges, highDetail ? 10000 : 1500);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = highDetail ? 2.5 : 1.8;
      visibleExtensionEdges.forEach(({ extension, edge }) => {
        const coords = collectVisibleCoords(edge.geometry, bounds, highDetail ? 200 : 40);
        if (coords.length < 2) return;
        const first = coordToScreen(coords[0], bounds, size.width, size.height);
        ctx.beginPath();
        ctx.moveTo(first.x, first.y);
        coords.slice(1).forEach((coord) => {
          const pt = coordToScreen(coord, bounds, size.width, size.height);
          ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        const mid = coordToScreen(coords[Math.floor(coords.length / 2)], bounds, size.width, size.height);
        features.push({ type: "extension-edge", id: edge.extensionEdgeId, x: mid.x, y: mid.y, payload: { extension, edge } });
      });
    }

    if (showExtensions && layers.stations) {
      const extensionStations: Array<{ extension: GraphExtension; station: GraphExtension["stations"][number] }> = [];
      for (const extension of extensions) {
        for (const station of extension.stations) {
          if (coordInBounds([station.lng, station.lat], bounds)) extensionStations.push({ extension, station });
        }
      }
      const visibleExtensionStations = sampled(extensionStations, pointMax);
      ctx.fillStyle = "#ffe66d";
      visibleExtensionStations.forEach(({ extension, station }) => {
        const pt = coordToScreen([station.lng, station.lat], bounds, size.width, size.height);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, highDetail ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        features.push({ type: "extension-station", id: station.extensionStationId, x: pt.x, y: pt.y, payload: { extension, station } });
      });
    }

    if (showExtensions && layers.nodes) {
      const extensionNodes: Array<{ extension: GraphExtension; node: GraphExtension["nodes"][number] }> = [];
      for (const extension of extensions) {
        for (const node of extension.nodes) {
          if (coordInBounds([node.lng, node.lat], bounds)) extensionNodes.push({ extension, node });
        }
      }
      const visibleExtensionNodes = sampled(extensionNodes, highDetail ? 10000 : 1200);
      ctx.fillStyle = "#ff595e";
      visibleExtensionNodes.forEach(({ extension, node }) => {
        const pt = coordToScreen([node.lng, node.lat], bounds, size.width, size.height);
        ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
        features.push({ type: "extension-node", id: node.extensionNodeId, x: pt.x, y: pt.y, payload: { extension, node } });
      });
    }

    if (showBuildPaths && buildPaths.length) {
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = highDetail ? 4 : 2.8;
      buildPaths.forEach((path) => {
        const coords = collectVisibleCoords(path.geometry, bounds, highDetail ? 500 : 120);
        if (coords.length < 2) return;
        ctx.beginPath();
        coords.forEach((coord, index) => {
          const pt = coordToScreen(coord, bounds, size.width, size.height);
          if (index === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        const mid = coordToScreen(coords[Math.floor(coords.length / 2)], bounds, size.width, size.height);
        features.push({ type: "build-path", id: path.id, x: mid.x, y: mid.y, payload: path.payload ?? path });
      });
    }

    if (showCandidates && candidatePoints.length) {
      ctx.fillStyle = "#a78bfa";
      ctx.strokeStyle = "#f5f3ff";
      ctx.lineWidth = 1.5;
      candidatePoints.forEach((point) => {
        if (!coordInBounds(point.coordinate, bounds)) return;
        const pt = coordToScreen(point.coordinate, bounds, size.width, size.height);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        features.push({ type: "candidate", id: point.id, x: pt.x, y: pt.y, payload: point.payload ?? point });
      });
    }

    if (showAttachmentPoints && attachmentPoints.length) {
      ctx.fillStyle = "#22c55e";
      ctx.strokeStyle = "#ecfdf5";
      ctx.lineWidth = 1.5;
      attachmentPoints.forEach((point) => {
        if (!coordInBounds(point.coordinate, bounds)) return;
        const pt = coordToScreen(point.coordinate, bounds, size.width, size.height);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 6);
        ctx.lineTo(pt.x + 6, pt.y);
        ctx.lineTo(pt.x, pt.y + 6);
        ctx.lineTo(pt.x - 6, pt.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        features.push({ type: "attachment-point", id: point.id, x: pt.x, y: pt.y, payload: point.payload ?? point });
      });
    }

    if (showCrossings && crossingPoints.length) {
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#fee2e2";
      ctx.lineWidth = 1.5;
      crossingPoints.forEach((point) => {
        if (!coordInBounds(point.coordinate, bounds)) return;
        const pt = coordToScreen(point.coordinate, bounds, size.width, size.height);
        ctx.beginPath();
        ctx.rect(pt.x - 5, pt.y - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
        features.push({ type: "crossing", id: point.id, x: pt.x, y: pt.y, payload: point.payload ?? point });
      });
    }

    renderedFeaturesRef.current = features;
    ctx.fillStyle = "#b8d7ee";
    ctx.font = "12px ui-monospace, Consolas, monospace";
    ctx.fillText(`Rendered features: ${features.length.toLocaleString()}`, 12, size.height - 14);
    console.info("GRAPHMAP VIEWPORT RENDER", {
      bounds,
      renderedFeatures: features.length,
      viewportRatio,
      highDetail,
    });
  }, [attachmentPoints, bounds, buildPaths, candidatePoints, crossingPoints, extensions, fullBounds, graph, layers, size]);

  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nearest = renderedFeaturesRef.current
      .map((feature) => ({ feature, distance: Math.hypot(feature.x - x, feature.y - y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest && nearest.distance < 18) {
      onSelectFeature(nearest.feature);
      return;
    }
    const coord = screenToCoord(x, y, bounds, size.width, size.height);
    onSelectFeature(null);
    onMapCoordinateClick?.(coord);
  }

  if (!graph) {
    return <div className="dal-map-empty">Load an inventory graph to view geometry.</div>;
  }

  return (
    <div className="dal-map-wrap">
      <div className="dal-map-toolbar">
        <button type="button" onClick={() => setBounds(fullBounds)}>
          Fit Bounds
        </button>
        <button type="button" onClick={() => setBounds((prev) => zoomBounds(prev, 0.55))}>
          Zoom In
        </button>
        <button type="button" onClick={() => setBounds((prev) => zoomBounds(prev, 1.8))}>
          Zoom Out
        </button>
      </div>
      <canvas ref={canvasRef} className="dal-map-canvas" onClick={handleClick} />
    </div>
  );
}
