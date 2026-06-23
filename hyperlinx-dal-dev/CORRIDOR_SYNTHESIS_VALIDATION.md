# Corridor Synthesis Validation

Status: doctrine validation only.

## Endpoint Pair Example

Input:

```text
A endpoint
Z endpoint
hyperscaler requirement
```

Expected synthesis output:

- primary candidate request.
- possible low-latency candidate request.
- diagnostics showing provider evidence is required.
- no ScopeVersion creation.

## Customer Route Example

Input:

```text
customer supplied route
A/Z endpoints
requirement sheet
```

Expected synthesis output:

- `CUSTOMER_SUPPLIED` candidate.
- preserved customer route evidence IDs.
- optional generated alternatives in future phases.
- no overwrite of customer geometry.

## AI Corridor Example

Input:

```text
data center endpoints
power/substation evidence
cloud on-ramp evidence
future AI demand evidence
```

Expected synthesis output:

- `AI_CORRIDOR` candidate.
- attributes for power proximity, transmission, data centers, interconnection density, expansion land, future AI demand.
- score placeholder only.

## Metro Overbuild Example

Input:

```text
metro endpoint list
existing fiber evidence
commercial product intent
```

Expected synthesis output:

- `PRIMARY` candidate.
- `EXPANSION` candidate when residual capacity evidence exists.
- diagnostics for shared ROW and permitting evidence gaps.

## Middle-Mile Example

Input:

```text
regional endpoints
existing conduit route
desired diversity
```

Expected synthesis output:

- `PRIMARY` candidate.
- `DIVERSE` candidate request.
- diversity evidence requirements.
- unresolved overlap diagnostics until calculated later.

## Remaining Risks Before Implementation

- Provider calls must preserve provenance.
- Geometry normalization must preserve customer files exactly.
- Diversity cannot be inferred from line separation alone.
- Existing fiber/conduit references must not become execution truth.
- Candidate generation must remain separate from Prism scoring.

## Remaining Risks Before Prism

- Score placeholders must not be shown as final rankings.
- Diversity claims require overlap evidence.
- AI corridor attributes need source-specific confidence.
- Monetization potential must not override customer service requirements.
- Promotion must remain draft-only until Route Engineering approval.

