# Preliminary Quote Validation

This validation confirms that preliminary quotes and opportunity packages can be created as advisory commercial artifacts.

Fixtures live in:

`src/commercial/fixtures/preliminaryQuoteFixtures.ts`

## Fixture Scenarios

1. Dallas to Kansas City Hyperscaler Long Haul
2. West Texas AI Expansion
3. Metro Data Center Interconnect
4. Duct Monetization Opportunity
5. Enterprise Access Opportunity
6. Dark Fiber IRU Opportunity

## Example Opportunity Package

An Opportunity Package contains:

- Customer Ask
- Lens
- Reference Architecture
- Recommended Products
- Object Plan
- Estimated Quantities
- Estimated NRC
- Estimated MRC
- Estimated IRU
- Commercial Assumptions
- Commercial Risks
- Confidence
- Engineering Review Required
- Marketplace Budget Required
- Status: PRELIMINARY

## Product Estimate Examples

Hyperscaler long haul may produce:

- AI_INTERCONNECT estimate
- NRC estimate
- MRC estimate
- power review risk
- engineering review requirement

Duct monetization may produce:

- DUCT_SALE estimate
- RESIDUAL_CAPACITY estimate
- spare duct assumptions
- budget-not-established risk

Dark fiber IRU may produce:

- DARK_FIBER_IRU estimate
- ROUTE_OPERATIONS estimate
- strand reservation assumptions
- Route Engineering review requirement

## Confidence Examples

HIGH confidence requires:

- strong architecture fit
- strong evidence confidence
- design standard context
- no major missing object/tool evidence

LOW confidence may result from:

- missing architecture fit
- missing tool evidence
- missing object evidence
- unresolved review blockers

## Estimate Vs Budget

Preliminary Quote:

- advisory
- assumption-based
- no budget authority
- no contract authority
- no execution authority

Marketplace Budget:

- future process
- requires approved ScopeVersion
- converts estimate to budget
- may support commercial approval

## Future Boundary

Future Marketplace receives:

Approved ScopeVersion

and converts:

Estimate

to

Budget

Future SOF/Contract generation occurs only after:

- Engineering Approval
- Marketplace Budget Lock
- Commercial Approval

## Remaining Risks

- No Marketplace integration exists.
- No SOF generation exists.
- No contract generation exists.
- No pricing API exists.
- No ScopeVersion creation exists.
- No budget authority exists.
