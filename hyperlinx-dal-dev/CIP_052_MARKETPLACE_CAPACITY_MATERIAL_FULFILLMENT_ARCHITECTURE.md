# CIP-052 — Marketplace Capacity, Material Fulfillment & Human Work Allocation

## Status

Pre-implementation governing specification. No runtime, repository, persistence, ScopeVersion, Control, Field, Commercial, Engineering, Product Doctrine, award, or contract behavior is changed by this document.

## Purpose

Transform Marketplace from a whole-package quote surface into a governed fulfillment-planning surface that answers:

> Given the authorized ScopeVersion, which combination of qualified vendor labor, equipment, and material supply can fulfill it within cost, schedule, geography, technical, and constraint requirements?

Vendors state what they can responsibly commit. Teralinx humans determine how authorized work is allocated. A vendor never gains authority to redraw, resize, substitute, or mutate the ScopeVersion.

## Constitutional authority

1. ScopeVersion remains execution truth and the sole source of authorized demand.
2. Bid Packages decompose that demand into measurable procurement structure; they do not create new scope.
3. Vendor Responses are immutable commercial evidence, not execution authority.
4. Capacity and material comparison are deterministic advisory projections.
5. Work Allocation is an explicit human decision that assigns existing ScopeVersion stations, segments, objects, and quantities.
6. An allocation is not an Award, Contract, Purchase Commitment, Control work item, Field authorization, or ScopeVersion mutation.
7. Awards and purchase commitments require their own governed human action and downstream authority.
8. Vendor alternates never satisfy Product Doctrine or Engineering requirements automatically.
9. Marketplace may identify gaps and candidate combinations; humans approve allocations and awards.

## Revised lifecycle

```text
Authorized ScopeVersion
  -> Demand Decomposition
  -> Bid Packages
  -> Vendor / Supplier Invitations
  -> Immutable Capacity and Material Response Versions
  -> Price + Capacity + Availability + Lead-Time Comparison
  -> Human Work / Material Allocation
  -> Human Award or Purchase Commitment
  -> Control
```

The comparison dimensions are:

```text
PRICE + QUANTITY + CAPACITY + AVAILABILITY + LEAD TIME
+ DURATION + GEOGRAPHY + CONSTRAINT CAPABILITY
```

## 8E. Capacity-Based Scope Qualification

### Response modes

A vendor response must not require qualification for an entire Bid Package. The package-level response mode is one of:

- `FULL_SCOPE` — vendor can satisfy the complete package within required dates.
- `PARTIAL_SCOPE` — vendor can perform a defined portion of the governed package.
- `CAPACITY_OFFER` — vendor offers resources or production capacity for Teralinx allocation.
- `NO_BID` — vendor declines the package.

`PARTIAL_SCOPE` and `CAPACITY_OFFER` identify capacity and preferences. They do not authorize the vendor to define a new route or unilaterally select executable ScopeVersion work.

### Required construction capacity evidence

When applicable, a response records:

- resource type and count, such as HDD rigs, plows, trench crews, rock crews, splice crews, and specialty crossing resources;
- production rate and unit, such as feet/day per crew or aggregate feet/day;
- mobilization lead time;
- availability start and end;
- available duration;
- maximum quantity commitment by method;
- geography or segment preference;
- technical and constraint capabilities;
- exclusions and assumptions;
- unit price, mobilization cost, total price, and price-valid-through date;
- evidence/attachment references;
- submitting vendor identity and authorized representative.

### Capacity commitment model

```ts
type VendorResponseMode =
  | "FULL_SCOPE"
  | "PARTIAL_SCOPE"
  | "CAPACITY_OFFER"
  | "NO_BID";

interface CapacityCommitment {
  commitmentId: string;
  capabilityType: string;
  resourceType: string;
  resourceCount: number;
  productionRate: number;
  productionUnit: string;
  mobilizationDays: number;
  availableFrom: string;
  availableThrough: string;
  durationDays: number;
  maximumQuantity?: number;
  maximumQuantityUnit?: string;
  geographicPreferences: string[];
  constraintCapabilities: string[];
  exclusions: string[];
  assumptions: string[];
}
```

