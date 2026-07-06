# RUNTIME_DIAGNOSTICS

Date: 2026-07-03

## Purpose

Runtime Diagnostics proves that artifacts are reused and shows where constitutional work still occurs.

## Counters

- assembly executions
- cache hits
- cache misses
- projection executions
- revision changes
- artifact generation duration
- render count
- map rebuild count
- engineering projection count

## Debug Logs

Runtime logging is quiet by default. Debug categories are enabled through `VITE_DAL_RUNTIME_DEBUG=1` or local storage key `hyperlinx:debug:runtime`.

