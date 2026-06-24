# Completion Audit Model

Status: doctrine and contract alignment.

## Audit Purpose

Completion Audit records why a ScopeVersion was considered complete or not complete.

The audit preserves:

- scopeVersionId.
- customerId.
- opportunityId.
- corridorId.
- completion status.
- completion close ID when created.
- validated Field close IDs.
- lifecycle transition audit IDs.
- blocker IDs.
- diagnostics.

## Replayability

Completion history must remain replayable from:

```text
ScopeVersion
  -> FIELD_CLOSE evidence
  -> Completion requirements
  -> Completion audit
  -> COMPLETION_CLOSE
  -> Lifecycle audit
```

No completion record may exist outside ScopeVersion authority.

