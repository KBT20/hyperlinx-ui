# Translate Shapefile Validation

Status: fixture validation document.

## Fixture Location

`src/translate/fixtures/shapefileFixtures.ts`

Synthetic in-memory fixtures represent:

1. Fiber route shapefile.
2. Conduit route shapefile.
3. Utility territory shapefile.
4. Data center campus polygon.
5. Transmission line route.
6. Mixed engineering package.

## Feature Extraction Examples

Fiber route:

```text
geometry = PolyLine
classification = ROUTE_CANDIDATE
evidence bucket = routes
```

Data center campus:

```text
geometry = Polygon
classification = ENDPOINT
geometry preserved as polygon evidence
```

Transmission line:

```text
geometry = PolyLine
classification = POWER_ASSET
evidence bucket = power
```

## Attribute Preservation

All DBF fields are preserved in:

```text
normalizedPayload.attributes
normalizedPayload.attributes.rawProperties
```

Original source field names remain available.

Unknown fields are preserved and reported through diagnostics.

Duplicate normalized field names are reported through diagnostics.

## Projection Handling

Supported recognition:

- WGS84.
- NAD83.
- Unknown projection.

If projection cannot be determined:

- geometry is preserved.
- confidence is lowered.
- warning is emitted.

## Evidence Bundle Examples

The shapefile engine returns:

```ts
{
  packageId,
  packageName,
  layers,
  evidenceBundle,
  diagnostics
}
```

No persistence occurs.

## Future GIS Integrations

Future source-specific mapper rules should cover:

- DOT GIS.
- County GIS.
- Utility GIS.
- Parcel GIS.
- Environmental GIS.
- Carrier GIS.
- Hyperscaler GIS.

These sources should map into evidence bundles without becoming authority.

