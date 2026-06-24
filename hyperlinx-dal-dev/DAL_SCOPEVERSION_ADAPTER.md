# DAL ScopeVersion Adapter

Phase: 6.7A

The ScopeVersion adapter exposes read-only access to the DAL ScopeVersion shape for Constitutional Runtime consumers.

## Read Functions

- `getScopeVersion(scopeVersions, scopeVersionId)`
- `getScopeVersionState(scopeVersion)`
- `getScopeVersionTraceability(scopeVersion)`
- `getScopeVersionClosures(scopeVersion)`
- `getScopeVersionLifecycle(scopeVersion)`

## State Authority

Lifecycle state is read through:

```ts
getAuthoritativeLifecycleState(scopeVersion)
```

The adapter does not read `scopeVersion.status` as final truth. It reports both top-level and canonical lifecycle fields for diagnostics, but authoritative display should use the lifecycle guard.

## Traceability Fields

The adapter attempts to resolve:

- `customerId`
- `opportunityId`
- `corridorId`
- `scopeVersionId`
- `parentScopeVersionId`
- `rootScopeVersionId`

Resolution is evidence-based. Missing values produce adapter gaps.

## Closure Reads

The adapter reads closures from:

- `scopeVersion.closures`
- `scopeVersion.canonicalTruth.closures`

Duplicate closure IDs are deduplicated for the returned reference.

## Non-Authority

Adapter references are not new truth. They are a read-only bridge to existing DAL state.
