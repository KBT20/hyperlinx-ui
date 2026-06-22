# DAL Kernel Event Registry

Scope: `hyperlinx-dal-dev` only.

Events are append-only evidence. They may imply lifecycle when reconciled by `ScopeVersionLifecycleGuard`, but the authoritative state remains `ScopeVersion.canonicalTruth.lifecycleState`.

## Canonical Event Contracts

| Event type | Producer | Required payload | Optional payload | Entity mutated | Lifecycle impact | Projection impact | Idempotency key | Replay behavior |
|---|---|---|---|---|---|---|---|---|
| `scopeversion.created` | Inventory, Design/Prism/Translate transformation | `source`, source entity ID | graph summary, source metadata | ScopeVersion | Initializes `ANALYZED`/`DRAFT` depending source | Appears in Twin/OI timeline | `scopeVersionId:eventType` | Create if missing; ignore duplicate event ID |
| `scopeversion.certified` | Certification engine | `scopeVersionId`, certification state | graph/certification evidence | ScopeVersion | Advances to `CERTIFIED` | Certification readiness | `scopeVersionId:certifiedAt` | Preserve highest lifecycle |
| `scopeversion.quoted` | Quote engine/Marketplace | `quoteId`, commercial basis | worksheet, quote explanation | ScopeVersion | Advances to `QUOTED` | Marketplace/OI quoted counts | `scopeVersionId:quoteId` | Merge quote basis; do not regress lifecycle |
| `scopeversion.approved` | Route Engineering | `scopeVersionId`, approver | approval notes | ScopeVersion | Advances to `APPROVED` | Control eligibility, Twin timeline | `scopeVersionId:approvedAt` | Preserve approved or higher lifecycle |
| `scopeversion.control.work_created` | Control | `workItemIds`, execution state | work type summary | ScopeVersion and ControlWorkItem | Advances to `CONTROL` | Control/OI work created | `scopeVersionId:work_created` | Preserve `CONTROL` or higher |
| `scopeversion.control.activated` | Control | `workItemId`, execution state | activation notes | ScopeVersion and ControlWorkItem | Advances to `CONTROL_ACTIVE` | Field eligibility, Twin/OI active work | `scopeVersionId:workItemId:activated` | Preserve `CONTROL_ACTIVE` or higher |
| `scopeversion.field.started` | Field | `workItemId` | first station/object | ScopeVersion | Advances to `FIELD` | Field/Twin active execution | `scopeVersionId:workItemId:field_started` | Preserve `FIELD` or higher |
| `scopeversion.partially_complete` | ClosureAuthorityEngine | closure/progress summary | feet affected | ScopeVersion | Advances to `PARTIALLY_COMPLETE` | Twin/OI progress | `scopeVersionId:progress:partial` | Recompute from closures |
| `scopeversion.complete` | ClosureAuthorityEngine/Control | closure/progress summary | completion evidence | ScopeVersion | Advances to `COMPLETE` | Complete counts | `scopeVersionId:complete` | Preserve complete or higher |
| `scopeversion.operational` | Future operations authority | operational acceptance evidence | service activation data | ScopeVersion | Advances to `OPERATIONAL` | Operational inventory | `scopeVersionId:operational` | Terminal before retirement |
| `scopeversion.retired` | Future governance | retirement reason | successor ScopeVersion ID | ScopeVersion | Advances to `RETIRED` once supported | Historical only | `scopeVersionId:retired` | Terminal |
| `control.work.created` | Control | `workItemId`, `scopeVersionId`, `workType` | package details | ControlWorkItem | None directly unless paired with scope event | Control/OI work queue | `workItemId` | Upsert work item |
| `control.work.activated` | Control | `workItemId`, `scopeVersionId` | activation notes | ControlWorkItem | None directly unless paired with scope event | Field work visible | `workItemId:activatedAt` | Upsert active status |
| `control.work.held` | Control | `workItemId`, reason | blocker ID | ControlWorkItem | No ScopeVersion lifecycle advance | Hold/blocker metrics | `workItemId:heldAt` | Set hold status |
| `control.work.completed` | Control/Field projection | `workItemId` | completion summary | ControlWorkItem | May support `COMPLETE` if all packages complete | Completion metrics | `workItemId:completedAt` | Set complete status |
| `control.work.cancelled` | Control | `workItemId`, reason | replacement ID | ControlWorkItem | No lifecycle advance | Cancelled work metrics | `workItemId:cancelledAt` | Set cancelled status |
| `field.object_state_transition.closed` | Field/ClosureAuthorityEngine | `closureId`, `scopeVersionId`, `workItemId`, `objectIds`, `newObjectState` | evidence IDs, notes, feet affected | ClosureRecord, ScopeVersion objects | Advances to `FIELD`, maybe `PARTIALLY_COMPLETE`/`COMPLETE` | Field/Twin/OI object state counts | `closureId` | Append only; reject duplicate closure ID |
| `field.station_state_transition.closed` | Field/ClosureAuthorityEngine | `closureId`, `scopeVersionId`, `workItemId`, `stationId`, `newStationState` | evidence IDs, notes, feet affected | ClosureRecord, ScopeVersion stations | Advances to `FIELD`, maybe `PARTIALLY_COMPLETE`/`COMPLETE` | Station and feet progress | `closureId` | Append only |
| `field.range_state_transition.closed` | Field/ClosureAuthorityEngine | `closureId`, `stationStartId`, `stationEndId`, target state | evidence IDs, notes | ClosureRecord, ScopeVersion stations/objects | Advances to `FIELD`, maybe completion | Range progress | `closureId` | Append only |
| `field.evidence.attached` | Field | `evidenceId`, `closureId` | media metadata | Closure evidence | No lifecycle impact | Evidence audit | `evidenceId` | Append/reference only |
| `field.blocker.created` | Field/Control | blocker ID, target entity | reason | Object/station/work exception | Exception state only | Blocker metrics | `blockerId` | Append/block |
| `field.blocker.resolved` | Field/Control | blocker ID, resolution | resumed state | Object/station/work exception | Restores prior executable state | Reduced blocker metrics | `blockerId:resolvedAt` | Append/resolve |
| `marketplace.quote.created` | Marketplace | `quoteId`, `scopeVersionId` | worksheet | MarketplaceQuote | Usually paired with `scopeversion.quoted` | Quote list/OI metrics | `quoteId` | Upsert quote |
| `marketplace.quote.accepted` | Marketplace | `quoteId`, accepted by | commercial notes | MarketplaceQuote | Future: approval/commercial state | OI commercial status | `quoteId:acceptedAt` | Preserve accepted quote state |
| `marketplace.quote.revised` | Marketplace | `quoteId`, revision ID | delta | MarketplaceQuote | May emit new `scopeversion.quoted` | Quote history | `quoteId:revisionId` | Append revision |
| `translate.source.ingested` | Translate | source file/dataset ID | parser diagnostics | CandidateSite/InventoryGraph seed | No direct lifecycle impact | Translate audit | source hash | Append ingest audit |
| `translate.objects.extracted` | Translate | extracted object counts | confidence | CandidateSite/InventoryGraph seed | No direct lifecycle impact | Validation queue | source hash:extract | Replace extraction preview until committed |
| `translate.scopeversion.created` | Translate | `scopeVersionId`, source dataset ID | transform summary | ScopeVersion | Initializes ScopeVersion | OI/source lineage | `scopeVersionId` | Create ScopeVersion through repository |
| `translate.validation.failed` | Translate | validation code | diagnostics | Source validation | Blocks source promotion | Validation panel | source hash:validation | Append failure |
| `translate.validation.passed` | Translate | validation code | diagnostics | Source validation | Allows source promotion | Validation panel | source hash:validation | Append pass |
| `prism.opportunity.created` | Prism | opportunity/seed ID | score inputs | OpportunitySeed | No direct lifecycle impact | Prism/OI opportunity counts | opportunity ID | Upsert opportunity seed |
| `prism.scopeversion.seeded` | Prism/Site Decision | seed ID, `scopeVersionId` | site decision basis | ScopeVersion | Initializes `ANALYZED` ScopeVersion | Site Decision, OI | `scopeVersionId:seedId` | Create ScopeVersion |
| `prism.route.scanned` | Prism | candidate/site ID | nearest route/node/station | OpportunitySeed | No direct lifecycle impact | Prism diagnostics | candidate ID:inventory ID | Recompute advisory analysis |
| `prism.constraint.detected` | Prism/constraint engine | constraint type, geometry reference | severity | OpportunitySeed/ScopeVersion evidence | No direct lifecycle impact | Risk/constructability views | candidate ID:constraint hash | Append/update evidence |

## Current Implementation Notes

- Current code also emits `scopeversion.site_decision.created`, `scopeversion.stationing.generated`, `scopeversion.child.created`, `scopeversion.child.created_from_close`, `scopeversion.child_created`, and `scopeversion.child_from_close`. These are accepted implementation events and should be normalized into the canonical registry before external API stabilization.
- Lifecycle inference currently recognizes `scopeversion.quoted`, `scopeversion.approved`, `scopeversion.control.work_created`, `scopeversion.control.activated`, `field.*`, `scopeversion.complete`, `scopeversion.control.work_complete`, and `scopeversion.operational`.
