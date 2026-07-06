# ASSEMBLY_SCHEDULER

Date: 2026-07-03

## Purpose

The Assembly Scheduler compares input hashes, decides whether to reuse cache, executes required engines, updates revisions, and preserves lineage.

## Execution Rule

Assembly executes only when constitutional inputs change. Normal React rendering must not execute assembly engines directly.

## Current Scheduler Facades

- Product Doctrine Assembly
- Draft IOF Package Assembly
- Engineering Projection
- Map Layer Projection

Each facade calls the Constitutional Runtime Kernel.

