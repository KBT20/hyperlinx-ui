# Runtime Object Doctrine

## Purpose

Runtime objects are the shared identity layer for Teralinx infrastructure work. Route, Segment, Handhole, Conduit, Pole, POP, ILA, Crossing, Customer Site, Data Center, and future infrastructure entities must be represented as runtime objects before downstream lifecycle systems consume them.

## Runtime Object Requirements

Every runtime object has:

- Runtime ID
- Object type
- Version
- Authority
- Evidence reference
- Relationships
- Created timestamp
- Updated timestamp
- Metadata

## Identity

Runtime IDs are stable identifiers created by the runtime translation layer. They are not React keys, file names, map feature IDs, browser cache IDs, or human labels.

## Relationship Rule

Objects do not imply topology by nesting inside files. Topology is expressed by explicit relationship records:

- Route contains Segment
- Segment terminates at Handhole
- Customer Site is snapped to Route
- Inventory contains Runtime Object
- Runtime Object is evidenced by Evidence

## Versioning

Object versions advance when a runtime object is materially changed. Draft views may compare versions, but may not overwrite prior versions or erase history.

## Authority

Runtime objects may carry evidence authority, commercial review authority, engineering review authority, carrier evidence authority, or Teralinx runtime authority. ScopeVersion, Certified Route, Twin, Marketplace, Control, Field, and Operational Intelligence retain their own authority boundaries.

## Evidence Reference

Every runtime object must be traceable to at least one evidence record unless explicitly created by a documented platform operation that records its own history event.

## Current Implementation

Sprint 11 introduces runtime object APIs and customer design translation into runtime objects. It does not convert ScopeVersion doctrine, Twin authority, Marketplace, Control, Field, or Operational Intelligence.
