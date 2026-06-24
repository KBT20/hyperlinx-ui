# Runtime Dependency Audit

Status: audit and planning only.

## Dependency Chain

The constitutional runtime depends on:

```text
Translate
  -> Corridor
  -> Prism
  -> Marketplace
  -> Contract Readiness
  -> ScopeVersion
  -> Close Authority
  -> Lifecycle Authority
  -> Control
  -> Work Packages
  -> Field
  -> Completion
  -> Operations
```

## Required Inputs And Outputs

Close Authority requires:

- ScopeVersion traceability.
- actor attribution.
- evidence IDs.
- close type.

Lifecycle Authority requires:

- current state.
- requested state.
- required validated closes.
- actor authority.

Control requires:

- contract execution evidence.
- `CONTROL_CLOSE`.
- ScopeVersion traceability.

Field requires:

- active Control authority.
- approved Work Packages.
- ScopeVersion traceability.

Completion requires:

- validated `FIELD_CLOSE` events.
- completed requirements.
- acceptance evidence.

Operations requires:

- validated `COMPLETION_CLOSE`.
- ownership.
- inventory references.
- turnover package.
- operational acceptance.

## Missing Dependency Classes

Production integration must verify:

- DAL server repository adapters.
- tenant/account identity source.
- actor identity source.
- close ledger adapter.
- lifecycle state adapter.
- work package adapter.
- closure evidence adapter.
- audit export adapter.

## Duplicate Dependency Risks

Duplicate dependency risks include:

- browser fallback data and server data both treated as authority.
- workspace-local state and ScopeVersion state both treated as lifecycle truth.
- Marketplace estimates and budget locks both treated as commercial truth.
- Field closures and Completion closes both treated as completion truth.

