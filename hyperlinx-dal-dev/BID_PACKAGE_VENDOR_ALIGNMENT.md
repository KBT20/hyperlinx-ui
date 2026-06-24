# Bid Package Vendor Alignment

Status: doctrine and contracts only.

## Purpose

Vendor alignment identifies vendors that may be relevant to a Bid Package based on category and capability.

This phase does not invite vendors, collect responses, award work, or create contracts.

## Alignment Helpers

Read-only helpers include:

- `generateBidPackages()`.
- `generateSegmentPackage()`.
- `generateStationGroupPackage()`.
- `generateDisciplinePackage()`.
- `generateCategoryPackage()`.
- `generateHybridPackage()`.
- `matchVendorCategories()`.
- `matchCapabilities()`.

## Matching Inputs

Vendor matching may consider:

- package type.
- required item capabilities.
- vendor category.
- vendor capability references.

## Matching Boundary

Vendor matching is advisory.

Matched vendors are not:

- invited.
- awarded.
- contracted.
- approved.
- assigned work.

## Diagnostics

Supported diagnostics:

- `BID_PACKAGE_CREATED`.
- `BID_PACKAGE_ITEM_CREATED`.
- `BID_PACKAGE_STATION_LINKED`.
- `BID_PACKAGE_SEGMENT_LINKED`.
- `BID_PACKAGE_VENDOR_MATCHED`.
- `BID_PACKAGE_VALIDATED`.

Diagnostics are development evidence only.

