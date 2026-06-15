import { normalizeTileX, tileCount, validTileY } from "./geo";

type Tile = {
  key: string;
  x: number;
  y: number;
  z: number;
  left: number;
  top: number;
};

type BasemapLayerProps = {
  tiles: Tile[];
};

export default function BasemapLayer({ tiles }: BasemapLayerProps) {
  return (
    <div className="dal-basemap-layer" aria-hidden="true">
      {tiles
        .filter((tile) => validTileY(tile.y, tile.z))
        .map((tile) => {
          const x = normalizeTileX(tile.x, tile.z);
          const y = Math.max(0, Math.min(tileCount(tile.z) - 1, tile.y));
          return (
            <img
              key={tile.key}
              className="dal-map-tile"
              src={`https://tile.openstreetmap.org/${tile.z}/${x}/${y}.png`}
              style={{ left: tile.left, top: tile.top }}
              loading="lazy"
              alt=""
            />
          );
        })}
    </div>
  );
}
