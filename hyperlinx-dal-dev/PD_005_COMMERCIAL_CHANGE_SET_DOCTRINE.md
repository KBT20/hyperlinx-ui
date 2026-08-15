# PD-005 Commercial Change Set Doctrine

Date: 2026-07-08

## Constitutional Doctrine

Commercial Repository is immutable.

Commercial Revision is mutable.

Commercial Change Sets are additive.

Commercial Revision is rebuilt from:

Commercial Repository

plus

Commercial Change Set(s)

equals

Commercial Revision Projection

No Commercial screen may directly modify Repository Truth.

## Authority Layers

Repository Truth:

- Opportunity
- Commercial Route Repository
- Estimate reference
- Workbook reference
- Commercial assumption references
- Product doctrine references

Commercial Revision:

- Editable Commercial authority
- Rebuilt through patch replay
- Consumed by Workbook, Estimate, Proposal, Commercial Release Package, and Draft IOF Package

Commercial Change Set:

- Additive patch set
- Contains only deterministic patch records
- Does not embed Opportunity, Route Repository, Proposal, Workbook, Estimate, Draft IOF, geometry, maps, or runtime state

Commercial Revision Projection:

- Disposable projection
- Rebuildable from repository references plus Change Sets
- Carries diagnostics and patch replay evidence

## Patch Model

Each Commercial Patch contains only:

- `patchId`
- `revisionId`
- `patchType`
- `targetObjectId`
- `targetProperty`
- `oldValue`
- `newValue`
- `createdBy`
- `createdAt`
- `reason`
- `authority`
- `validationState`

## Runtime Rules

- Commercial edits create patches.
- Patches do not mutate repository truth.
- Save Revision persists a patch set.
- Compare Revision compares projected patch results, not raw JSON.
- Discard Revision removes unapplied patches.
- Restore Original inactivates patches and rebuilds from Repository Truth.
- Pricing formulas remain unchanged.
- Proposal outputs remain unchanged.
- ScopeVersion remains unchanged.
- Engineering Change Sets are not part of PD-005.

## Consumer Rule

The following consume Commercial Revision Projection:

- Workbook
- Estimate
- Proposal
- Commercial Release Package
- Draft IOF Package

Repository Truth remains reachable by reference only.
