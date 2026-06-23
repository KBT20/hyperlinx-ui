# Translate V1 Supported Formats

Status: implementation document.

## Supported Now

| Format | Parser | Outputs |
| --- | --- | --- |
| CSV | `translateCsv()` | Endpoint evidence and optional coordinate-sequence route evidence |
| GeoJSON | `translateGeoJson()` | Point endpoints and LineString/MultiLineString route evidence |
| KML | `translateKml()` | Placemark Point endpoints and LineString route evidence |
| KMZ | `translateKmz()` | Extracted KML endpoints and route evidence |

## CSV Rules

Recognized coordinate columns:

- latitude, lat, y.
- longitude, lon, lng, long, x.

Recognized label columns:

- name.
- site.
- siteName.
- company.
- facility.
- endpoint.

Recognized role columns:

- role.
- endpointRole.
- end.

Rows with valid coordinates become endpoint evidence. If two or more coordinate rows exist, Translate also creates route-candidate evidence from the coordinate sequence.

## GeoJSON Rules

Supported geometries:

- Point.
- MultiPoint.
- LineString.
- MultiLineString.
- GeometryCollection containing the above.

Unsupported geometry is ignored for V1 and should be surfaced through future diagnostics if needed.

## KML Rules

Supported placemark geometry:

- Point.
- LineString.

Placemark name and description are preserved in normalized payload.

## KMZ Rules

KMZ parser selects the first `.kml` file in the archive and passes it through the KML parser.

## Future Support

Planned but not implemented:

- Phase 6.1B: Shapefile support.
- Phase 6.1C: PDF support.
- Phase 6.1D: DWG/CAD support.

Future support must continue to produce evidence, not truth.

