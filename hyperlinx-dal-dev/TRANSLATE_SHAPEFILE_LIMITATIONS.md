# Translate Shapefile Limitations

Status: implementation limitation document.

## Parser Scope

The V1 parser reads common `.shp` geometry records and `.dbf` attributes directly.

It does not yet support:

- coordinate reprojection.
- multipart polygon topology validation.
- shapefile zip/package auto-discovery.
- spatial index use from `.shx`.
- advanced DBF encodings beyond browser `TextDecoder` support.
- source-specific schemas for every DOT, county, utility, carrier, or hyperscaler data provider.

## Coordinate Systems

WGS84 and NAD83 are detected from `.prj` text.

Unknown projections are preserved and confidence is lowered. Geometry is not discarded.

No coordinate transformation is performed in this phase.

## Attribute Mapping

All attributes are preserved.

Classification uses heuristics based on layer name and attributes. It is not authority.

Unknown fields remain unknown until mapper rules are created.

## Geometry Mapping

The corridor evidence model supports point, line, and polygon references. Shapefile-specific geometry remains fully preserved in `normalizedPayload.shapefileGeometry`.

MultiPoint and complex multipart geometry may not receive a direct `geometryReference` if the current evidence model cannot represent it precisely.

## Future Readiness

Future phases should add:

- source-specific mapper registries.
- projection transformation.
- ZIP package reader for multi-layer shapefile drops.
- spatial validation.
- multipart polygon semantics.
- richer utility, parcel, environmental, carrier, and hyperscaler GIS classifications.

