# Translate Shapefile Supported Types

Status: implementation reference.

## Package Components

Supported components:

- `.shp`
- `.shx`
- `.dbf`
- `.prj`
- `.cpg`

Required:

- `.shp`

Optional but diagnosed when missing:

- `.shx`
- `.dbf`
- `.prj`
- `.cpg`

Missing optional components do not discard the shapefile.

## Geometry Types

Supported geometry model:

- `POINT`
- `MULTIPOINT`
- `LINESTRING`
- `MULTILINESTRING`
- `POLYGON`
- `MULTIPOLYGON`
- `UNKNOWN`

V1 parser support covers common ESRI shape records:

- Point.
- MultiPoint.
- PolyLine.
- Polygon.
- Z/M variants are parsed for XY coordinates and preserve the source shape type.

## Feature Classification

Classification is heuristic only.

POINT examples:

- Endpoint.
- Interconnection Node.
- Data Center.
- Carrier Hotel.
- Substation.
- Regen Site.
- Utility Asset.

LINE examples:

- Fiber Route.
- Conduit Route.
- Road Corridor.
- Rail Corridor.
- Transmission Route.
- Customer Route.

POLYGON examples:

- Data Center Campus.
- Utility Territory.
- Municipality.
- Parcel.
- Development Site.
- Environmental Zone.

## Evidence Mapping

The engine maps shapefile content into existing evidence structures:

- endpoints.
- route evidence.
- constraint evidence.
- crossing evidence.
- jurisdiction evidence.
- power evidence.
- interconnection evidence.
- regen evidence.
- monetization evidence.

The current evidence model does not have a separate utility or development-site bucket, so those classifications are preserved in `normalizedPayload`.

