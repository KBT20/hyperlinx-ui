# IOF Package Assembly Audit

Sprint: 13.2
Status: Audit and architecture definition
Commit: none created

## Executive Summary

Ryan should not manually build an IOF Package. Ryan submits a governed Commercial Opportunity / Commercial Proposal for Sales Engineering review. The Runtime should then assemble a Draft IOF Package manifest from references to existing Runtime Objects, relationships, evidence, geometry, commercial assumptions, pricing summaries, and proposed IOF Units.

The current StellaOS runtime has most of the source material required for Draft IOF Package assembly:

- Authenticated workspaces for Ryan, Kyle, Fran, and Google.
- Organization-scoped Existing Inventory Runtime Objects.
- Customer Design Request Runtime Objects and evidence.
- Runtime Object, Evidence, Relationship, Validation, and History libraries.
- Commercial Opportunity persistence with owner, workspace, visibility, lifecycle, authority, evidence, and relationship links.
- Proposal draft and accepted proposal persistence.
- Commercial route, A/Z, OSRM, stationing, takeoff, ILA planning, transparent estimate, assumptions, and line item engines.
- Advisory marketplace data structures and pricebook fixtures.

The largest architecture gap is directionality. The current IOF package code is primarily ScopeVersion-first: it generates IOF packages from an existing ScopeVersion and closes IOF packages into child ScopeVersions. Sprint 13.2 requires the opposite first step: Commercial Proposal -> Draft IOF Package -> Sales Engineering Certification -> Certified IOF Package -> ScopeVersion.

Therefore, this audit recommends adding a new Draft IOF Package assembly path. It should not reuse `generateIofPackagesForScopeVersion` as the Ryan handoff mechanism. That function remains useful after certified executable truth exists.

## Current State

Commercial Planning currently produces a mixture of:

- Persisted Runtime Objects.
- Persisted library records.
- Derived runtime-backed customer graph/twin projections.
- UI-only workspace state.
- Planning/candidate objects with explicit `noScopeVersionCreation`.
- Advisory pricing and marketplace fixtures.
- Execution ScopeVersion and IOF utilities that must remain behind Sales Engineering authority.

The user-facing handoff currently exists conceptually as "proposal accepted" and "open/enter Engineering Mode", but there is no runtime route that assembles a governed Draft IOF Package manifest from Ryan's submitted proposal.

## Object Inventory

