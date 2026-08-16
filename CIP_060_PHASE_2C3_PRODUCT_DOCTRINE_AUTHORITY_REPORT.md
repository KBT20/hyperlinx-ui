# CIP-060 Phase 2C.3 — Product Doctrine Authority Gate & Clean Demo Lifecycle Restart

Date: 2026-08-16  
Validated code: `2362513a3a0fe5b5416ffffdef92303b8d7be0b6`  
Runtime: DAL1 (`67.213.118.179`), `org-demo`, file-authoritative persistence

## Outcome

The Product Doctrine authority gate, exact Proposal Revision binding, doctrine assembly, deterministic object instantiation, canonical manifest persistence, reference-only Draft IOF persistence, restart reload, and Commercial preflight all passed.

Execution stopped at the first remaining genuine predicate during Engineering Package persistence:

`Engineering Package reference validation failed: closureLedger, iofPackageTwin, executionGraph, lifecycleGraph, commercialAudit, constitutionalState`

The predicate returned HTTP 409 at Engineering transaction step 10 (`Verify Engineering Package`). It was not bypassed or weakened. No Engineering Package was persisted, and no later lifecycle stage was attempted.

## Implemented contract

- The canonical Layer-1 product is projected from the shared Product Doctrine registry into the Demo catalog without copying a production product record into `org-demo`.
- Proposal Revision snapshots persist the exact `productId`, `productDoctrineId`, `productDoctrineVersion`, and `productDoctrineHash`.
- Draft IOF release resolves the selected immutable Proposal Revision. It never resolves `latest` doctrine or infers a revision from `sourceProposalVersion`.
- Missing doctrine authority fails before Draft IOF assembly with HTTP 409 and `PRODUCT_DOCTRINE_AUTHORITY_REQUIRED`.
- Mismatched doctrine identity/version/hash fails closed with `PRODUCT_DOCTRINE_AUTHORITY_MISMATCH`.
- The existing Product Doctrine Assembly and `DoctrineObjectInstantiationEngine` are invoked through the server runtime adapter. No Demo-specific doctrine engine was introduced.
- The canonical Engineering Object Manifest is persisted in `server/data-demo/engineering-object-manifests` and the Draft stores its immutable repository reference.
- A persistence-boundary defect was repaired: Proposal approval enrichment and metadata patches no longer copy hydrated doctrine, manifest, geometry, or object graphs back into the Draft repository record.

## Exact authority and lineage

| Authority | Persisted identity |
|---|---|
| Product | `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER` |
| Product Doctrine | `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER` |
| Doctrine version | `20C.1.0` |
| Doctrine hash | `81c488a6d4bd35183e35eabf1a1c533e53a7c700d38db5d5bf67e8c2b3883bdd` |
| Demo Opportunity B | `OPPORTUNITY-DEMO-E2E-20260816-B` |
| Commercial Route B | `ROUTE-DEMO-E2E-20260816-B` |
| Proposal B | `PROPOSAL-DEMO-E2E-20260816-B` |
| Proposal Revision 1 | `PROPOSAL-DEMO-E2E-20260816-B-revision-1` |
| Proposal Revision 1 hash | `3df1acd29bfd9d8afd9548cb184dbf18eaee4e6568962d4e4398eca4d492628c` |
| Proposal Revision 2 | `PROPOSAL-DEMO-E2E-20260816-B-revision-2` |
| Proposal Revision 2 hash | `4f930650af5ce32a9738576fc90d27bc682bc428cda4d37c39978e95aaa702fa` |
| Draft IOF | `DRAFT-IOF-PROPOSAL-DEMO-E2E-20260816-B` |
| Engineering Object Manifest | `DRAFT-IOF-PROPOSAL-DEMO-E2E-20260816-B:DOCTRINE-ENGINEERING-OBJECT-MANIFEST` |
| Manifest hash | `e54bdf587607e9ed618b91d666aacbcef01233baef60c518a4c66786229ba3c4` |
| Manifest object count | `43` |
| Engineering Baseline created before the gate | `ENG-BASE-DRAFT-IOF-PROPOSAL-DEMO-E2E-20260816-B` |
| Candidate Engineering Package blocked before persistence | `ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-E2E-20260816-B` |

