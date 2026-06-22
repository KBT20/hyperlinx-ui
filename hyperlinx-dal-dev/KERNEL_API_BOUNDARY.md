# DAL Kernel API Boundary

Scope: `hyperlinx-dal-dev` server APIs.

## Endpoint Registry

| Endpoint | Reads/writes | Entity authority | Allowed caller/workspace | Required fields | Lifecycle side effects | Persistence behavior | Projection impact |
|---|---|---|---|---|---|---|---|
| `GET /api/scopeversions` | Read | ScopeVersion | All workspaces | None | None | Lists normalized ScopeVersions from server storage | Feeds all lenses |
| `GET /api/scopeversions/:id` | Read | ScopeVersion | All workspaces | `scopeVersionId` | None | Loads normalized ScopeVersion | Selected scope truth |
| `POST /api/scopeversions` | Write | ScopeVersion | Route Engineering, Prism, Translate, inventory import | Valid `scopeVersion` | Reconciles lifecycle through server merge guard | Persists server record | Creates/updates available truth |
| `PUT /api/scopeversions/:id` | Write | ScopeVersion | Authorized kernel writers | Valid `scopeVersion` | Reconciles lifecycle; certified immutable records create child truth | Persists server record or child | Updates selected truth |
| `POST /api/scopeversions/:id/closures` | Write | ScopeVersion closure ledger | Field | `closureRecord`, active work item, `CONTROL_ACTIVE` or `FIELD` lifecycle | Applies closure and derives lifecycle/progress | Appends closure to ScopeVersion | Field/Twin/OI progress |
| `GET /api/control/work-items` | Read | ControlWorkItem | Control, Field, Twin, OI | None | None | Lists work item collection | Work queue/projection |
| `POST /api/control/work-items` | Write | ControlWorkItem | Control | `workItemId`, `scopeVersionId`, `status`, title | None by itself; ScopeVersion lifecycle must be advanced by Control save path | Persists work item | Field work eligibility |
| `GET /api/field/closures` | Read | FieldClosure side ledger | Field, Twin, OI | None | None | Lists side ledger | Supplemental projection |
| `POST /api/field/closures` | Write | FieldClosure side ledger | Field | `closureId`, `scopeVersionId`, closure body | No ScopeVersion mutation by this endpoint alone | Persists side ledger | Supplemental projection only |
| `GET /api/twin/state` | Read | TwinProjection | Twin, OI diagnostics | Optional `scopeVersionId` | None | Computes projection from server records | Selected ScopeVersion or portfolio projection |
| `GET /api/marketplace/quotes` | Read | MarketplaceQuote | Marketplace, Control, OI | None | None | Lists quotes | Commercial projection |
| `POST /api/marketplace/quotes` | Write | MarketplaceQuote | Marketplace | `quoteId` and quote body | No lifecycle effect by itself; quote engine must save ScopeVersion `QUOTED` | Persists quote | Marketplace/OI |
| `GET /api/iof-packages` | Read | IOFPackage | Control, Twin, OI | None | None | Lists packages | Package progress |
| `POST /api/iof-packages` | Write | IOFPackage | Control/package workspace | `packageId`, `scopeVersionId`, `packageType` | None on creation | Persists package | Package/work lens |
| `PUT /api/iof-packages/:id` | Write | IOFPackage | Control/package workspace | package body | None; closed packages reject updates | Persists package | Package progress |
| `POST /api/iof-packages/:id/close` | Write | IOFPackage, CloseEvent, child ScopeVersion | Package close authority | package ID | Creates CloseEvent and child ScopeVersion | Persists package, close event, child ScopeVersion | Future Twin lineage |
| `GET /api/close-events` | Read | CloseEvent | Twin, OI, package workspaces | None | None | Lists close events | Lineage projection |
| `POST /api/close-events` | Write | CloseEvent | Package/closure framework | close event body | No direct lifecycle unless paired with package close or child ScopeVersion | Persists close event | Lineage projection |
| `GET /api/inventory-graphs` | Read | InventoryGraph metadata | Inventory, Prism, Site Decision | None | None | Lists metadata only | Inventory selection |
| `GET /api/inventory-graphs/:id` | Read | InventoryGraph | Inventory, Prism, Site Decision | `inventoryId` | None | Loads stored graph | Map/serviceability source |
| `POST /api/inventory-graphs` | Write disabled | InventoryGraph | None in this phase | N/A | None | Returns 501; use baseline graph chunk API | Prevents large upload misuse |
| `GET /api/candidate-sites` | Read | CandidateSite | Translate, Candidate Sites, Prism | None | None | Lists candidates | Candidate selection |
| `POST /api/candidate-sites` | Write | CandidateSite | Translate/Candidate Sites | candidate body | None | Persists candidate | Prism input |
| `GET /api/opportunity-seeds` | Read | OpportunitySeed | Prism, Portfolio, Site Decision | None | None | Lists seeds | Site Decision input |
| `POST /api/opportunity-seeds` | Write | OpportunitySeed | Prism | seed body | None | Persists seed | Portfolio/Site Decision |
| `POST /api/geocode` | Write-like compute | Geocode diagnostics | Candidate Sites/Translate | address/site payload | None | No truth mutation unless caller persists result | Candidate geocode evidence |
| `GET /api/certified-routes` | Read | CertifiedRoute | Route Engineering, Site Decision | None | None | Lists certified routes | Route evidence |
| `POST /api/certified-routes` | Write | CertifiedRoute | Route Engineering | certified route body | None until ScopeVersion reference saved | Persists route evidence | ScopeVersion validation |

## Boundary Rules

- API routes expose repositories; repositories own persistence mechanics.
- ScopeVersion write endpoints must reconcile lifecycle before persistence.
- Work item and closure side ledgers are not substitutes for ScopeVersion truth.
- `/api/field/closures` is supplemental. Authoritative field mutation goes through `/api/scopeversions/:id/closures`.
- `/api/twin/state` must remain read-only.
