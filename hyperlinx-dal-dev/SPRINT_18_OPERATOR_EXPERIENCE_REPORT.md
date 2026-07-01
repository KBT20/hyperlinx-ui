# Sprint 18 Operator Experience Report

## Result

Sprint 18 pauses feature expansion and makes operator continuity the acceptance test.

The Google opportunity becomes the golden path. A first-time operator should be able to create the same Google Protected Dark Fiber IRU proposal because StellaOS guides the sequence, preserves context, and exposes the next governed action.

## Operator Experience Doctrine

The operator expresses intent. The product defines standards. The Design Engine creates solutions. The Spine becomes governed truth. Every downstream workspace consumes that same truth.

This sprint is not UI polish. It is operational flow.

StellaOS should reduce the number of places an operator must remember platform structure. The platform should surface the correct next action from Runtime state, product policy, and lifecycle authority.

## Feature Freeze

Do not add Layer 2 or Layer 3 capability during this effort.

Do not add new automation, queues, or marketplace execution before the current lifecycle can be operated by a human without losing context.

New work during this phase is limited to:

- Fixing dead actions.
- Making existing actions deterministic.
- Preserving governed context across navigation, refresh, logout, login, and authority transfer.
- Making existing Google lifecycle actions visible in a linear sequence.
- Adding validation that protects the current lifecycle.

## Google Golden Path

The Google opportunity is the acceptance test:

1. Create Google account.
2. Select Protected Dark Fiber IRU.
3. Enter customer inputs by KMZ, KML, address, or latitude/longitude.
4. Generate deterministic design candidates.
5. Select the preferred design.
6. Station the route.
7. Instantiate the Product runtime objects.
8. Commit the design to the Spine.
9. Generate the $29M proposal.
10. Complete customer review and approval.
11. Complete engineering certification.
12. Create the Certified IOF Package.
13. Hand off the same certified truth to Marketplace, Control, Field, and Twin.

## Phase 1 Stabilization Matrix

| Blocking Item | Current Sprint 18 Contract | Validation / Proof |
|---|---|---|
| Resolve Z destination | A/Z text resolution now uses a shared resolver. The Z destination can be resolved by the explicit Resolve Z button or by the Build A/Z Seed action when the operator enters raw text. | `sprint18-operator-experience-validation.mjs` checks that Z uses `opportunityScoutAzDestination`, writes `azDestinationLocation`, and creates the A/Z candidate from the resolved destination. |
| Customer KMZ/KML upload | Customer Design Request accepts `.kmz,.kml` as first-class proposed-build input separate from existing inventory. | Validation checks the Commercial Planning import accept contract. |
| Preserve selected account, opportunity, product, map, and design | Runtime rehydration remains the source of governed resume state. WorkspaceSession stores governed IDs and resume pointers. | Sprint 17 validation proves Account, Opportunity, Product, Proposal, Draft IOF, Certified IOF, ScopeVersion, route, graph, authority, and history rehydrate after login. |
| Preserve state after Engineering approval and return to Commercial | Engineering certification updates the same Runtime WorkspaceSession to Execution authority instead of creating a disconnected workspace state. | Sprint 17 validation proves Engineering certification rehydrates into Commercial with Execution authority and ScopeVersion. |
| Deterministic buttons | Buttons that create governed runtime must either create/update a named object or be disabled until their prerequisites are available. A/Z seed no longer silently returns when raw A/Z text is present. | Sprint 18 validation checks the A/Z seed fallback resolver and existing runtime route order. |
| Runtime rehydration across refresh and authority transfer | Specific runtime handlers must run before the generic runtime foundation route. | Validation checks `handleRuntimeLifecycleBridge`, then `handleRuntimeWorkspaceSession`, then `handleRuntimeFoundation`. |

## Linear Commercial Workflow

Commercial Planning should become a guided sequence:

### Step 1 - Select Account

Choose or create the customer. Runtime activates the customer context and returns governed account, contact, opportunity, and Twin references.

### Step 2 - Select Product

The operator selects the product before entering design detail.

