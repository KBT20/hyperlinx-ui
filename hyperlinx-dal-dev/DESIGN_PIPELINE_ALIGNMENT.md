# Design Pipeline Alignment

Phase 6.9B preserves the existing Hyperlinx design pipeline.

The intended alignment is:

```text
Teralinx Route Intake
  -> Design Launch Session
  -> Design Workspace
  -> Existing Route Builder
  -> Existing Stationing
  -> Existing Network Objects
  -> Existing Proposed Inventory Graph
  -> Inventory Graph Workspace
```

## Alignment Guarantees

- No alternate routing engine is introduced.
- No alternate geometry engine is introduced.
- No alternate inventory model is introduced.
- No alternate ScopeVersion authority is introduced.
- No lifecycle or execution model is modified.

## Current UI Behavior

The Teralinx Route workspace creates a session in local component state and enables navigation to the existing Design workspace. This is a visual and orchestration handoff only.

## Future Integration Boundary

Future phases may pass the session into a live Design workspace adapter. That adapter must still preserve Design ownership and may not bypass the existing synthesis pipeline.