### Response version model

Every submission creates a new immutable version. Revisions never overwrite observations.

```ts
interface VendorResponseVersion {
  responseVersionId: string;
  responseSeriesId: string;
  version: number;
  supersedesResponseVersionId?: string;
  scopeVersionId: string;
  scopeVersionHash: string;
  bidPackageIds: string[];
  vendorId: string;
  responseMode: VendorResponseMode;
  capacityCommitments: CapacityCommitment[];
  materialResponses: MaterialLineResponse[];
  priceValidThrough?: string;
  status: "DRAFT" | "SUBMITTED" | "CLARIFICATION_REQUIRED" | "WITHDRAWN";
  submittedBy?: string;
  submittedAt?: string;
  contentHash: string;
}
```

A withdrawn or superseded response remains auditable and cannot be silently deleted from comparison history.

## 8F. Material Supply, Capacity & Lead-Time Response

### Supplier roles

A responding organization may be a contractor, material supplier, distributor, manufacturer, equipment supplier, or combined provider. A supplier responds only for the products, quantities, geographies, and delivery windows it can support.

### Material-line modes

Each governed material requirement can receive one of:

- `FULL`
- `PARTIAL`
- `ALTERNATE`
- `BACKORDERED`
- `NO_BID`

Package-level participation does not imply every material line is accepted.

### Material response fields

```ts
type MaterialResponseMode =
  | "FULL"
  | "PARTIAL"
  | "ALTERNATE"
  | "BACKORDERED"
  | "NO_BID";

interface MaterialLineResponse {
  materialResponseId: string;
  bidPackageItemId: string;
  scopeMaterialObjectId: string;
  responseMode: MaterialResponseMode;
  specifiedProduct: string;
  manufacturer?: string;
  productOrSku?: string;
  specificationCompliance: "COMPLIANT" | "EXCEPTION" | "UNREVIEWED";
  quantityOffered: number;
  unit: string;
  unitPrice?: number;
  inventoryStatus?: string;
  productionCapacity?: number;
  productionCapacityUnit?: string;
  fabricationDays?: number;
  shippingDays?: number;
  leadTimeDays?: number;
  availableFrom?: string;
  deliveryCapacity?: number;
  deliveryCapacityUnit?: string;
  deliveryLocations: string[];
  freightCost?: number;
  minimumOrderQuantity?: number;
  priceValidThrough?: string;
  alternateProduct?: MaterialAlternate;
  exclusions: string[];
  assumptions: string[];
}

interface MaterialAlternate {
  proposedManufacturer?: string;
  proposedProductOrSku: string;
  reason: string;
  specificationDifferences: string[];
  reviewState:
    | "PENDING_TERALINX_REVIEW"
    | "PENDING_ENGINEERING_REVIEW"
    | "PENDING_PRODUCT_DOCTRINE_REVIEW"
    | "ACCEPTED"
    | "REJECTED";
  decisionReferenceId?: string;
}
```

### Alternate authority gate

Marketplace records and routes an alternate; it does not approve technical equivalence. If an alternate changes an engineered or product requirement, acceptance must come from the existing applicable Engineering and/or Product Doctrine human-authority process. Until accepted, the alternate contributes zero authorized fulfillment coverage.

Acceptance does not mutate the existing ScopeVersion implicitly. If the authorized design must change, the existing governed revision/certification/authorization lifecycle applies before Marketplace can allocate the alternate.

## Demand decomposition

Marketplace reads an immutable demand projection from the selected authorized ScopeVersion:

- construction quantities by method;
- objects and object classes;
- station and segment ranges;
- material quantities and specifications;
- required-by dates and completion dates;
- geographic limits;
- engineering conditions and constraints;
- required capabilities;
- route revision and geometry hash;
- certification and ScopeVersion hashes.

Every demand line retains its ScopeVersion object, station, segment, quantity, and specification references. Decomposition may group the demand into Bid Packages but cannot create net-new authorized quantities or geometry.

## Coverage projection

Coverage is calculated against demand, not against package count.

### Construction and equipment

For each capability and schedule window, the projection compares:

