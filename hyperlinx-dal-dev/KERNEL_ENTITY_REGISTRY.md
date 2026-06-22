# DAL Kernel Entity Registry

Scope: `hyperlinx-dal-dev` only.

The DAL kernel owns deterministic truth, work, closure, projection, and persistence rules. Workspaces are lenses. They may request transitions or render projections, but they do not own independent truth models.

## Entity Registry

| Entity | Type/interface file | Primary ID | Parent entity | Authority owner | Immutable fields | Mutable fields | Mutating events | Projection consumers |
|---|---|---|---|---|---|---|---|---|
| ScopeVersion | `src/types/dal.ts` | `scopeVersionId` | Optional `parentScopeVersionId` | ScopeVersion repository and lifecycle guard | ID, source references, certified geometry once certified, certified route reference after approval | `status`, `canonicalTruth.lifecycleState`, `canonicalTruth.lifecycleTimestamp`, closures/progress through closure authority | `scopeversion.created`, `scopeversion.certified`, `scopeversion.quoted`, `scopeversion.approved`, `scopeversion.control.work_created`, `scopeversion.control.activated`, `field.*`, `scopeversion.complete`, `scopeversion.operational` | Map Kernel, Route Engineering, Marketplace, Control, Field, Twin, OI |
| CertifiedRoute | `src/routing/CertifiedRouteAuthority.ts` | `certifiedRouteId` | ScopeVersion by `certifiedRouteReference` | Route Engineering | `geometryHash`, route geometry after certification, candidate and attachment references | Authority state until certified/rejected, engineer notes | Route certification events, ScopeVersion approval evidence | ScopeVersion validation, Map Kernel, Marketplace, Control, Field, Twin |
| ControlWorkItem | `src/types/dal.ts` | `workItemId` | ScopeVersion | Control | ID, scope linkage, work type after creation | `status`, `notes`, timestamps | `control.work.created`, `control.work.activated`, `control.work.held`, `control.work.completed`, `control.work.cancelled` | Control, Field, Twin, OI |
| ClosureRecord | `src/types/dal.ts` | `closureId` | ScopeVersion and ControlWorkItem | Field via ClosureAuthorityEngine | ID, scope ID, work item ID, closure type, prior state evidence | Persistence status and timestamps only | `field.object_state_transition.closed`, `field.station_state_transition.closed`, `field.range_state_transition.closed` | Field, Twin, OI, ScopeVersion progress |
| ScopeInfrastructureObject | `src/types/dal.ts` | `objectId` | ScopeVersion, RouteStation | ScopeVersion creation and ClosureAuthorityEngine | ID, scope ID, station ID, object type/category, coordinates after certification | `objectState`, closure history projection | Field closure events | Field, Twin, OI, Map Kernel |
| RouteStation | `src/types/dal.ts` | `stationId` | ScopeVersion and CertifiedRoute | RouteStationingEngine and ClosureAuthorityEngine | ID, measure, coordinate after stationing/certification | `stationState` | Field station/range closure events | Field, Map Kernel, Twin, OI |
| MarketplaceQuote | `src/types/dal.ts` | `quoteId` | ScopeVersion or OpportunitySeed | Marketplace/quote engine | Quote ID and source linkage | Commercial worksheet/status while preliminary | `marketplace.quote.created`, `marketplace.quote.accepted`, `marketplace.quote.revised`, `scopeversion.quoted` | Marketplace, Control, OI, ScopeVersion commercial basis |
| OperationalEvent | `src/types/dal.ts` | `eventId` | Owning entity by `entityId` | Producing workspace or kernel engine | Event ID, type, entity, timestamp, payload after append | None | Append-only event creation | Lifecycle guard, Twin, OI, audits |
| TwinProjection | `src/types/dal.ts` | `twinStateId` | Selected ScopeVersion | Twin route/projection service | Projection source and selected scope boundary | Ephemeral metrics on refresh | None; read-only projection | Twin |
| OpportunitySeed | `src/types/portfolio.ts` | `id` | CandidateSite and InventoryGraph | Prism | Source candidate and inventory references | Scores, advisory rankings, certification snapshots before ScopeVersion | `prism.opportunity.created`, `prism.scopeversion.seeded` | Prism, Portfolio, Site Decision |
| CandidateSite | `src/types/candidateSite.ts` and `src/types/portfolio.ts` | `candidateId` | Source dataset | Translate/Candidate Sites/Prism | Raw address and source identity | Geocode diagnostics, certification stage, status | `translate.source.ingested`, geocode/certification events | Candidate Sites, Prism, Site Decision |
| InventoryGraph | `src/types/dal.ts` | `inventoryId` | None | DAL server baseline/inventory persistence | Graph ID, imported source identity, persisted graph geometry | Metadata/sync flags | `translate.scopeversion.created`, inventory persistence events | Inventory, Prism, Site Decision, Map Kernel |
| InventoryRoute | `src/types/dal.ts` | `routeId` | InventoryGraph | Inventory persistence | Coordinates, edge IDs, length | Metadata only through new graph version | Inventory import/sync events | Map Kernel, Prism, attachment engines |
| InventoryNode | `src/types/dal.ts` | `nodeId` | InventoryGraph | Inventory persistence | Coordinate and route membership | None after graph certification | Inventory import/sync events | Prism, attachment engines, Map Kernel |
| InventoryEdge | `src/types/dal.ts` | `edgeId` | InventoryGraph | Inventory persistence | Endpoints, coordinates, route ID | None after graph certification | Inventory import/sync events | Prism, attachment engines, Map Kernel |
| InventoryStation | `src/types/dal.ts` | `stationId` | InventoryRoute/InventoryGraph | Inventory persistence | Coordinate, route ID, measure | None after graph certification | Inventory import/sync events | Prism and attachment reference only |
| IOFPackage | `src/types/dal.ts` | `packageId` | ScopeVersion | IOF package repository | Package ID, source ScopeVersion, package type after creation | `status`, `progress`, archive/close fields | `control.work.*`, package close events | Control, Twin lineage, OI |
| CloseEvent | `src/types/dal.ts` | `closeEventId` | IOFPackage and source ScopeVersion | Close event repository | Event ID, source ScopeVersion, package ID, event type, timestamp | `childScopeVersionId` after child creation | IOF package close | Twin lineage, ScopeVersion child creation |
| ScopeVersionExecutionState | `src/types/dal.ts` | `scopeVersionId` | ScopeVersion | Control | ScopeVersion ID | Work-type statuses and `overallExecutionState` | `scopeversion.control.work_created`, `scopeversion.control.activated`, work completion | Control, Field, Twin, OI |

## Frozen Authority Notes

- Certified objects are evidence, not truth. ScopeVersion is the truth container.
- ClosureRecord and CloseEvent are different kernel concepts. ClosureRecord mutates execution state inside a ScopeVersion. CloseEvent closes IOF package work and may create child ScopeVersion truth.
- Existing inventory stations are reference authority. Lateral RouteStations are production authority.
- TwinProjection and OI projections are read-only.
