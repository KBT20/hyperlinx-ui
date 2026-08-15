# ROOT CAUSE OF 112,989,222-BYTE DRAFT IOF

The client function `draftIofPackageRecordForRepository` labeled its output `referenceOnly` but copied the full `engineeringObjectManifest` / `doctrineObjectManifest`, station projections and graphs, projected manifests, measured centerline, closure/twin graphs, and their top-level aliases into that output. The same instantiated objects were therefore serialized in the Engineering manifest and again through projection aliases. The unchanged 4 MiB guard correctly blocked the 112,989,222-byte request before it reached persistence. This is a serialization-boundary defect, not a server capacity defect.

The observed failed payload was never durably persisted. The browser/runtime evidence retained the exact total (112,989,222 bytes) and grouped Object Manifest size (56,303,042 bytes), but not the discarded byte stream. Exact per-field sizes for the other 24 failed fields therefore cannot honestly be recovered. The repaired runtime emits a top-25 field audit for every assembled payload so a future run retains that evidence before extraction.

## Before audit and duplication findings

| Field/group | Serialized bytes | Package share | Authority | Independently persisted before repair | Duplicate finding | Disposition |
|---|---:|---:|---|---|---|---|
| Entire failed Draft IOF | 112,989,222 | 100% | Manifest | No | Container included governed projections | Normalize to references |
| Object Manifest group | 56,303,042 | 49.83% | Object instantiation | Directory declared, not materialized | Manifest plus object/index/sequence/span aliases | Persist one canonical Engineering Object Manifest and reference it |
| Station projection / graph | Exact failed bytes unavailable | — | Station authority | Directories declared, not materialized | Stations appeared through projection, graph, indexed graph, and measured spine | Persist canonical projection/graph/centerline artifacts |
| Route geometry | Exact failed bytes unavailable | — | Commercial Route | Yes | Centerline/geometry/route aliases repeated governed route coordinates | Retain route repository ID, revision, geometry ID/hash only |
| Customer Twin / inventory | Exact failed bytes unavailable | — | Customer Twin | Runtime repositories exist | Whole-customer context was eligible to leak into a project package | Retain customer/twin reference only |
| Estimate / proposal | Exact failed bytes unavailable | — | Immutable estimate/proposal revisions | Proposal yes; estimate referenced by ID | Snapshots and audit history were eligible for repetition | Retain exact revision IDs/hashes |
| Source evidence | Exact failed bytes unavailable | — | Customer Design Import | Yes | Source content did not belong in package | Retain evidence IDs/file hashes/type/provenance |

The 56 MB Object Manifest group was caused by nested copies of the same object population: the Engineering manifest already contains validation, quantity placement, station object index, sequenced action objects, derived spans, and attachments, while the Draft IOF copied those members again as top-level `doctrine*` fields. Projection objects and spans were also repeated through dedicated manifests and aliases.

## Repository inventory

| Authority | Repository | State at audit |
|---|---|---|
| Commercial Route / normalized geometry | `commercial-routes` | Materialized, 36 records |
| Measured centerline | `measured-centerlines` | Declared; materializes on next qualifying release |
| Station Projection | `station-projections` | Declared; materializes on next qualifying release |
| Station Graph | `station-graphs` | Declared; materializes on next qualifying release |
| Engineering Object Manifest | `engineering-object-manifests` | Declared; materializes on next qualifying release |
| Station / projected manifests | `station-object-manifests`, `projected-object-manifests` | Declared; materialize on release |
| Product Doctrine Assembly | `product-doctrine-assemblies` | Added as a bounded governed artifact authority |
| Project Configuration | `project-configurations` | Added as a bounded governed artifact authority |
| Quantity Reconciliation | `quantity-reconciliations` | Added as a bounded governed artifact authority |
| Proposal Revision | `proposal-drafts` | Materialized, 24 records |
| Commercial Revision | `commercial-revisions` | Materialized, 15 records |
| Commercial Release | `commercial-release-packages` | Materialized, 23 records |
| Customer Design / source evidence | `customer-design-imports` | Materialized, 8 records |
| Engineering Draft / Package | `engineering-drafts`, `engineering-packages` | Materialized |

No duplicate route, proposal, release, source-evidence, Engineering Draft, or Engineering Package authority was introduced.

## Reference contract and package shape

