# RUNTIME_DIAGNOSTICS_GUIDE

Date: 2026-07-03

## Purpose

Runtime Diagnostics exposes whether constitutional artifacts are being reused or regenerated.

## Counters

- React renders
- Assembly executions
- Cache hits
- Cache misses
- Projection executions
- Object instantiation executions
- Engineering projection executions
- Map rebuilds
- Operational Intelligence executions
- Runtime serialization count

## UI

The DAL shell includes a Runtime Diagnostics panel under the active workspace. It displays cache hit rate, cache entry count, assembly executions, projection executions, engineering projection executions, map rebuilds, cache hits, and cache misses.

## Debug Logs

Runtime debug logs are disabled by default. Enable them with:

- `VITE_DAL_RUNTIME_DEBUG=1`
- or local storage key `hyperlinx:debug:runtime` set to `1`

## Interpretation

When inputs remain unchanged, cache hits should increase while assembly and projection execution counters remain stable. Map rebuilds should increase only when map source identity, source revision, layer visibility, station label settings, or primitive inputs change.