| objectName | objectType | file/source module | runtime location / persistence | createdBy / ownedBy | authority / visibility / lifecycle | relationships / evidence / history | map layer dependency | persistence and scope |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Participant Workspace | Workspace | `server/routes/auth.js`, `server/routes/runtime-foundation.js` | `/api/auth/login`, `/api/runtime/workspaces/me`, `server/data/runtime-workspaces` | Auth user | User workspace, organization `org-teralinx` | Workspace hierarchy lists runtime libraries | None | Persisted on login; survives logout/restart; user-scoped |
| Existing Inventory Commit | RuntimeTranslationCommit | `src/runtime/RuntimeObjectModel.ts`, `src/components/workspaces/GoogleRfpWorkspace.tsx` | `/api/runtime/commit`, `translation-commits` | Importing authenticated user | Evidence-only connector, organization asset | Creates evidence, inventory, objects, relationships, validation, history | Feeds Customer Twin and inventory layers | Persisted; survives logout/restart; organization-scoped |
| Existing Inventory | RuntimeInventoryRecord | `RuntimeObjectModel.buildRuntimeCommitFromExistingInventoryImport` | `/api/runtime/inventories`, `runtime-inventories` | Customer / importing user | `CUSTOMER_EVIDENCE`, `ORGANIZATION`, `ACTIVE` | `objectIds`, `relationshipIds`, `evidenceIds` | Customer inventory map and Customer Twin | Persisted; organization-scoped; should be reference-only in IOF |
| Existing Inventory Route / Segment / Object | RuntimeObjectRecord | `RuntimeObjectModel.routeRuntimeObject`, `segmentRuntimeObject`, `objectRuntimeObject` | `/api/runtime/objects`, `runtime-objects` | Customer / importing user | `CUSTOMER_EVIDENCE`, `ORGANIZATION`, `ACTIVE`; lane `EXISTING_INVENTORY` | Contained by inventory, snapped-to relationships, evidence links | Inventory, Customer Twin, proposal reference layers | Persisted; organization-scoped; IOF must reference, not copy |
| Runtime Evidence | RuntimeEvidenceRecord | `RuntimeObjectModel.runtimeEvidenceForRecord`, `server/routes/runtime-foundation.js` | `/api/runtime/evidence`, `runtime-evidence` | Evidence source / importing user | Evidence registry authority; validation `PASS/WARNING/FAIL` | Lineage to import, route, object, polygon | None directly | Persisted; organization-scoped; evidence-only |
| Runtime Relationship | RuntimeRelationshipRecord | `RuntimeObjectModel.relationship`, runtime commit | `/api/runtime/relationships`, `runtime-relationships` | Runtime commit | Relationship graph authority | `CONTAINS`, `SNAPPED_TO`, `DERIVED_FROM`, etc. | Relationship graph and twin assembly | Persisted; organization-scoped; reference-only |
| Runtime Validation Report | RuntimeValidationReport | `RuntimeObjectModel.validationStatus`, runtime commit | `/api/runtime/validation`, `runtime-validation` | Runtime commit | Validation evidence | Checks evidence, object creation, lane separation | None | Persisted; evidence/readiness input |
| Runtime History Event | RuntimeHistoryEvent | Runtime commit, opportunity route, proof harness | `/api/runtime/history`, `runtime-history` | Actor in authenticated runtime | Activity / history | Event chain for inventory, design, opportunity, proposal, engineering, ScopeVersion | None | Persisted; organization-scoped; evidence/history input |
| Activity Event | TeralinxActivityEvent | `src/api/teralinxRuntime.ts`, `server/routes/activity.js` | `/api/activity`, `activity` | UI actor | Generic activity | Links opportunity, customer, object | Workspace dashboard | Persisted; currently generic route; useful as history but not authoritative |
| Customer Network Graph | CustomerNetworkGraph | `src/customerInventory/CustomerNetworkInventory.ts` | Derived from `/api/runtime/inventories` and `/api/runtime/objects` | Runtime-derived | Frozen for Commercial Planning | Derived routes, edges, nodes, stations, objects | Customer inventory map, Customer Twin | Not separately persisted; survives restart by re-derivation from runtime |
| Customer Twin State | CustomerTwinState | `src/customerTwin/CustomerTwin.ts` | Derived from CustomerNetworkGraph; Sprint 13 proof can persist twin as Runtime Object | Runtime-derived / Ryan in proof | Current UI label `PRE_KERNEL_CUSTOMER_TWIN`; proof object `ORGANIZATION` | Built from inventory routes/objects/stations | Customer Twin map, attachment/diversity queries | UI twin is derived; organization persistence exists only when committed as Runtime Object |
| Customer Design Import | CustomerDesignImport | `src/translate/CustomerDesignImport.ts`, `src/api/customerDesignLibrary.ts`, `server/routes/customer-design-imports.js` | `/api/customer-design-imports`, `customer-design-imports` | Customer / user uploading | `noScopeVersionCreation`, `noInventoryMutation`, `noCertifiedRouteAuthority` | Runtime evidence/object IDs after commit; lineage/audit events | Customer Design layers | Persisted; organization/customer library record |
| Customer Design Request Runtime Object | RuntimeObjectRecord `DESIGN_REQUEST` | `RuntimeObjectModel.buildRuntimeCommitFromCustomerDesign` | `/api/runtime/objects`, `runtime-objects` | Customer / uploading user | `CUSTOMER_EVIDENCE`, `SHARED`, `DRAFT`; lane `CUSTOMER_DESIGN_REQUEST` | Contains proposed routes/segments; evidence links | Customer design map layer | Persisted when committed; reference-only/evidence-only in IOF |
| Customer Proposed Route / Segment | RuntimeObjectRecord `PROPOSED_ROUTE` / `PROPOSED_SEGMENT` | `RuntimeObjectModel.buildRuntimeCommitFromCustomerDesign` | `/api/runtime/objects` | Customer / uploading user | `CUSTOMER_EVIDENCE`, `SHARED`, `DRAFT` | Contained by design request, evidence links | Customer design / proposal overlay | Persisted when committed; reference-only; may seed geometry |
| Commercial Opportunity | CommercialOpportunityRecord | `src/components/workspaces/GoogleRfpWorkspace.tsx`, `server/routes/commercial-opportunities.js` | `/api/commercial/opportunities`, `commercial-opportunities`; mirrored to `runtime-objects` | Ryan owner by default | `PRIVATE` then `SHARED`, owner/contributor/reviewer/approver authority, `ACTIVE` | Evidence links, relationship links, runtime history | Proposal and workspace dashboard | Persisted; survives logout/restart; user/workspace scoped with explicit sharing |
| Opportunity Runtime Mirror | RuntimeObjectRecord `OPPORTUNITY` | `server/routes/commercial-opportunities.js` | `/api/runtime/objects` | Opportunity owner | `COMMERCIAL_REVIEW`, lifecycle from opportunity | Mirrors evidence/relationships/history | Runtime Object Library | Persisted; one mirror per opportunity; include as root reference |
| Opportunity Scout Candidate / Site Decision | OpportunityScoutCandidate and decisions | `src/commercial/OpportunityScoutEngine.ts`, `GoogleRfpWorkspace.tsx` | UI state until saved inside opportunity/snapshot | Ryan | Commercial planning only | May reference A/Z, customer twin, routes | Map click/selection | Workspace state only unless embedded in saved Opportunity |
| A/Z Resolved Locations | ResolvedLocation | `GoogleRfpWorkspace.tsx`, geocode/routing engines | UI state | Ryan | Commercial planning | Feeds route result and draft | Map click, A/Z controller | Workspace state only unless embedded in opportunity/proposal |
| Commercial OSRM Route Result | CommercialRouteResult | `src/commercial/CommercialOsrmRoutingEngine.ts`, `GoogleRfpWorkspace.tsx` | UI state; embedded in draft/snapshot if saved | Ryan | Commercial planning; no engineering authority | Geometry, route miles, diagnostics | Commercial route layer | Not independently persisted; include via saved proposal/draft reference |
| Commercial Corridor Draft | CommercialCorridorDraft | `src/commercial/CommercialCorridorDraftEngine.ts` | UI/DAL state; persisted if saved in opportunity/proposal/engineering draft | Ryan | Sales estimate; `noScopeVersionCreation`, `noInventoryMutation` | A/Z geometry, route segments, transparent estimate, pricing | Proposal overlay, Transparent Estimate Explorer | Partly persisted through snapshots/opportunity; requires refactor into runtime object/manifest source |
| Transparent Corridor Estimate | TransparentCorridorEstimate | `src/commercial/TransparentEstimatingEngine.ts`, `TransparentEstimateExplorer.tsx` | Embedded in CommercialCorridorDraft/snapshots | Ryan / estimator controls | Advisory commercial pricing, assumption authority | Line items, audit trail, unknown quantities, ILA plan | Transparent Estimate Explorer | Persisted only if containing draft/snapshot is saved |
| Budget Assumption State | BudgetAssumptionState | `src/commercial/BudgetAssumptionState.ts`, `GoogleRfpWorkspace.tsx` | UI state; selected ID saved in snapshot/accepted proposal | Ryan | Commercial assumption | Civil mix, bore/slack/waste/splicing assumptions | Transparent estimate controls | Workspace state unless referenced by saved proposal |
| ProposedGraph | ProposedGraph | `src/proposedGraph/ProposedGraph.ts`, `ProposedGraphEngine.ts` | In-memory Google RFP bid plan/proposal graph | Runtime/design synthesis | Sales estimate; `noScopeVersionCreation`, `noPersistence` | Nodes, edges, route candidate, stationed corridor, takeoff | Proposal/route review | Not persisted by itself; include only through proposal snapshot or future runtime object |
| StationedCorridor | StationedCorridor | `src/corridor/StationedCorridor.ts`, corridor generation | In-memory graph/proposal object | Design synthesis | `READY_FOR_PROPOSAL` or `READY_FOR_ENGINEERING`; no engineering cert | Stations, segments, inventory objects, takeoff | Route review and maps | Not persisted by itself; critical source for proposed unitization |
| CorridorTakeoff | CorridorTakeoff | `src/corridor/CorridorTakeoff.ts` | In-memory graph/proposal object | Design synthesis | Estimate-only | Route feet/miles, duct/fiber feet, handholes, vaults, regen, crossings | Transparent Estimate Explorer | Not persisted by itself; high-value source for proposed units |
| Preliminary Quote Package | PreliminaryQuotePackage | `src/proposal/ProposalGenerationEngine.ts` | In-memory Google RFP bid plan; embedded in proposal views | Commercial synthesis | Preliminary, non-contractual, engineering validation required | Line items, assumptions, blockers, diagnostics | Proposal summary | Not independently persisted; proposed IOF pricing input |
| Proposal Snapshot | LiveProposalSnapshot | `GoogleRfpWorkspace.tsx` | `/api/proposals`, `proposal-drafts` | Ryan | Immutable commercial record; no execution authority | Route geometry, construction strategy, pricing summary | Proposal history | Persisted; survives logout/restart; include in package history/evidence |
| Accepted Proposal | AcceptedProposal | `GoogleRfpWorkspace.tsx` | `/api/proposals`, `proposal-drafts` | Customer acceptance, Engineering owner label | `noScopeVersionCreation`, `noServiceOrderCreation` | Accepted geometry, commercial summary, snapshots, comments, selected networks | Handoff view | Persisted; primary Ryan handoff source |
| Customer Draft Record | CustomerDraftRecord | `GoogleRfpWorkspace.tsx` | UI state; copied into accepted proposal if accepted | Customer | Commercial review input only; no inventory mutation | Customer comments/routes | Customer review state | Workspace state unless proposal accepted |
| Engineering Draft | EngineeringDraft | `src/engineering/RouteEngineeringDraft.ts`, `server/routes/engineering-drafts.js` | `/api/engineering/drafts`, `engineering-drafts` | Kyle / engineering authority | Engineering review/write | References commercial draft/opportunity/proposal | Route Engineering workspace | Persisted; Sales Engineering review target, but not cert package yet |
| Certified Route | CertifiedRoute | `server/routes/certified-routes.js`, routing authority modules | `/api/certified-routes`, `certified-routes` | Engineering | Engineer-defined route can be certified if evidence is current | Can unlock IOF/Control/Field authority | Route engineering map | Persisted; future Certified IOF dependency |
| Current IOF Package | IOFPackage | `src/api/iofPackageRepository.ts`, `server/routes/iof-packages.js`, `src/types/dal.ts` | `/api/iof-packages`, `iof-packages` | ScopeVersion authority | `ENGINEERING/PERMITTING/CONSTRUCTION/TESTING`, `DRAFT/APPROVED/ACTIVE/COMPLETE/CLOSED` | Currently points to ScopeVersion route/stations/objects | IOF package renderer | Persisted; current model is execution package, not Ryan draft assembly |
| ScopeVersion | ScopeVersion | `src/api/scopeVersionRepository.ts`, `server/routes/scopeversions.js` | `/api/scopeversions`, `scopeversions` | ScopeVersion authority / engineering | Execution truth, certifiable, immutable when certified | Canonical truth, IOF package IDs, events | MapKernel ScopeVersion renderer | Persisted; must only be created from Certified IOF Package |
| Marketplace Quote | MarketplaceQuote / generic quote | `server/routes/marketplace-quotes.js`, `src/types/dal.ts` | `/api/marketplace/quotes`, `marketplace-quotes` | Marketplace / vendor future | Not currently authority-gated; advisory | Opportunity, ScopeVersion, inventory, graph references | Marketplace workspace | Persisted if used; not currently tied to Ryan proposal assembly |
| Marketplace Pricebook / Vendor Pricebook | MarketplacePriceBook, VendorPriceBook | `src/marketplace/*`, fixtures | Static fixtures/source code | Vendor/marketplace fixture | Advisory only | Unit price recommendations | Marketplace UI | Not runtime-persisted as customer opportunity evidence today |
| Bid Package / Budget Candidate | BidPackage, BudgetCandidate | `src/marketplace/*`, fixtures | Static fixtures/source code | Marketplace fixture | ScopeVersion-based marketplace planning | Vendor responses, bid package items | Marketplace workspace | Current model assumes ScopeVersion; future consumer of Certified IOF Units only |
| Commercial Map Layer State | NetworkLayerState and selections | `GoogleRfpWorkspace.tsx`, `CommercialMapLayerManager.ts` | UI state | Ryan | Workspace-only | Selects existing/proposed networks | Map layers, highlighting, selection | Not persisted except through saved Opportunity/Proposal fields |