Each extracted artifact is persisted as immutable `payload` plus metadata and is referenced by `artifactType`, `artifactId`, immutable `revision`, SHA-256 `hash`, `authority`, repository path, `createdAt`, organization/tenant/customer/opportunity scope, and source/package identity. The Draft IOF carries named references (`objectManifestRef`, `stationProjectionRef`, `stationGraphRef`, `measuredCenterlineRef`, doctrine/configuration/quantity refs) plus the consolidated reference registry.

The client first creates a small allowlisted manifest, then sends only the canonical artifacts—not their aliases—to the artifact endpoint. The server durably persists those artifacts and returns immutable references. Only then does the client serialize and save the reference-only Draft IOF. The 4 MiB limit remains exactly `4 * 1024 * 1024`; no compression or guard bypass was added.

## Engineering dereference and integrity

Engineering submission uses strict dereference. It blocks with `ARTIFACT_INTEGRITY_FAILURE` when a referenced artifact is missing, its ID/revision/hash differs, or organization/tenant/customer/opportunity scope differs. The Commercial Route is restored by exact repository ID and independently checked for route revision, geometry hash, customer, and opportunity. No `latest` reference is accepted. A deterministic Draft IOF package hash excludes only its prior hash and volatile `updatedAt`.

Round-trip validation proves normalization changes location rather than information: a 250-object manifest plus station projection/graph was persisted, stripped from the package, reconstructed with the same object/station counts, then correctly blocked after hash tampering, deletion, and three scope substitutions.

## Payload budget and current named record

| Measurement | Bytes |
|---|---:|
| Observed failure before normalization | 112,989,222 |
| Observed Object Manifest group | 56,303,042 |
| Current persisted named package | 33,684 |
| Reduction versus observed failure | 99.9702% |
| Largest current inline field | `manifest`, 14,511 |

The current named repository record is `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-2-GGL-HELSWR-v2`. Its largest remaining fields are legacy compact metadata: `manifest` 14,511 bytes, `dependencyGraph` 3,613, `proposalSummary` 2,295, `commercialSummary` 1,646, and `proposedIofUnits` 1,146. It contains no 56 MB object graph.

## Real opportunity acceptance limitation

The exact failed 113 MB in-memory assembly cannot be rerun from the current UI state: the named opportunity belongs to `customer-account-2` / Demo, while the current customer surface intentionally exposes only Google, so it is not present in either Opportunity selector. The failed client byte stream was never persisted. No customer data was migrated, no alternate smaller opportunity was fabricated as acceptance proof, and no repository was cleared.

The existing named package was advanced through the exact Proposal Revision/Commercial Revision/Release eligibility save boundary, but Engineering correctly blocked because that old persisted record has no Doctrine Object Manifest—the unavailable artifact that existed only in the discarded client assembly. This is the correct fail-closed result. A complete real `Release to Engineering` and reload therefore remains pending until the named opportunity is selectable again or an equivalent new Google opportunity produces a fresh full assembly. The code path for that next release is normalized and covered by artifact round-trip/integrity tests.

## UI and Reasoning isolation

The repeated React key warning came from Vendor Preview using display text (`n/a`) as its key. It now uses a stable deterministic text-plus-occurrence composite; no random key is used. Draft IOF persistence and Engineering dereference contain no Reasoning Service dependency, so the existing remote circuit-open state is irrelevant.

## Validation and regressions

- CIP-045C: 49/49 pass, including persistence/reconstruction, missing artifact, hash mismatch, and tenant/customer/opportunity isolation.
- CIP-045B: 88/88 pass.
- CIP-045A: 58/58 pass (both transition suites).
- CIP-045: 84/84 pass.
- CIP-044A.2: 30/30 pass; ten-run civil mutation remains below 500 ms and performs zero structural IOF work.
- CIP-044A.3: 25/25 pass.
- CIP-041: 30/30 pass.
- CIP-035A, CIP-036 (both suites), CIP-037 (both suites), CIP-038, and CIP-040 pass.
- TypeScript and production build pass. The build reports only the pre-existing chunk-size advisory.
- Service Order count remains 0. ScopeVersion count remains 0.
- No deployment, DAL1 change, or production push occurred.

The primary code changes are confined to Draft IOF serialization/persistence/dereference and the affected Vendor Preview key.
