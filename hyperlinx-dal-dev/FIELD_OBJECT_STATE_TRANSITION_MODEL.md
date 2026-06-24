# Field Object State Transition Model

Status: doctrine only.

## Object State Path

```text
Object
  -> Assigned
  -> In Progress
  -> Ready To Close
  -> Closed
```

## Station State Path

```text
Station
  -> Assigned
  -> In Progress
  -> Ready To Close
  -> Closed
```

## Segment State Path

```text
Segment
  -> Assigned
  -> In Progress
  -> Ready To Close
  -> Closed
```

## Authority Boundary

Object, station, and segment closure remains advisory until validated.

Validated Field closure provides evidence for future Completion Authority.

No object, station, or segment truth mutates directly from Field UI state.

