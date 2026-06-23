# Corridor Synthesis Doctrine

Status: doctrine only.

## Constitutional Rule

Translate normalizes evidence. Corridor Synthesis generates corridor candidates. Prism scores corridor candidates. Promotion creates ScopeVersion drafts. Route Engineering creates executable truth.

Corridor Synthesis does not create authority.

## Non-Goals

This phase does not:

- implement routing.
- call external APIs.
- create UI.
- persist candidates.
- create ScopeVersions.
- implement Prism scoring.
- mutate kernel lifecycle, completion, authority, Control, Field, Twin, OI, or execution contracts.

## Synthesis Purpose

Corridor Synthesis converts normalized evidence into candidate corridor options that a human and future Prism scoring can compare.

Candidates may represent:

- customer-supplied routes.
- provider-generated routes.
- human-engineered routes.
- route diversity alternatives.
- AI infrastructure corridor concepts.
- expansion or monetization paths.

## Authority Boundary

External routing APIs are evidence providers.

No external route is authoritative.

Customer supplied routes must always be preserved.

Human engineering review remains authoritative.

## Synthesis Chain

```text
Normalized Evidence Bundle
  -> Corridor Synthesis Request
  -> Provider Evidence / Customer Geometry / Human Engineering
  -> CorridorCandidate[]
  -> Prism Scoring
  -> Promotion Gate
  -> ScopeVersion Draft
  -> Route Engineering Approval
```

## Preservation Rule

Generated routes never overwrite customer routes. Conflicting routes remain evidence. Every candidate must retain provenance through evidence IDs and provider IDs.

