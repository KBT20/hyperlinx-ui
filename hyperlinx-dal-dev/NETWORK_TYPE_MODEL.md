# Network Type Model

Phase: 6.8C

Network type describes the customer's intended class of network before engineering review.

## Supported Types

- `METRO`: metro aggregation, enterprise access, interconnection, carrier hotel proximity.
- `MIDDLE_MILE`: regional aggregation, POP-to-POP, metro-to-regional transport.
- `LONG_HAUL`: intercity backbone, optical reach, ADM and regen review.
- `AI_CORRIDOR`: AI, GPU, data center, power-adjacent, hyperscaler expansion corridor.
- `DATA_CENTER_INTERCONNECT`: facility-to-facility or campus-to-carrier-hotel interconnect.
- `ENTERPRISE_ACCESS`: customer building, campus, or enterprise lateral access.
- `WIRELESS_BACKHAUL`: wireless site to aggregation network.
- `CUSTOM`: human-defined intent that requires explicit review.

Network type is advisory. It selects a reference architecture candidate; it does not authorize design or execution.
