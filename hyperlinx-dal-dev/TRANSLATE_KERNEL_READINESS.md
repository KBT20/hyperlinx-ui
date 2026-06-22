# Translate Kernel Readiness

Scope: `hyperlinx-dal-dev` only.

Purpose: assess whether DAL kernel contracts are ready for future Translate work. This document does not implement Translate.

## Current Readiness

| Area | Status | Notes |
|---|---|---|
| ScopeVersion lifecycle | Ready with guard | `ScopeVersionLifecycleGuard` provides authoritative lifecycle reads and monotonic merge. |
| Wire-name registry | Ready for boundary use | `KernelStateRegistry` normalizes aliases and logs `[KERNEL_ALIAS_NORMALIZED]`. |
| Inventory truth | Ready for server-backed flow | Inventory graph APIs and IndexedDB fallback are differentiated through fallback diagnostics. |
| Route authority | Ready for canonical persistence | CertifiedRoute and route certification paths emit `DRAFT`/`REJECTED` canonically. |
| Control work authority | Ready for canonical persistence | `HOLD` is canonical; `ON_HOLD` is accepted only as an alias. |
| Fallback authority labeling | Partially ready | Client repositories log `[KERNEL_FALLBACK_ACTIVE]`; workspace-level UX should continue surfacing fallback state clearly. |
| Invariant engine | Ready for advisory checks | Alias, duplicate-authority, and fallback findings are reported as kernel warnings. |

## Translate Preconditions

Before Translate commits authoritative output, it must:

1. Emit canonical kernel wire values only.
2. Treat browser fallback as development continuity, not truth.
3. Create or update ScopeVersions only through repository/API save paths.
4. Preserve source evidence separately from ScopeVersion truth.
5. Run kernel invariant checks before commit.
6. Label any local-only extraction state as `DEVELOPMENT_FALLBACK` or `LOCAL_FALLBACK`.

## Non-Goals For This Pass

No Translate upload parsing, extraction workflow, validation queue, source-object mapping, or commit UI was implemented in this pass.

## Readiness Verdict

Translate can begin a DAL-only implementation after one additional consolidation pass:

```text
Server/client transition constants should be generated from one source or moved into a shared package.
```

Until then, Translate should call existing repositories and normalizers rather than duplicating transition logic.
