import { useEffect, useMemo, useRef, useState } from "react";
import type { DALCoordinate } from "../types/dal";
import AttachmentLayer from "./AttachmentLayer";
import BasemapLayer from "./BasemapLayer";
import BuildPathLayer from "./BuildPathLayer";
import CandidateLayer from "./CandidateLayer";
import CrossingLayer from "./CrossingLayer";
import ParcelLayer from "./ParcelLayer";
import RouteLayer from "./RouteLayer";
import { centerFromCoordinates, isCoordinate, lonLatToWorld, worldToTile, zoomForCoordinates } from "./geo";
import type { GISBuildPath, GISCrossing, GISParcel, GISPoint, GISRoute } from "./types";

type LeafletMapProps = {
  autoFocusKey?: string;
  center?: DALCoordinate;
  zoom?: number;
  height?: number;
  focusCoordinates?: DALCoordinate[];
  candidates?: GISPoint[];
  attachments?: GISPoint[];
  routes?: GISRoute[];
  buildPaths?: GISBuildPath[];
  crossings?: GISCrossing[];
  stations?: GISPoint[];
  nodes?: GISPoint[];
  parcels?: GISParcel[];
};

const DEFAULT_CENTER: DALCoordinate = [-97.7431, 30.2672];

function collectCoordinates(props: LeafletMapProps) {
  const coords: DALCoordinate[] = [];
  props.focusCoordinates?.forEach((coord) => {
    if (isCoordinate(coord)) coords.push(coord);
  });
  props.candidates?.forEach((point) => coords.push(point.coordinate));
  props.attachments?.forEach((point) => coords.push(point.coordinate));
  props.routes?.forEach((route) => route.coordinates.forEach((coord) => coords.push(coord)));
  props.buildPaths?.forEach((path) => path.coordinates.forEach((coord) => coords.push(coord)));
  props.crossings?.forEach((point) => coords.push(point.coordinate));
  props.stations?.forEach((point) => coords.push(point.coordinate));
  props.nodes?.forEach((point) => coords.push(point.coordinate));
  props.parcels?.forEach((parcel) => {
    if (parcel.centroid) coords.push(parcel.centroid);
    parcel.polygon?.forEach((ring) => ring.forEach((coord) => coords.push(coord)));
  });
  return coords.filter(isCoordinate);
}

export default function LeafletMap(props: LeafletMapProps) {
  const {
    autoFocusKey,
    center,
    zoom,
    height = 560,
    candidates = [],
    attachments = [],
    routes = [],
    buildPaths = [],
    crossings = [],
    stations = [],
    nodes = [],
    parcels = [],
  } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 960, height });
  const focusCoordinates = useMemo(() => collectCoordinates(props), [autoFocusKey, candidates, attachments, routes, buildPaths, crossings, stations, nodes, parcels, props.focusCoordinates]);
  const [view, setView] = useState(() => ({
    center: center ?? centerFromCoordinates(focusCoordinates, DEFAULT_CENTER),
    zoom: zoom ?? zoomForCoordinates(focusCoordinates, 960, height),
  }));

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

  useEffect(() => {
    const nextCenter = center ?? centerFromCoordinates(focusCoordinates, DEFAULT_CENTER);
    const nextZoom = zoom ?? zoomForCoordinates(focusCoordinates, size.width, size.height);
    setView({ center: nextCenter, zoom: nextZoom });
  }, [autoFocusKey, center, zoom, size.width, size.height]);

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
    const startX = worldToTile(leftWorld) - 1;
    const endX = worldToTile(centerWorld.x + size.width / 2) + 1;
    const startY = worldToTile(topWorld) - 1;
    const endY = worldToTile(centerWorld.y + size.height / 2) + 1;
    const nextTiles = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) {
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

  return (
    <div className="dal-leaflet-map" ref={wrapRef} style={{ minHeight: height }}>
      <BasemapLayer tiles={tiles} />
      <svg className="dal-map-svg" width={size.width} height={size.height} role="img" aria-label="DAL serviceability map">
        <ParcelLayer parcels={parcels} project={project} />
        <RouteLayer routes={routes} project={project} />
        <BuildPathLayer buildPaths={buildPaths} project={project} />
        <CrossingLayer crossings={crossings} project={project} />
        <AttachmentLayer attachments={attachments} stations={stations} nodes={nodes} project={project} />
        <CandidateLayer candidates={candidates} project={project} />
      </svg>
      <div className="dal-map-zoom">
        <button type="button" onClick={() => setView((prev) => ({ ...prev, zoom: Math.min(19, prev.zoom + 1) }))}>
          +
        </button>
        <button type="button" onClick={() => setView((prev) => ({ ...prev, zoom: Math.max(3, prev.zoom - 1) }))}>
          -
        </button>
      </div>
      <div className="dal-map-attribution">OpenStreetMap</div>
    </div>
  );
}
