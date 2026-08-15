# CIP-048A — Engineering Failure Authority Audit, Classification & Resolution Contract

## Outcome

The real package `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2` was audited without replacement, regeneration, approval, certification, Service Order, or ScopeVersion creation. Its six original compliance failures were not Engineering decisions or genuine missing package authority. They were consumer/normalization predicates applied to valid immutable artifacts. Correcting those defects makes the existing governed state read truthfully as Engineering Review Complete. Human Approval is now READY but remains uncreated; IOF Certification remains BLOCKED.

## Authority trace

The active lineage is:

`Proposal Revision PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
→ `Commercial Revision COMM-REV-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-V1-PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
→ `Draft IOF DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
→ `Engineering Package ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
→ `Engineering Revision ENG-REV-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-000`

The reference-only Draft IOF resolves immutable artifacts for the measured centerline, Station Projection, Station Graph, Station Object Manifest, Projected Object Manifest, Engineering Object Manifest, Product Doctrine Assembly, Project Configuration, quantity/commercial audit reconciliation, Closure Ledger, and IOF Package Twin. The Commercial Opportunity Route remains geometry authority.

## Failure audit

| Displayed failure | Validator | Predicate | Expected | Actual authority | Classification | Owner | Human action | Resolution |
|---|---|---|---|---|---|---|---|---|
| Stationing — station authority missing | `EngineeringCertificationProjection.buildCompliance` | Top-level `stationAuthority` with expected station count | 7,957 stations at 100 ft including terminal station | Immutable Station Projection contains 7,957 stations and Station Authority ID; response hydration exposed only `stationProjection` | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Normalize the immutable Station Projection into the response-level Station Authority contract; no station regeneration |
| Station-to-coordinate — coordinate map incomplete | Same | Every authorized station has finite measure and coordinate | Complete Station → coordinate association | All 7,957 Station Projection records contain `measuredDistanceFeet` and coordinate | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Accept the governed `measuredDistanceFeet` field and normalized authority |
| Graph — 7,956 edges shown as FAIL | `stationGraphReferencesValid` | Every edge endpoint resolves to an authorized station ID | 7,956 valid consecutive edges | All 7,956 edges resolve; the consumer compared them against the previously empty station contract | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Evaluate graph against rehydrated Station Authority; report the actual invalid edge if one exists |
| Object attachment — unresolved or missing | Object attachment compliance predicate | Explicit redundant attachment array covers projected objects | Governed station identity and coordinate per object | 433 unique projected objects already contain station ID, station address/value, coordinate, projection hash, and projection authority; redundant array was stripped by reference-only persistence | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Project a response-only attachment view from the exact governed object station address; persist or regenerate nothing |
| Audit projection — 0 attachments / 0 closure expectations | Audit projection compliance predicate | `closureExpectationCount > 0` | PASS audit projection at Engineering lifecycle | Persisted summary says PASS, `createsObjects: false`; closure evidence belongs to later Field/Closure lifecycle | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Respect explicit Commercial audit PASS; do not require future Field closure evidence for Engineering certification |
| Engineering readiness — SUBMITTED_TO_ENGINEERING | Readiness compliance predicate | String contains READY and general draft validation is not FAIL | Expected active review lifecycle | `SUBMITTED_TO_ENGINEERING` is the correct state while Engineering is reviewing | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Treat submitted/under-review as valid lifecycle context; continue to derive approval readiness from governed gates |
| Proposed IOF units validation | Server approval explicit validation bridge | Legacy embedded `proposedIofUnits` exists | Governed proposed IOF representation | Reference-only record has a valid 433-object Projected Object Manifest | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Recognize the immutable projected manifest as the governed representation rather than requiring stripped legacy embedding |
| Quantity Reconciliation — Action Required, 0 items | UI and server quantity gate | Any object named `quantityReconciliation` is a formal human reconciliation | Formal item list only when attributable differences exist | Artifact is a PASS Commercial Audit Reconciliation with no Engineering reconciliation items | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Require human action only for a formal reconciliation containing unresolved attributable items |
| Constitutional Quantity Review — separate action | UI action inbox | Constitutional result requires another human action | Derived validation after quantity disposition | Constitutional Assembly is PASS and depends on underlying quantity authority | IMPLEMENTATION_DEFECT | IMPLEMENTATION/SYSTEM | No | Remove duplicate human action; automatically re-evaluate the deterministic gate |
| Station lifecycle — 160 rules versus 7,957 stations | Station lifecycle compliance predicate | Lifecycle rule count must equal all 100-ft stations | Valid doctrine control-point lifecycle rules | 160 doctrine control-point rules; Engineering Object Manifest validation is PASS | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Validate the doctrine manifest/rules, not one lifecycle rule per measurement station |
| Map Kernel render authority failed | `auditMapKernelRenderAuthority` | Unique render identity for each visible governed feature | Separate A and Z site identities | Site identity selected parent `routeId`, collapsing A and Z into two duplicate point/label groups | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Use each Site's governed feature ID; retain route ID only as lineage |
| Repeated HH-001 / duplicate Engineering object presentation | Engineering map projection and React rendering | One intentional representation per governed object | One HH-001 | Source manifest has 433/433 unique IDs and exactly one HH-001; PD-002A, generic, and instantiated aliases could all enter rendering | IMPLEMENTATION_DEFECT | IMPLEMENTATION | No | Use PD-002A addressing as the canonical object render representation and omit secondary aliases |

