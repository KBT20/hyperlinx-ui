# CIP-044A.3 Estimate Render Normalization Report

## EXACT FIELD CAUSING SECTIONDETAILS CRASH

- Expression: `entry.authorityLayer.replaceAll("_", " ")`
- Field: `authorityLayer`
- Object type: `TransparentEstimateAuditEntry`
- Estimate section: `ESTIMATE_AUDIT`, rendered by `SectionDetails`
- Source projection: `TransparentEstimatingEngine.auditEntries(...)`; the current projection assigns a required authority-layer enum.
- Actual runtime value: `undefined`
- Expected value: one of the governed `TransparentEstimateAuditEntry["authorityLayer"]` strings.
- Actual persisted source: `server/data/commercial-opportunities/GOOGLE-HELIUM-HIU-MUS.json`, under `commercialDraftSnapshot.transparentEstimate.auditTrail`.
- Scope: all 74 audit rows in that legacy snapshot lack `authorityLayer`, `costLedgerId`, and `costContributionMode`. The first failing row is `AUDIT-CONSTRUCTION-COST` / `Construction Cost`.

The saved estimate predates the current audit-lineage fields. Current estimates generate them correctly. The repair therefore normalizes at presentation and does not rewrite the saved opportunity, infer a valid authority layer, or alter estimate authority.

## Repair

`formatEstimateLabel(value, fallback)` is now the single presentation-only formatter for estimate labels. Valid strings are trimmed and underscore-normalized. Missing required values render `UNRESOLVED`; optional values can supply an explicit fallback such as `NOT CONFIGURED` or `MISSING EVIDENCE`.

The Estimate Audit table now uses the formatter for `authorityLayer` and `costContributionMode`, and renders a missing `costLedgerId` as `UNRESOLVED`. Estimate status, human-audit authority labels, and ILA presentation labels use the same bounded formatter. No estimate number, quantity, rate, Product Doctrine rule, Project Configuration value, calibration, or historical revision is changed.

Every `SectionDetails` instance is now inside `SecondaryEstimatePanelBoundary`. A malformed section is contained without destroying Commercial Planning, while `componentDidCatch` retains the real exception in the development console.

Real Chrome rehydration of the exact legacy record rendered the explorer with no error, showed 74 `UNRESOLVED` authority cells, and retained an operational workspace.

## Bounded string-assumption audit

| Expression/field | Classification | Result |
|---|---|---|
| `estimateStatus` | required enum/display | centralized formatter; missing is `UNRESOLVED` |
| human audit `previousAuthority` / `newAuthority` | required enum/display | centralized formatter; missing is `UNRESOLVED` |
| estimate audit `authorityLayer` | required authority/display | centralized formatter; missing is `UNRESOLVED` |
| estimate audit `costContributionMode` | required enum/display | centralized formatter; missing is `UNRESOLVED` |
| ILA role, planning authority, Engineering state, power state | required/optional projected display | centralized formatter with explicit fallbacks |
| `numberFromInput(value).trim()` and `parseConstraintInput(input).trim()` | local user input | safe; both arguments are typed strings from form controls |
| `key.replace("ILA-INT-", "")` | derived internal station key | safe; `key` comes from governed `stationOverrides` keys |

There are no remaining direct `replaceAll` calls in `TransparentEstimateExplorer.tsx`.

## Bookend source and semantics

The failed-browser fixture populated bookends because its governed saved controls explicitly contain legacy `useBookendIlas: true` (condition B: restored Project Configuration, represented by the legacy explicit field). Presentation normalization now maps that explicit field to `bookendIlaEnabled: true`; it does not infer bookends merely because ILA planning exists.

New Product #1 configuration still defaults `bookendIlaEnabled` to `false`.

Engine validation:

- Intermediate OFF + Bookends OFF: 0 stations.
- Intermediate ON + Bookends OFF: 2 intermediate stations, 0 bookends.
- Intermediate OFF + Bookends ON: exactly Start/A and End/Z, 2 total.
- Intermediate ON + Bookends ON: 2 intermediate plus exactly 2 bookends.
- No tested state produced one bookend.
- Turning bookends off removes their facility cost.

