# CIP-044A.1 — Local Runtime Rehydration 500 Repair

## Captured exception and root cause

Before changing source, the configured local API target was probed at `127.0.0.1:3001`. The actual exception was:

```text
TypeError: fetch failed
cause: Error: connect ECONNREFUSED 127.0.0.1:3001
code: ECONNREFUSED
syscall: connect
address: 127.0.0.1
port: 3001
```

Vite proxies `/api` to port 3001. `npm run dev` previously launched only Vite, so an absent runtime process converted the failed upstream connections into HTTP 500 responses. Current Session rehydration, Customer Twin inventories/objects, and Proposal Runtime Library failed together because they share that proxy target—not because their repositories were corrupt.

## Repository evidence

A fresh local runtime process loaded the existing repositories without clearing, rewriting, regenerating, or migrating them. Exact governed requests returned 200 for Kyle, Ryan, Fran, and Google. Kyle's existing records returned:

- Runtime rehydration: 1,116,841 bytes
- Runtime inventories: 174,259 bytes
- Runtime objects: approximately 19.4 MB
- Proposal Runtime Library: 656,474 bytes

Concurrent repetitions also returned 200. Therefore no persisted-record normalization or backward-compatible migration was required.

## Repair

`npm run dev` now uses `scripts/local-dev.mjs`. The launcher:

1. Checks the configured local runtime `/health` endpoint.
2. Reuses an already healthy compatible runtime.
3. Otherwise starts `server/index.js` on the proxy target's local port.
4. Waits for confirmed runtime health before starting Vite.
5. Stops owned child processes together and surfaces unexpected runtime exit.
6. Refuses to synthesize a local server for a configured non-local API target.

`npm run dev:ui` retains the UI-only command for deliberate advanced use.

## Constitutional and performance preservation

No runtime engine, repository contract, persisted record, cache implementation, projection scheduler, authority gate, or commercial calculation was changed. The CIP-044A civil dependency registry remains:

```text
QUANTITY → ESTIMATE → COMMERCIAL_FINANCIALS → PROPOSAL
```

Geometry, stationing, map, Engineering, Product Doctrine, and structural Draft IOF remain preserved for a civil-mix edit. The existing CIP-044A validator is rerun as part of verification to retain the current 12-mile fast-path envelope.

No deployment, DAL1 access, production modification, persistence migration, or repository clearing occurred.
