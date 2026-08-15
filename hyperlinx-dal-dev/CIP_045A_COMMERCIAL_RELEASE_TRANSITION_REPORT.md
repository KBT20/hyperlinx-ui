# CIP-045A Commercial Release Transition Report

## ROOT CAUSE OF CURRENT HANDOFF BLOCK

The UI evaluated the complete Engineering handoff readiness gate before invoking the existing lifecycle helper that creates the Commercial Revision and Commercial Release Package. In other words, `handleSubmitCommercialDraftIofToEngineering` treated the Release Package and saved Draft IOF as preconditions even though `ensureCommercialLifecycleAuthorityForDraft` is the governed transition responsible for creating/reusing those artifacts. The constitutional check was valid; its position in the user action was not.

The selected Google record also predates CIP-045 immutable proposal revisions. It reports legacy `COMMERCIAL_APPROVED`/`APPROVED`, but has no `proposalRevisionId`, no `proposalHash`, and no exact revision-bound approval. Its historical Commercial Revision, four Release Packages, and Draft IOF likewise have no Proposal Revision ID/hash. They therefore cannot be silently reused as authority for a CIP-045 exact release.

## Current real artifacts

- Proposal: `PROP-GOOGLE-DFW-ROUTE-36OBJ-v2`
- Proposal Revision ID: not present (legacy working record)
- Proposal hash: not present
- Revision display: `R1 WORKING`; Saved Proposal Revisions: `0`
- Legacy status / approval display: `COMMERCIAL_APPROVED` / `APPROVED`
- Exact revision-bound approval: not present
- Commercial Revision: `COMM-REV-OPP-GOOGLE-DFW-ROUTE-36OBJ-1783608785224-V1`, created `2026-08-11T20:48:45.938Z`; it has no source Proposal Revision ID/hash
- Commercial Change Set: none required by this transition; the live view reports Repository Truth with no active patches
- Historical Release Packages: four exist for the legacy Commercial Revision, including the latest `COMM-REL-COMM-REV-OPP-GOOGLE-DFW-ROUTE-36OBJ-1783608785224-V1-commercial-release-bb2d0`, created `2026-08-11T20:48:45.968Z`; none has a Proposal Revision ID/hash
- Historical Draft IOF: `DRAFT-IOF-PROP-GOOGLE-DFW-ROUTE-36OBJ-v2`, last updated `2026-08-11T20:48:45.991Z`; it references the latest legacy Release Package but has no Proposal Revision ID/hash
- Engineering handoff: not submitted

The current readiness lookup correctly refuses to treat those legacy artifacts as exact CIP-045 authority. No persisted customer record was rewritten or regenerated during this repair.

## Repair

The primary action is now **Release to Engineering**. It validates only true prerequisites first: an explicitly selected immutable `SAVED` Proposal Revision, exact revision/hash customer approval, Estimate, Workbook, and Route Repository. It then executes the existing governed sequence:

1. Load the selected exact Proposal Revision and hash.
2. Create or reuse a Commercial Revision bound to that exact identity.
3. Create or reuse its immutable Commercial Release Package.
4. Bind and save the Draft IOF after the Release Package.
5. Submit that exact Draft IOF to deterministic Engineering Intake and verify the Engineering Package.

The artifacts remain independent, reference-only repository records. Logical sequence values are now Proposal Revision `1`, Commercial Revision `2`, Release Package `3`, Draft IOF `4`, and Engineering Intake `5`.

## Approval and exact lineage policy

Release requires both:

- an immutable Proposal Revision whose `revisionStatus` is `SAVED`; and
- an `APPROVED` decision containing the same `proposalRevisionId` and `proposalHash`.

A WORKING revision cannot release. Approval from a parent revision is not inherited. An older saved and approved revision can be explicitly selected; its resulting chain is recorded in `proposalRevisionHandoffs` without overwriting a newer active working revision.

