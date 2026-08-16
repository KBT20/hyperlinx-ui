# CIP-063 — Commercial-to-Engineering Constitutional Boundary

Date: 2026-08-16

## Governing finding

The six failed Engineering references are outputs of the existing canonical `DoctrineProjectionEngine`. The DAL server's local station-projection adapter produced geometry, stations, objects, and manifests but omitted the canonical state-authority portion of the same projection. Engineering then correctly rejected the incomplete handoff.

The repair restores the missing producer dependency before Commercial handoff. It does not create fallback IDs in Engineering, remove any Engineering or certification checks, query a latest revision, or permit executable authority before ScopeVersion.

## Reference lifecycle map

| Reference | Producer | Semantic purpose | First legitimate state | Consumers and later authority |
|---|---|---|---|---|
| `commercialAuditReconciliation` | Canonical Doctrine Projection Engine | Reconciles Commercial doctrine quantities with projected objects, templates, and sequences | Commercial assembly, before Engineering | Engineering intake and certification require `PASS` |
| `constitutionalStateValidation` | Canonical Doctrine Projection Engine | Proves projected objects/spans are born with lifecycle, domain, audit, and geometry authority | Commercial assembly, before Engineering | Engineering intake and certification require `PASS`; ScopeVersion retains certified status |
| `closureLedger` / `closureLedgerId` | Canonical Doctrine Projection Engine | Establishes the empty governed ledger identity and work-segment census; it does not close work | Commercial assembly, before Engineering | Certification binds it; Field/Close append governed events only after ScopeVersion |
| `iofPackageTwin` / `iofPackageTwinId` | Canonical Doctrine Projection Engine | Establishes the non-executable package projection identity | Commercial assembly, before Engineering | Certification materializes the immutable Certified Twin; ScopeVersion materializes Authorized Twin; Close advances Twin state |
| `executionGraphId` | Canonical Doctrine Projection Engine | Identifies planned execution relationships without authorizing execution | Commercial assembly, before Engineering | Certification binds the graph identity; ScopeVersion is the first execution authority |
| `lifecycleGraphId` | Canonical Doctrine Projection Engine | Identifies planned object/span lifecycle relationships | Commercial assembly, before Engineering | Certification binds the graph identity; transitions remain governed by closure/state authority after ScopeVersion |

## Deferral boundary

Commercial projection may define identities and planning state, but it cannot authorize operations. The existing deferrals remain intact:

- Certified IOF Twin materialization occurs at Engineering certification.
- Service Order remains pre-execution commercial commitment.
- ScopeVersion remains the atomic Order for Execution.
- Marketplace, Control, Field, Close, and operational Twin transitions remain downstream of ScopeVersion.

## Code repair

- The server runtime bundle now exports the existing canonical `projectDoctrineToStationSpine` producer.
- Commercial station projection passes the exact persisted Doctrine Object Manifest, measured spine, station authority, station graph, and route authority into that producer.
- The resulting governed objects, spans, work segments, audit, state validation, closure ledger, Twin identity, and graph identities are persisted through the existing reference-only artifact repositories.
- The Engineering reference-only package and all strict resolution gates remain unchanged.

## Fixture rule

The accepted R3 fixture remains the lifecycle source. Resumption reassembles the Draft IOF through the legitimate current Commercial handoff from the same immutable Proposal Revision 3; it does not reset Demo, clone another Proposal, alter R3, or touch production records.

## DAL1 acceptance result

Result: `PASS_TO_SCOPEVERSION` and `PASS_AFTER_RESTART`

- Proposal Revision: `PROPOSAL-DEMO-CIP062-NORTHSTAR-revision-3`
- Proposal hash: `0b6ad2866098cc520cc1c92d34c5fd089a79735c17a58cef4a0ff5a34b7eaf5f`
- Engineering Package: `ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR`
- Engineering Approval: `ENG-APPROVAL-ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR-d2ee594bd84318a2-c46cedf86a2f`
- Certified IOF: `CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR`
- Service Order: `SO-PROPOSAL-DEMO-CIP062-NORTHSTAR-R001`
- ScopeVersion: `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR`
- Authorized Twin: `DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR:IOF-PACKAGE-TWIN:AUTHORIZED:ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP062-NORTHSTAR:V1`

The exact R3 passed Commercial handoff, Engineering review, Engineering budget approval through an Engineering Change Set, exact Human Approval, certification, Customer View Service Order loading, customer signature, Executive countersignature, atomic ScopeVersion creation, and Authorized Twin materialization.

Negative predicates proved:

- stale Engineering Revision hash: rejected with HTTP 409 `STALE_APPROVAL_ELIGIBILITY`
- wrong Service Order document hash: rejected with HTTP 409
- customer signature without the authenticated signer's exact name: rejected with HTTP 409
- no direct ScopeVersion mutation was invoked

Persistence and isolation:

- Restart reload: PASS
- Customer Portal status after restart: `AUTHORIZED`
- Twin projection after restart: PASS, server source
- Persisted classification: `environment=DEMO`, `organizationId=org-demo`, `productionEligible=false`
- Demo reset: not performed
- Production repository: all 2,461 pre-deployment files remained byte-identical
- Demo repository: grew from 66 to 90 files only through the authorized R3 lifecycle
- Chicago access: none

Validation:

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node scripts/cip063-constitutional-boundary-validation.mjs`: PASS
- `node scripts/cip063-dal1-resume.mjs`: PASS to ScopeVersion
- `node scripts/cip063-restart-verification.mjs`: PASS after restart
