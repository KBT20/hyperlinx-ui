# Corridor Synthesis Inputs

Status: doctrine only.

## Supported Inputs

Corridor Synthesis must support:

- Endpoint Pair.
- Customer Route.
- KML.
- KMZ.
- GeoJSON.
- Shapefile.
- Corridor Concept.
- Existing Fiber Route.
- Existing Conduit Route.

Inputs may be mixed.

## Input Examples

### Endpoint Pair Only

```text
A endpoint
Z endpoint
Requirement
Normalized endpoint evidence
```

The synthesis engine may request provider-generated route candidates in a future phase. No route is authoritative.

### Customer Route Plus Endpoints

```text
A endpoint
Z endpoint
Customer route geometry
Requirement
```

The customer route must be preserved exactly as evidence. Generated alternatives may be added but may not replace it.

### Customer Route Plus KML

```text
Customer route
Engineer reference KML
Endpoint evidence
Requirement evidence
```

Conflicting geometry remains evidence and requires human review.

### Existing Fiber Route Plus Desired Diversity

```text
Existing fiber route evidence
Endpoint pair
Diversity requirement
```

The existing fiber route is a reference input. A diverse candidate must preserve evidence about shared ROW, road, structures, crossings, jurisdictions, and utilities.

## Required Input Properties

Every synthesis input should preserve:

- input ID.
- input type.
- evidence IDs.
- source name.
- raw reference when available.
- normalized geometry reference when available.

## Classification Inputs

Synthesis inputs may include classification context:

- A MSA.
- Z MSA.
- same-MSA flag.
- endpoint role.
- network role hint.
- corridor class hint.
- aggregation point IDs.
- customer intent.
- product intent.

Classification context is evidence for candidate generation. It is not route authority.

## Mixed Input Rule

When multiple inputs disagree, synthesis may create multiple candidates or conflicts. It may not discard either input.
