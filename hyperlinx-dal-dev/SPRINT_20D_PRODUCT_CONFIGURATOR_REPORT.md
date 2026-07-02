# SPRINT_20D_PRODUCT_CONFIGURATOR_REPORT

## Executive Summary

Sprint 20D establishes Product Invocation Authority in Commercial Planning.

Commercial now begins with a customer and a supported product selection. For Phase 1, the only supported product is:

- Point-to-Point Duct & Dark Fiber

Selecting and building this product invokes:

```text
PointToPointConfigurator
        |
        v
PD-001 Product Doctrine
        |
        v
Engineering Object Doctrine
        |
        v
Measured Spine
        |
        v
Station Authority
        |
        v
Engineering Objects
        |
        v
Commercial Design
        |
        v
Draft IOF Package
        |
        v
Commercial Review
```

Commercial still does not create ScopeVersion.

## Product Authority Implemented

Added:

- `src/products/PointToPointConfigurator.ts`

The configurator is the authority entry point for the supported product. It validates the selected product, resolves A/Z, consumes route geometry when present, invokes PD-001, assembles the Draft IOF Package, and records the product invocation trail.

Authority constants:

- `POINT_TO_POINT_CONFIGURATOR_ID`
- `POINT_TO_POINT_CONFIGURATOR_VERSION`
- `POINT_TO_POINT_PRODUCT_NAME`

The configurator rejects unsupported products.

## Commercial Workspace Changes

Updated:

- `src/components/workspaces/GoogleRfpWorkspace.tsx`

Commercial Planning now exposes a product-first workflow:

- Step 1 Customer
- Step 2 Product
- Step 3 A/Z
- Step 4 Build Commercial Design

The `BUILD COMMERCIAL DESIGN` action invokes `executePointToPointConfigurator()` and loads the resulting Draft IOF Package into Commercial Review.

The Phase 1 product list is intentionally limited to Point-to-Point Duct & Dark Fiber. Unsupported products are not presented as selectable commercial authority.

## Context Inspector

After build, Commercial displays the Product Configurator Context Inspector:

- Customer
- Opportunity
- Product
- Doctrine
- Configurator
- Route Length
- Measured Spine
- Station Count
- Engineering Objects
- Quantities
- Commercial Status
- Draft Package Status

This confirms the customer/product invocation produced a governed Draft IOF Package, not a manually assembled engineering artifact.

## Draft IOF Package Persistence

The Product Configurator stamps the Draft IOF Package with:

- `productConfigurator`
- `productConfiguratorVersion`
- `configuratorVersion`
- `configuratorLifecycle`
- `productInvocationAuthority`
- `engineeringObjectDoctrine`
- `engineeringObjects`
- `commercialDesign`
- `commercialReviewState`

Existing Sprint 20B and 20C artifacts continue to persist:

- `measuredSpine`
- `stationAuthority`
- `stationIndex`
- `stationToCoordinateMap`
- `objectStationAttachments`
- `stationIndexedGraph`
- Commercial review history fields

Updated runtime typings:

- `src/api/teralinxRuntime.ts`

## Commercial Review Handoff

The resulting package is loaded into the existing Commercial Review and station-aware review surfaces.

Commercial can review and revise station-attached object placement under Sprint 20C rules, then submit the edited Draft IOF Package to Engineering Certification.

Engineering remains the certification authority.

## Authority Boundary

Sprint 20D does not create:

- ScopeVersion
- Service Order Form
- Control workspace state
- Marketplace state
- Field state
- Operational Twin state

Commercial Product Invocation Authority ends at the Draft IOF Package and Commercial Review handoff.

## Validation Results

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint20d-product-configurator-validation.mjs`: PASS, 41 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

## Validation Coverage

The Sprint 20D validation confirms:

- Customer selected
- Correct product selected
- Correct configurator invoked
- PD-001 loaded
- A/Z resolved
- Route generated
- Measured spine generated
- Station authority generated
- Station index persisted
- Station-to-coordinate map persisted
- Object station attachments persisted
- Station-indexed graph generated
- Engineering objects generated
- Quantities generated
- Draft IOF Package created
- Commercial Review loaded
- ScopeVersion not created

## Constitutional Result

Commercial Planning now invokes product doctrine through a Product Configurator.

The selected product determines the configurator.

The configurator invokes PD-001.

PD-001 produces engineering objects and quantity authority.

Sprint 20B produces measured spine and station authority.

Sprint 20C enables station-aware Commercial Review.

Sprint 20D ties those stages together into a product-first Commercial Design path that produces the Draft IOF Package for Engineering Certification.

ScopeVersion remains out of scope.
