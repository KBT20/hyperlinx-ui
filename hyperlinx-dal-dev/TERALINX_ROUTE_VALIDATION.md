# Teralinx Route Validation

Phase: 6.9A

## Validation Checks

The route intake engine checks:

- Missing Customer
- Missing Opportunity
- Missing Site
- Invalid Address
- Duplicate Site
- No Network Intent

## Ready Example

Fixture:

- Google Texas AI Route

Expected:

- Customer complete
- Opportunity complete
- A Site and Z Site present
- Network intent selected
- Readiness: `READY_FOR_DESIGN`

## Blocked Example

Fixture:

- `TLX-ROUTE-BLOCKED`

Expected:

- Missing customer blockers
- Missing opportunity blockers
- Missing site/location blockers
- No network intent blocker
- Readiness: `BLOCKED`

## UI Validation

The workspace displays:

- Customer
- Opportunity
- Network Type
- Protection
- Products
- Site Count
- Estimated Miles placeholder
- Ready for Design
- Blockers
- Collapsible diagnostics
- Placeholder action buttons

## Required Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```

## Boundary Validation

- No routing.
- No geometry.
- No ScopeVersion creation.
- No inventory mutation.
- No persistence.
- No APIs.
- No Chicago/root production changes.
