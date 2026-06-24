# DAL Runtime Boundary

Phase: 6.7A

The adapter boundary allows Constitutional Runtime components to consume existing DAL records without changing DAL behavior.

## DAL Runtime Owns

- Current persisted records
- Existing server APIs
- Existing IndexedDB fallback behavior
- Current workspaces
- Current execution behavior

## Constitutional Runtime Owns

- Authority rules
- Lifecycle rules
- Traceability requirements
- Audit interpretation

## Adapter Boundary

Adapters may:

- Read DAL records supplied by the caller.
- Map records to constitutional references.
- Validate required field presence.
- Produce diagnostics.
- Identify gaps.

Adapters may not:

- Fetch server records.
- Write server records.
- Write IndexedDB records.
- Modify ScopeVersions.
- Change lifecycle state.
- Generate work or closures.
- Create production truth.

## Integration Strategy

This layer is designed for read-only adapters, shadow runtime validation, and eventual parallel validation before any production adoption.
