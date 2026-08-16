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