- required resource-equivalent capacity;
- offered resource count and production rate;
- mobilization date;
- overlapping available days;
- maximum commitment;
- constraint eligibility;
- geographic compatibility;
- quantity allocable without overlap.

### Materials

For each material demand line, the projection compares:

- accepted compliant quantity;
- delivery cadence;
- inventory/production availability;
- lead and shipping time;
- required-by date;
- delivery geography;
- duplicate allocations;
- accepted versus unaccepted alternates.

### Readiness output

The projection reports, by dimension:

- required quantity/capacity;
- qualified offered quantity/capacity;
- human-allocated quantity/capacity;
- uncovered balance;
- coverage percentage;
- required date and projected fulfillment date;
- `PASS`, `AT_RISK`, `FAIL`, or `UNRESOLVED` schedule state;
- blockers, exclusions, overlaps, and evidence references.

Project readiness must keep independent dimensions visible. A single blended percentage must never conceal a critical zero-coverage material or constraint capability.

## Human Work Allocation

### Purpose

A Work Allocation is Teralinx's explicit assignment proposal mapping vendor capacity to existing ScopeVersion demand.

```ts
interface WorkAllocation {
  allocationId: string;
  scopeVersionId: string;
  scopeVersionHash: string;
  allocationRevision: number;
  vendorId: string;
  vendorResponseVersionIds: string[];
  bidPackageIds: string[];
  stationRanges: Array<{ startStationId: string; endStationId: string }>;
  segmentIds: string[];
  objectIds: string[];
  quantityAllocations: Array<{
    bidPackageItemId: string;
    quantity: number;
    unit: string;
  }>;
  resourceAllocations: Array<{
    capacityCommitmentId: string;
    resourceCount: number;
  }>;
  plannedStart: string;
  requiredComplete: string;
  proposedValue: number;
  status: "DRAFT" | "UNDER_REVIEW" | "APPROVED_FOR_AWARD" | "REJECTED" | "SUPERSEDED";
  decidedBy?: string;
  decidedAt?: string;
  decisionNotes?: string;
  contentHash: string;
}
```

### Allocation invariants

- Allocated stations, segments, objects, and quantities must exist in the bound ScopeVersion/Bid Packages.
- A response's price, capacity, date, geography, capability, and maximum-commitment limits cannot be exceeded silently.
- Duplicate or overlapping allocations must be detected and presented.
- An allocation cannot include an unaccepted material alternate.
- A vendor may be allocated less than it offered.
- Teralinx may combine multiple vendors and suppliers to fulfill one ScopeVersion demand line.
- Allocation changes create a new revision; earlier decisions remain immutable.
- Approval for award is a human action and still does not itself create Control or Field authority.

## Award and purchase commitment boundary

The model distinguishes:

```text
Vendor Response = offered commercial/capacity evidence
Work Allocation = Teralinx responsibility assignment decision
Award = governed intent to engage a vendor for allocated work
Purchase Commitment = governed intent to procure allocated materials
Contract = legal/commercial obligation
Control = execution authorization and management
```

No automatic optimization result may create an Award, Purchase Commitment, Contract, Control record, Field work, or Close Event.

## Marketplace screen hierarchy

### 1. ScopeVersion Demand

- selected authorized ScopeVersion and lifecycle/hash;
- compact project schedule and geography;
- labor/equipment/material/constraint demand decomposition;
- Bid Package coverage and traceability.

### 2. Vendor and Supplier Responses

- invitation/respondent status;
- package response mode;
- capacity commitments;
- material-line responses;
- immutable version history and comparison;
- clarifications, exclusions, evidence, and alternates.

### 3. Fulfillment Readiness

- construction labor coverage;
- equipment coverage by type;
- material coverage by line;
- constraint/specialty coverage;
- schedule and geographic coverage;
- price, lead-time, and risk comparison;
- uncovered demand and conflicts.

### 4. Allocation Workspace

- human selection of vendor/supplier response versions;
- governed ScopeVersion station/segment/object picker;
- quantity and resource assignment;
- overlap, schedule, capability, and material compliance validation;
- allocation revision and explicit decision controls.

