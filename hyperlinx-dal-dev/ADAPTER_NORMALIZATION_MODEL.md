# Adapter Normalization Model

Phase: 6.7C

Normalization maps legacy DAL names into Constitutional Runtime vocabulary for read-only interpretation.

## Lifecycle Examples

- `RELEASED_TO_CONTROL` -> `CONTROL`
- `ACTIVATED` -> `CONTROL_ACTIVE`
- `IN_FIELD` -> `FIELD`
- `FIELD_ACTIVE` -> `FIELD`

## Close Examples

- `FIELD_CLOSURE` -> `FIELD_CLOSE`
- `CONTROL_ACTIVATED` -> `CONTROL_CLOSE`

## Marketplace Examples

- `candidateId` -> `budgetCandidateId`

## Rule Contract

Every normalization rule includes:

- Rule ID
- Gap type
- Source value
- Normalized value
- Applies-to field
- Description
- `readOnly: true`

Normalization only affects adapter interpretation.
