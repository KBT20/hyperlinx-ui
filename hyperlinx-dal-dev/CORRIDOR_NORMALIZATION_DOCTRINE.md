# Corridor Normalization Doctrine

Status: doctrine and isolated read-only engine.

## Constitutional Rule

Translate does not create truth.

Translate creates evidence. Evidence is normalized. Evidence is attached to Corridor development objects. Corridor Promotion evaluates evidence. Route Engineering creates executable truth.

## Non-Goals

This phase does not:

- generate routes.
- score routes.
- create ScopeVersions.
- persist evidence.
- call external APIs.
- mutate lifecycle authority.
- change Control, Field, Twin, Operational Intelligence, completion, or closure contracts.

## Evidence Preservation

No evidence should be discarded simply because newer evidence exists.

When sources conflict:

- preserve all records.
- create a conflict record.
- reduce confidence when appropriate.
- require human review before promotion.

## Source Authority

No source is authoritative.

Customer files, APIs, datasets, and human notes all provide evidence only. Authority remains inside the DAL kernel and Route Engineering approval path.

## Normalization Target

Future Translate implementations should normalize raw inputs into:

- `CorridorNormalizedEvidence`
- `CorridorEvidenceBundle`
- `ConflictRecord`

The bundle becomes the handoff object for:

- Corridor Promotion.
- Prism.
- Route Engineering.

