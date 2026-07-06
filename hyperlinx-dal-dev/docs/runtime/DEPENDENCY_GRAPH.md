# DEPENDENCY_GRAPH

Date: 2026-07-03

## Purpose

The Runtime Dependency Graph records artifact relationships and determines invalidation order.

## Current Chain

```text
Product Doctrine
  -> Commercial Audit
  -> Audit Object Manifest
  -> Draft IOF Package
  -> Object Addressing
  -> Production Doctrine
  -> Instantiation
  -> Kernel Execution Graph
  -> Engineering Projection
```

## Invalidation

When an upstream artifact changes, the graph resolves the upstream artifact first and then dependent artifacts in dependency order.

