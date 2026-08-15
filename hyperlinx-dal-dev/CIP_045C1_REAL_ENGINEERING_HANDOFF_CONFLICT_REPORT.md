409 CLASSIFICATION: IMPLEMENTATION_DEFECT

# CIP-045C.1 Real Engineering Handoff Conflict Report

## Outcome

The exact local Draft IOF Package `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2` now reaches the real Engineering intake path without weakening any Engineering, station, doctrine, constitutional, or reference-integrity gate.

- Draft status: `SUBMITTED_TO_ENGINEERING`
- Workflow: `ENGINEERING_INTAKE`
- Engineering Package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Engineering Package reference hash: `474534308a85da4eeab2b0c458a96e34de005c4782c5e87b6373f3ef93b0ee7d`
- Engineering Baseline: `ENG-BASE-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Engineering Baseline hash: `4dc548b4ac024b69b62655fd7376374d88ea2c06f05764b359e8b62ee86b9573`
- Reload/reference reconstruction: PASS, no missing references, every integrity check true
- Reference-only Draft size: 30,922 compact bytes / 35,647 persisted bytes, below the unchanged 4 MiB guard
- Service Order: not created
- ScopeVersion: not created; `BLOCKED_UNTIL_SIGNED_SERVICE_ORDER`

## Exact original 409

The server exception was captured before code modification in the handoff recovery transaction at `2026-08-13T18:31:23.950Z`:

`Station Projection failed: Doctrine Object Manifest validation failed (Required asset ASSET:HANDHOLES was not instantiated., Required asset ASSET:VAULTS was not instantiated., Required asset ASSET:SPLICE-CASES was not instantiated.).`

The failure originated in `requireDoctrineObjectMaterializationForStationProjection` during transaction step 1, `Validate Commercial Package`, before the Engineering package was assembled. This was a valid fail-closed gate reacting to invalid producer output, not a constitutional block.

## Root cause

The Commercial Product Doctrine producer omitted the released Proposal Revision's formal project configuration and physical facility quantities. The resulting doctrine manifest carried zero physical quantities for handholes, vaults, and splice cases even though immutable Proposal Revision `PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1` (hash `bf45a5b291f79acbedddec87487fe37a0db118d92d569a1c3e2a0754a7ab437e`) contained 319 handholes, 19 vaults, and 33 splice cases.

After restoring that input, two related reconstruction defects became visible behind the original failure:

1. Station projection attached physical facility IDs, while station-aware validation addressed the corresponding doctrine-object IDs. Deterministic aliases now associate each doctrine facility object with its already-projected physical object at the same station and coordinate. No placement or evidence is invented.
2. Reference-only handoff hydration exposed `stationIndexedGraph` but not the `stationGraph` contract field, and rebuilding the projected manifest discarded persisted commercial-audit/constitutional validation. Exact persisted values are now retained and reconstructed.

The final persistence boundary also now strips all hydrated repository-backed projection views. An existing-record normalization reduced the submitted Draft from 26,385,677 bytes to 35,647 bytes without changing its authority, artifact revisions, or Engineering result.

## Authority and artifact trace

| Authority/artifact | Resolution | Exact identity |
|---|---|---|
| Governed route | RESOLVED | `ROUTE-REPO-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-COMMERCIAL-DRAFT-IMPORT-ROUTE-HELSWR-REVISED-71526-1`, revision 1, geometry `rg-0d302bb0` |
| Source evidence metadata | RESOLVED | `ATTACHMENT-HELIUM-REV-ROUTE-KMZ-1`, checksum `0e5befb1763577813372446cb4a770acce8c806a52512cd39bc4c937e412af8f` |
| Source KMZ binary | MISSING (not an Engineering required reference) | Recorded location `server/data/opportunities/account-2/temporary-imports/Helium Rev Route.kmz` does not exist locally; no fallback or regeneration was used |
| Proposal Revision | RESOLVED | `PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`, hash `bf45a5b291f79acbedddec87487fe37a0db118d92d569a1c3e2a0754a7ab437e` |
| Commercial Revision | RESOLVED | `COMM-REV-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-V1-PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`, hash `commercial-revision-8a77a0d019f16d94` |
| Commercial Release | RESOLVED | `COMM-REL-COMM-REV-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-V1-PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1-commercial-release-9cae2`, hash `commercial-release-9cae2ac1e9b5c1d1` |
| Engineering Object Manifest | RESOLVED | `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2:DOCTRINE-ENGINEERING-OBJECT-MANIFEST`, revision 1, hash `871e91e237d8483282d8647bbe3603e21b0c4843b7d2ae0160a0897d4cd8a128` |
| Measured centerline | RESOLVED | `...:MEASURED-CENTERLINE:mc-4ddb007ba1c9`, revision 1, hash `c850ccb21fcac7c5036ea9f5b89964702ad723032c97aa3f48d497771efd14a7` |
| Station projection | RESOLVED | `...:DOCTRINE-STATION-PROJECTION:dpe-73dea64e72cf`, revision 1, hash `d8d67fd803678c7e954ec362adba95f87bb19018673ca3f013d6f57341a2195c` |
| Station graph | RESOLVED | `...:STATION-GRAPH:sg-71b7e21bb26d`, revision 1, hash `fa16d4a373209e63a9666b39b600554e4f795f1404c9314bbadb58c91a1a8b57` |
| Station Object Manifest | RESOLVED | `...:STATION-OBJECT-MANIFEST:som-79e03960e713`, revision 1, hash `ca8e3b5643592a6212ec60a0fdd2a80a406f69978e13dc9d2c7752f8bd12e8bf` |
| Projected Object Manifest | RESOLVED | `...:PROJECTED-OBJECT-MANIFEST:pom-070f17b2f43e`, revision 1, hash `81fde2b4ffa402223e6f8fc343fc118607bd66108b74b01c511ffcf9ce4dee7b` |
| Product Doctrine Assembly | RESOLVED | `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER:ASSEMBLY:COMMERCIAL-DRAFT-IMPORT-ROUTE-HelSWR-Revised-71526-1`, revision 1, hash `0ae10b31df50df1fa4cdc8344074710b2c3e0424a26d3aa8cf97e688fb9ae62b` |
| Project Configuration | RESOLVED | `OPP-DEMO-OPPORTUNITY-3SWR-1786645604709:DUCT-DARK-FIBER-CONFIG:R1`, revision 1, hash `a75bf86ec888853f4e4f51cf628f46ab90b4d7604c7e7b481f586c3efc2a21a5` |
| Quantity reconciliation | RESOLVED | `...:COMMERCIAL-AUDIT-RECONCILIATION`, revision 1, hash `a8be0e1af8508bf37f8260c216ec15c9569a77c30092917f2e3dfd8faf8beacb` |

All 11 Draft artifact records existed before the reference-only Draft was persisted, and their revision, SHA-256 payload hash, organization, tenant, customer, and opportunity scopes match exactly. Missing-artifact and altered-hash fixtures both fail closed with `ARTIFACT_INTEGRITY_FAILURE`. A tampered Engineering station graph reference also fails closed.

## Preserved behavior

- Engineering validation and constitutional authority were not weakened.
- The 4 MiB request guard was not raised.
- No repository was cleared or customer data regenerated.
- No persistence technology/schema migration or deployment occurred; only the required backward-compatible normalization of this existing local submitted Draft record was applied.
- DAL1 and `app.teralinx.net` were untouched.
- Reasoning remains outside this deterministic handoff path.
- Geometry, map, Engineering, structural IOF, station projection, and the immutable proposal quantities are preserved.
- Duplicate React revision keys now use the opportunity plus governed revision identity; the `revisions-v1`/`revisions-v3` collision is removed.

## Validation

Primary validator: `node cip045c1-real-engineering-handoff-conflict-validation.mjs` — 35 passed, 0 failed.

The validator covers exact reference resolution, hashes/revisions/scopes, persistence order, strict rehydration, missing and tampered artifacts, Engineering reload integrity, fail-closed behavior, payload size, duplicate keys, and the absence of Service Order/ScopeVersion creation.

Real browser reload validation returned HTTP 200 for the exact Engineering Package, with `referenceIntegrity.ok = true`, no missing references, every check true, reference-only state retained, and ScopeVersion still blocked.

Regression results:

- CIP-045C: 49/49
- CIP-045B: 88/88
- CIP-045A: 58/58
- CIP-045: 84/84
- CIP-044A.2: 30/30; ten-run civil mutation p95 1.757 ms, zero structural/geometry/station/map/Engineering rebuilds
- CIP-041: 30/30
- CIP-035A: PASS
- `npx tsc --noEmit`: PASS
- `npm run build`: PASS (existing chunk-size warning only)
- `git diff --check`: PASS
