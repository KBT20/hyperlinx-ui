# CIP-013C Commercial Workbook Map-First Report

Date: 2026-07-06

## Scope

This is a Commercial Planning UI/workbench recomposition only. It does not change constitutional authority, ScopeVersion behavior, Runtime promotion, Engineering Certification authority, pricing engines, routing engines, graph logic, kernel logic, or Service Order authority.

## What Moved Above The Fold

- Commercial header now exposes Customer, Product, Opportunity, Proposal Status, Estimate Status, Commercial Readiness, and Confidence.
- The map remains the primary working surface with the estimate sidebar beside it.
- The estimate sidebar now includes route length, construction cost, cost per mile, revenue, revenue per mile, gross margin, margin percentage, monthly revenue, lifecycle value, confidence, unknowns, and construction mix.
- A compact bottom action bar was added for New Opportunity, Generate Route, Save Snapshot, Customer Review, and Save Proposal.

## What Moved Into Commercial Workbook

- Proposal Summary
- Estimate Detail
- Commercial Economics
- Construction Mix
- Product Doctrine Assumptions
- Human Overrides
- Quantities
- Object Manifest Summary
- Production Forecast
- Commercial Validation
- Risks / Unknowns
- Draft IOF Package Preview
- Service Order Preview
- Runtime / Diagnostics

## Doctrine Assumptions

Doctrine values are displayed beside current commercial values. Commercial users do not edit doctrine. They record commercial overrides against the estimate.

The displayed path is:

Doctrine Value -> Commercial Override -> Engineering Actual later

Engineering Actual remains unavailable in Commercial Planning.

## Human Overrides

Overrides are shown with:

- assumption id
- doctrine value
- override value
- reason
- owner
- timestamp
- source
- confidence

The workbook uses the existing transparent estimate controls and human audit trail so overrides remain part of the commercial estimate record.

## Map Performance

- Heavy workbook sections are gated behind collapsed details.
- Estimate Detail mounts only when its workbook section is opened.
- Commercial Validation mounts only when its workbook section is opened.
- Draft IOF JSON preview mounts only when opened.
- Runtime / Diagnostics is collapsed by default.
- Station-Aware Object Review is not mounted in Commercial Planning.

## Functionality Preserved

- Proposal actions and customer review actions remain available.
- Transparent estimate detail remains available.
- Commercial economics remain available.
- Commercial Review / Draft IOF Package validation remains available.
- Manifest, quantities, production, risks, and diagnostics remain available in workbook form.
- No ScopeVersion is created.

## Remaining Before Printable Proposal / Service Order

- Final legal terms.
- Payment terms.
- Insurance language.
- Warranty language.
- Signature blocks.
- Final printable Service Order rendering.