## Package Eligibility Matrix

| Object / source | Classification | Why | Sales Engineering | Marketplace later | Control later | Field later |
| --- | --- | --- | --- | --- | --- | --- |
| Commercial Opportunity | INCLUDE_IN_DRAFT_IOF_PACKAGE | Root commercial intent, owner, authority, selected scope, relationships, evidence | Yes | Summary only after certification | No direct | No direct |
| Accepted Proposal | INCLUDE_IN_DRAFT_IOF_PACKAGE | Ryan/customer-approved commercial interpretation and terms | Yes | Pricing baseline after certification | No direct | No direct |
| Proposal Snapshots | REFERENCE_ONLY | History of commercial revisions; useful audit trail | Yes | No | No | No |
| Existing Inventory Runtime Inventory | REFERENCE_ONLY | Authoritative customer inventory must not be duplicated | Yes | Context only | Context only | Context only |
| Existing Inventory Runtime Objects | REFERENCE_ONLY | Source-of-truth objects remain in Runtime Object Library | Yes | Only certified derived units later | Only certified planned work later | Only certified work later |
| Customer Design Request | REFERENCE_ONLY | Customer intent/design evidence, not authority | Yes | No obligations | No | No |
| Customer Design Request Evidence | EVIDENCE_ONLY | Uploaded file proves intent but is not authority by itself | Yes | No | No | No |
| Customer Twin | REFERENCE_ONLY | Organization context and attachment/diversity intelligence | Yes | Context only | Context only | Context only |
| CustomerNetworkGraph | WORKSPACE_STATE_ONLY | Derived view over runtime inventory; can be regenerated | Yes as summary | No | No | No |
| CommercialCorridorDraft | INCLUDE_IN_DRAFT_IOF_PACKAGE | Contains geometry, route segments, commercial assumptions, transparent estimate | Yes | Advisory pricing only | No | No |
| TransparentCorridorEstimate | INCLUDE_IN_DRAFT_IOF_PACKAGE | Best current source of proposed quantities, price, confidence, risks | Yes | Advisory input only | No | No |
| BudgetAssumptionState | INCLUDE_IN_DRAFT_IOF_PACKAGE | Explains Ryan's civil/pricing choices | Yes | No | No | No |
| A/Z resolved locations | INCLUDE_IN_DRAFT_IOF_PACKAGE | Defines route intent and endpoints | Yes | No | No | Field only after certification |
| OSRM route result | INCLUDE_IN_DRAFT_IOF_PACKAGE | Current commercial route geometry; not certified | Yes | No | No | No |
| ProposedGraph | REQUIRES_REFACTOR | Excellent source of graph units but currently `noPersistence` | Yes | After certification | After certification | After certification |
| StationedCorridor | REQUIRES_REFACTOR | Excellent source of station/unit schedule but not independently persisted | Yes | After certification | After certification | After certification |
| CorridorTakeoff | INCLUDE_IN_DRAFT_IOF_PACKAGE | Deterministic proposed quantity source if saved with proposal | Yes | Recommended unit inputs | Later certified quantities | Later certified work |
| PreliminaryQuotePackage | INCLUDE_IN_DRAFT_IOF_PACKAGE | Commercial quote values and assumptions | Yes | Advisory comparison | No | No |
| Commercial Item Catalog / Unit Cost Library | REFERENCE_ONLY | Development pricing basis, not obligation | Yes | Advisory seed | No | No |
| Marketplace Quote History | EVIDENCE_ONLY | Current route exists but no reliable Google opportunity records yet | Yes if present | Yes advisory | No | No |
| Vendor / Material Pricebooks | EVIDENCE_ONLY | Fixture/advisory data, not acceptance | Yes advisory | Yes after certification | No | No |
| Engineering Draft | REFERENCE_ONLY | Review product after handoff, not Ryan-submitted source unless already created | Yes | No | No | No |
| Certified Route | DO_NOT_INCLUDE in Draft; REFERENCE_ONLY after review | Not available before Sales Engineering certification | Produced by Sales Engineering | Unlocks later | Unlocks later | Unlocks later |
| Current IOF Package | REQUIRES_REFACTOR | Existing model is ScopeVersion-first execution package | Yes as boundary warning | After certification | Yes after certification | Yes after certification |
| ScopeVersion | DO_NOT_INCLUDE | Draft package cannot create or depend on execution truth | No until Certified IOF | Yes after creation | Yes | Yes |
| UI-only map selections | WORKSPACE_STATE_ONLY | Useful for ergonomics, not sufficient for governed package | No unless saved | No | No | No |
| Runtime History | EVIDENCE_ONLY | Audit chain for submission and assembly | Yes | No | No | No |

