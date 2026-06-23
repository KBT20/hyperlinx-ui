# Corridor Synthesis Validation

Status: V1 engine validation document.

## Fixture Location

`src/corridor/fixtures/corridorSynthesisFixtures.ts`

Fixtures include:

1. Dallas to Kansas City endpoint pair.
2. Customer supplied route.
3. Metro overbuild corridor.
4. Long-haul corridor.
5. AI corridor request.
6. Middle-mile request.

## Endpoint Synthesis Example

Input:

```text
A endpoint
Z endpoint
requirements
```

Expected output:

- `PRIMARY` candidate.
- straight-line placeholder geometry.
- endpoint evidence IDs.
- no routing provider call.
- no ScopeVersion creation.

## Customer Route Preservation Example

Input:

```text
route evidence already exists
endpoint evidence exists
requirements exist
```

Expected output:

- `CUSTOMER_SUPPLIED` candidate.
- original route geometry preserved.
- source route evidence retained in `preservedCustomerRouteEvidenceIds`.
- no geometry overwrite.

## AI Corridor Example

Input:

```text
hyperscaler endpoints
AI corridor requirements
```

Expected output:

- `AI_CORRIDOR` placeholder candidate.
- placeholder attributes for power, substations, transmission, interconnection, expansion land, and AI demand.
- no enrichment.
- no scoring.

## Expansion Corridor Example

Input:

```text
endpoint pair or customer route
expansion requested
```

Expected output:

- `EXPANSION` placeholder candidate.
- placeholder attributes for future capacity, residual duct, residual fiber, expansion land, and future build zones.
- no calculations.

## Candidate Output Examples

Every candidate retains:

- candidate ID.
- candidate type.
- source.
- evidence IDs.
- requirements.
- attributes.
- diagnostics.
- provider sources.
- creation method.
- generated timestamp.

## Known Limitations

- Endpoint candidates use straight-line placeholder geometry.
- Diversity is `NOT_EVALUATED`.
- AI attributes are placeholders.
- Expansion attributes are placeholders.
- No provider integrations exist.
- No Prism scoring exists.
- No promotion or ScopeVersion creation occurs.

## Future Provider Integrations

Future integration points:

- OSRM.
- GraphHopper.
- OpenRouteService.
- Google Roads.
- DOT GIS.
- Internal Teralinx Models.

Provider output must remain evidence-only.

