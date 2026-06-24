# Preliminary Quote Validation

Phase: 6.8J

## Google Quote

Fixture:

- Google Texas AI Expansion

Expected:

- Recommended AI corridor products display.
- NRC, MRC, term, and TCV display.
- Scope Review / Prism blockers affect readiness.

## Carrier Quote

Fixture:

- Carrier Long Haul

Expected:

- Dark Fiber, Wavelength, and Long Haul products display.
- Long term advisory commercial values display.

## AI Corridor Quote

Fixtures:

- Google Texas AI Expansion
- Oracle GPU Expansion
- AI Corridor Diverse

Expected:

- AI Interconnect, Data Center Interconnect, GPU Facility, Power Infrastructure, and Long Haul products display where applicable.

## Metro Quote

Fixture:

- Metro Ring

Expected:

- Metro Access, Ethernet, and Managed Infrastructure products display.

## Blocked Quote

Fixture:

- Blocked Example

Expected:

- Readiness displays `BLOCKED`.
- Blockers appear in diagnostics.
- No customer discussion readiness.

## Ready For Customer Discussion Quote

Fixture:

- Ready For Customer Discussion Example

Expected:

- Readiness displays `QUOTE_GENERATED`.
- Next action displays `READY_FOR_CUSTOMER_DISCUSSION`.
- Quote remains advisory and non-contractual.

## Ryan Workflow

Ryan can open Preliminary Quote, select a fixture opportunity, inspect products, commercial values, assumptions, risks, confidence, and customer-discussion readiness without creating authority.

## Required Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```

## Boundary Validation

- No contract.
- No budget lock.
- No SOF.
- No persistence.
- No server routes.
- No authority creation.
- No Chicago/root production modifications.
