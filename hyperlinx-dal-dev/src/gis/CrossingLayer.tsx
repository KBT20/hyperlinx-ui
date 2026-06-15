import type { GISCrossing, ProjectPoint } from "./types";

type CrossingLayerProps = {
  crossings: GISCrossing[];
  project: ProjectPoint;
};

export default function CrossingLayer({ crossings, project }: CrossingLayerProps) {
  return (
    <g className="dal-crossing-layer">
      {crossings.map((crossing) => {
        const point = project(crossing.coordinate);
        return (
          <g key={crossing.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
            <rect x="-6" y="-6" width="12" height="12" rx="2" className="dal-map-marker crossing" />
            <path d="M-4,-4 L4,4 M4,-4 L-4,4" className="dal-crossing-icon" />
            {crossing.label ? (
              <text x="9" y="-8" className="dal-map-label">
                {crossing.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
