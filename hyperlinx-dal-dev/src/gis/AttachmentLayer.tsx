import type { GISPoint, ProjectPoint } from "./types";

type AttachmentLayerProps = {
  attachments: GISPoint[];
  stations?: GISPoint[];
  nodes?: GISPoint[];
  project: ProjectPoint;
  zoom?: number;
  enableLevelOfDetail?: boolean;
  onPointSelect?: (point: GISPoint) => void;
};

function markerClass(base: string, point: GISPoint) {
  return [
    "dal-map-marker",
    base,
    point.state ? `state-${point.state.toLowerCase().replaceAll("_", "-")}` : "",
    point.selected ? "selected" : "",
    point.current ? "current-work" : "",
    point.muted ? "muted" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function shouldShowPoint(point: GISPoint, zoom: number, minZoom: number) {
  return zoom >= minZoom || point.selected || point.current;
}

function shouldShowLabel(point: GISPoint, zoom: number, minZoom: number) {
  return Boolean(point.label) && (zoom >= minZoom || point.selected || point.current);
}

export default function AttachmentLayer({ attachments, stations = [], nodes = [], project, zoom = 14, enableLevelOfDetail = false, onPointSelect }: AttachmentLayerProps) {
  const visibleStations = enableLevelOfDetail ? stations.filter((station) => shouldShowPoint(station, zoom, 12)) : stations;
  const visibleNodes = enableLevelOfDetail ? nodes.filter((node) => shouldShowPoint(node, zoom, 13)) : nodes;
  const stationLabelZoom = enableLevelOfDetail ? 15 : 0;
  const nodeLabelZoom = enableLevelOfDetail ? 16 : 0;
  return (
    <g className="dal-attachment-layer">
      {attachments.map((attachment) => {
        const point = project(attachment.coordinate);
        return (
          <g key={attachment.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`} onClick={() => onPointSelect?.(attachment)} className={onPointSelect ? "dal-map-selectable" : ""}>
            <rect x="-7" y="-7" width="14" height="14" rx="2" className={markerClass("attachment", attachment)} />
            {attachment.label ? (
              <text x="10" y="18" className="dal-map-label">
                {attachment.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {visibleStations.map((station) => {
        const point = project(station.coordinate);
        return (
          <g key={station.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`} onClick={() => onPointSelect?.(station)} className={onPointSelect ? "dal-map-selectable" : ""}>
            <circle r={station.selected || station.current ? 8 : 6} className={markerClass("station", station)} />
            {shouldShowLabel(station, zoom, stationLabelZoom) ? (
              <text x="10" y="4" className="dal-map-label">
                {station.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {visibleNodes.map((node) => {
        const point = project(node.coordinate);
        return (
          <g key={node.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`} onClick={() => onPointSelect?.(node)} className={onPointSelect ? "dal-map-selectable" : ""}>
            <path d="M0,-7 L7,0 L0,7 L-7,0 Z" className={markerClass("node", node)} />
            {shouldShowLabel(node, zoom, nodeLabelZoom) ? (
              <text x="10" y="4" className="dal-map-label">
                {node.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
