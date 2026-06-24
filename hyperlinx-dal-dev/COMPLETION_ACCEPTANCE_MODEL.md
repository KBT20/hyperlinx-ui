# Completion Acceptance Model

Status: doctrine and contract alignment.

## Acceptance Types

Completion Authority supports:

- Object Acceptance.
- Station Acceptance.
- Segment Acceptance.
- Work Package Acceptance.
- Facility Acceptance.
- Power Acceptance.
- Transport Acceptance.
- Customer Acceptance.
- Composite Acceptance.

## Acceptance Meaning

Acceptance is evidence until Completion Authority validates completion.

Acceptance does not:

- mutate ScopeVersion truth.
- create operations authority.
- create billing authority.
- create monitoring authority.

## Acceptance Requirements

An acceptance record must identify:

- acceptance ID.
- acceptance type.
- referenced objects, stations, segments, work packages, deliverables, or composite scope.
- evidence IDs.
- accepted status.
- accepted by.
- accepted at.

Completion cannot be approved without accepted acceptance criteria.

## Operations Alignment

Completion Authority creates `COMPLETION_CLOSE`.

Operations Authority consumes `COMPLETION_CLOSE`.

Operations Authority creates `OPERATIONS_CLOSE` after operational readiness and operational acceptance are validated.

Completion acceptance remains delivery evidence. Operational acceptance remains a separate readiness requirement.
