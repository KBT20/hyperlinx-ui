# UI Action Authority Audit

Date: 2026-07-08

## Objective

Audit every visible Commercial and Engineering operator action before UI removal or relocation.

This audit is documentation-only. No Commercial or Engineering UI source was modified. No button, menu item, toolbar action, map action, or form action was removed.

## Inventories Produced

- `COMMERCIAL_UI_ACTION_INVENTORY.md`
- `ENGINEERING_UI_ACTION_INVENTORY.md`

## Source Coverage

Commercial sources audited:

- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/googleRfp/CommercialReviewPanel.tsx`
- `src/components/workspaces/googleRfp/GoogleBidCommercialPreviewPanel.tsx`
- `src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx`
- `src/components/workspaces/googleRfp/GoogleBidRouteReviewPanel.tsx`
- `src/components/workspaces/googleRfp/GoogleBidDiagnosticsSummaryPanel.tsx`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`

Engineering sources audited:

- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/mapkernel/MapKernel.tsx`

No keyboard shortcuts or context menu actions were found in the audited Commercial or Engineering sources.

## Constitutional Authority Model

Every remaining operator action should map to exactly one owner and lifecycle stage:

| Lifecycle Stage | Constitutional Authority | Canonical Operator Actions |
|---|---|---|
| Customer / Account intake | Customer Repository / Customer Twin Repository | Select Account, Import Existing Network, New/Edit/Save Account, Save Contact |
| Opportunity setup | Commercial Repository | New Opportunity, Open Opportunity, Save Opportunity, Save As |
| Commercial route truth | Commercial Route Repository | Import Route, Save Imported Route, Generate Route |
| Commercial edits | Commercial Revision / Commercial Change Set | Start Edit, Save Revision, Compare Revision, Restore Original, Discard Revision, estimate/ILA/assumption edits |
| Proposal | Proposal Repository | Save Proposal, Submit to Customer, Comment, Upload Evidence, Request Changes, Approve |
| Commercial release | Commercial Release Package | Create Draft IOF Source, Save Draft, Validate |
| Engineering handoff | Engineering Baseline / Engineering Repository | Submit to Engineering, Open Engineering Certification |
| Engineering intake restore | Engineering Repository | Open Engineering Package |
| Engineering edits | Engineering Revision / Engineering Change Set | Open Station Review, Add Constraint, Move Object, Create Route Redline, Record Doctrine Exception, budget edits |
| Engineering budget | Engineering Revision / Engineering Change Set | Approve Engineering Budget |
| Certification | Certification Ledger | CERTIFY IOF PACKAGE, Restore Certified Package |
| Return loop | Engineering / Commercial boundary | Reject / Request Commercial Revision |

ScopeVersion is not an owner for any audited Commercial or Engineering action. No audited action should create ScopeVersion.

## Duplicate Action Analysis

| Duplicate Set | Current Surfaces | Canonical Action | Authority | Decision |
|---|---|---|---|---|
| New Opportunity | Header, left rail, map action bar, command dialog | Header or left rail primary | Commercial Repository | Keep one primary visible action later; duplicates are harmless but noisy |
| Product selector | Header, Customer Twin drawer, Product Configurator | Product Configurator once an opportunity is being built | Commercial | Consolidate later; avoid hidden competing product context |
| Save Opportunity | Header, proposal preview Generate Preview fallback, service order preview fallback | Header Save | Commercial Repository | Keep header Save; replace preview fallback labels with explicit Generate Preview later |
| Open Opportunity | Header selector, landing selector, recent opportunity buttons | Opportunity Library selector | Commercial Repository | Keep recent buttons as shortcuts, but library selector is canonical |
| Generate Route | Route inspector, map action bar, legacy scout panel | Route inspector/map primary | Commercial Route Repository | Keep one primary route generation action in map-first layout |
| Save Snapshot | Route inspector, map action bar, live commercial session, route review map | Save Revision | Commercial Change Set | Mark duplicate/obsolete; replace with Save Revision after cleanup |
| Customer Review navigation | Left rail, map action bar, proposal progress | Gated lifecycle pipeline | UI View State | Keep until gated pipeline replaces stage buttons |
| Accept / Approve Proposal | Route inspector Accept Proposal, Customer Dashboard Approve, legacy review Accept Proposal | Proposal Dashboard Approve | Proposal Repository | Keep canonical approval in Proposal Dashboard; hide legacy fixture paths |
| Submit to Engineering | Proposal Dashboard, Commercial Review Panel, handoff card, legacy/commented blocks | Proposal Dashboard / Commercial Review | Commercial Release Package -> Engineering Baseline | Keep one canonical action after approval; remove legacy/commented duplicates |
| Open Engineering Certification | Proposal Dashboard, Commercial Review Panel, handoff card | Submitted handoff card | Engineering Repository | Keep one canonical open action after submission |
| Reload Twin / Refresh Twin / Reload Customer Inventory | Warning card, imports rail, vertical rail, false legacy inventory block | Automatic restore with Developer retry | Customer Twin Repository | Move manual retries to Developer Mode |
| Refresh Proposals | Proposal Dashboard | Automatic after proposal save/restore | Proposal Repository | Hide to Developer Mode |
| Engineering Open Package | Package browser row, active package selector, projection-failure browser | Package browser row | Engineering Repository | Keep row as canonical; selector can remain compact switcher |
| Engineering Return to Commercial | Empty package state and projection failure state | Return to Commercial | UI Navigation | Keep; mutually exclusive recovery states |

## Orphan And Obsolete Actions

| Action | Current Implementation | Authority Finding | Decision | Replacement |
|---|---|---|---|---|
| Commercial sales map Review / Compare redline buttons | `ProposedNetworkMapPanel` calls optional `redline.onModeChange`, but map-first Commercial passes no callback | No effective authority in current Commercial map-first path | Remove or wire | Route Edit Session mode controls |
| Commercial sales map Save/Discard/Select Proposal redline buttons | Optional callbacks are absent in current map-first path | No-op/disabled in current path | Remove | Route Edit Session Save/Discard/Compare |
| Activate Corridor Draft | `handleLockScoutCandidate` | Legacy workspace draft mutation | Remove later | Generate Route -> Route Repository -> Commercial Revision |
| Lock Site | `handleLockScoutCandidate` | Legacy workspace draft mutation | Remove later | Generate Route -> Route Repository -> Commercial Revision |
| Save Snapshot | `handleSaveCommercialDraftSnapshot` / `handleSaveLiveProposalSnapshot` | Legacy snapshot authority overlaps Commercial Change Set | Replace | Save Revision |
| Download Diagnostics JSON | Disabled placeholder in diagnostics panel | No implementation and no constitutional owner | Remove | Developer export if needed later |
| Runtime Lifecycle Bridge Refresh Commercial State | Hardcoded false block | Not visible; old runtime sync internals | Remove | Gated lifecycle pipeline diagnostics |
| Stage KMZ/KML/CSV Draft fixture buttons | Hardcoded false legacy review block | Fixture-only customer draft staging | Remove or Developer Mode | Import Route / Customer Evidence upload |
| Legacy assigned work / approval lists | Hardcoded false runtime dashboard | Belongs to Home/OI, not Commercial Planning | Remove | Home / Operational Intelligence |
| Legacy Draft IOF JSON / Engineering queue block | Commented JSX | Duplicates Commercial Review and Engineering Certification | Remove | Commercial Review + Engineering Certification |

## Developer-Only Actions

| Action | Current Surface | Reason | Recommendation |
|---|---|---|---|
| Repository Browser details | Commercial runtime diagnostics | Raw repository JSON browser | Move to Developer Mode |
| Route Persistence Inspector | Commercial runtime diagnostics | Persistence audit/debugging | Move to Developer Mode |
| Show/Hide Runtime Performance | Commercial diagnostics | Performance instrumentation | Move to Developer Mode |
| Copy JSON | Legacy diagnostics panel | Raw JSON clipboard export | Move to Developer Mode |
| Refresh Proposals | Proposal Dashboard | Manual repository reload | Move to Developer Mode or replace with automatic reload |
| Reload/Refresh Twin/Inventory | Commercial rail | Manual repository/projection reload | Move to Developer Mode after automatic restore retry exists |
| Preview Package raw JSON | Commercial Review Panel | Raw Draft IOF JSON exposure | Keep collapsed under developer/details mode |

## Administrator Actions

| Action | Current Surface | Authority | Recommendation |
|---|---|---|---|
| New Account | Customer Twin drawer | Customer Repository | Move to Account Admin mode |
| Edit Account | Customer Twin drawer | Customer Repository | Move to Account Admin mode |
| Save Account | Customer Twin drawer | Customer Repository | Move to Account Admin mode |
| Save Contact | Customer Twin drawer | Customer Repository | Move to Account Admin mode |
| Duplicate Proposal | Commercial Proposal Dashboard | Proposal Repository | Keep only if sales/admin policy allows proposal duplication |
| Archive Proposal | Commercial Proposal Dashboard | Proposal Repository | Keep with clear permission boundary |

## Automatic Runtime Candidates

| Manual Action Today | Desired Automatic Behavior | Authority |
|---|---|---|
| Refresh Proposals | Proposal Repository reloads after save, submit, approve, restore | Proposal Repository |
| Reload Twin / Refresh Twin / Reload Customer Inventory | Customer Twin restore retries and reports warnings automatically | Customer Twin Repository |
| Save Snapshot | Runtime checkpoints automatically; operator uses Save Revision for authority | Commercial Change Set |
| Refresh Commercial State | Lifecycle status derives from repository transitions | Kernel / lifecycle projection |
| Validate Draft IOF | Validation runs automatically before Submit to Engineering, with optional manual Validate retained | Commercial Release Package |
| Refresh Engineering Packages | Engineering queue reloads after handoff and on workspace open | Engineering Repository |
| Refresh Proposal Preview | Proposal preview updates after Proposal Repository save or Commercial Revision replay | Proposal Repository / Commercial Revision Projection |

## Remaining Operator Actions

The remaining operator actions that should survive cleanup are:

| Workspace | Canonical Action | Authority |
|---|---|---|
| Commercial | New Opportunity | Commercial Repository |
| Commercial | Open Opportunity | Commercial Repository |
| Commercial | Save Opportunity / Save As | Commercial Repository |
| Commercial | Select Account / Product | Customer Repository / Commercial |
| Commercial | Import Existing Network | Customer Twin Repository |
| Commercial | Import Route | Temporary Imported Route state |
| Commercial | Save / Replace / Discard Imported Route | Commercial Route Repository |
| Commercial | Resolve A/Z, click A/Z, use Customer Twin references | Commercial route planning |
| Commercial | Generate Route | Commercial Route Repository |
| Commercial | Start Edit | Commercial Revision |
| Commercial | Save / Compare / Restore / Discard Revision | Commercial Change Set |
| Commercial | Estimate, constraint, civil mix, financial, and ILA edits | Commercial Change Set |
| Commercial | Save Proposal | Proposal Repository |
| Commercial | Submit to Customer | Proposal Repository |
| Commercial | Comment / Upload Evidence / Request Changes / Approve | Proposal Repository |
| Commercial | Create Draft IOF Source / Save Draft / Validate | Commercial Release Package / Draft IOF Package |
| Commercial | Submit to Engineering | Engineering Baseline / Engineering Repository |
| Commercial | Open Engineering Certification | Engineering Repository restore |
| Engineering | Open Engineering Package | Engineering Repository |
| Engineering | Open Station Review | Engineering Revision |
| Engineering | Discipline lens / map view / label controls | Engineering Projection View |
| Engineering | Budget edits and confirmations | Engineering Change Set |
| Engineering | Add Constraint | Engineering Change Set |
| Engineering | Move Object | Engineering Change Set |
| Engineering | Create Route Redline | Engineering Change Set |
| Engineering | Record Doctrine Exception | Engineering Change Set |
| Engineering | Approve Engineering Budget | Engineering Revision |
| Engineering | CERTIFY IOF PACKAGE | Certification Ledger |
| Engineering | Restore Certified Package | Certification Ledger / Certified IOF Package projection |
| Engineering | Reject / Request Commercial Revision | Engineering -> Commercial return loop |

## Lifecycle Audit

Every canonical action above maps to one lifecycle stage and one authority. The main violations are not missing authority, but duplicated surfaces and legacy names:

- `Save Snapshot` names an old snapshot model while the constitutional authority is now `Save Revision`.
- `Activate Corridor Draft` and `Lock Site` imply mutable workspace authority instead of Commercial Revision authority.
- Manual refresh/reload actions expose runtime mechanics that should be automatic or developer-only.
- Sales redline toolbar actions are visible without active callbacks in the map-first Commercial path.
- Raw JSON previews and repository browsers are useful for development but are not operator lifecycle actions.

## Cleanup Order Recommendation

1. Move developer-only diagnostics behind a Developer Mode gate.
2. Replace `Save Snapshot` labels and callbacks with the canonical `Save Revision` action where the Change Set path exists.
3. Remove no-op sales redline toolbar actions or wire them to Route Edit Session.
4. Consolidate duplicate `Submit to Engineering` and `Open Engineering Certification` surfaces to one handoff card.
5. Replace proposal progress boxes with the requested gated lifecycle pipeline:

```text
Commercial Planning
-> Customer Review
-> Commercial Approval
-> Draft IOF Package
-> Engineering Certification
-> Service Order
-> Customer Signature
-> ScopeVersion Created
-> Marketplace
-> Control
-> Field
-> Operational Twin
```

6. Move Account create/edit/save actions into Account Admin.
7. Delete hardcoded false and commented legacy UI blocks after their canonical replacements are confirmed.

## Final Finding

Commercial Planning still contains the bulk of duplicate and obsolete action surfaces. Engineering Certification is already close to constitutional shape: its remaining actions largely map to Engineering Repository, Engineering Revision, Engineering Change Set, Budget Confirmation, Certification Ledger, or the Commercial return loop.

No UI action should be removed until the cleanup pass uses this audit as the authority map.
