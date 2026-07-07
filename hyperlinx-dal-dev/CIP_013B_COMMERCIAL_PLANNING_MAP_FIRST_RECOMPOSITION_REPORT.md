# CIP-013B Commercial Planning Map-First Recomposition Report

Date: 2026-07-06

## Scope

This change is a UI decomposition only. It does not change constitutional authority, ScopeVersion behavior, lifecycle promotion, graph logic, pricing engines, routing engines, doctrine engines, engineering engines, runtime persistence, or APIs.

## Moved

- Moved the Commercial Planning map shell to the first workspace position after the commercial header and opportunity notice through workspace ordering.
- Moved live commercial economics into the map right rail as the primary Estimate sidebar.
- Moved proposal readiness into a compact Proposal Progress rail with Draft, Submitted, Customer Review, Approved, IOF Package, and Engineering states.
- Moved Customer Twin load health into the map workspace so failed or pending Twin loads are visible beside the route.

## Collapsed

- Collapsed Account / Customer Twin context into a compact drawer.
- Collapsed Existing Inventory import into a compact drawer.
- Collapsed Customer Design Request import into a compact drawer.

## Removed From The Commercial Planning Surface

- Removed the rendered Runtime Lifecycle Bridge path from Commercial Planning.
- Removed the rendered Workspace Summary / Assigned Work / Notifications / Executive Overview dashboard path.
- Hid the old landing/admin summary so Commercial Planning opens on the route, not environment metadata.
- Replaced visible runtime implementation labels with business labels such as Commercial Proposal, Current Session, References, Customer Twin, and Proposal Library.

## Preserved

- Preserved the existing ProposedNetworkMapPanel and all map props.
- Preserved pricing, route, graph, Customer Twin, proposal, Draft IOF Package, and engineering API calls.
- Preserved Draft IOF Package and Commercial Review behavior.
- Preserved Customer Review and Sales + Sales Engineering collaboration controls in the map rail.

## Bug Fixes

- Opening an opportunity now refreshes Customer Twin inventory, including same-account opportunities.
- Customer Twin failures are surfaced as explicit warnings instead of silently continuing.
- Duplicate React keys were removed from text-keyed lists and financial warning lists by using stable contextual keys.
- Runtime lifecycle and dashboard crash surfaces were removed from the rendered Commercial Planning path.

## Result

Commercial Planning now opens around the four commercial questions:

- What is being built? The map.
- What will it cost? The estimate sidebar.
- What will we sell it for? Revenue, monthly revenue, lifecycle value, and margin.
- Is it ready for customer review? Proposal Progress and Proposal Status.
