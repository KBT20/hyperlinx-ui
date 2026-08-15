# CIP-051 — Customer Deliverables, PDF Generation & Governed KMZ Export

## Result

PASS. The local runtime now exposes governed Proposal PDF, Service Order PDF, proposal-route KMZ, Certified IOF KMZ, and authorized ScopeVersion KMZ downloads. The implementation projects existing authority records and does not rebuild, re-key, or persist export-specific business state.

Validated against the real `HelSWR_Revised_71526` fixture on 2026-08-14.

## 1. Existing capability and gaps discovered

- The browser previously had a placeholder Service Order PDF action but no PDF artifact generator.
- The repository already used JSZip and contained KMZ parsing support, but no governed customer KMZ export route.
- Shared route geometry, station projections, object manifests, proposal revisions, certified IOF packages, Service Orders, and ScopeVersions already existed and remain authoritative.
- The missing layer was a read-only deliverable projection plus customer-facing download controls.

## 2. Proposal PDF authority

The Proposal PDF is resolved from the exact proposal revision and its bound Draft IOF, governed Commercial Route, product configuration, quantities, and commercial terms. The validated revision is `PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`, with proposal hash `bf45a5b291f79acbedddec87487fe37a0db118d92d569a1c3e2a0754a7ab437e`.

## 3. Service Order PDF authority

The Service Order PDF is resolved from `SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001`, document hash `44d9a14a00cd9945784844ea4e226e8d490431c0870cdf7d60e09da83f8d9389`, its exact certification basis, and its countersignature/ScopeVersion evidence when present.

## 4. Map snapshot authority

PDF maps use the same governed route coordinates as the Commercial Route Repository. The exporter scales that complete coordinate sequence into a deterministic vector map; it does not calculate a substitute route.

## 5. Governed KMZ authority

KMZ exports use route `ROUTE-REPO-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-COMMERCIAL-DRAFT-IMPORT-ROUTE-HELSWR-REVISED-71526-1`, revision 1, geometry hash `rg-0d302bb0`, and all 340 source coordinates.

## 6. Station disclosure

The source contains 7,957 stations. Customer KMZs intentionally project 151 approximately one-mile station references to remain usable and avoid station explosion. Full station authority is neither modified nor replaced.

## 7. Object classes

The validated KMZ contains 433 unique network facilities:

- Handhole: 319
- Vault: 19
- Splice Case: 33
- Marker Post: 31
- Slack Loop: 31
- ILA/regeneration facilities: 0, matching the certified source fixture

## 8. Customer-safe disclosure

Deliverables contain customer-facing project, route, quantity, commercial, facility, certification, and authorization information. Internal runtime diagnostics, cache state, debug data, browser state, and repository implementation details are excluded.

## 9. PDF structure

Both PDFs are deterministic, three-page documents using standard embedded-safe PDF typography and vector route graphics. The Proposal presents project/configuration, route/endpoints, civil mix, quantities, commercial terms, and authority references. The Service Order presents scope, certified basis, route, quantity and station summaries, terms/conditions, signatures, countersignature evidence, and ScopeVersion authorization when applicable.

## 10. KMZ structure

Each KMZ contains `doc.kml` with these governed folders:

1. Project
2. Route
3. Endpoints
4. Major Facilities
5. Network Facilities
6. Engineering Conditions
7. Station References
8. Scope Components

## 11. Export metadata

HTTP responses expose content disposition, export hash, authority hash, geometry hash, and lifecycle status. KML extended data carries the applicable route, geometry, proposal/certification/ScopeVersion references and lifecycle statement.

## 12. Exact route validation

The exported LineString has exactly 340 points in the same order as the governed route. Endpoint A is `[-98.43099449671928, 37.25367177953801]`; endpoint Z is `[-97.05147205636051, 36.16719168339439]`. Validated route distance is 150.68 miles.

## 13. Authority bindings

