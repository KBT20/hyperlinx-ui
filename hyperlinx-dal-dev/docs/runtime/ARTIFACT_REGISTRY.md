# ARTIFACT_REGISTRY

Date: 2026-07-03

## Purpose

The Artifact Registry records every created constitutional artifact as a runtime object with immutable identity and mutable revisions.

## Record Fields

- artifact id
- artifact type
- revision
- input hash
- timestamp
- producer
- dependencies
- produced from
- doctrine versions
- generation duration
- cache status
- validation status

## Identity Rule

Artifact IDs are immutable. Revisions increment when inputs change. Cache hits do not create a new revision.

