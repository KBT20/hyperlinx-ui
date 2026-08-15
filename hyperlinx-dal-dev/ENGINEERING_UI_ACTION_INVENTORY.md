# Engineering UI Action Inventory

Date: 2026-07-08

## Scope

This inventory audits visible Engineering Certification actions before any UI removal or relocation. No UI source was modified by this audit.

Sources audited:

- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/mapkernel/MapKernel.tsx`

No Engineering keyboard shortcuts or context menus were found in the audited sources.

## Action Inventory

| Action | Workspace | Current Implementation | Purpose | Lifecycle Stage | Authority | Repository Impact | Class | Keep | Hide | Remove | Replacement |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Return to Commercial | Engineering Certification | `setWorkspace("googleRfp")` in empty/recovery states | Navigate back to Commercial Planning | Navigation | UI View State | No repository write | Operator Action / Duplicate Surface | Yes | No | No | Keep in recovery/empty states |
| Open Engineering Package row | Engineering Package Browser | `openPackage(engineeringPackageId)` | Restore selected Engineering Package | Engineering intake restore | Engineering Repository | Reads Engineering Package and references | Operator Action | Yes | No | No | Canonical package open |
| Alternate package row in projection failure | Projection recovery browser | `openPackage(engineeringPackageId)` | Recover by opening another package | Engineering restore recovery | Engineering Repository | Reads Engineering Package and references | Operator Action | Yes | No | No | None |
| Engineering package queue selector | Engineering summary aside | `openPackage(event.currentTarget.value)` | Switch active Engineering Package | Engineering intake restore | Engineering Repository | Reads Engineering Package and references | Operator Action / Duplicate | Yes | No | No | Canonical should be package browser; selector can remain as compact switcher |
| Open Station Review | Engineering header | `openStationReview` | Generate/open local station review from restored projection | Station Planning | Engineering Revision | Local station review; no ScopeVersion | Operator Action | Yes | No | No | Future Station Plan Repository / Engineering Change Set |
| Discipline lens buttons | Engineering Certification | `setDisciplineLens(lens.key)` | Filter Engineering Revision by discipline | Engineering review projection | UI Projection | No repository write | Operator View Action | Yes | No | No | None |
| Labels Off | Engineering canvas | `setStationLabelMode("hidden")` | Hide station labels | Engineering map projection | UI View State | No repository write | Operator View Action | Yes | No | No | None |
| Major Stations | Engineering canvas | `setStationLabelMode("major")` | Show major station labels | Engineering map projection | UI View State | No repository write | Operator View Action | Yes | No | No | None |
| Engineering Labels | Engineering canvas | `setStationLabelMode("engineering")` | Show detailed station labels | Engineering map projection | UI View State | No repository write | Operator View Action | Yes | No | No | None |
| Map topology view | Engineering map | `setMode("topology")` in `MapKernel` | Switch map to topological truth view | Engineering projection view | UI View State | Persists view state only in browser | Operator View Action | Yes | No | No | None |
| Map geographic view | Engineering map | `setMode("geographic")` in `MapKernel` | Switch map to geographic view | Engineering projection view | UI View State | Persists view state only in browser | Operator View Action | Yes | No | No | None |
| Geographic base layer selector | Engineering map | `setBaseLayer` in `MapKernel` | Choose street/satellite/hybrid/terrain base | Engineering projection view | UI View State | Persists view state only in browser | Operator View Action | Yes | No | No | None |
| Map zoom + / - | Engineering map | `zoomGeographicView` | Change geographic zoom | Engineering projection view | UI View State | Persists view state only in browser | Operator View Action | Yes | No | No | None |
| Fit Candidate | Engineering map | `fitGeographicView(... FIT_CANDIDATE ...)` | Focus map on candidate features | Engineering projection view | UI View State | Viewport request only | Operator View Action | Yes | No | No | None |
| Fit Attachment | Engineering map | `fitGeographicView(... FIT_ATTACHMENT ...)` | Focus map on attachment features | Engineering projection view | UI View State | Viewport request only | Operator View Action | Yes | No | No | None |
| Fit Route | Engineering map | `fitGeographicView(... FIT_ROUTE ...)` | Focus map on active route | Engineering projection view | UI View State | Viewport request only | Operator View Action | Yes | No | No | None |
| Fit Certified Route | Engineering map | `fitGeographicView(... FIT_CERTIFIED_ROUTE ...)` | Focus map on certified route geometry when present | Certified IOF projection view | UI View State | Viewport request only | Operator View Action | Yes | No | No | None |
| Fit Entire Network | Engineering map | `fitGeographicView(... FIT_ENTIRE_NETWORK ...)` | Focus map on all projected features | Engineering projection view | UI View State | Viewport request only | Operator View Action | Yes | No | No | None |
| Map pan / wheel / feature select | Engineering map | `MapKernel` pointer/wheel/selection handlers | Navigate and inspect projection primitives | Engineering projection view | UI View State | No repository write | Operator View Action | Yes | No | No | None |
| Editable route vertex/segment/corridor handles | Engineering map kernel capability | `editableRoute` callbacks when enabled | Move route geometry interactively | Engineering Revision | Engineering Change Set | No direct repository write in current Certification workspace | Operator Action when enabled | Yes | No | No | Must emit Engineering patches only |
| Constraint category selector | Engineering Certification | `setConstraintCategory` | Stage constraint category | Engineering Revision | Engineering Change Set | Local state until Add Constraint | Operator Action | Yes | No | No | None |
| Constraint severity selector | Engineering Certification | `setConstraintSeverity` | Stage constraint severity | Engineering Revision | Engineering Change Set | Local state until Add Constraint | Operator Action | Yes | No | No | None |
| Constraint disposition input | Engineering Certification | `setConstraintDisposition` | Stage constraint disposition | Engineering Revision | Engineering Change Set | Local state until Add Constraint | Operator Action | Yes | No | No | None |
| Constraint notes textarea | Engineering Certification | `setConstraintNotes` | Stage notes/evidence | Engineering Revision | Engineering Change Set | Local state until Add Constraint | Operator Action | Yes | No | No | None |
| Selected object selector | Engineering Certification | `setSelectedObjectId` | Select object under review | Engineering review projection | UI View State | No repository write | Operator View Action | Yes | No | No | None |
| Engineering approved budget input | Engineering Budget Review | `updateEngineeringBudgetRow` | Confirm object-level budget amount | Engineering Revision / Budget Confirmation | Engineering Change Set | Records `CHANGE_OBJECT_CONFIGURATION` patch | Operator Action | Yes | No | No | None |
| Budget confirm checkbox | Engineering Budget Review | `updateEngineeringBudgetRow` | Confirm object budget row | Engineering Revision / Budget Confirmation | Engineering Change Set | Records `CHANGE_OBJECT_CONFIGURATION` patch | Operator Action | Yes | No | No | None |
| Budget notes textarea | Engineering Budget Review | `updateEngineeringBudgetRow` | Add notes to selected object budget | Engineering Revision / Budget Confirmation | Engineering Change Set | Records `CHANGE_OBJECT_CONFIGURATION` patch | Operator Action | Yes | No | No | None |
| Approve Engineering Budget | Engineering Budget Review | `approveEngineeringBudget` | Approve complete engineering budget | Budget Confirmation | Engineering Change Set / Certification readiness | Records `CHANGE_REVIEW_STATUS` patch; unlocks certification readiness | Operator Action | Yes | No | No | None |
| Restore certified package selector | Certified IOF Package panel | `openCertifiedPackage` | Restore Certified IOF Package projection | Certification Ledger / Certified IOF projection | Certification Ledger / Certified IOF Package | Reads certified package/ledger projection | Operator Action | Yes | No | No | None |
| Add Constraint | Engineering Actions | `addConstraint` | Add constraint to object/revision | Engineering Revision | Engineering Change Set / Engineering Certification API | Writes constraint and `ADD_CONSTRAINT` patch | Operator Action | Yes | No | No | None |
| New station selector | Engineering Actions | `setMoveStation` | Stage target station for object move | Engineering Revision | Engineering Change Set | Local state until Move Object | Operator Action | Yes | No | No | None |
| Move reason input | Engineering Actions | `setMoveReason` | Stage move reason | Engineering Revision | Engineering Change Set | Local state until Move Object | Operator Action | Yes | No | No | None |
| Move authority input | Engineering Actions | `setMoveAuthority` | Stage move authority | Engineering Revision | Engineering Change Set | Local state until Move Object | Operator Action | Yes | No | No | None |
| Move Object | Engineering Actions | `moveObject` | Move selected object to a station | Engineering Revision / Object Placement | Engineering Change Set / Engineering Certification API | Writes move and `MOVE_OBJECT` patch | Operator Action | Yes | No | No | None |
| Redline reason input | Engineering Actions | `setRedlineReason` | Stage route redline reason | Engineering Revision / Placement | Engineering Change Set | Local state until Create Route Redline | Operator Action | Yes | No | No | None |
| Redline description textarea | Engineering Actions | `setRedlineDescription` | Stage route redline description | Engineering Revision / Placement | Engineering Change Set | Local state until Create Route Redline | Operator Action | Yes | No | No | None |
| Create Route Redline | Engineering Actions | `createRedline` | Record engineering route redline | Engineering Revision / Placement | Engineering Change Set / Engineering Certification API | Writes redline and `CHANGE_PLACEMENT` patch | Operator Action | Yes | No | No | None |
| Doctrine rule input | Engineering Actions | `setExceptionRule` | Stage exception rule | Engineering Revision / Exceptions | Engineering Change Set | Local state until Record Doctrine Exception | Operator Action | Yes | No | No | None |
| Actual condition input | Engineering Actions | `setExceptionCondition` | Stage actual condition | Engineering Revision / Exceptions | Engineering Change Set | Local state until Record Doctrine Exception | Operator Action | Yes | No | No | None |
| Exception reason textarea | Engineering Actions | `setExceptionReason` | Stage exception reason | Engineering Revision / Exceptions | Engineering Change Set | Local state until Record Doctrine Exception | Operator Action | Yes | No | No | None |
| Exception impact textarea | Engineering Actions | `setExceptionImpact` | Stage exception impact | Engineering Revision / Exceptions | Engineering Change Set | Local state until Record Doctrine Exception | Operator Action | Yes | No | No | None |
| Record Doctrine Exception | Engineering Actions | `recordException` | Persist engineering doctrine exception | Engineering Revision / Exceptions | Engineering Change Set / Engineering Certification API | Writes exception and `ADD_EXCEPTION` patch | Operator Action | Yes | No | No | None |
| Certification notes textarea | Engineering Actions | `setCertificationNotes` | Stage certification notes | Engineering Certification | Certification Ledger | Local state until certify | Operator Action | Yes | No | No | None |
| CERTIFY IOF PACKAGE | Engineering Actions | `certifyPackage` | Create immutable certification event and Certified IOF projection | Engineering Certification -> Certification Ledger | Certification Ledger / Certified IOF Package | Creates Certification Ledger entry and Certified IOF Package projection; no ScopeVersion | Operator Action | Yes | No | No | None |
| Commercial revision reason textarea | Engineering Actions | `setCommercialRevisionReason` | Stage reason for return to Commercial | Return loop | Engineering / Commercial boundary | Local state until reject/request | Operator Action | Yes | No | No | None |
| Reject / Request Commercial Revision | Engineering Actions | `requestCommercialRevision` | Return package for Commercial revision | Engineering rejection -> Commercial revision loop | Engineering Repository / Commercial workflow | Updates package return state; no ScopeVersion | Operator Action | Yes | No | No | None |

## Engineering Duplicates

| Duplicate | Canonical Action | Finding | Decision |
|---|---|---|---|
| Return to Commercial appears in empty and projection-failure states | Return to Commercial | Same navigation action in mutually exclusive recovery states | Keep |
| Open Engineering Package appears as list row and compact selector | Package browser row | Both call `openPackage`; selector is useful after a package is open | Keep, but label selector as switcher |
| Open Station Review appears only once | Open Station Review | No duplicate found | Keep |
| Certification restore selector and certification action | Separate actions | Restore reads a certified package; Certify creates ledger/package | Keep both |

## Engineering Developer/Internal Actions

No visible Engineering developer-only buttons were found. Map mode, base layer, label density, and fit controls are operator view actions because they do not mutate repository truth.

## Engineering Authority Summary

Remaining Engineering actions map to these constitutional stages:

| Stage | Actions |
|---|---|
| Engineering Repository restore | Open Engineering Package, queue selector |
| Engineering Baseline / Revision projection | Discipline lenses, map view controls, object selector |
| Station Planning | Open Station Review |
| Engineering Change Sets | Add Constraint, Move Object, Create Route Redline, Record Doctrine Exception, budget row edits |
| Budget Confirmation | Approve Engineering Budget |
| Certification Ledger | CERTIFY IOF PACKAGE |
| Return loop | Reject / Request Commercial Revision |
