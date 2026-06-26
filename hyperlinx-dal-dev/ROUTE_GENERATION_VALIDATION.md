# Route Generation Validation

## Google Texas AI Route

Expected:

- RouteCandidate generated from Dallas A Site to Temple Z Site.
- Long-haul doctrine applied.
- Route statistics include mileage, fiber feet, duct feet, vault estimates, regen estimates, and estimated crossings.
- Constraints are marked estimated and pending Route Engineering verification.

## Austin Metro Access

Expected:

- RouteCandidate generated from Austin POP to customer site.
- Metro doctrine applied.
- Urban segments and possible bridge/highway constraints may be estimated.
- No ScopeVersion or inventory graph is created.

## Carrier Middle Mile

Expected:

- RouteCandidate generated from Wichita Falls to Lawton.
- Middle-mile doctrine applied.
- Path-protected behavior is represented as doctrine metadata, not as geographic diversity.

## Sales Disclaimer

The UI must show:

Route generated using deterministic design doctrine. Crossings, constraints, and infrastructure quantities are estimated. Final route geometry, permitting requirements, and construction quantities will be established during Route Engineering.

## Non-Goals

No engineering certification, authoritative GIS lookup, OSRM, path optimization, persistence, APIs, ScopeVersion creation, inventory mutation, or execution workflow is introduced.
