import type { GISPoint, ProjectPoint } from "./types";

type CandidateLayerProps = {
  candidates: GISPoint[];
  project: ProjectPoint;
};

export default function CandidateLayer({ candidates, project }: CandidateLayerProps) {
  return (
    <g className="dal-candidate-layer">
      {candidates.map((candidate) => {
        const point = project(candidate.coordinate);
        return (
          <g key={candidate.id} transform={`translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`}>
            <circle r="7" className="dal-map-marker candidate" />
            <circle r="13" className="dal-map-marker-halo candidate" />
            {candidate.label ? (
              <text x="11" y="-10" className="dal-map-label">
                {candidate.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
