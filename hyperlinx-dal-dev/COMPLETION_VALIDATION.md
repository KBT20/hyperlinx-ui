# Completion Validation

Status: validation examples and remaining boundary notes.

## Completion-Ready Example

Input:

- lifecycle state: `FIELD_ACTIVE`
- validated `FIELD_CLOSE`
- required Work Package closed
- required Object closed
- required Station closed
- required Segment closed
- required Deliverable closed
- accepted completion criteria

Expected result:

- status: `COMPLETE`
- `COMPLETION_CLOSE` created
- lifecycle review transition approved
- lifecycle complete transition approved

## Blocker Examples

Missing Station closure:

- blocker: `MISSING_STATION_CLOSE`
- status: `NOT_READY`

Missing Work Package closure:

- blocker: `MISSING_WORK_PACKAGE_CLOSE`
- status: `NOT_READY`

Missing acceptance criteria:

- blocker: `MISSING_ACCEPTANCE_CRITERIA`
- status: `NOT_READY`

Missing `scopeVersionId`:

- blocker: `MISSING_SCOPEVERSION_ID`
- status: `NOT_READY`

## Authority Examples

Completion Authority creates `COMPLETION_CLOSE` only after requirements pass.

`COMPLETION_CLOSE` is validated by ScopeVersion Close Authority.

Lifecycle Authority then evaluates:

```text
COMPLETION_REVIEW -> COMPLETE
```

## Fixture Coverage

`src/completion/fixtures/completionAuthorityFixtures.ts` includes:

- long-haul corridor completion.
- metro aggregation completion.
- AI corridor completion.
- GPU facility completion.
- data center completion.
- missing station closure rejection.
- missing work package closure rejection.
- missing acceptance criteria rejection.
- missing scopeVersionId rejection.
- fully validated completion example.

## Remaining Requirements Before Operations Authority

Future phases must define:

- Operations Authority.
- operational acceptance.
- asset activation.
- revenue realization.
- monitoring activation.

Completion Authority does not implement those responsibilities.
