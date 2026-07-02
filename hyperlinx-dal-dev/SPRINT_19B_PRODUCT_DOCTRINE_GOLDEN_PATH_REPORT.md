# Sprint 19B Product Doctrine Golden Path

Status: Implemented for local validation

Goal: prove the first deterministic Layer 1 product flow from Account/Product/A-Z/OSRM into a Commercial Proposal and Draft IOF Package JSON suitable for Engineering handoff.

## Product Doctrine Created

Product: `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER`

Doctrine: `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER`

Version: `19B.1.0`

Rules:

- `networkClass: LONG_HAUL`
- `topology: LINEAR`
- `layer: 1`
- `opticalTransport: false`
- `comparisonAllowed: false`
- `reuseRecommendationAllowed: false`
- `scopeVersionCreationAllowedFromCommercial: false`
- `engineeringCertificationRequired: true`

Implementation:

- `src/products/ProductDoctrineContracts.ts`
- `src/products/pointToPointLongHaulDoctrine.ts`

The doctrine compiler accepts A/Z sites and an OSRM centerline, then deterministically assembles a spine, stations, route segments, conduit objects, fiber objects, structures, crossings, quantities, pricing inputs, validation summary, and Engineering manifest.

## Golden Path Flow

Implemented flow:

1. Select Account / Customer.
2. Select Product: Point-to-Point Long Haul Conduit & Fiber.
3. Product loads Product Doctrine.
4. Enter A location.
5. Enter Z location.
6. Resolve A/Z to coordinates.
7. Generate OSRM route.
8. Convert OSRM route into centerline.
9. Product Doctrine assembles Layer 1 linear long-haul product artifacts.
10. Generate Commercial Proposal.
11. Generate Draft IOF Package JSON.
12. Display Draft IOF Package in Commercial.
13. Send exact Draft IOF Package to Engineering.

The Commercial workspace now defaults to the Sprint 19B product and displays doctrine ID, doctrine version, doctrine validation, quantity summary, pricing summary, object count, station count, and the complete Draft IOF Package JSON before handoff.

## Package Fields Assembled

The Draft IOF Package includes:

- package metadata
- account/customer
- selected product
- product doctrine version
- A/Z sites
- OSRM route
- centerline
- spine
- stations
- route segments
- objects
- conduit assembly
- fiber assembly
- structure assembly
- crossing assembly
- quantity summary
- pricing summary
- validation summary
- engineering manifest
- `noScopeVersionCreation: true`

The IOF Package Assembly Engine now accepts `productDoctrine` and `productDoctrineAssembly` inputs and carries those fields into the package as first-class JSON.

## Validation Results

Required commands:

```bash
npx tsc --noEmit
node sprint19b-product-doctrine-golden-path-validation.mjs
npm run build
```

Validation script:

- `sprint19b-product-doctrine-golden-path-validation.mjs`

The validation checks the exact doctrine rules, product registration, package field propagation, Commercial workspace display, Engineering handoff state, and a deterministic Google-style point-to-point sample model with non-empty stations, objects, quantities, and pricing.

Local results:

- `npx tsc --noEmit`: PASS
- `node sprint19b-product-doctrine-golden-path-validation.mjs`: PASS, 51 checks
- `npm run build`: PASS

Validation sample:

- route miles: 309.32
- stations: 310
- objects: 1,084
- conduit feet: 6,532,800
- fiber feet: 1,714,860
- budget cost: 68,594,400
- sell price IRU: 92,602,440
- engineering handoff state: `READY_FOR_ENGINEERING_REVIEW`

## Known Gaps

- The route still depends on the existing Commercial OSRM routing path being available at runtime.
- The doctrine assembly is pre-certified and commercial-authoritative only.
- The Draft IOF Package is ready for Engineering review, not execution.
- No Marketplace, Control, Field, optical transport, reuse comparison, or ScopeVersion creation is included in Sprint 19B.

## Next Step

The next step is Engineering certification and ScopeVersion creation from the exact Draft IOF Package after Engineering reviews and certifies the proposed IOF units. Commercial remains blocked from creating ScopeVersion authority.
