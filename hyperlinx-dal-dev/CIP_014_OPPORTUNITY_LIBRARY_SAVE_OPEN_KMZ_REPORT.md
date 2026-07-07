# CIP-014 Commercial Repository, Opportunity Library, Unified Import Authority Report

Date: 2026-07-06

## Repository Layer

CIP-014 now routes commercial persistence through `src/repositories/commercialRepositories.ts`.

Implemented repository interfaces:

- CustomerRepository
- CustomerTwinRepository
- OpportunityRepository
- ProposalRepository
- RevisionRepository
- TemplateRepository
- ImportRepository

Commercial Planning consumes those repository APIs for customer, Customer Twin, opportunity, proposal, revision, template, and import persistence. Direct file parsing and runtime inventory commit construction moved out of the workspace and into the repository layer.

## Opportunity Library

Each customer can own multiple opportunities. New, Open, Save, and Save As are preserved in the Commercial Planning header. Opening an opportunity restores saved commercial state from the opportunity repository, including:

- map and route geometry
- imported route snapshot
- estimate
- commercial workbook metadata
- proposal preview metadata
- Service Order preview metadata
- doctrine assumptions and overrides
- quantities, pricing, source files, attachments, and revision history

Save preserves the active opportunity ID. Save As creates a new opportunity ID so one opportunity cannot silently overwrite another.

## Unified Import Authority

The workspace now exposes only two import actions:

- Import Existing Network
- Import Route

Import Existing Network is customer-level. It supports KMZ, KML, GeoJSON, and Runtime Inventory JSON, and commits Customer Twin existing-inventory data only.

Import Route is opportunity-level. It supports KMZ, KML, GeoJSON, JSON GeoJSON, and CSV, and creates or updates commercial route evidence for pricing, estimate, proposal preview, and Service Order preview work.

The previous route-import option to add a file to Existing Customer Inventory was removed from the opportunity import flow. That authority now belongs only to Import Existing Network.

## Header Recomposition

The Commercial Planning header now centers the CIP-014 business fields:

- Customer
- Opportunity Name
- Opportunity ID
- Product
- Commercial Status
- Owner
- Created
- Modified
- Estimate Status
- Proposal Status

Header actions now focus on the commercial repository path: New Opportunity, Open Opportunity, Save, Save As, Import Existing Network, Import Route, Preview Proposal, and Service Order Preview.

## Proposal And Service Order Preview

Proposal Preview remains collapsed by default and is backed by ProposalRepository records. Service Order Preview remains a collapsible commercial workbook section and is stored as opportunity repository preview metadata, with legal/business terms left as Commercial Release 2 placeholders.

## Boundaries Preserved

No ScopeVersion creation was introduced. Engineering, Marketplace, Control, Field, Twin, Operational Intelligence, graph logic, route logic, pricing engines, doctrine engines, and runtime execution behavior were not changed by this repository decomposition.

## Validation Results

Run:

```bash
node hyperlinx-dal-dev/cip014-opportunity-library-save-open-kmz-validation.mjs
npx tsc --noEmit -p hyperlinx-dal-dev/tsconfig.json
npm run build
```

The validation script confirms the repository layer, multiple opportunities per customer, Save/Open/Save As, exact restore payload, two-import UI, preview persistence, absence of workspace file I/O, and absence of ScopeVersion creation.
