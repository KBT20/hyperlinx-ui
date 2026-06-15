import type { GISRoute, ProjectPoint } from "./types";
import { pathData } from "./geo";

type RouteLayerProps = {
  routes: GISRoute[];
  project: ProjectPoint;
};

export default function RouteLayer({ routes, project }: RouteLayerProps) {
  return (
    <g className="dal-route-layer">
      {routes.map((route) => {
        const d = pathData(route.coordinates, project);
        if (!d) return null;
        return (
          <path
            key={route.id}
            d={d}
            className="dal-route-line"
            stroke={route.color ?? "#27c26a"}
            strokeWidth={route.width ?? 4}
            aria-label={route.label ?? route.id}
          />
        );
      })}
    </g>
  );
}
