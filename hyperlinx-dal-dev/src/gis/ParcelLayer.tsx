import type { GISParcel, ProjectPoint } from "./types";
import { pathData } from "./geo";

type ParcelLayerProps = {
  parcels: GISParcel[];
  project: ProjectPoint;
};

export default function ParcelLayer({ parcels, project }: ParcelLayerProps) {
  return (
    <g className="dal-parcel-layer">
      {parcels.map((parcel) => (
        <g key={parcel.id}>
          {(parcel.polygon ?? []).map((ring, index) => {
            const d = pathData(ring, project);
            return d ? <path key={`${parcel.id}-${index}`} d={`${d} Z`} className="dal-parcel-polygon" /> : null;
          })}
          {parcel.centroid ? (
            <text x={project(parcel.centroid).x + 8} y={project(parcel.centroid).y + 4} className="dal-map-label">
              {parcel.label ?? parcel.id}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  );
}
