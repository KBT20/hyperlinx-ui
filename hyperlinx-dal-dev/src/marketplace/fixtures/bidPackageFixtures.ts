import type { BidPackage } from "../BidPackage";
import {
  alignBidPackageVendors,
  estimateBidPackageTotal,
  generateBidPackages,
  generateCategoryPackage,
  generateDisciplinePackage,
  generateHybridPackage,
  generateSegmentPackage,
  generateStationGroupPackage,
} from "../BidPackage";
import type { BidPackageItem, BidPackageItemCategory } from "../BidPackageItem";
import type {
  BidPackageObjectDomain,
  BidPackageObjectReference,
  BidPackageSegmentReference,
  BidPackageStationReference,
} from "../BidPackageStationAllocation";
import type { BidPackageQuantityUnit } from "../BidPackageQuantity";
import { vendorProfiles } from "./vendorRegistryFixtures";

const scopeVersionId = "SV-DAL-DKC-EXAMPLE";
const corridorId = "CORRIDOR-DALLAS-KANSAS-CITY";

function station(stationId: string, stationLabel: string, measureFeet: number): BidPackageStationReference {
  return {
    stationId,
    stationLabel,
    routeId: "ROUTE-DKC-001",
    scopeVersionId,
    measureFeet,
  };
}

function segment(segmentId: string, segmentName: string, startMeasureFeet: number, endMeasureFeet: number): BidPackageSegmentReference {
  return {
    segmentId,
    segmentName,
    routeId: "ROUTE-DKC-001",
    startMeasureFeet,
    endMeasureFeet,
  };
}

function objectReference(objectId: string, objectType: string, objectDomain: BidPackageObjectDomain): BidPackageObjectReference {
  return {
    objectId,
    objectType,
    objectDomain,
    scopeVersionId,
  };
}

function item(input: {
  itemId: string;
  itemName: string;
  itemCategory: BidPackageItemCategory;
  discipline: string;
  quantity: number;
  unit: BidPackageQuantityUnit;
  unitLabel: string;
  estimatedUnitCost?: number;
  objectReference: BidPackageObjectReference;
  stationReference: BidPackageStationReference;
  segmentReference: BidPackageSegmentReference;
  requiredCapabilityTypes: BidPackageItem["requiredCapabilityTypes"];
}): BidPackageItem {
  const estimatedTotal = input.estimatedUnitCost === undefined ? undefined : input.quantity * input.estimatedUnitCost;
  return {
    itemId: input.itemId,
    itemName: input.itemName,
    itemCategory: input.itemCategory,
    discipline: input.discipline,
    requiredCapabilityTypes: input.requiredCapabilityTypes,
    quantity: {
      quantityId: `${input.itemId}-QTY`,
      quantity: input.quantity,
      unit: input.unit,
      unitLabel: input.unitLabel,
      estimatedUnitCost: input.estimatedUnitCost,
      estimatedTotal,
    },
    objectReference: input.objectReference,
    stationReference: input.stationReference,
    segmentReference: input.segmentReference,
    stationAllocations: [
      {
        allocationId: `${input.itemId}-STATION`,
        stationReference: input.stationReference,
        quantityShare: input.quantity,
        estimatedCostShare: estimatedTotal,
      },
    ],
    segmentAllocations: [
      {
        allocationId: `${input.itemId}-SEGMENT`,
        segmentReference: input.segmentReference,
        quantityShare: input.quantity,
        estimatedCostShare: estimatedTotal,
      },
    ],
    disciplineAllocations: [
      {
        allocationId: `${input.itemId}-DISCIPLINE`,
        discipline: input.discipline,
        quantityShare: input.quantity,
        estimatedCostShare: estimatedTotal,
      },
    ],
    categoryAllocations: [
      {
        allocationId: `${input.itemId}-CATEGORY`,
        category: input.itemCategory,
        quantityShare: input.quantity,
        estimatedCostShare: estimatedTotal,
      },
    ],
  };
}