Every artifact carries the exact Proposal Revision ID/hash. Exact matches are required when reusing a Commercial Revision, Release Package, or Draft IOF, preventing stale Release authority from crossing revision boundaries.

## Idempotency and failure behavior

- A synchronous pending guard absorbs double clicks in the UI.
- Commercial Revision and Release IDs/hashes are deterministic from immutable inputs.
- Existing artifacts are reused only when Proposal Revision ID/hash and governing references match.
- An already submitted Draft IOF returns its deterministic existing Engineering Intake/Package with `idempotentReplay: true` and `noDuplicateArtifactsCreated: true`.
- Each stage awaits the previous stage. An exception stops the coordinator immediately; successfully persisted immutable stages remain available for the retry.
- Draft IOF save and Engineering submit independently revalidate exact revision/hash eligibility on the server.

## Readiness UI

The live card now displays independent rows for Proposal Revision, Customer Approval, Commercial Revision, Release Package, Draft IOF Package, and Engineering Handoff. It distinguishes `NOT CREATED` from `BLOCKED`, offers an eligible-revision selector, exposes the primary Release action, and retains the detailed repository IDs/checks elsewhere in the Commercial view.

## Real-browser result

Microsoft Edge against `http://127.0.0.1:5173` loaded Account 1 / Google and the current DFW opportunity. The repaired card rendered as **Commercial Release Readiness** with **Release to Engineering**. It accurately reported:

- Proposal Revision: BLOCKED — save and select an immutable revision
- Customer Approval: BLOCKED — exact selected revision/hash approval required
- Commercial Revision: BLOCKED for the selected exact revision
- Release Package: NOT CREATED for the selected exact revision
- Draft IOF: BLOCKED until Release Package
- Engineering Handoff: BLOCKED until Draft IOF save

No release was invoked because the real record has zero eligible saved Proposal Revisions. Creating an approval or retroactively assigning a hash would fabricate constitutional authority and violate CIP-045A. After reload, the application correctly returned to the account-neutral screen (the existing no-customer-until-selected policy); the automated attempt to reselect and restore the large Google workspace did not complete the readiness-card rehydration within 90 seconds. Repository inspection and the pre-reload live view both showed the same legacy identities. No duplicate artifacts were created.

## Validation and regression

- CIP-045A focused: `58/58` passed
- CIP-045: `84/84` passed
- CIP-035A: passed
- CIP-041: `30/30` passed
- CIP-044A.2: `30/30` passed; ten-run fixture median `0.195 ms`, p95/max `2.667 ms`; structural assembly/geometry/station/map/Engineering/repository writes remained zero
- CIP-044A.3: `25/25` passed
- TypeScript: passed
- Production build: passed (existing large-chunk advisory only)
- `git diff --check`: passed
- CIP-029 Commercial Engineering Handoff: one stale literal-order assertion failed because it expects the direct Draft IOF save call to precede the newer CIP-035A lifecycle helper; all other checks passed. The governed sequence was not weakened to satisfy it.

## Final chain

For the currently selected real record, an eligible exact chain was deliberately not fabricated:

Proposal Revision:
`NOT CREATED — legacy record must first be saved as a CIP-045 immutable revision`

Proposal Hash:
`NOT CREATED`

Commercial Revision:
`NOT CREATED FOR AN EXACT PROPOSAL REVISION` (historical legacy ID: `COMM-REV-OPP-GOOGLE-DFW-ROUTE-36OBJ-1783608785224-V1`)

Commercial Release Package:
`NOT CREATED FOR AN EXACT PROPOSAL REVISION` (historical legacy packages retained)

Draft IOF Package:
`NOT CREATED FOR AN EXACT PROPOSAL REVISION` (historical legacy ID retained)

Engineering Intake:
`NOT SUBMITTED`

The repaired implementation is ready to traverse the full sequence as soon as a real saved Proposal Revision receives exact revision/hash customer approval. No Engineering certification, Service Order, ScopeVersion, deployment, DAL1 push, or `app.teralinx.net` change was made.
