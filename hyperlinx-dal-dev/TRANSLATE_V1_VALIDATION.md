# Translate V1 Validation

Status: fixture validation document.

## Fixture Location

`src/translate/fixtures/translateV1Fixtures.ts`

Fixtures include:

- CSV endpoint pair.
- GeoJSON route.
- KML route.
- KMZ route.
- Mixed endpoint plus route GeoJSON package.

## CSV Example

Input:

```text
id,name,role,latitude,longitude,address,city,state
END-A,AI Campus A,A_END,32.7767,-96.7970,100 Compute Dr,Dallas,TX
END-Z,Cloud Onramp Z,Z_END,32.8120,-96.7540,200 Onramp Ave,Dallas,TX
```

Expected output:

- two endpoint evidence records.
- one route-candidate evidence record from coordinate sequence.
- one `CorridorEvidenceBundle`.

## GeoJSON Example

Input:

```text
FeatureCollection with LineString route geometry
```

Expected output:

- route-candidate evidence.
- LineString geometry reference.
- source type `GEOJSON`.

## KML Example

Input:

```text
Placemark with LineString coordinates
```

Expected output:

- route-candidate evidence.
- placemark name preserved.
- source type `KML`.

## KMZ Example

Input:

```text
KMZ archive containing doc.kml
```

Expected output:

- extracted KML route evidence.
- source type `KMZ`.
- no persistence.

## Mixed Package Example

Input:

```text
GeoJSON Point A
GeoJSON Point Z
GeoJSON LineString route
```

Expected output:

- endpoint evidence for A/Z.
- route candidate evidence.
- bundle containing both endpoint and route evidence.

## Evidence Bundle Output

Translate V1 returns:

```ts
{
  job,
  sourceType,
  sourceFile,
  evidenceBundle,
  artifacts,
  diagnostics
}
```

The evidence bundle contains normalized evidence and conflict records from the Phase 6.0C corridor evidence model.

## Known Limitations

- CSV parsing is V1-grade and supports quoted fields, but not workbook formulas or multi-sheet files.
- GeoJSON polygon/area semantics are not normalized in V1.
- KML parser supports Point and LineString placemarks only.
- KMZ parser selects the first `.kml` file.
- Shapefile, PDF, DWG, and CAD are intentionally not implemented.
- Translate does not persist, promote, score, route, or create ScopeVersions.

## Future Readiness

Phase 6.1B:

- Shapefile support.

Phase 6.1C:

- PDF support.

Phase 6.1D:

- DWG/CAD support.