## Proposed IOF Unit Source Matrix

| Candidate unit source | Current availability | Quantity method | Unit type / UOM | Confidence | Missing data | Deterministic today | Sales Engineering verify | Marketplace price later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Route segments | CommercialCorridorDraft routeSegments; ProposedGraph edges | Segment length and geometry | `CIVIL_SEGMENT`, foot/mile | Medium | Certified alignment | Yes if draft persisted | Yes | Yes |
| Stationing | CustomerNetworkGraph stations; StationedCorridor stations; Transparent estimate station count | Station interval and geometry | `STATION`, each/foot | Medium | Certified station baseline | Yes for planning | Yes | No direct |
| ILA facilities | TransparentEstimate.ilaFacilities; ILA Planning Engine | Span/regen spacing and facility profiles | `ILA_FACILITY`, each | Medium | Site validation, power, lease, permitting | Yes for proposal | Yes | Yes |
| Handholes | CorridorTakeoff.handholeCount; TransparentPhysicalQuantities | Route spacing/profile | `HANDHOLE`, each | Medium | Exact placement | Yes | Yes | Yes |
| Vaults | CorridorTakeoff.vaultCount; TransparentPhysicalQuantities | Route spacing/profile | `VAULT`, each | Medium | Exact placement | Yes | Yes | Yes |
| Fiber footage | CorridorTakeoff.fiberFeet; Transparent purchasedFiberFeet | Route feet + slack/waste | `FIBER`, foot | Medium | Final fiber count, slack plan | Yes | Yes | Yes |
| Conduit footage | CorridorTakeoff.ductFeet; Transparent conduitFeet | Route feet x duct package | `CONDUIT`, foot | Medium | Duct count/config by segment | Yes | Yes | Yes |
| Bore footage | CommercialFoundation derived hddFeet; transparent civil mix | Crossing and civil mix allocation | `DIRECTIONAL_BORE`, foot | Low/Medium | Soil/rock/geotech | Yes as assumption | Yes | Yes |
| Aerial footage | Not generated as primary current path | None | `AERIAL`, foot | Low | Aerial inventory, pole make-ready | No | Yes | Yes |
| Open trench footage | CommercialFoundation derived openTrenchFeet; transparent civil mix | Route feet allocation | `OPEN_TRENCH`, foot | Low/Medium | Surface/restoration class | Yes as assumption | Yes | Yes |
| Plow footage | CommercialFoundation derived plowFeet | Route feet minus other allocations | `PLOW`, foot | Low/Medium | Soil/ROW constraints | Yes as assumption | Yes | Yes |
| Splice points / splice cases | CorridorTakeoff.splicePointCount; Transparent spliceCaseCount | Reel/splice proxy | `SPLICE`, each | Medium | Fiber design and splice matrix | Yes as assumption | Yes | Yes |
| POP objects | Existing inventory Runtime Objects / Customer Twin | Referenced endpoint/object | `POP_REFERENCE`, each | High as reference | Engineering endpoint validation | Reference deterministic | Yes | No direct |
| Cabinet / data center objects | Runtime Objects if imported | Referenced object | `FACILITY_REFERENCE`, each | Medium/High | Facility access and exact handoff | Reference deterministic | Yes | Possibly |
| Material assumptions | Commercial Item Catalog, Unit Cost Library, Transparent materials | Line item mapping | Material unit by type | Low/Medium | Vendor-specific BOM | Yes as advisory | Yes | Yes |
| Labor assumptions | Transparent labor lines, CommercialFoundation labor items | Production controls and quantity mapping | Labor unit | Low | Crew plan and contractor | Yes as advisory | Yes | Yes |
| Construction method | BudgetAssumptionState civil mix, route segment method | Percent/segment allocation | Method unit | Low/Medium | Engineering means/methods | Yes as assumption | Yes | Yes |
| Geology / rock / soil | Transparent unknown constraints / controls | Unknown or manual override | Risk / allowance | Low | Geotech data | No unless user override | Yes | Yes as risk |
| Crossings | CorridorTakeoff crossing counts; transparent unknown quantities | Count from route constraints | Crossing each | Low/Medium | Permit authority and method | Yes as count/proxy | Yes | Yes |
| Permits | CommercialFoundation permit allowance | Crossing count + 1 | Permit each/allowance | Low | Jurisdiction and fees | Partial | Yes | Yes |
| Make-ready | Not explicit except aerial future | None | Make-ready each/allowance | Low | Pole/aerial data | No | Yes | Yes |
| Traffic control | CommercialFoundation roadCrossing + vault + handhole proxy | Proxy count | Traffic control each | Low | Traffic plan | Partial | Yes | Yes |
| Testing | CorridorTakeoff splicePointCount proxy | Splice/test proxy | Test each | Low/Medium | Test sections and acceptance criteria | Partial | Yes | Yes |
| Engineering labor | Route miles and permit allowances | Mileage/crossing allowances | Engineering mile/each | Medium | Final engineering scope | Yes advisory | Yes | Yes |
| Project management | Direct cost percentage | Percent allowance | PM allowance | Low | Delivery model | Yes advisory | Yes | Yes |
| Maintenance / SLA | Transparent lifecycle MRC and optional recurring opportunities | Route miles x monthly cost | MRC/mile/month | Low | SLA terms | Advisory only | Review | Future product |

