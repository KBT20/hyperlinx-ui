# PROJECTION_CACHE

Date: 2026-07-03

## Purpose

The Projection Cache prevents constitutional artifacts from regenerating when their inputs have not changed.

## Cached Artifacts

- Product Doctrine
- Audit Projection
- Object Manifest
- Draft IOF Package
- PD-002A Address Projection
- Spine Object Catalog
- PD-003 Production Projection
- Spine Object Instantiation
- Kernel Execution Graph
- Engineering Projection
- Revenue Projection
- Map Projection

## Cache Key

The cache key includes artifact identity, input hash, doctrine versions, dependency identities, and produced-from references.

## Behavior

Unchanged inputs return a cache hit and preserve revision. Changed inputs create a cache miss and increment revision.

