# Corridor Synthesis Engine Architecture

Status: V1 pure engine.

## Doctrine

Translate creates evidence. Corridor Synthesis creates alternatives. Prism evaluates alternatives. Promotion creates ScopeVersion drafts. Route Engineering remains authoritative.

Corridor Synthesis V1 does not create truth.

## Non-Goals

This phase does not:

- perform Prism scoring.
- create ScopeVersions.
- create authority.
- perform promotion.
- call external routing providers.
- persist candidates.
- modify lifecycle, completion, closure, Control, Field, Twin, OI, or ScopeVersion execution contracts.

## Implementation

Engine:

- `src/corridor/CorridorSynthesisEngine.ts`

Fixtures:

- `src/corridor/fixtures/corridorSynthesisFixtures.ts`

Existing contracts consumed:

- `CorridorCandidate`
- `CorridorEvidenceBundle`
- `CorridorRequirement`

## Engine Inputs

```text
CorridorSynthesisRequest
  -> corridorId
  -> evidenceBundle
  -> requirements
  -> requestedCandidateTypes
```

## Engine Outputs

```text
CorridorSynthesisResult
  -> CorridorSynthesisCandidate[]
  -> diagnostics
  -> providerHooks
  -> preservedCustomerRouteEvidenceIds
```

## Candidate Types

V1 can represent:

- PRIMARY.
- DIVERSE.
- LOW_LATENCY.
- LOW_COST.
- AI_CORRIDOR.
- EXPANSION.
- CUSTOMER_SUPPLIED.
- HYBRID.

No candidate is scored or ranked.

## Geometry Rule

Endpoint-pair candidates use straight-line placeholder geometry only.

Customer-supplied route evidence is preserved exactly.

No generated route overwrites customer geometry.

