# CIP-036 Kernel Reasoning Service Report

Date: 2026-07-09

## Objective

Move advisory AI reasoning availability from workspace-owned probing into a StellaOS Kernel service.

Reasoning is now a cached kernel capability. Workspaces no longer own model discovery or `/v1/models` probes.

## Root Problem

Before CIP-036, workspace and dashboard initialization could call the reasoning registry, which probed external endpoints such as:

`GET /v1/models`

That meant navigation could repeatedly rediscover models and repeat timeouts when the endpoint was offline.

## Kernel Service

Created:

`src/kernel/ReasoningServiceManager.ts`

Kernel authority:

`STELLAOS_KERNEL_REASONING_SERVICE_MANAGER`

The manager owns:

- endpoint provider configuration
- startup probe
- cached health state
- model cache
- endpoint capabilities
- circuit breaker
- developer-mode disable switch
- cached status subscriptions

## Endpoint State

The Reasoning Service state machine supports:

- `STARTING`
- `ONLINE`
- `DEGRADED`
- `OFFLINE`

Each endpoint records:

- last successful probe
- last failure
- retry after
- latency
- available models
- default model
- embedding model
- reasoning model
- endpoint version
- circuit breaker state

## Circuit Breaker

Failed probes open the circuit breaker.

Backoff sequence:

- 60 seconds
- 120 seconds
- 300 seconds
- 600 seconds

When the circuit is open, the manager returns cached diagnostics and does not immediately reprobe.

The log is reduced to one kernel message per open circuit:

`Reasoning endpoint unavailable. Circuit breaker opened. Retry in N seconds.`

## Model Cache

Model discovery is cached in the kernel state:

- available models
- default model
- embedding model
- reasoning model
- endpoint capabilities

Workspaces consume cached state and do not rediscover models on navigation.

## Provider Configuration

The kernel now models configurable reasoning providers:

1. Local Mistral (Primary)
2. OpenAI
3. Anthropic
4. Ollama
5. Disabled

Existing environment variables continue to feed the provider list.

## Developer Mode

Added:

`VITE_DAL_REASONING_ENABLED=false`

Runtime toggle:

`stellaos.reasoningEnabled`

When disabled, no endpoint probes occur and the kernel reports reasoning as disabled.

## UI Integration

Added a kernel diagnostics panel:

`Reasoning Status`

It displays:

- endpoint
- online state
- latency
- models
- last successful probe
- retry countdown
- circuit breaker state

The existing Reasoning Health Dashboard now subscribes to cached kernel state. Its refresh action asks the kernel manager to refresh and respects the circuit breaker.

## Compatibility

`src/api/reasoningRegistry.ts` is now a compatibility facade over `ReasoningServiceManager`.

Existing reasoning client imports continue to work, but endpoint probing and model discovery are kernel-owned.

## Unchanged Areas

CIP-036 does not change:

- Product Doctrine
- Commercial
- Engineering
- ScopeVersion
- Marketplace
- Control
- Field
- Twin
- Operational Intelligence domain logic

Only reasoning infrastructure changed.

## Files Modified

- `src/kernel/ReasoningServiceManager.ts`
- `src/api/reasoningRegistry.ts`
- `src/api/dalConnectivity.ts`
- `src/api/reasoningClient.ts`
- `src/config/dalApi.ts`
- `src/runtime/ConstitutionalRuntimeKernel.ts`
- `src/components/ReasoningHealthDashboard.tsx`
- `src/components/KernelReasoningStatusPanel.tsx`
- `src/components/RuntimeDiagnosticsPanel.tsx`
- `src/dal/DALApp.tsx`
- `src/workspaces/InventoryRecoveryWorkspace.tsx`
- `cip036-kernel-reasoning-service-validation.mjs`
- `CIP_036_KERNEL_REASONING_SERVICE_REPORT.md`

## Validation Results

Validation script:

`node cip036-kernel-reasoning-service-validation.mjs`

Result:

`PASS`

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Production build:

`npm run build`

Result:

`PASS`

Diff whitespace:

`git diff --check`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
