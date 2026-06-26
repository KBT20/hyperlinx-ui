# OSP Segment Pricing Model

Phase: 7.4D

## Purpose

OSP Segment Pricing prices a route segment from takeoff quantities and explicit development-seed rates.

## Segment Fields

Each segment supports:

- segment name
- A location
- Z location
- route miles
- route feet
- bore percentage
- plow percentage
- bore feet
- plow feet
- itemized line items
- segment subtotal
- explicit contingency
- segment total
- cost per foot
- cost per mile

## Implemented Line Items

| Line Item | Source |
| --- | --- |
| Plow labor | Route feet less bore feet |
| Bore labor | Route feet x bore percentage |
| Rock adder | Bore feet x rock percentage |
| Bridge / waterway bore allowance | Water + bridge crossing counts |
| Conduit material | CorridorTakeoff.ductFeet |
| Innerduct / FuturePath | CorridorTakeoff.ductFeet |
| Fiber material | CorridorTakeoff.fiberFeet |
| Fiber blowing / pulling labor | CorridorTakeoff.fiberFeet |
| Handhole labor | CorridorTakeoff.handholeCount or spacing fallback |
| Handhole material | CorridorTakeoff.handholeCount or spacing fallback |
| Vault allowance | CorridorTakeoff.vaultCount |
| Splice cases | CorridorTakeoff.splicePointCount |
| Splicing labor | CorridorTakeoff.splicePointCount |
| Engineering / permitting | CorridorTakeoff.routeFeet |
| Project management | Explicit percentage, visible line item |
| Contingency | Explicit percentage applied to segment subtotal |

## Development Seed Rates

Reference-derived development rates include:

- Plow labor: `$5 / ft`
- Bore labor: `$11 / ft`
- Rock adder: `$45 / ft`
- Engineering / permitting: `$0.75 / ft`
- Contingency: `7.5%`, applied to segment subtotal
- Handhole spacing: `1 per 2,500 ft`
- Handhole labor: `$315 each`
- Handhole material: `$900 each`
- Splice case: `$850 each`

All rates require commercial review before production use.