const mp0 = station("STA-MP000", "MP0", 0);
const mp50 = station("STA-MP050", "MP50", 264000);
const station100 = station("STA-0100", "100+00", 10000);
const station150 = station("STA-0150", "150+00", 15000);
const dallasSegment = segment("SEG-MP0-MP50", "MP0-MP50", 0, 264000);
const stationGroupSegment = segment("SEG-STATION-100-150", "Stations 100-150", 10000, 15000);
const metroSegment = segment("SEG-METRO-AGGREGATION", "Metro Aggregation", 0, 52000);

const conduitFeet = item({
  itemId: "BPI-CONDUIT-FEET",
  itemName: "Conduit Placement",
  itemCategory: "CONDUIT",
  discipline: "Civil",
  quantity: 264000,
  unit: "FEET",
  unitLabel: "Conduit / Foot",
  estimatedUnitCost: 18,
  objectReference: objectReference("OBJ-CONDUIT-DKC", "CONDUIT", "INFRASTRUCTURE"),
  stationReference: mp0,
  segmentReference: dallasSegment,
  requiredCapabilityTypes: ["CONDUIT_PLACEMENT", "DIRECTIONAL_DRILLING"],
});

const fiberFeet = item({
  itemId: "BPI-FIBER-FEET",
  itemName: "Fiber Placement",
  itemCategory: "FIBER",
  discipline: "Fiber",
  quantity: 264000,
  unit: "FEET",
  unitLabel: "Fiber / Foot",
  estimatedUnitCost: 8,
  objectReference: objectReference("OBJ-FIBER-DKC", "FIBER", "INFRASTRUCTURE"),
  stationReference: mp0,
  segmentReference: dallasSegment,
  requiredCapabilityTypes: ["FIBER_PLACEMENT"],
});

const splices = item({
  itemId: "BPI-SPLICES",
  itemName: "Splicing",
  itemCategory: "SPLICING",
  discipline: "Splicing",
  quantity: 42,
  unit: "SPLICES",
  unitLabel: "Splice / Each",
  estimatedUnitCost: 1200,
  objectReference: objectReference("OBJ-SPLICE-DKC", "SPLICE", "OPERATIONAL"),
  stationReference: station100,
  segmentReference: stationGroupSegment,
  requiredCapabilityTypes: ["SPLICING"],
});

const opticalCabinets = item({
  itemId: "BPI-OPTICAL-CABINETS",
  itemName: "Optical Cabinets",
  itemCategory: "OPTICAL",
  discipline: "Optical",
  quantity: 6,
  unit: "CABINETS",
  unitLabel: "Cabinet / Each",
  estimatedUnitCost: 2200,
  objectReference: objectReference("OBJ-OPTICAL-DKC", "OPTICAL_SYSTEM", "OPERATIONAL"),
  stationReference: station150,
  segmentReference: stationGroupSegment,
  requiredCapabilityTypes: ["OPTICAL_DEPLOYMENT"],
});

const crossings = item({
  itemId: "BPI-CROSSINGS",
  itemName: "Crossings",
  itemCategory: "CIVIL",
  discipline: "Civil",
  quantity: 12,
  unit: "CROSSINGS",
  unitLabel: "Crossing / Each",
  estimatedUnitCost: 35000,
  objectReference: objectReference("OBJ-CROSSING-DKC", "CROSSING", "INFRASTRUCTURE"),
  stationReference: mp50,
  segmentReference: dallasSegment,
  requiredCapabilityTypes: ["DIRECTIONAL_DRILLING", "PERMITTING"],
});

const gpuRacks = item({
  itemId: "BPI-GPU-RACKS",
  itemName: "GPU Rack Capacity",
  itemCategory: "GPU_CAPACITY",
  discipline: "Compute",
  quantity: 24,
  unit: "RACKS",
  unitLabel: "GPU Rack / Month",
  estimatedUnitCost: 28000,
  objectReference: objectReference("OBJ-GPU-CAPACITY", "GPU_FACILITY", "MONETIZATION"),
  stationReference: station150,
  segmentReference: metroSegment,
  requiredCapabilityTypes: ["GPU_HOSTING"],
});

