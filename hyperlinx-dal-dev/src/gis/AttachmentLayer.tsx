import type { GISPoint, ProjectPoint } from "./types";

type AttachmentLayerProps = {
  attachments: GISPoint[];
  stations?: GISPoint[];
  nodes?: GISPoint[];
  project: ProjectPoint;
};

export default function AttachmentLayer({ attachments, stations = [], nodes = [], project }: AttachmentLayerProps) {
  return (
    <g className="dal-attachment-layer">
      {attachments.map((attachment) => {
        const point = project(attachment.coordinate);
        return (
          <g key={attachment.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
            <rect x="-6" y="-6" width="12" height="12" rx="2" className="dal-map-marker attachment" />
            {attachment.label ? (
              <text x="10" y="18" className="dal-map-label">
                {attachment.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {stations.map((station) => {
        const point = project(station.coordinate);
        return (
          <g key={station.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
            <circle r="6" className="dal-map-marker station" />
            {station.label ? (
              <text x="10" y="4" className="dal-map-label">
                {station.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {nodes.map((node) => {
        const point = project(node.coordinate);
        return (
          <g key={node.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
            <path d="M0,-7 L7,0 L0,7 L-7,0 Z" className="dal-map-marker node" />
            {node.label ? (
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
