# Corridor Normalization Validation

Status: static fixture validation.

## Fixture Location

`src/corridor/fixtures/corridorNormalizationFixtures.ts`

Fixtures include:

1. Endpoint pair only.
2. Customer supplied route.
3. Customer route plus KML.
4. Conflicting endpoint coordinates.
5. Conflicting route geometry.
6. Missing evidence package.

## Evidence Examples

Endpoint evidence normalizes to:

```text
entityType = ENDPOINT
sourceType = CUSTOMER_ENDPOINT
geometryReference = POINT
```

Route evidence normalizes to:

```text
entityType = ROUTE_CANDIDATE
sourceType = CUSTOMER_ROUTE | KML
geometryReference = LINESTRING
```

## Confidence Examples

Expected categories:

- customer endpoint: HIGH.
- customer route: HIGH.
- KML route: MEDIUM/HIGH depending completeness.
- OSRM route: MEDIUM.
- human engineering review: VERIFIED.
- unknown or missing evidence: VERY_LOW/LOW.

## Conflict Examples

Conflicting endpoint coordinates:

```text
same ENDPOINT entityId
different POINT geometry
conflict field = geometry
```

Conflicting route geometry:

```text
same ROUTE_CANDIDATE entityId
different LINESTRING geometry
conflict field = geometry
```

No conflict is automatically resolved.

## Normalization Output Examples

Evidence bundle output includes:

- endpoints.
- routes.
- constraints.
- crossings.
- jurisdictions.
- power.
- interconnection.
- regen.
- monetization.
- conflicts.

## Remaining Risks Before Translate V1

- File parsing must preserve raw source references.
- Multi-sheet customer workbooks may contain conflicting requirements.
- KML/KMZ placemark semantics may be ambiguous.
- CSV column names require mapping confidence.
- Human override must create evidence, not overwrite evidence.

## Remaining Risks Before Corridor Synthesis

- Route candidates need diversity grouping.
- Constraint evidence needs severity normalization.
- Power and interconnect datasets need source-specific confidence tuning.
- Evidence bundle completeness gates must remain separate from promotion authority.

