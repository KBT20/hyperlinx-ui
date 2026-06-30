# Sprint 13.5 - IOF Package Assembly Experience

Status: Implemented and validated  
Commit: Not created

## Implemented

- IOF Package Dashboard inside Commercial Planning
- Package Explorer for summary, inventory, customer design, geometry, objects, relationships, evidence, notes, history, and validation
- True IOF Package Manifest
- Proposed IOF Unit review fields
- Assembly Graph
- Readiness and validation model
- Package differences model
- Engineering assignment action
- Return to Commercial action
- Authenticated runtime endpoints for package manifest, graph, readiness, and differences
- Google 29M package assembly validation harness

## Explicit Non-Goals Preserved

The Sprint 13.5 flow does not create:

- Marketplace
- Contracts
- SOF
- SOW
- ScopeVersion during draft assembly

ScopeVersion remains gated by Engineering Certification from Sprint 13.4.

## Validation

Commands run:

```bash
node iof-package-experience-validation.mjs
node iof-assembly-validation.mjs
node engineering-certification-validation.mjs
npx tsc --noEmit -p tsconfig.json
npm run build
```

Result:

- 28 assertions passed
- Google 29M Proposal assembled into Draft IOF Package
- 3 Proposed IOF Units created from Runtime Object references
- Manifest generated with runtime object, relationship, inventory, geometry, evidence, document, assumption, customer request, and engineering requirement sections
- Dependency Graph generated
- Readiness score: 91
- Package assignment persisted
- Draft IOF Package reopened after a simulated runtime restart
- No ScopeVersion created during draft assembly
- Sprint 13.4 IOF assembly regression: 11 assertions passed
- Engineering Certification regression: 48 assertions passed
- TypeScript: passed
- Build: passed with the existing Vite large chunk warning

## Runtime Outcome

Commercial and Engineering now share a governed package spine:

1. Proposal
2. Runtime Objects
3. Relationships
4. Proposed IOF Units
5. Evidence
6. Geometry
7. Draft IOF Package
8. Engineering Review Queue

This completes the visible package assembly experience without advancing into Marketplace, Contracts, SOF, or SOW.