Protected Dark Fiber IRU loads its engineering standards, fulfillment policy, pricing model, runtime template, and required deliverables. The Product becomes the blueprint for the opportunity.

### Step 3 - Enter Customer Intent

The operator records whatever the customer provides:

- Addresses.
- Latitude / longitude.
- KMZ or KML.
- Existing routes.
- SLA, diversity, and latency requirements.
- Existing customer inventory.
- Carrier or marketplace inventory references.

### Step 4 - Design Engine

The Design Engine evaluates customer-provided route, generated route, on-net inventory, off-net inventory, greenfield, and hybrid options within Product policy.

It must present deterministic candidates with explanations. It must not behave like a black box.

### Step 5 - Station the Design

After operator selection, the route becomes stationed engineering geometry:

- Stations.
- Segments.
- ILAs.
- Junctions.
- POPs.
- Crossings.

### Step 6 - Instantiate the Product

The Product template creates the governed runtime objects required by the selected product:

- Fiber.
- Conduit.
- Segments.
- Commercial objects.
- Engineering objects.
- Marketplace objects.
- Control objects.
- Twin objects.

### Step 7 - Commit to the Spine

The Spine becomes the engineering baseline containing:

- Account.
- Opportunity.
- Product.
- Customer Intent.
- Fulfillment Policy.
- Approved Design.
- Stationed Geometry.
- Product Runtime Objects.

Everything downstream references the Spine.

### Step 8 - Generate Proposal

The Proposal is assembled from Spine truth. Operators should not re-enter data already governed by Runtime.

### Step 9 - Customer Review

Customer approval advances the lifecycle. Requested changes loop back to the Design Engine while preserving Runtime History.

### Step 10 - Engineering

Engineering validates and certifies the same governed design, then creates the Certified IOF Package.

### Step 11 - Marketplace / Control / Field / Twin

Marketplace, Control, Field, and Twin consume the certified package. They do not reinterpret commercial intent.

## Design Engine Doctrine

The Design Engine is a strategic differentiator.

It must:

- Accept customer designs.
- Improve customer designs.
- Generate designs from intent alone.
- Compare alternatives.
- Explain every recommendation.
- Operate inside the selected Product fulfillment policy.

## Fulfillment Doctrine

Products define fulfillment policy.

StellaOS should not automatically optimize for existing inventory. Existing inventory, customer inventory, partner inventory, marketplace inventory, and greenfield construction are all fulfillment options only when allowed by the Product.

Examples:

| Product | Fulfillment Policy |
|---|---|
| Hyperscaler Backbone | Greenfield preferred, off-net permitted, hybrid prohibited, shared infrastructure prohibited. |
| Enterprise Lateral | Hybrid preferred, on-net preferred, existing inventory preferred. |
| Protected Dark Fiber IRU | Diversity, physical protection, engineering standards, and deliverable completeness govern selection. |

## UI Doctrine

The map becomes the primary workspace.

The lower pane remains the governed ledger.

Every operator surface should answer:

- Where am I?
- What has been completed?
- What is the next governed action?
- What Runtime object will this action create or update?

No scattered buttons. No hidden workflow.

## Twin Doctrine

Twin becomes the executive and operational lens.

Selecting an opportunity should expose:

- Customer.
- Product.
- Design.
- Proposal.
- Engineering status.
- Runtime state.
- Marketplace status.
- Control status.
- Field status.

The Opportunity becomes navigation.

## Validation

Sprint 18 validation command:

```bash
node sprint18-operator-experience-validation.mjs
```

The validation proves:

1. The operator doctrine and Google golden path are recorded.
2. The Commercial workflow is represented as a linear 11-step sequence.
3. Resolve Z uses the destination input and writes destination state.
4. The one-button A/Z seed path resolves raw Z text before creating the candidate.
5. KMZ/KML customer design input remains first-class.
6. Runtime rehydration route order keeps specific handlers before the foundation route.
7. Runtime rehydration remains validated with authenticated HTTP 200.
8. Protected Dark Fiber IRU remains present as the Google product.

Proof file:

```text
.tmp/sprint18-operator-experience-report.json
```
