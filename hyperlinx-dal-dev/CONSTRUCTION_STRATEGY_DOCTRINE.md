# Construction Strategy Doctrine

Phase: 7.4G  
Scope: DAL sales estimator only.  
Authority: Budgetary, advisory, non-production.

## Doctrine

Construction Strategy defines how the proposed route is expected to be built before engineering refinement.

It is not geometry authority.
It is not Route Engineering.
It does not create ScopeVersions.
It does not certify construction method.

## Supported Methods

The sales estimator supports three construction strategy methods:

| Method | Meaning |
| --- | --- |
| Plow | Route footage expected to be plowed based on environment, restoration, permitting, production strategy, and customer standards. |
| Dirt Bore | Route footage expected to be constructed by boring/HDD. |
| Open Cut | Route footage expected to be constructed by open trench/open cut. |

The method percentages must always total 100%.

## Critical Boundary

Construction Method is not Geology.

Construction Strategy answers:

```text
How are we going to build it?
```

Geology answers:

```text
What conditions will Dirt Bore encounter?
```

Plow is independent of geology.
Open Cut is independent of geology.
Only Dirt Bore receives geology-based rock adder pricing.

## Recalculation Rule

Changing Construction Strategy recalculates quantities and pricing through the existing `SelectedScopePricingSummary`.

No duplicate pricing authority is created.
No geometry is modified.
No production authority is modified.
