# CIP-046D/E — Engineering Review, Human Approval & Certification Workspace

## Outcome

The Engineering workspace now opens as a compact review-and-approval experience for the already assembled Commercial Draft IOF Package. It immediately presents package identity, the governed progress path, only the unresolved package-level actions, a contextual review workspace, and explicit final certification. The shared Opportunity Map and all existing Engineering tools remain available.

Implementation stops at the required architectural boundary: the current Engineering package architecture has no distinct persisted pre-certification **Human Engineering Approval** event. No new authority, repository, status, or persistence was invented. IOF certification remains the existing explicit human authority event.

## Before / after hierarchy

| Before | After |
| --- | --- |
| Package selector and long debug-oriented review surface | Compact package/customer/opportunity/product/route/revision header |
| Multiple gate, quantity, compliance, budget, constraint, and evidence panels presented together | Four-step progress: Package Received → Engineering Review → Human Approval → IOF Certification |
| Blockers distributed across long panels | Required Engineering Approvals inbox derived from existing governed gates |
| Map, inspector, and every workflow panel competing for space | Contextual Review Workspace: Map, Budget, Quantities, Compliance, Conditions, Final Review |
| Advanced tools mixed into normal review | Collapsed Engineering Tools menu |
| Revision and technical actions mixed into the page | Collapsed More Actions menu |
| Diagnostics and runtime evidence visually prominent | Diagnostics / Package Integrity hidden until explicitly opened |
| Fixed action footer | Existing actions exposed only in their relevant review surface |

## Existing certification gates discovered

| Gate | Source / authority | Classification | Presentation |
| --- | --- | --- | --- |
| Route authority | Existing Engineering certification projection | System validation | Final Review summary; action only if failed |
| Quantity reconciliation | Existing reconciliation state and handlers | Human action when unresolved | Required Approval → Quantities |
| Constitutional quantity gate | Existing constitutional projection | Governed system gate affected by reconciliation decisions | Required Approval → Quantities |
| Engineering budget approval | Existing Engineering Change Set `CHANGE_REVIEW_STATUS` patch | Human action | Required Approval → Budget; restored as approved when evidence exists |
| Blocking Engineering conditions | Existing constraint records and disposition handlers | Human action when open | Required Approval → Conditions |
| Compliance / doctrine exceptions | Existing compliance checks and doctrine-exception handler | Human action only for failures needing disposition | Required Approval → Compliance |
| Package/system integrity | Existing package, reference, geometry, projection, and evidence checks | System validation | Passing checks hidden; failures remain blockers and technical details remain available |
| Certification readiness | Existing derived `readyForHumanCertification` state | System gate | Final Review and disabled-button explanation |
| IOF certification | Existing `certifyDraftIofPackage` / Certification Ledger path | Explicit human authority | Final Review only |

Passing repository, projection, cache, geometry, route, station, and package checks are not converted into human work. Projected objects and stations are not individual approvals.

## Required Approval model and handler mapping

The inbox is a response-only projection over existing state. It creates no records and owns no authority.

| Required Approval | Existing action used |
| --- | --- |
| Engineering Budget | Existing Engineering Change Set budget review-status patch |
| Quantity Reconciliation | Existing quantity reconciliation handlers and panel |
| Constitutional Quantity Review | Same existing reconciliation workflow; constitutional result remains system-derived |
| Engineering Conditions | Existing constraint selection and disposition flow |
| Compliance / Doctrine Exceptions | Existing doctrine exception handler |
| Request Commercial Revision | Existing return-to-Commercial handler in More Actions |
| Certify IOF Package | Existing certification-ready state and certification handler |

The prior approved budget change set for the 3SWR package is now rehydrated backward-compatibly. The budget therefore shows **Approved** and correctly disappears from the action inbox instead of being reset on load.

## Panel disposition

- Duplicate long-form budget, quantity, compliance, constraint, and footer presentations are visually hidden; their existing functions are reused by focused surfaces.
- Engineering Tools retains Identify Condition, Object Review / Move, Route Review / Redline, Station Review, and Doctrine Exception.
- More Actions retains Request Commercial Revision and explicit Technical Details access.
- Diagnostics / Package Integrity is hidden by default. Runtime, cache, reasoning, hashes, and audit evidence do not appear in normal review, but remain explicitly accessible.
- The shared Opportunity Map remains mounted and uses the existing Engineering review projection, layers, resolution-aware disclosure, selection, and inspector behavior.

## Final Review and certification

Final Review gives one concise interpretation of existing governed state: route authority, quantities, budget, conditions, compliance, system integrity, and remaining blockers. Certification stays disabled until the existing certification-ready state passes, explains remaining blockers, and requires an explicit click. No automatic approval or certification occurs.

## Human Approval authority gap

| Required report field | Finding |
| --- | --- |
| BLOCKER | A distinct persisted pre-certification “Approve Engineering Package” event cannot be completed |
| SOURCE GATE | None exists in the current Engineering package/certification architecture |
| EXPECTED AUTHORITY | Immutable or otherwise governed Engineering-package approval evidence, distinct from Certification Ledger evidence |
| MISSING WORKFLOW | Human approve/revoke/supersede lifecycle and its authorization, storage, projection, and certification dependency |
| RECOMMENDED NEXT CIP | Define the constitutional semantics and owner of Engineering Review Complete vs Human Engineering Approved vs IOF Certified before adding persistence |

`ENGINEERING_APPROVED` occurrences in downstream ScopeVersion/corridor fixtures are not valid authority for this package workflow. The UI reports **Authority Gap** and does not infer approval from passing checks.

## Real package acceptance

Validated package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`.

- Package identity, route context, progress, and Required Engineering Approvals are visible on open.
- Three legitimate blockers are projected: quantity reconciliation, constitutional quantity authority, and six compliance failures.
- Existing budget approval rehydrates as approved; no duplicate budget task remains.
- Conditions show ready with zero blocking conditions.
- Final Review shows route ready, budget approved, system integrity pass, and certification blocked by the three legitimate gates.
- Human Approval explicitly reports the missing authority.
- Request Commercial Revision and all Engineering tools remain accessible.
- No governed resolution was fabricated for unresolved quantity or compliance state.

## Performance and regressions

- Context navigation dispatch measured 0.1–0.3 ms in the browser.
- Switching among Budget, Quantities, Compliance, Opportunity Map, and Final Review produced zero new resource requests, mutation requests, or `server/data` changes.
- No route, geometry, station, Product Doctrine, Draft IOF, or Engineering Package rebuild was triggered by presentation navigation.
- No reasoning dependency was introduced.
- No Service Order or ScopeVersion was created.
- No deployment or DAL1/app.teralinx.net change occurred.
- TypeScript typecheck and production build pass.

Validation output: `artifacts/cip046d/engineering-approval-certification-validation.json`

Screenshots at 1375 × 780:

- Before reference: `artifacts/cip046c/engineering-regional-1440x900.png`
- After / action inbox: `artifacts/cip046d/engineering-approval-inbox-1375x780.png`
- After / final review: `artifacts/cip046d/engineering-final-review-authority-gap-1375x780.png`

## Acceptance boundary

The normal user can open the package, immediately see the exact governed actions, enter the matching existing review function, see final governed readiness, and access explicit certification. The requested path intentionally stops before a separate Human Engineering Approval can be persisted or completed because that authority does not exist. Certification remains correctly blocked for this real package.
