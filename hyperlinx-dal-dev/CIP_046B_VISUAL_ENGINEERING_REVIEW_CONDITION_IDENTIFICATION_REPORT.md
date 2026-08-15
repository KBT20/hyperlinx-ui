# CIP-046B Visual Engineering Review & Condition Identification Report

## Outcome

Engineering Certification is now organized around a human visual review of the existing governed Engineering Package and the Shared Opportunity Map introduced by CIP-046A. The implementation adds no workflow engine, repository, constitutional authority, certification authority, Commercial authority, route authority, or persisted domain object.

**New persisted authority introduced: None.**

The human-facing `Engineering Condition` is a projection and interaction model over the existing `engineeringConstraints` collection. Persisted changes continue through the existing Draft IOF Package metadata and Engineering Change Set repositories.

## Validated package

- Engineering Package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Draft IOF Package: `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Commercial Route Repository: `ROUTE-REPO-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-COMMERCIAL-DRAFT-IMPORT-ROUTE-HELSWR-REVISED-71526-1`
- Route revision: `1`
- Commercial orientation: `SOURCE_START_TO_END`
- Displayed route length: `795,574 ft`
- Doctrine: `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER / 20C.1.0`

The Shared Opportunity Map remains a response projection of the Commercial Route Repository. It was not copied into Engineering persistence and was not mutated by map interaction.

## Existing authority and handler inventory

| Human action | Existing authority / source | Existing handler or projection retained | Mutation behavior |
|---|---|---|---|
| Open Engineering Package | Engineering Package + Draft IOF repositories | `GET /api/engineering/certification/draft-packages/:id` | Retains its pre-existing intake/status persistence behavior. This was not changed. |
| View route | Commercial Route Repository | Shared Opportunity Map response projection and MapKernel | Presentation only. |
| Select route, station, object, site, or condition | Engineering projection + MapKernel selection references | MapKernel selection callback | Presentation only. |
| Identify condition | Draft IOF `engineeringConstraints` | Existing constraints POST handler, extended with backward-compatible human metadata | Engineering metadata mutation. |
| Accept proposed design | Same constraint record | Constraint disposition endpoint + `RESOLVE_CONSTRAINT` Engineering Change Set patch | Engineering decision only; no physical route/object mutation. |
| Move object | Engineering Revision | Existing object-move handler + Engineering Change Set | Governed Engineering mutation. |
| Create route redline | Engineering Revision | Existing route-redline handler + Engineering Change Set | Governed Engineering overlay; Commercial route evidence remains unchanged. |
| Doctrine exception | Existing doctrine-exception contract | Existing doctrine-exception handler + Engineering Change Set | Governed exception mutation. |
| Quantity reconciliation | Existing quantity reconciliation authority | Existing reconciliation panel and handlers | Only explicit reconciliation decisions mutate state. |
| Engineering budget | Existing Engineering budget certification input | Existing budget approval path | Explicit Engineering approval mutation. |
| Request Commercial Revision | Existing Commercial revision return path | Existing `return-commercial` action | Explicit lifecycle mutation; no certification. |
| Certify | Existing certification gates and certification ledger | Existing certify handler | Explicit human certification only. |

## Engineering Condition mapping

The UI classification is translated to the existing constitutional constraint categories. Human severity is stored as compatible metadata; it does not create a new gate system.

| Human classification | Existing constraint category |
|---|---|
| ROW, Railroad, Water, Road Crossing, Environmental, Utility Conflict | `CROSSING_CONSTRAINT` or existing route/constructability category |
| Constructability, Access, Permitting | Existing constructability / access category |
| Power, Facility Placement, Fiber / Cable, Splicing, ILA / Regeneration, Customer Site | Existing facility or object constraint category |
| Quantity, Cost / Budget | Existing quantity / budget constraint category |
| Doctrine Exception | Existing doctrine exception path |
| Route, Other | Existing route/general constraint category |

Human metadata recorded on the same constraint includes title, classification, severity, inherited package/revision/route/station/object context, geometry hash, actor, timestamp, and disposition. Older constraints normalize with safe defaults.

## Human workflow implemented

The primary screen now follows:

`Route → Visual Review → Identify Condition → Select Context → Record Decision → Continue Review`

- The Opportunity Map is the primary canvas.
- Proposed objects remain contextual design volume and are labeled `PROPOSED / NOT EXCEPTED`.
- The Inspector presents identity, station, coordinate, doctrine, construction assumption, budget, and open-condition count before technical detail.
- Technical evidence remains available under collapsed details.
- The Condition form inherits the active route/station/object/location context.
- Dispositions surface Accept, Engineering Change, Doctrine Exception, and Commercial Revision Required through existing mechanisms.
- The Navigator counts actionable work, not the 433 proposed objects.
- Quantities show differences; unchanged matches are collapsed.
- Budget shows affected rows and financial consequences; unchanged objects do not require repetitive acknowledgement.
- Final Review shows concise remaining blockers and readiness.

## Map, queue, and Inspector synchronization

- Map selections drive the Inspector and condition context.
- The Condition Queue uses the same projected constraint IDs as map markers.
- `selectedFeatureId` keeps the corresponding marker visible under progressive map density.
- Feature-focus requests are guarded so a viewport focus is applied once rather than causing repeated viewport recomputation.
- Condition markers use restrained states: open/attention amber, blocking red, and accepted/resolved gray.

## Mutation boundary

Presentation-only interactions:

- map pan, zoom, layer/profile selection, and fit controls;
- route/station/object/site/condition selection;
- navigator changes;
- Inspector expansion;
- condition queue navigation;
- diagnostics expansion;
- quantity and budget inspection before explicit confirmation.

Governed mutations:

- add or disposition a condition;
- move an object;
- create a route redline;
- record a doctrine exception;
- reconcile a quantity difference;
- approve Engineering budget;
- request a Commercial revision;
- certify through explicit human action.

No normal presentation interaction invokes route rebuild, geometry rebuild, Product Doctrine assembly, Draft IOF assembly, station rebuild, object-manifest rebuild, Engineering Package regeneration, Commercial estimate calculation, proposal calculation, Customer Twin loading, or reasoning.

## Live acceptance evidence

The existing package contains the live acceptance condition:

- Title: `CIP-046B visual acceptance condition`
- Context: `HANDHOLE / HH-001`
- Classification: `Access`
- Severity: `INFO`
- Final status: `ACCEPTED`
- Disposition: `ACCEPT`
- Decision: proposed design accepted without physical change

The decision is recorded in the existing Engineering Change Set:

`ENGINEERING-CHANGE-SET-ENG-REV-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-000-1786655663945`

Its active patch is `RESOLVE_CONSTRAINT`; it declares baseline immutability, no station-projection mutation, no pricing mutation, no Commercial authority mutation, and no ScopeVersion creation. Validation recorded zero object-move calls and zero route-redline calls for the acceptance disposition.

The validated fixture currently projects `0` Stations in the Navigator and `0` quantity differences while its proposed objects retain station references. That display was not treated as a defect and was not rewritten. A live object move was therefore not fabricated against an unavailable station choice. The existing Move Object, route-redline, reconciliation, and budget handlers remain surfaced and unchanged. This is the one acceptance branch not mutated live; doing so without a selectable governed station would have exceeded the human-authority boundary.

## Performance measurements

Warm, presentation-level measurements from the acceptance browser session:

| Interaction | Measured synchronous presentation cost |
|---|---:|
| Navigator change | `0.3 ms` |
| Inspector open | `0.0 ms` |
| Map selection dispatch | `0.3 ms` |
| Zoom dispatch | `0.2 ms` |

The measured interaction interval produced:

- `0` condition mutation calls;
- `0` object-move calls;
- `0` route-redline calls;
- `0` additional reasoning calls;
- no route or package regeneration.

The package's existing hydration payload and pre-existing GET lifecycle persistence remain outside the presentation interaction measurements. Duplicate auto-rehydration was prevented in the client by disabling package selection while the selected package is being restored; the GET contract itself was not changed.

## Certification gate verification

Certification remains an explicit human action and is disabled for this package. The primary Final Review reports the actual governed blockers rather than converting object volume into tasks:

- Engineering budget not approved;
- quantity reconciliation incomplete;
- constitutional quantity gate incomplete;
- six existing compliance failures.

The UI does not mark the package ready merely because the Engineering condition was accepted. No certification request was made and no certified package, Service Order, or ScopeVersion was created.

## Commercial Revision return path

`Commercial Revision Required` prepares the existing return form with the condition title, Engineering Package, Engineering Revision, constraint ID, station, object, decision reason, and impact. The existing explicit `Request Commercial Revision` action remains the only lifecycle mutation. Preparing that context does not certify the package and does not itself return it to Commercial.

## Reasoning-offline verification

Reasoning remains advisory. Three pre-existing global reasoning/health resource entries were present before the measured Engineering interaction interval and three remained afterward: delta `0`. No Engineering action awaited reasoning, and the condition workflow completed while Reasoning displayed `STARTING`.

## Diagnostics and unchanged unclear authority

Repository integrity, hashes, graphs, doctrine diagnostics, station diagnostics, runtime metrics, cache metrics, and reasoning status remain under collapsed Diagnostics / Package Integrity surfaces. Genuine blockers are summarized in Final Review.

The fixture's mismatch between a zero projected station count and object-level station references was not reinterpreted. Station authority, object movement validity, and the pre-existing package-open GET persistence contract were left unchanged. The GET behavior should be addressed only in a future bounded correction if its lifecycle side effect is to change.

## Visual and machine-readable artifacts

- Before: `artifacts/cip046a/engineering-workspace-after-1375x780.png`
- After: `artifacts/cip046b/engineering-condition-review-after-1375x780.png`
- Machine-readable acceptance: `artifacts/cip046b/condition-workflow-validation.json`
- Validation harness: `scripts/cip046b-visual-condition-validation.mjs`

## Verification

- `npm run typecheck` — PASS
- `npm run build` — PASS
- scoped `git diff --check` — PASS (line-ending notices only)
- no deployment, DAL1, `app.teralinx.net`, production migration, Service Order generation, ScopeVersion creation, Field, Control, Marketplace, Twin, or reasoning redesign performed
