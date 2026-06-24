# Translate Doctrine

Translate ingests and normalizes evidence.

Translate creates evidence bundles and may now create non-authoritative Baseline Network Candidates through intent-driven architecture selection.

Translate does not create truth.

Translate does not create ScopeVersions.

Translate does not promote work.

Translate does not own customer creation.

Translate does not own opportunity creation.

Translate is launched from Opportunity.

Translate may be launched from Opportunity Detail.

Translate Workspace is the first executable workspace after Opportunity Detail.

## Flow

```text
Customer
  -> Opportunity
  -> Opportunity Detail
  -> Opportunity Launch
  -> Translate Workspace
  -> Baseline Network
  -> Intent Selection
  -> Architecture Selection
  -> Baseline Network Synthesis
  -> Scope Review
  -> Prism
```

Customer-supplied routes, KMZs, KMLs, GeoJSON, CSVs, and other normalized evidence are preserved as source evidence. Generated baseline candidates never overwrite customer evidence.

Translate Workspace produces Scope Review readiness. It does not approve, engineer, route, persist, or create ScopeVersions.
