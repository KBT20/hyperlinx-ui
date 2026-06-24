# Work Package Authority Model

Status: doctrine and read-only authority contract.

## Authority Chain

```text
ScopeVersion
  -> CONTRACT_CLOSE
  -> CONTROL_CLOSE
  -> CONTROL_ACTIVE
  -> Work Packages
```

## Authority Rules

Work Packages require:

- ScopeVersion traceability.
- Control activation authority.
- approved planning packages.
- approved commercial references.
- approved execution strategy.

Work Packages may not:

- create ScopeVersion truth.
- modify ScopeVersion truth.
- activate Field.
- authorize crew work.
- schedule work.

## Field Boundary

Field activation requires approved Work Packages, but approved Work Packages do not themselves activate Field.

Future Field activation authority must consume Work Packages and create separate Field authority.

