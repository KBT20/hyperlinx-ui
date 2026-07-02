# SPRINT 20B - Engineering Intake Report

## Objective

Sprint 20B completes the Commercial to Engineering transition for Draft IOF Packages.

Commercial now assembles and reviews the Draft IOF Package, then submits the same package object to Engineering Intake. Engineering accepts custody, opens the package into the Engineering Certification twin, and certification produces a Certified IOF Package only.

## Implemented

- Added Commercial Review panel with Customer, Proposal, Product, Doctrine, Revision, Validation, Commercial Readiness, Engineering Readiness, Completeness, and Estimated Confidence.
- Replaced visible Commercial-side engineering queue/certification controls with Commercial-only actions: Save Draft, Validate, Preview Package, Submit to Engineering.
- Added Commercial submit endpoint:
  - Locks the commercial revision.
  - Persists the same Draft IOF Package with `SUBMITTED_TO_ENGINEERING`.
  - Creates an Engineering Intake record keyed to the same package id.
  - Prevents locked commercial revisions from being saved back to `DRAFT`.
- Added Engineering Intake storage under `server/data/engineering-intakes`.
- Updated Engineering queue to load only packages with `SUBMITTED_TO_ENGINEERING`.
- Updated Engineering package open flow to transition status to `UNDER_ENGINEERING_REVIEW`.
- Updated Engineering Certification workspace:
  - No auto-open of first queued package.
  - Start screen shows Packages Awaiting Review cards.
  - Active package header shows Package, Customer, Revision, Authority, Engineering Status, and Doctrine.
  - Certification messaging now confirms ScopeVersion is not created.
- Updated certification server handler:
  - Persists Certified IOF Package.
  - Stores certification date, engineer, doctrine status, constraint summary, approved exceptions, redline history, engineering manifest, notes, readiness, certified id, and status `CERTIFIED`.
  - Updates Engineering Intake status to `CERTIFIED`.
  - Does not create ScopeVersion, Service Order, Marketplace, Control, Field, Twin, Payments, or Customer Workspace artifacts.

## Validation

- `npx tsc --noEmit`
- `node sprint20b-engineering-intake-validation.mjs`
- `npm run build`

## Boundary

ScopeVersion generation remains available only as a separate future/manual certified-package action. Sprint 20B certification itself stops at Certified IOF Package.