Real Chrome OFF/ON/OFF validation on the available saved Google route:

- OFF: 0 total stations, 0 bookends.
- ON: 2 total stations, `Start Bookend` and `End Bookend`.
- OFF again: 0 total stations, 0 bookends, no stale station or contained error.

## Real-browser mutation results

Browser: Headless Chrome 151 on Windows, through Chrome DevTools Protocol against the local Vite UI and local runtime.

The repository currently exposes the selected saved `Google DFW Route 36obj` estimate as **150.68 miles**, not the requested 13.44-mile fixture. No persisted 13.44-mile commercial opportunity is present locally, so no record was fabricated or migrated. The measurements below are the actual available saved-route results; the unchanged 70,963-foot/13.44-mile focused fixture is reported separately.

| Mutation | App trace | Browser event-to-two-paints | Estimate evidence |
|---|---:|---:|---|
| Civil dirt mix 13% → 14% | 2,030.5 ms | 3,917.8 ms | known cost $21,953,422 → $18,905,297 |
| Standard Dirt $15/ft → $16/ft | 1,824.6 ms | 3,596.4 ms | known cost → $19,068,650 |
| Rock quantity 1% → 2% | 1,801.7 ms | 3,583.7 ms | quantity trace completed |
| Rock adder $30/ft → $31/ft | 1,863.0 ms | 3,738.1 ms | known cost → $19,436,371 |

The mutation engine and projection-cache work remained small (individual financial cache/projection child timings were approximately 2.8–5.9 ms). The measured remainder is browser React commit/paint time for the available 150.68-mile restored workspace. No mutation approached the former 59-second failure, but these full-browser values are above the focused 500 ms fixture threshold and are reported without relabeling them as a 13.44-mile result.

Every captured civil/dirt/rock trace reported:

- structural IOF assemblies: 0
- route/geometry rebuilds: 0
- station rebuilds: 0
- map rebuilds: 0
- Engineering projections: 0
- repository reads: 0
- repository writes: 0
- structural/financial cache status: HIT

The unchanged CIP-044A.2 70,963-foot fixture retained structural fingerprint `edcf28c4` before and after civil mix. Its 10-run local mutation lifecycle measured min 0.200 ms, median 0.448 ms, mean 0.738 ms, p95/max 3.516 ms, with no traversal of giant Customer Twin/station arrays.

## Related observations

- Normal rate calibration was being diverted into an implicitly created Route Edit Session before the CIP-044A.2 mutation path. The route-patch branch now applies only when an explicit Route Edit Session already exists, matching project-configuration behavior. Explicit route editing remains available; ordinary unsaved calibration reaches the non-persisting financial fast path.
- The remote `72.46.85.137:8000/api/reasoning/health` timeout remains isolated behind the Reasoning Service circuit breaker. Deterministic estimate construction and the commercial scheduler do not import or await it. The browser showed Commercial Planning operational while Reasoning was OFFLINE/OPEN.
- Duplicate Design Launch/Doctrine logs remain the previously validated React development `StrictMode` evaluation. `DesignLaunchEngine` declares `noPersistence: true` and contains no repository/fetch write path. No redesign was made.

## Regression results

- CIP-044A.3 focused validation: 25/25 passed.
- CIP-044A.1 focused validation: 59/59 passed.
- CIP-044A.2 focused validation: 30/30 passed.
- TypeScript: passed (`tsc --noEmit`).
- Production build: passed (`vite build`); existing bundle-size warning only.
- Real browser: no `SectionDetails`, `TransparentEstimateExplorer`, or `replaceAll` exception; no contained panel error.

No repository data was cleared or rewritten. No persistence migration, deployment, DAL1 push, `app.teralinx.net` change, constitutional-authority change, or CIP-045 work was performed.
