# Preliminary Quote Assumption Model

Phase: 6.8J

## Assumption Categories

- `NETWORK`
- `MARKETPLACE`
- `ENGINEERING`
- `COMMERCIAL`
- `RISK`
- `CUSTOMER`

## Assumption Fields

Each assumption includes:

- `assumptionId`
- `category`
- `statement`
- `confidence`
- `evidenceIds`
- `requiresValidation`
- `advisoryOnly`

## Required Assumptions

The quote workspace always includes assumptions that:

- Engineering validation is required.
- Marketplace inputs are fixture-based and not commitments.
- NRC, MRC, term, and TCV are preliminary commercial recommendation values.

## Boundary

Assumptions do not create contracts, budget locks, or execution authority.
