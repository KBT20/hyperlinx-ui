# DAL Adapter Doctrine

Phase: 6.7A

The DAL Adapter Layer is a read-only translation boundary between the existing DAL runtime and the Constitutional Runtime.

## Doctrine

The Constitutional Runtime owns authority, lifecycle, traceability, and audit semantics.

The DAL runtime owns current operational state, current entities, current persistence, and current execution behavior.

Adapters translate between those domains. They do not decide, mutate, persist, or create authority.

## Boundary Rules

- Adapters are read-only.
- Adapters may inspect DAL records and return constitutional references.
- Adapters may produce diagnostics and gaps.
- Adapters may not write to IndexedDB, DAL server APIs, or local storage.
- Adapters may not emit lifecycle events.
- Adapters may not create ScopeVersions, Close Events, Work Packages, or Operations records.
- Adapters may not infer truth from missing DAL state.

## Constitutional Rule

ScopeVersion authority remains constitutional truth. Adapter output is an interpretation of DAL runtime state, not a replacement for ScopeVersion truth.

## Diagnostics

The adapter layer emits:

- `[ADAPTER_AUDIT_STARTED]`
- `[ENTITY_MAPPING_VALIDATED]`
- `[TRACEABILITY_VALIDATED]`
- `[ADAPTER_GAP_IDENTIFIED]`
- `[ADAPTER_AUDIT_COMPLETE]`
- `[SCOPEVERSION_ADAPTER_READ]`
- `[SCOPEVERSION_ADAPTER_WARNING]`
- `[SCOPEVERSION_ADAPTER_ERROR]`

These diagnostics are audit evidence only.