const transportGbps = item({
  itemId: "BPI-TRANSPORT-GBPS",
  itemName: "Transport Capacity",
  itemCategory: "TRANSPORT",
  discipline: "Transport",
  quantity: 400,
  unit: "COUNT",
  unitLabel: "Transport / Gbps",
  estimatedUnitCost: 160,
  objectReference: objectReference("OBJ-TRANSPORT-DKC", "TRANSPORT", "MONETIZATION"),
  stationReference: station100,
  segmentReference: metroSegment,
  requiredCapabilityTypes: ["TRANSPORT"],
});

const interconnectionCabinets = item({
  itemId: "BPI-INTERCONNECTION-CABINETS",
  itemName: "Interconnection Cabinets",
  itemCategory: "INTERCONNECTION",
  discipline: "Interconnection",
  quantity: 8,
  unit: "CABINETS",
  unitLabel: "Cabinet / Each",
  estimatedUnitCost: 2200,
  objectReference: objectReference("OBJ-INTERCONNECTION", "CARRIER_HOTEL", "INTERCONNECTION"),
  stationReference: station100,
  segmentReference: metroSegment,
  requiredCapabilityTypes: ["INTERCONNECTION"],
});

const generatedPackages = generateBidPackages([
  {
    packageId: "BIDPKG-DKC-FULL",
    packageName: "Dallas to Kansas City Full Project",
    packageType: "FULL_PROJECT",
    scopeVersionId,
    corridorId,
    items: [conduitFeet, fiberFeet, splices, opticalCabinets, crossings],
    notes: "Full project package example. No vendor invitation or bid collection occurs.",
  },
]);

export const bidPackageFixtures: readonly BidPackage[] = Object.freeze(
  [
    ...generatedPackages,
    generateSegmentPackage({
      packageId: "BIDPKG-MP0-MP50",
      packageName: "MP0-MP50 Segment",
      scopeVersionId,
      corridorId,
      segmentIds: ["SEG-MP0-MP50"],
      items: [conduitFeet, fiberFeet, crossings],
    }),
    generateStationGroupPackage({
      packageId: "BIDPKG-STATIONS-100-150",
      packageName: "Stations 100-150",
      scopeVersionId,
      corridorId,
      stationIds: ["STA-0100", "STA-0150"],
      items: [splices, opticalCabinets],
    }),
    generateDisciplinePackage({
      packageId: "BIDPKG-FIBER-PLACEMENT",
      packageName: "Fiber Placement Package",
      scopeVersionId,
      corridorId,
      items: [fiberFeet],
    }),
    generateDisciplinePackage({
      packageId: "BIDPKG-SPLICING",
      packageName: "Splicing Package",
      scopeVersionId,
      corridorId,
      items: [splices],
    }),
    generateHybridPackage({
      packageId: "BIDPKG-CONDUIT-FIBER-HYBRID",
      packageName: "Conduit + Fiber Hybrid Package",
      scopeVersionId,
      corridorId,
      items: [conduitFeet, fiberFeet],
    }),
    generateCategoryPackage({
      packageId: "BIDPKG-AI-CORRIDOR",
      packageName: "AI Corridor Package",
      scopeVersionId,
      corridorId,
      items: [gpuRacks, transportGbps, interconnectionCabinets],
    }),
    generateHybridPackage({
      packageId: "BIDPKG-METRO-AGGREGATION",
      packageName: "Metro Aggregation Package",
      scopeVersionId,
      corridorId,
      segmentIds: ["SEG-METRO-AGGREGATION"],
      items: [fiberFeet, splices, transportGbps, interconnectionCabinets],
    }),
  ].map((bidPackage) => alignBidPackageVendors(bidPackage, vendorProfiles)),
);

export function evaluateBidPackageFixtures() {
  return bidPackageFixtures.map((bidPackage) => ({
    packageId: bidPackage.packageId,
    packageType: bidPackage.packageType,
    itemCount: bidPackage.items.length,
    stationCount: bidPackage.stationIds.length,
    segmentCount: bidPackage.segmentIds.length,
    matchedVendorCount: bidPackage.matchedVendorIds.length,
    estimatedTotal: estimateBidPackageTotal(bidPackage),
  }));
}

