# Completion Engine Validation

Scope: `hyperlinx-dal-dev` only.

## Baseline ScopeVersion

Target: `SV-FBL-411584`

Known current Twin projection from field report:

| Metric | Before |
|---|---:|
| activeWorkItems | 1 |
| pendingWorkItems | 4 |
| closureCount | 1 |
| releasedObjects | 1 |
| lifecycleViolations | 0 |
| completedFeet | 0 |
| percentComplete | 0 |

No local persisted server record for `SV-FBL-411584` was found in the workspace, so this report documents kernel behavior and expected runtime validation against DAL1 data.

## Completion Engine Inputs

The engine consumes:

```ts
calculateCompletionProjection({
  scopeVersion,
  workItems,
  closures
})
```

Input handling:

| Input | Rule |
|---|---|
| ScopeVersion | Required for authoritative projection. Missing scope emits a blocking warning. |
| Work items | Filtered by `scopeVersionId === selectedScopeVersionId`. Foreign items are ignored and warned. |
| Closures | Filtered by `scopeVersionId === selectedScopeVersionId`. Foreign closures are ignored and warned. |
| Closure ledger | Used before current ScopeVersion state for footage completion evidence. |
| Current object/station state | Used for weighted object/station progress when footage evidence is absent. |

Diagnostics emitted:

```text
[COMPLETION_ENGINE_INPUT]
[COMPLETION_ENGINE_SCOPE_FILTER]
[COMPLETION_ENGINE_PROJECTION]
[COMPLETION_ENGINE_WARNING]
```

## Expected Baseline Projection

For the known current state:

| Metric | Expected |
|---|---:|
| closureCount | 1 |
| releasedObjects | 1 |
| objectCompletionPercent | `> 0` because `RELEASED = 0.10` |
| completedFeet | 0 because release closure does not complete footage |
| percentComplete | 0 when no completion footage exists |
| lifecycleViolations | 0 |
| foreign-scope closures | 0 |

Completion authority should be:

```text
MIXED
```

when both ScopeVersion state and closure ledger evidence are present.

## Full Execution Scenario

Fresh ScopeVersion validation path:

1. Approve ScopeVersion
2. Create work
3. Activate work
4. Release object
5. Install object
6. Test object
7. Accept object
8. Complete object
9. Verify object

Expected object progress by state:

| Object State | Weight |
|---|---:|
| PLANNED | 0 |
| RELEASED | 0.10 |
| INSTALLED | 0.40 |
| TESTED | 0.65 |
| ACCEPTED | 0.80 |
| COMPLETE | 1.00 |
| VERIFIED | 1.00 |
| BLOCKED | 0 |
| REJECTED | 0 |

Expected work progress by status:

| Work Status | Weight |
|---|---:|
| PENDING | 0 |
| ACTIVE | 0.25 |
| HOLD | 0.10 |
| BLOCKED | 0 |
| COMPLETE | 1.00 |
| CANCELLED | 0 |

Expected station progress by state:

| Station State | Weight |
|---|---:|
| PLANNED | 0 |
| RELEASED | 0.10 |
| IN_PROGRESS | 0.50 |
| COMPLETE | 1.00 |
| VERIFIED | 1.00 |
| BLOCKED | 0 |
| REJECTED | 0 |

## Closure Footage Rules

Completed feet increase only when closure evidence supports footage completion:

| Closure type | Completion footage rule |
|---|---|
| `OBJECT_STATE_TRANSITION` | Counts footage only when new object state is `COMPLETE` or `VERIFIED` and `feetAffected > 0`. |
| `STATION_STATE_TRANSITION` | Counts footage when new station state is `COMPLETE` or `VERIFIED`; uses `feetAffected`, then station measure delta. |
| `STATION_RANGE_TRANSITION` | Counts footage when target state is `COMPLETE` or `VERIFIED`; uses `feetAffected`, then station range delta. |

Released object closures with `feetAffected = 0` do not increase `completedFeet`.

## Twin Integration

Twin now receives:

```text
completionProjection
```

and legacy metric fields are populated from the completion projection:

```text
activeWorkItems
pendingWorkItems
closureCount
completedFeet
releasedObjects
installedObjects
testedObjects
acceptedObjects
completedObjects
verifiedObjects
blockedObjects
rejectedObjects
percentComplete
objectCompletionPercent
stationDerivedCompletionPercent
workCompletionPercent
completionAuthority
```

Twin remains selected-ScopeVersion only.

## Operational Intelligence Integration

Operational Intelligence aggregates completion projections across portfolio ScopeVersions.

New portfolio summary values:

```text
portfolioCompletionPercent
activeScopeVersions
blockedScopeVersions
completedScopeVersions
totalCompletedFeet
```

OI remains portfolio authority and does not become selected-scope-only.

## Warnings

The completion kernel emits warning records for:

| Code | Meaning |
|---|---|
| `COMPLETION_SCOPEVERSION_MISSING` | Completion projection lacks ScopeVersion input. |
| `COMPLETION_FOREIGN_WORK_ITEM` | Work item belongs to another ScopeVersion. |
| `COMPLETION_FOREIGN_CLOSURE` | Closure belongs to another ScopeVersion. |
| `COMPLETION_UNKNOWN_OBJECT` | Closure references an object not in ScopeVersion truth. |
| `COMPLETION_UNKNOWN_STATION` | Closure references a station not in ScopeVersion truth. |
| `COMPLETION_TOTAL_FEET_MISSING` | No total footage basis was found. |
| `COMPLETION_FEET_EXCEEDS_TOTAL` | Completion footage exceeds total route footage. |

Kernel invariant logging uses:

```text
[KERNEL_COMPLETION_INVARIANT]
```

## Remaining Risks

- Server and client completion engines are mirrored because the DAL server is plain JavaScript while the client kernel is TypeScript. A future shared-package or code-generation step should eliminate this mirror.
- Live runtime verification for `SV-FBL-411584` requires DAL1 persisted data or a local server data snapshot.
- Legacy `FieldClosure` side-ledger records do not carry rich object/station transition states; authoritative completion should prefer `ClosureRecord` entries appended to ScopeVersion truth.