## Proposed IOF Unit Model

First version:

```ts
type ProposedIofUnit = {
  iofUnitId: string;
  unitType: string;
  discipline: "ENGINEERING" | "CIVIL" | "MATERIAL" | "LABOR" | "FACILITY" | "PERMIT" | "TESTING" | "PROJECT_MANAGEMENT" | "LIFECYCLE";
  trade: string;
  description: string;
  quantity: number;
  unitOfMeasure: "FOOT" | "MILE" | "EACH" | "ALLOWANCE" | "PERCENT" | "MONTH" | "HOUR" | "DAY";
  locationReference?: {
    routeId?: string;
    segmentId?: string;
    stationId?: string;
    stationStartId?: string;
    stationEndId?: string;
    milepostStart?: number;
    milepostEnd?: number;
  };
  geometryReference?: {
    runtimeObjectId?: string;
    routeId?: string;
    geometryHash?: string;
    geometrySource: "RUNTIME_OBJECT" | "COMMERCIAL_DRAFT" | "CUSTOMER_DESIGN_REQUEST" | "OSRM_ROUTE" | "STATIONED_CORRIDOR";
  };
  sourceRuntimeObjectIds: string[];
  sourceRelationshipIds: string[];
  sourceEvidenceIds: string[];
  commercialAssumptionIds: string[];
  engineeringAssumptionIds: string[];
  marketplaceHistoryIds: string[];
  proposedUnitPrice?: number;
  marketplaceRecommendedPrice?: number;
  historicalAveragePrice?: number;
  priceConfidence: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  quantityConfidence: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  scheduleConfidence: "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "BLOCKING";
  status: "PROPOSED";
  createdBy: string;
  createdAt: string;
  owner: string;
  workspaceId: string;
  organizationId: string;
  lifecycleState: "DRAFT";
  requiresSalesEngineeringReview: true;
  reviewNotes: string[];
  dependencies: string[];
  downstreamConsumers: Array<"SALES_ENGINEERING" | "MARKETPLACE_AFTER_CERTIFICATION" | "CONTROL_AFTER_SCOPEVERSION" | "FIELD_AFTER_CONTROL">;
};
```