- Proposal revision → Draft IOF → Commercial Route revision/hash
- Service Order → Certified IOF `CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Certified KMZ → certification hash `aaa450430fa23eb42fa6ccaceb491024497a92c37abe265c5b0a97a7ea49f022`
- Authorized KMZ → `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`

## 14. Endpoint handling

A/Z placemarks are projected directly from the governed route endpoints. No endpoint enrichment or export step mutates source coordinates.

## 15. Browser save validation

Automated Edge validation found and clicked all five controls:

- Download Proposal PDF
- Download Route KMZ
- Download Service Order PDF
- Download Certified Route KMZ
- Download Authorized Route KMZ

All five files were saved to `artifacts/cip051-browser-downloads`. Browser fetch confirmed HTTP 200, `application/pdf`, attachment disposition, and `%PDF` magic. Runtime exceptions: 0. Console errors: 0.

## 16. Human-readable filenames

- `Teralinx_HelSWR_Revised_71526_Proposal_R1.pdf`
- `Teralinx_HelSWR_Revised_71526_Service_Order_R1.pdf`
- `Teralinx_HelSWR_Revised_71526_Route_R1.kmz`
- `Teralinx_HelSWR_Revised_71526_Certified_Route.kmz`
- `Teralinx_HelSWR_Revised_71526_ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2_Authorized_Route.kmz`

## 17. Artifact sizes

| Artifact | Bytes |
|---|---:|
| Proposal PDF | 11,242 |
| Service Order PDF | 13,050 |
| Proposal route KMZ | 28,216 |
| Certified KMZ | 28,216 |
| Authorized KMZ | 28,221 |

## 18. Generation performance

Final validation timings:

| Artifact | Time |
|---|---:|
| Proposal PDF | 213.9 ms |
| Service Order PDF | 144.2 ms |
| Proposal route KMZ | 244.7 ms |
| Certified KMZ | 200.3 ms |
| Authorized KMZ | 322.2 ms |

## 19. Reproducibility

Repeated exports were byte-for-byte deterministic. Fixed KMZ entry timestamps, stable ordering, normalized text, and deterministic PDF object assembly prevent incidental binary drift. `deterministicBinary: true`.

## 20. Security and scoping

- Assigned customer request: HTTP 200
- Unauthenticated request: HTTP 401
- Guessed out-of-scope identifier: HTTP 404
- Access is restricted by organization and customer assignment/authorized-signer context, with explicit platform/proposal-management authority support.

The fixture provides one populated customer tenant; therefore a second real tenant record was not available for a positive cross-tenant fixture comparison. The negative guessed-ID and unauthenticated paths were exercised.

## 21. Lifecycle presentation

Certified export is explicitly labeled certified and **NOT AUTHORIZED** and contains no ScopeVersion claim. Authorized export names and records the exact materialized ScopeVersion. Source evidence orientation and geometry remain intact in both.

## 22. Validated commercial content

- Product: 3 × 1.25-inch HDPE ducts; 864-count fiber
- Civil mix: 82% plow, 12% dirt, 0% rock, 6% trench
- Conduit: 2,458,324 ft
- Purchased fiber: 877,121 ft
- NRC: 26,334,426
- MRC: 15,068
- Term: 240 months
- TCV: 29,950,746

## 23. Export hashes

- Proposal PDF: `a3e2538acb1eecd0505b770c26aa4ce886d8611f0a9c55dbc827139011362ac5`
- Service Order PDF: `3eaa238d6c0a2254edf32695bed35cb93803a10834884ae68907929a355098ea`
- Certified KMZ: `8facb317b6719f75b767542bbe555b08200a57c1d16654778a7f65def1495c98`
- Authorized KMZ: `3a445e796a6b3442a0df9b0b7863e0e8f32c7df5f403ea5380bce0d5bb62ce10`

## 24. Source immutability

The validation snapshots authoritative records before export and compares them after all exports. `sourceAuthorityUnchanged: true`. No new repository, authority record, route, proposal, certification, Service Order, or ScopeVersion is created by downloading.

## 25. Validation and regressions

| Check | Result |
|---|---|
| `cip051-customer-deliverables-export-validation.mjs` | PASS |
| CIP-050 Commercial authorization | PASS, exit 0 |
| CIP-049 Twin browser validation | PASS execution, 0 runtime exceptions and 0 integrity failures; one expected advisory reasoning warning |
| CIP-047 Engineering human approval authority | PASS |
| CIP-045B route source consolidation | PASS, 88/88 |
| TypeScript typecheck | PASS |
| Production build | PASS; existing >500 kB chunk warning |
| `git diff --check` | PASS; line-ending conversion warnings only |
| CIP-048C browser runner | INCONCLUSIVE: runner exceeded 120 seconds without emitting a failed assertion |
| CIP-046C shared-map browser runner | INCONCLUSIVE: runner exceeded 120 seconds without emitting a failed assertion |

## 26. Known limitations and residual gaps

- The deterministic PDF map is a clean vector route overview, not a network-fetched street/satellite basemap. This avoids external map licensing, availability, and nondeterminism in a governed artifact.
- PDF structure, download, media type, magic bytes, pages, content, and xref generation were automated; a native desktop PDF viewer was not available in the validation harness.
- KMZ was structurally opened and parsed with JSZip/KML validation and saved through the browser. A native Google Earth application was not available in the validation environment.
- The certified fixture contains no ILA/regeneration objects, so none are invented for the customer export.
- The two timed-out legacy browser runners remain explicitly inconclusive; no assertion failure was observed, and their underlying CIP-051-sensitive authority/map invariants are covered by the direct export validator and passing CIP-045B/CIP-047 checks.

## Implementation surfaces

- `server/routes/customer-exports.js`: governed artifact resolution, PDF/KMZ generation, security, response metadata
- `server/index.js`: export endpoint registration
- `server/routes/_shared.js`: browser-visible export response headers
- `src/api/teralinxRuntime.ts`: browser download helper
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: Proposal and route controls
- `src/workspaces/ServiceOrderWorkspace.tsx`: Service Order PDF control
- `src/workspaces/TwinWorkspace.tsx`: Service Order, certified-route, and authorized-route controls
- `cip051-customer-deliverables-export-validation.mjs`: authority, structure, determinism, security, mutation, and browser-save validation
