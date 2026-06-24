# Operations Validation

Status: validation examples and remaining boundary notes.

## Operations-Ready Example

Input:

- lifecycle state: `COMPLETE`
- validated `COMPLETION_CLOSE`
- operational owner
- support owner
- maintenance owner
- asset inventory reference
- service inventory reference
- required documentation
- turnover package
- accepted operational criteria

Expected result:

- status: `OPERATIONS_ACTIVE`
- `OPERATIONS_CLOSE` created
- lifecycle transition `COMPLETE -> OPERATIONS` approved

## Blocker Examples

Missing Completion close:

- blocker: `MISSING_COMPLETION_CLOSE`
- status: `NOT_READY`

Missing operational owner:

- blocker: `MISSING_OPERATIONAL_OWNER`
- status: `NOT_READY`

Missing turnover package:

- blocker: `MISSING_TURNOVER_PACKAGE`
- status: `NOT_READY`

Missing acceptance criteria:

- blocker: `MISSING_ACCEPTANCE_CRITERIA`
- status: `NOT_READY`

## Authority Examples

Operations Authority creates `OPERATIONS_CLOSE` only after readiness requirements pass.

`OPERATIONS_CLOSE` is validated by ScopeVersion Close Authority.

Lifecycle Authority then evaluates:

```text
COMPLETE -> OPERATIONS
```

## Fixture Coverage

`src/operations/fixtures/operationsAuthorityFixtures.ts` includes:

- long-haul corridor operational activation.
- metro aggregation operational activation.
- AI corridor operational activation.
- GPU facility operational activation.
- data center operational activation.
- missing completion close rejection.
- missing operational owner rejection.
- missing turnover package rejection.
- missing acceptance criteria rejection.
- fully validated operations example.

## Remaining Requirements Before Revenue Realization

Future phases must define:

- revenue realization.
- operational telemetry.
- Operational Intelligence consumption.
- SLA validation.
- lifecycle renewal.
- expansion planning.

Operations Authority does not implement those responsibilities.
