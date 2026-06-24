# Field Closure Event Model

Status: doctrine and read-only event contract.

## Supported Field Closure Types

Field closure supports:

- `OBJECT_CLOSE`
- `STATION_CLOSE`
- `SEGMENT_CLOSE`
- `DISCIPLINE_CLOSE`
- `WORK_PACKAGE_CLOSE`
- `MATERIAL_CLOSE`
- `FACILITY_CLOSE`
- `POWER_CLOSE`
- `TRANSPORT_CLOSE`
- `GPU_CLOSE`
- `DATA_CENTER_CLOSE`
- `COMPOSITE_CLOSE`

## Required Inputs

Field closure requires:

- `scopeVersionId`.
- `customerId`.
- `opportunityId`.
- `corridorId`.
- lifecycle state `FIELD_ACTIVE`.
- approved Work Package.
- closure evidence.
- actor identity.
- closure type.
- object references when applicable.
- station references when applicable.
- segment references when applicable.
- completion references.
- timestamp.

## Event Meaning

A Field closure event records completion evidence against approved work.

It does not mutate ScopeVersion truth.

It becomes authoritative only through ScopeVersion Close Authority validation.

Validated `FIELD_CLOSE` events are consumed by Completion Authority.

Completion Authority validates delivery completion and creates `COMPLETION_CLOSE`.

Operations Authority consumes `COMPLETION_CLOSE` in a later phase.
