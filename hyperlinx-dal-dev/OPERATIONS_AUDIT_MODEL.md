# Operations Audit Model

Status: doctrine and contract alignment.

## Audit Purpose

Operations Audit records why a completed ScopeVersion was considered ready or not ready for operations.

The audit preserves:

- scopeVersionId.
- customerId.
- opportunityId.
- corridorId.
- operations status.
- operations close ID when created.
- validated Completion close IDs.
- lifecycle transition audit IDs.
- blocker IDs.
- diagnostics.

## Replayability

Operational history must remain replayable from:

```text
ScopeVersion
  -> COMPLETION_CLOSE
  -> Operations requirements
  -> Operations audit
  -> OPERATIONS_CLOSE
  -> Lifecycle audit
```

No operational record may exist outside ScopeVersion authority.

