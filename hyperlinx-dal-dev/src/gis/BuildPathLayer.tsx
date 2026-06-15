import type { GISBuildPath, ProjectPoint } from "./types";
import { pathData } from "./geo";

type BuildPathLayerProps = {
  buildPaths: GISBuildPath[];
  project: ProjectPoint;
};

export default function BuildPathLayer({ buildPaths, project }: BuildPathLayerProps) {
  return (
    <g className="dal-build-path-layer">
      {buildPaths.map((path) => {
        const d = pathData(path.coordinates, project);
        if (!d) return null;
        return (
          <path
            key={path.id}
            d={d}
            className="dal-build-path-line"
            aria-label={path.label ?? path.id}
          />
        );
      })}
    </g>
  );
}