Rules:

- Proposed IOF Units are not Runtime Object copies.
- Proposed IOF Units may carry derived quantities, but every derivation must point back to Runtime Objects, relationships, evidence, and assumptions.
- Proposed IOF Units cannot be consumed as obligations by Marketplace, SOF, SOW, Control, or Field.
- Sales Engineering converts `PROPOSED` units into certified units inside a Certified IOF Package.

## Draft IOF Package Model

First version:

```ts
type DraftIofPackage = {
  iofPackageId: string;
  packageType: "DRAFT";
  customerId: string;
  opportunityId: string;
  proposalId: string;
  commercialOwnerId: string;
  salesEngineeringReviewerIds: string[];
  organizationId: string;
  workspaceId: string;
  status: "DRAFT" | "SUBMITTED_FOR_SALES_ENGINEERING" | "RETURNED_TO_COMMERCIAL" | "READY_FOR_CERTIFICATION";
  lifecycleState: "ASSEMBLED" | "SUBMITTED" | "IN_REVIEW" | "RETURNED" | "SUPERSEDED";
  sourceRuntimeObjectIds: string[];
  sourceInventoryIds: string[];
  sourceDesignRequestIds: string[];
  customerTwinId?: string;
  commercialAssumptionIds: string[];
  proposalTermIds: string[];
  dealPointIds: string[];
  geometryObjectIds: string[];
  relationshipIds: string[];
  evidenceIds: string[];
  historyIds: string[];
  proposedIofUnitIds: string[];
  proposedIofUnits: ProposedIofUnit[];
  riskIds: string[];
  pricingSummary: {
    proposedNrc?: number;
    proposedMrc?: number;
    proposedTcv?: number;
    proposedUnitTotal?: number;
    currency: "USD";
  };
  marginSummary: {
    grossMarginPercent?: number;
    grossMarginDollars?: number;
    costBasis?: string;
  };
  marketplaceIntelligenceSummary: {
    advisoryOnly: true;
    recommendedTotal?: number;
    historicalAverageTotal?: number;
    pricebookIds: string[];
    quoteIds: string[];
    gaps: string[];
  };
  engineeringReadinessSummary: {
    readyForSalesEngineeringReview: boolean;
    deterministicUnitCount: number;
    reviewRequiredUnitCount: number;
    missingGeometry: boolean;
    missingEvidence: boolean;
    missingPricing: boolean;
  };
  missingInformation: string[];
  blockingIssues: string[];
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  submittedBy?: string;
  version: number;
};
```

The package manifest should be persisted separately from the current `IOFPackage` execution package model or introduced as a backward-compatible extension with `packageType = "DRAFT"` and `certificationState = "UNCERTIFIED"`. The safer path is a new `DraftIofPackage` type and route first, then unify rendering later.

## Assembly Flow

When Ryan clicks `Submit for Sales Engineering`, Runtime should:

1. Validate authenticated user.
2. Validate user has commercial authority over the Opportunity.
3. Load Commercial Opportunity from `/api/commercial/opportunities/:id`.
4. Load accepted Proposal Draft / latest submitted Proposal from `/api/proposals`.
5. Load customer/account context.
6. Load Existing Inventory references from the opportunity/proposal relationship links and `/api/runtime/inventories`.
7. Load Customer Design Request references from `/api/customer-design-imports` and `/api/runtime/objects`.
8. Load Customer Twin reference or rebuild Customer Twin projection from Runtime Inventory.
9. Load route geometry from accepted proposal, commercial draft, customer design route, or OSRM route result embedded in the proposal.
10. Load A/Z endpoint references.
11. Load stationing from StationedCorridor, CustomerNetworkGraph, or accepted proposal geometry.
12. Load ILA/facility assumptions from Transparent Estimate / ILA Planning.
13. Load commercial pricing assumptions from BudgetAssumptionState and PreliminaryQuotePackage.
14. Load proposal/deal points from accepted proposal and proposal terms.
15. Load related Runtime Objects, relationships, evidence, validation reports, and history.
16. Load Marketplace Intelligence if available, marked advisory only.
17. Generate Proposed IOF Units from persisted source records.
18. Generate Draft IOF Package manifest with references and readiness summary.
19. Persist Draft IOF Package.
20. Write Runtime History event `runtime.iof_package.draft_assembled`.
21. Notify Sales Engineering reviewers.
22. Return package readiness summary to Ryan.

Assembly must fail or return `blockingIssues` if:

- No authenticated commercial owner exists.
- Opportunity is not readable/writable by the submitting user.
- No proposal is accepted/submitted for review.
- Route geometry cannot be resolved.
- Source objects lack ownership/organization/workspace.
- Package assembly would duplicate Runtime Objects instead of referencing them.

## Sales Engineering Handoff Requirements

When Sales Engineering opens a Draft IOF Package, the review surface should show:

- Package Summary: status, owner, submitted by, customer, opportunity, proposal, version, confidence.
- Commercial Summary: NRC/MRC/TCV, margin, assumptions, deal points, proposal terms.
- Geometry Summary: A/Z, route geometry source, geometry hash, route miles/feet, OSRM status, stationing status.
- Existing Inventory Summary: referenced inventories, routes, POPs, attachment/diversity constraints.
- Customer Design Summary: design request IDs, customer route/object references, import evidence.
- Proposed IOF Unit Schedule: units grouped by discipline/trade, quantities, confidence, dependencies.
- Pricing Recommendation vs Commercial Proposal: proposed commercial price, advisory marketplace price, variance, confidence.
- Risk Summary: unknown quantities, crossings, permits, geology, make-ready, schedule, evidence gaps.
- Missing Information: blocking and non-blocking missing fields.
- Evidence Chain: source evidence, proposal evidence, approval evidence, engineering evidence later.
- Relationship Graph: source Runtime Object IDs and relationships.
- Authority / Ownership: commercial owner, package owner, reviewer IDs, visibility, authority.
- Review Actions: visible placeholders for approve, modify, split, merge, reject, clarify, note, certify, return, generate Certified IOF Package, generate ScopeVersion.

Do not implement review mutations until the Draft Package manifest exists and is persisted.

## Marketplace Intelligence Readiness

Current marketplace state:

- `/api/marketplace/quotes` exists as a generic JSON collection but is not yet authenticated like other authority routes.
- `MarketplacePriceBook`, `VendorPriceBookRegistry`, `BudgetCandidate`, `BidPackage`, and vendor fixtures exist.
- Commercial Planning uses `UnitCostLibrary` and Transparent Estimating as development/advisory pricing.
- There is no runtime-backed Google-specific vendor quote history in the Draft IOF assembly path.
- Bid package and budget candidate models are ScopeVersion-oriented and should not consume proposed units as obligations.

Fields needed to advise Ryan during proposal creation:

- Unit type, unit of measure, proposed quantity, proposed commercial unit price.
- Advisory marketplace unit price, historical average, source pricebook, effective date.
- Price confidence, quantity confidence, risk level.
- Region/market coverage.
- Notes explaining whether the price is development, fixture, vendor historical, or accepted quote.

Fields needed later for vendor acceptance:

- Certified IOF Unit ID.
- Certified quantity and UOM.
- ScopeVersion ID.
- Bid package ID.
- Vendor ID, quote ID, response line item ID.
- Accepted unit price, total price, schedule, assumptions, risks.
- Acceptance authority and timestamp.

Gaps:

- No runtime marketplace price history relationship to Opportunity/Proposal.
- No proposed unit to marketplace recommendation adapter.
- No separation yet between advisory marketplace intelligence and accepted vendor obligation.
- Marketplace quote route should be authority-gated before production.

## ScopeVersion Boundary Report

Constitutional rule:

- Commercial cannot create execution ScopeVersion.
- Customer cannot create execution ScopeVersion.
- Draft IOF Package cannot create execution ScopeVersion.
- Only Certified IOF Package can create execution ScopeVersion.

Current usages:

| Code path | Classification | Finding |
| --- | --- | --- |
| `src/api/scopeVersionRepository.createScopeVersion` / `updateScopeVersion` | Execution ScopeVersion | Correct endpoint family, but must remain behind `scopeversion.authority`. Current server enforces this. |
| `server/routes/scopeversions.js` POST/PUT/certify/delete | Execution ScopeVersion | Correct authority boundary after Sprint 13 hardening. |
| `src/api/scopeVersionRepository.createScopeVersionFromInventoryGraph` / inventory upsert | Working Scope / Planning Artifact or legacy execution path | Needs reconciliation. Inventory graph conversion can be useful, but should not be callable by Commercial/Customer as execution truth. |
| `CustomerDesignImport.scopeVersionId` | Legacy Name | Customer Design Request carries a candidate ScopeVersion reference. Rename/reclassify as `candidateDesignVersionId` or `designRequestVersionId` in a future sprint. |
| `RuntimeObjectModel.designRequestFields.scopeVersionId` | Legacy Name / Working Scope | Current validation says customer design request carries candidate ScopeVersion reference. Must not create execution ScopeVersion. |
| `CommercialCorridorDraft.noScopeVersionCreation` | Working Scope / Planning Artifact | Correct boundary. Drafts do not create ScopeVersion. |
| `ProposedGraph.noScopeVersionCreation` and `noPersistence` | Working Scope / Planning Artifact | Correct boundary, but proposed graph must become referenceable through saved Proposal/Draft IOF assembly. |
| `PreliminaryQuotePackage.engineeringValidationRequired` | Working Scope / Planning Artifact | Correct boundary. Quote does not authorize execution. |
| `iofPackageRepository.generateIofPackagesForScopeVersion` | Execution IOF from ScopeVersion | Valid after ScopeVersion exists, not valid for Ryan handoff. Requires separate Draft IOF assembly path. |
| `iofPackageRepository.closeIofPackage` / `createChildScopeVersionFromCloseEvent` | Execution close/as-built path | Valid for Field/close lifecycle, not Draft IOF package creation. |
| Sprint 13 `operational-proof-validation.mjs` ScopeVersion creation | Proof harness | Proved authority and lineage, but it manually assembled the chain. It is not product assembly logic. |

Boundary conclusion:

The current runtime successfully blocks non-authoritative ScopeVersion writes via route permission checks, but terminology and legacy candidate fields can confuse the product architecture. The next implementation sprint should introduce `DraftIofPackage` and `ProposedIofUnit` without touching execution ScopeVersion creation.

## Google $29M Readiness Assessment

Based on Sprint 13 proof and current Commercial Planning code:

| Area | Readiness | Notes |
| --- | --- | --- |
| Participant workspaces | Ready | Ryan, Kyle, Fran, and Google authenticated workspaces exist. |
| Existing Inventory | Ready for reference | Runtime inventories and objects are persisted and organization-scoped. |
| Customer Design Request | Ready for reference/evidence | Design imports persist and can create customer design request Runtime Objects. |
| Customer Twin | Partially ready | UI twin derives from runtime inventory; proof persisted twin as Runtime Object. Product should standardize organization-persisted twin reference. |
| Commercial Opportunity | Ready | Opportunity owner/authority/history/runtime mirror exist. |
| Proposal Draft / Accepted Proposal | Ready | Proposal snapshots and accepted proposal persist to `/api/proposals`. |
| Route geometry | Partially ready | Available in accepted proposal, CommercialCorridorDraft, StationedCorridor, ProposedGraph, OSRM result; needs deterministic resolver in assembly service. |
| A/Z | Partially ready | Available in UI state/drafts; must be persisted in accepted proposal/opportunity for full assembly. |
| Stationing | Partially ready | Available from CustomerNetworkGraph and StationedCorridor; not always persisted independently. |
| Proposed unit sources | Partially ready | Takeoff, transparent estimate, line items, ILA plan exist; no Proposed IOF Unit model or persisted unitization. |
| Pricing | Ready as advisory | Transparent Estimate and Unit Cost Library exist; marketplace-specific pricing is not runtime-wired. |
| Evidence | Ready | Evidence registry exists and proof has inventory/design/commercial/approval/engineering evidence. |
| Relationships | Ready | Relationship graph exists; package assembly needs graph traversal helper. |
| History | Ready | Runtime history and activity exist. |
| Sales Engineering readiness | Partial | Engineering drafts and certified routes exist, but Draft IOF review/certification workflow is not built. |
| Marketplace readiness | Low/Partial | Advisory models/fixtures exist; no Draft IOF advisory adapter. |
| ScopeVersion readiness | Ready after certification only | ScopeVersion route is authority-gated. Certified IOF -> ScopeVersion path is not implemented as product flow yet. |

## Recommended Implementation Plan

Recommended next sprint: Sprint 13.3 - Draft IOF Package Assembly Runtime.

1. Add `DraftIofPackage` and `ProposedIofUnit` types.
2. Add persisted Draft IOF Package library route, for example `/api/iof-packages/draft` or `/api/draft-iof-packages`.
3. Add `assembleDraftIofPackage(opportunityId, proposalId)` runtime service.
4. Implement source graph resolver:
   - Opportunity.
   - Proposal / accepted proposal.
   - Customer inventory.
   - Customer design requests.
   - Customer twin.
   - Runtime objects.
   - Relationships.
   - Evidence.
   - History.
5. Implement deterministic proposed unitization from:
   - CorridorTakeoff.
   - TransparentCorridorEstimate.
   - PreliminaryQuotePackage line items.
   - CommercialQuantityMapping.
   - Existing inventory and customer design references.
6. Add Ryan UI action `Submit for Sales Engineering`.
7. Add Sales Engineering read-only Draft IOF Package view.
8. Add runtime history and notification events.
9. Add validation harness:
   - Ryan submits Google opportunity.
   - Runtime assembles Draft IOF Package.
   - Google/customer cannot mutate it.
   - Kyle/Sales Engineering can read it.
   - No ScopeVersion is created.
   - No Runtime Objects are duplicated.
10. Only after this, implement Sales Engineering certify/return actions.

## Risks

- Current IOF model name may mislead developers into using ScopeVersion-first packages for Ryan handoff.
- `CustomerDesignImport.scopeVersionId` is a legacy/candidate naming risk.
- ProposedGraph and StationedCorridor have excellent unit source data but are not persisted independently.
- AcceptedProposal currently stores rich data, but schema is loose and should be normalized before package assembly.
- Marketplace quote route is generic and not yet authority-gated.
- Activity history and runtime history are separate collections; assembly should prefer runtime history for authority.
- Customer Twin persistence is not fully standardized in the product UI path.
- Unit prices are development/advisory values; the UI must label them clearly.
- Draft IOF Package must avoid copying Runtime Objects, even when embedding proposed units.

## Open Questions

- Should `DraftIofPackage` be a separate library or an extension of `IOFPackage` with `packageType = "DRAFT"`?
- Who is the default Sales Engineering reviewer: Kyle, a queue, or an organization role?
- Should Customer Approval be required before Ryan can submit for Sales Engineering, or can Ryan submit a pre-approval review package?
- What proposal record is authoritative if multiple snapshots and accepted proposals exist?
- Should `CustomerTwinState` become a persisted organization Runtime Object on every inventory commit?
- What is the first canonical geometry resolver priority when Opportunity, Proposal, Customer Design, OSRM, and ProposedGraph all carry geometry?
- Which marketplace pricebook fields are trustworthy enough for advisory comparison in the first implementation?
- Should proposed IOF units be stored inside the Draft IOF Package manifest or as separate Runtime Library records referenced by ID?
- What is the exact certification object: Certified IOF Package, Certified Route, Engineering Draft, or a combined Sales Engineering Certification record?

## Final Audit Finding

Ryan submits the Commercial Proposal / Opportunity, not an IOF package.

The Runtime should assemble a Draft IOF Package manifest from:

- Commercial Opportunity.
- Accepted Proposal or submitted Proposal Draft.
- Existing Inventory Runtime Object references.
- Customer Design Request references.
- Customer Twin reference.
- Route geometry and A/Z references.
- Stationing and takeoff data.
- Commercial assumptions and transparent estimate line items.
- Proposal terms and deal points.
- Runtime relationships.
- Runtime evidence.
- Runtime history.
- Optional advisory marketplace intelligence.

Sales Engineering then reviews the Draft IOF Package, resolves missing information, modifies or certifies proposed units, and creates a Certified IOF Package. Only the Certified IOF Package may generate the first execution ScopeVersion.
