# Field Work Authority Model

Status: doctrine and read-only authority contract.

## Authority Chain

```text
ScopeVersion
  -> Control Authority
  -> Work Package
  -> Field Activation Authority
```

## Traceability

All Field work traces to:

```text
Work Package
  -> Control Authority
  -> ScopeVersion
```

Field activity may not exist outside ScopeVersion authority.

No orphan Field activity.

## Work Boundary

Field executes approved Work Packages.

Field activation authorizes execution workforce activity.

Field activation does not modify:

- ScopeVersion truth.
- budget authority.
- engineering authority.
- contract authority.

