# Opportunity UI Navigation Model

Phase: 6.8H

## Navigation Addition

The DAL sidebar includes a new development item:

- Opportunity

Existing DAL lenses remain intact.

## Routing Boundary

The workspace is mounted through the existing DAL state outlet. No router, server route, URL route, or persistence route is added.

## Navigation Order

Opportunity appears before Translate because it is the business development cockpit that launches subordinate workflows.

## Future Path

Future phases may connect this navigation item to live DAL data through a read-only adapter first. Direct production cutover remains out of scope.
