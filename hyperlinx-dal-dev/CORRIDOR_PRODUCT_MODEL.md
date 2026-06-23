# Corridor Product Model

Status: doctrine only.

## Commercial Context

Teralinx corridor products support hyperscalers, neoclouds, AI infrastructure operators, carriers, ISPs, enterprises, municipal customers, and utilities.

Primary commercial models:

- Duct: outright sale plus maintenance.
- Fiber: IRU.
- Transport: recurring service.
- Residual duct/fiber monetization: secondary but important.

No IaaS model is defined in this phase.

## Product Types

| Product | Commercial model | Notes |
| --- | --- | --- |
| DUCT_SALE | Sale | Requires duct count, duct size, owner, maintenance terms |
| DUCT_MAINTENANCE | Maintenance | Often attached to duct sale |
| DARK_FIBER_IRU | IRU | Requires fiber count, term, maintenance model |
| MANAGED_FIBER | Recurring or hybrid | Requires operating model |
| WAVE_SERVICE | Recurring | Requires optical system and service standards |
| ETHERNET_TRANSPORT | Recurring | Requires capacity, SLA, and handoff nodes |
| AI_INTERCONNECT | Recurring or hybrid | Requires high availability and low latency evidence |
| ROUTE_OPERATIONS | Maintenance or operations | Supports restoration and route operations |

## Infrastructure To Product Mapping

```text
ConduitSystem
  -> DUCT_SALE
  -> DUCT_MAINTENANCE

FiberSystem
  -> DARK_FIBER_IRU
  -> MANAGED_FIBER

OpticalSystem
  -> WAVE_SERVICE
  -> ETHERNET_TRANSPORT
  -> AI_INTERCONNECT

ServiceZone
  -> ROUTE_OPERATIONS
```

## Product Evidence

Each product should reference evidence for:

- capacity.
- availability target.
- SLA.
- term.
- NRC.
- MRC.
- route diversity.
- restoration SLA.
- maintenance requirement.

## Residual Capacity

Residual capacity is modeled separately from the primary customer requirement.

Residual monetization may include:

- ISP.
- WISP.
- wireless tower.
- enterprise.
- school.
- municipal.
- utility.
- data center.
- carrier.
- government.

Residual value must not override the customer design objective. It may influence route scoring only after required service, latency, diversity, and buildability constraints are satisfied.

## Product Readiness

A product is not quote-ready until it has:

- selected route candidate or ScopeVersion reference.
- infrastructure design.
- buildability assumptions.
- cost basis.
- commercial basis.
- evidence references.
- human review where required.

