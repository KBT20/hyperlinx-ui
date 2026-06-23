# Corridor Evidence Model

Status: doctrine only.

## Evidence Doctrine

External APIs and files provide evidence.

Evidence is not authority. Evidence supports authority.

The DAL kernel synthesizes truth through governed objects and transitions. Conflicting evidence must be preserved, not overwritten.

## Evidence Sources

Evidence may come from:

- Customer route file.
- Endpoint CSV.
- KML/KMZ.
- GeoJSON.
- Shapefile.
- DOT GIS.
- OSRM.
- GraphHopper.
- OpenRouteService.
- Power dataset.
- Parcel dataset.
- Data center dataset.
- Human engineering review.
- Field validation.
- Permit record.

## CorridorEvidence Fields

```ts
{
  evidenceId;
  sourceType;
  sourceName;
  collectedAt;
  confidence;
  entityType;
  entityId;
  rawReference;
  normalizedValue;
  notes;
}
```

## Confidence

Confidence is advisory and should be normalized to `0-100`.

Suggested interpretation:

- `90-100`: authoritative-looking source, human-confirmed, or field-confirmed.
- `70-89`: strong source but not human-certified.
- `40-69`: useful source with incomplete metadata.
- `1-39`: weak match, inferred, stale, or conflicting.
- `0`: unknown, failed, or not applicable.

## Conflict Preservation

If two evidence records disagree:

- Preserve both evidence records.
- Do not silently replace either.
- Attach conflict notes.
- Require human review before promotion into ScopeVersion truth.

## Human Override

Human override creates evidence.

Human override evidence should include:

- reviewer identity when available.
- timestamp.
- reason.
- prior evidence references.
- changed normalized value.

## Certified Truth Reference

Certified corridor truth should reference evidence IDs. A selected ScopeVersion should be able to explain why an endpoint, route, crossing, constraint, product, or monetization assumption exists.

## Implementation Reference

`src/corridor/corridorEvidence.ts` provides small helpers for creating evidence records and checking whether evidence supports an entity. It does not persist evidence and does not establish authority.