Proposal R1 → R2 cloning retained the same exact doctrine version and hash. Reload after a DAL1 process restart resolved the same R2 and the same canonical manifest reference/hash. An idempotent assembly retry did not create a duplicate canonical manifest.

## Acceptance matrix

| Requirement | Result | Evidence |
|---|---|---|
| Product selection authority | PASS | Canonical approved Layer-1 product resolved from shared registry |
| Exact Doctrine identity | PASS | ID/version/hash above persisted on Opportunity and Proposal Revision |
| Doctrine version binding | PASS | R1 and R2 remain bound to `20C.1.0` after restart |
| Proposal → Doctrine lineage | PASS | Immutable R2 snapshot carries the exact doctrine tuple |
| Release without Doctrine | REJECTED AS REQUIRED | Old A returns 409 `PRODUCT_DOCTRINE_AUTHORITY_REQUIRED` |
| Product Doctrine Assembly | PASS | Existing assembly reports PASS |
| Doctrine Object Instantiation | PASS | Existing engine reports PASS; 43 objects |
| Canonical Manifest persisted | PASS | Canonical Demo repository artifact exists |
| Manifest complete | PASS | Exact product/doctrine lineage and 43 objects validated |
| Draft IOF reference | PASS | Immutable manifest reference present; embedded payload absent |
| Reference-only size envelope | PASS | Persisted Draft B is 42,623 bytes |
| Restart/reload | PASS | DAL1 restarted; exact Proposal/doctrine/manifest lineage reloaded |
| Engineering route restoration | PASS | Commercial handoff preflight and Engineering baseline creation passed |
| Measured centerline/station projection/graph/authority | PASS | Engineering integrity reported no failure for these references |
| Engineering doctrine manifest dereference | PASS | Engineering integrity reported no doctrine-manifest failure |
| Engineering Package created | BLOCKED | Strict 409 for six absent constitutional-state artifacts |
| Old fixture A untouched | PASS | Every file in the pre-deployment A checksum manifest remains exact |
| Production data unchanged | PASS | All 2,415 production files match the pre-deployment checksum manifest |
| Governed PostgreSQL writes | ZERO | Runtime remained `DAL_PERSISTENCE_MODE=file`; Demo repositories cannot route to PostgreSQL |
| Chicago access | ZERO | No Chicago connection or command was made |

## Old fixture A classification

The existing A chain was not modified, regenerated, deleted, or retrofitted with doctrine. Its external classification is:

`DEMO / FAILED_PRE_ENGINEERING_VALIDATION / PRODUCT_DOCTRINE_AUTHORITY_ABSENT`

## Stop boundary

The next work is not a Product Doctrine authority change. Commercial station-aware assembly currently reaches a valid strict Engineering gate without materializing or resolving these required governed projections:

- Closure Ledger
- IOF Package Twin
- Execution Graph
- Lifecycle Graph
- Commercial Audit Reconciliation
- Constitutional State Validation

Those objects belong to the existing constitutional-state/projection authority contract. Phase 2C.3 stopped rather than fabricating IDs, embedding payloads, weakening `resolveEngineeringPackageReferences`, or continuing into Engineering Review, Approval, Certification, Service Order, ScopeVersion, Twin, Marketplace, Control, Field, or Close.

## Verification commands

- `npm run typecheck` — PASS
- `npm run build` — PASS
- `node scripts/cip060-phase2c3-product-doctrine-validation.mjs` — PASS (six negative authority cases)
- `node scripts/cip060-phase2c3-dal1-resume.mjs` — PASS through reference-only retry and Commercial preflight; STOP at the recorded Engineering 409
- DAL1 Demo A checksum manifest — PASS
- DAL1 production checksum manifest — PASS (2,415/2,415)