## Six compliance failures individually

The original six—stationing, station-to-coordinate, graph, object attachment, audit projection, and Engineering readiness—are all classified `IMPLEMENTATION_DEFECT`, owner `IMPLEMENTATION`, `humanActionRequired: false`. None is eligible for a Doctrine Exception. All now evaluate truthfully without changing their source artifacts.

## Quantity authority

- Commercial quantity/audit authority: `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2:COMMERCIAL-AUDIT-RECONCILIATION`, status PASS.
- Formal Engineering reconciliation: absent because this package exposes no attributable reconciliation items.
- Unresolved differences: zero formal items.
- Constitutional predicate: existing Constitutional Assembly status PASS, dependent on underlying quantities.
- Human decision required: none for the current package.
- Derived validation: Constitutional Quantity automatically follows governed quantity state and is not independently approved.

## Compliance and doctrine

No current compliance failure represents an Engineering deviation from Product Doctrine. The UI no longer offers a Doctrine Exception as a way to forgive package/software defects. The exception function remains contextual and available only where an actual Engineering condition/deviation exists.

## Failure Authority Contract

`src/engineering/EngineeringFailureAuthority.ts` provides a deterministic, non-persisted response projection containing:

`issueId`, `issueType`, `classification`, `title`, `humanReadableReason`, source authority/artifact/revision/hash, validator, predicate, expected, actual, blocking, human-action flag, dependencies, one resolution owner, resolution type/action, and technical details.

The allowed classifications and owners exactly match CIP-048A. Package/system issues are separated from the human action inbox. No classification repository was added.

## Guided Engineering workflow (CIP-048B)

The Engineering workspace now presents:

1. Package Received
2. Engineering Review
3. Human Approval
4. IOF Certification

The action inbox contains only `ENGINEERING_DECISION` work. Deterministic validations and package issues have separate surfaces. Normal navigation remains Opportunity Map, Budget, Quantities, Compliance, Conditions, and Final Review; station/object/constraint/redline/exception tools remain contextual or under Engineering Tools. Technical Diagnostics remain collapsed, and the advisory DAL Reasoning surface is not rendered in Engineering.

For the real package the current UI is:

- Package Received: COMPLETE
- Engineering Review: COMPLETE
- Required Engineering Actions: 0 HUMAN ACTIONS
- Human Approval: READY
- IOF Certification: BLOCKED
- Explicit next action: Approve Engineering Revision

The approval screen identifies the exact Engineering Package, Engineering Revision, revision hash, Draft IOF Package, customer, opportunity, and route. It uses the existing CIP-047 authority and does not auto-certify.

## Map and Inspector

Map Kernel authority now reports PASS, zero duplicate keys, and zero duplicate render authorities. The 433 governed point objects are unique; doctrine spans remain intentionally separate governed linear representations. Regional disclosure remains route/A/Z/major context only. The Inspector retains a stable 282 px column at desktop width, shows the human-readable object type first, moves technical object identity under technical details, and uses normal word breaking rather than character-by-character wrapping.

## Persistence and lifecycle safety

All repairs are response normalization, validation, identity construction, or presentation changes. No source repository record was edited. No approval, certification, Service Order, or ScopeVersion was created. No route, geometry, stationing, doctrine, Draft IOF, Engineering Package, or Customer Twin was regenerated.

## Validation evidence

- `artifacts/cip048a/engineering-failure-authority-validation.json`
- `artifacts/cip048a/review-complete-human-approval-ready-1375x780.png`
- `artifacts/cip048a/engineering-map-authority-1375x780.png`
- `artifacts/cip048a/final-review-approval-ready-1375x780.png`

The focused real-package suite passed all 29 assertions, including explicit checks that Engineering hides DAL Reasoning and keeps Technical Diagnostics collapsed. TypeScript, Node syntax, production build, and scoped `git diff --check` passed. CIP-045C.1, CIP-045C, CIP-044A.2, CIP-041, and CIP-035A regressions passed. The older CIP-046C browser runner logged its expected disclosure transitions but timed out at 120 seconds during its independent large-package browser sequence; the CIP-048A browser suite directly validated regional Engineering disclosure and Map Kernel render authority PASS.

The real browser validation covers the now-achievable Review Complete/Human Approval Ready state. Approved and Certified states were not created because doing so requires explicit human authority and was outside this audit.
