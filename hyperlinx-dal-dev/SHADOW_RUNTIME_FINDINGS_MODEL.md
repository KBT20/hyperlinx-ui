# Shadow Runtime Findings Model

Phase: 6.7B

Findings identify differences between DAL runtime state and Constitutional Runtime expectations.

## Severity

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

## Finding Fields

Each finding includes:

- Component
- Expected
- Actual
- Gap
- Recommended Adapter Action

## Examples

Lifecycle gap:

```text
Component: Lifecycle
Expected: Reachable lifecycle state
Actual: NOT_A_REAL_STATE
Recommended Adapter Action: Normalize DAL lifecycle before constitutional evaluation.
```

Traceability gap:

```text
Component: Traceability
Expected: customerId present
Actual: missing
Recommended Adapter Action: Map customerId from DAL runtime or mark explicitly unavailable.
```

Close authority gap:

```text
Component: Close Authority
Expected: CONTROL_CLOSE
Actual: Missing CONTROL_CLOSE
Recommended Adapter Action: Expose authoritative close records for this ScopeVersion.
```