### 5. Awards / Purchase Commitments

- allocations approved for downstream award;
- separate construction Award and material Purchase Commitment paths;
- explicit human approval and authority references;
- handoff readiness for Contract and Control without automatic creation.

### 6. Diagnostics / Evidence

- hashes and provenance;
- response history;
- coverage calculation details;
- alternate review references;
- rejected/withdrawn/superseded records;
- allocation conflict diagnostics.

## Intelligence boundary

Marketplace may accumulate governed observations for future advisory analysis across:

- price;
- available quantity;
- labor/equipment capacity;
- availability window;
- mobilization and material lead time;
- duration;
- geography;
- constraint capability;
- manufacturer production capacity;
- freight and delivery performance;
- historical completion/delivery performance.

Future Planner projections may report market capacity risk and comparable history, but may not silently change Commercial pricing, promised schedule, Product Doctrine, Engineering, or ScopeVersion authority.

## Required validation before implementation is accepted

1. A vendor can submit `FULL_SCOPE`, `PARTIAL_SCOPE`, `CAPACITY_OFFER`, or `NO_BID`.
2. A partial response is valuable without covering the entire Bid Package.
3. Capacity offers bind to the exact ScopeVersion and Bid Package versions/hashes.
4. Vendors cannot redraw route geometry or create stations, segments, objects, or quantities.
5. Capacity records resource count, production, mobilization, availability, duration, geography, maxima, constraints, and price.
6. Vendor Response V2 does not overwrite V1.
7. Withdrawn and superseded responses remain auditable.
8. Material lines accept `FULL`, `PARTIAL`, `ALTERNATE`, `BACKORDERED`, or `NO_BID` independently.
9. Partial material quantities contribute only their offered quantity.
10. Multiple suppliers may collectively cover one material demand line without double counting.
11. Lead time, delivery cadence, freight, minimum order, validity, and required-by dates are retained.
12. An unreviewed alternate contributes zero authorized coverage.
13. Marketplace cannot approve Product Doctrine or Engineering equivalence.
14. Coverage is calculated by capacity/quantity and schedule, not package count.
15. Coverage distinguishes offered from human-allocated capacity.
16. Critical uncovered dimensions remain visible even if aggregate coverage is high.
17. Human allocation selects only existing ScopeVersion stations, segments, objects, and quantities.
18. Allocation cannot exceed the selected immutable response version.
19. Overlapping or duplicate allocations are detected.
20. A vendor can be allocated less than offered.
21. Labor, equipment, and materials can be allocated across different providers.
22. Allocation revisions preserve prior decisions.
23. Allocation does not automatically create an Award.
24. Award does not automatically create a Contract, Control work, Field work, or ScopeVersion mutation.
25. All decisions identify the human actor and time.
26. Customer, organization, vendor, and record-level security prevents cross-scope access.
27. Marketplace comparison remains advisory and deterministic for identical evidence.
28. Existing ScopeVersion, Bid Package, Commercial, Engineering, Product Doctrine, certification, and route authority remain unchanged.

## Existing-model reconciliation required during implementation

The current `BudgetVendorResponse` has only one mutable-looking response object with `coveragePercent` and a free-text `capacitySummary`. CIP-052 must introduce explicit immutable response-series/version semantics and structured capacity/material lines while preserving backward-compatible read normalization for existing fixtures.

The existing `BudgetComparison.compareCapacity()` simply returns free-text capacity summaries. It must eventually become a projection over structured commitments, demand, dates, geography, constraint eligibility, and allocations. Its output remains advisory.

The current Marketplace workspace is a preliminary quote staging surface. CIP-052 should reorganize it around authorized ScopeVersion demand and the screen hierarchy above; it must not apply Marketplace quote state back into the ScopeVersion as a substitute for the governed response/allocation lifecycle.

## Implementation stop gate

Do not implement repositories, APIs, persistence, UI, allocation engines, awards, purchase commitments, or Control handoff until this revised model and its authority boundaries are accepted. The first implementation sprint must begin with an audit/migration plan for existing Bid Package and Budget Candidate records and must preserve local persisted data.
