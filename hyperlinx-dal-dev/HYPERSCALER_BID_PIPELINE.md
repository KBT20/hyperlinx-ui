# Hyperscaler Bid Pipeline

This document is the canonical Teralinx Bid Engine playbook. Google Helium is the first production precedent, not a hard-coded workflow. The same pipeline must support Google, Microsoft, Meta, AWS, Oracle, CoreWeave, OpenAI, carriers, utilities, and future infrastructure buyers.

## Roadmap Naming

Phase 7.2 is named **Teralinx Bid Engine Foundation**.

Its platform deliverables are:

- Bid Workspace
- Customer Fixture Framework
- Google Fixture v1 as the first production fixture
- Vendor Response Preview
- Submission Readiness
- KMZ Export
- Workbook Export

The platform is **Teralinx Bid Engine**. Customer-specific artifacts may seed fixtures, but no customer-specific planning logic belongs in the core platform.

## Sales Corridor Editing

Phase 7.3C defines **Sales Corridor Editing** as preliminary sales planning, not Route Engineering.

Sales users edit only the active proposal corridor:

- A and Z endpoints remain locked.
- The original OSRM corridor remains immutable gray evidence.
- The proposal corridor is the only editable blue line.
- Dragging the proposal corridor creates temporary revision intent.
- Save Revision creates budgetary proposal evidence.
- Route Engineering later owns control points, avoidance polygons, protected segments, certification, ScopeVersions, and inventory mutation.

## Canonical Flow

Customer Request
→ RFP Intake
→ Customer Sites
→ Network Intent
→ Design Doctrine
→ Centerline Route
→ Corridor
→ Takeoff
→ Civil Mix
→ Construction Quantities
→ Budgetary Quote
→ KMZ Export
→ Vendor Workbook
→ Customer Review
→ Accepted
→ Route Engineering
→ Certified Corridor
→ Inventory Graph
→ Construction
→ Field
→ Operational Intelligence

## Authority Boundary

The bid pipeline produces budgetary evidence. It does not create ScopeVersion authority, execution authority, contractual authority, inventory mutation, or field work.

Route Engineering remains the first authority boundary for certified construction truth.

## Reusable Principle

The customer workbook and commercial rules may change. The workflow must not.
