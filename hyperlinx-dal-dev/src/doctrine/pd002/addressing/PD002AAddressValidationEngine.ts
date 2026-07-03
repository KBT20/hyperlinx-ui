import type { StationAuthority } from "../../../spine/SpineAuthorityContracts";
import {
  OBJECT_ADDRESSING_VALIDATION_AUTHORITY,
  type ObjectAddress,
  type PD002AAddressValidation,
  type PD002AAddressValidationIssue,
  type PD002AReviewObject,
  type StationAddressRegistry,
} from "./PD002AAddressingContracts";

function issue(args: {
  severity: "FAIL" | "WARNING";
  index: number;
  objectId?: string;
  reviewObjectId?: string;
  reason: string;
  requiredResolution: string;
}): PD002AAddressValidationIssue {
  return {
    issueId: `PD002A-ADDRESS-${args.severity}-${String(args.index + 1).padStart(4, "0")}`,
    severity: args.severity,
    objectId: args.objectId,
    reviewObjectId: args.reviewObjectId,
    reason: args.reason,
    requiredResolution: args.requiredResolution,
  };
}

function stationExists(registry: StationAddressRegistry, stationId: string | undefined) {
  return Boolean(stationId && registry.byStationId[stationId]);
}

function objectHasCoordinateWithoutStation(address: ObjectAddress) {
  return Boolean(address.coordinate && !address.stationAddress && address.addressType === "POINT");
}

export function validateObjectAddresses(args: {
  packageId: string;
  stationAuthority: StationAuthority;
  stationAddressRegistry: StationAddressRegistry;
  objectAddresses: ObjectAddress[];
  unassignedReviewObjects: PD002AReviewObject[];
  addressedReviewObjects?: PD002AReviewObject[];
}): PD002AAddressValidation {
  const failures: PD002AAddressValidationIssue[] = [];
  const warnings: PD002AAddressValidationIssue[] = [];
  let issueIndex = 0;

  args.objectAddresses.forEach((address) => {
    if (address.addressType === "PACKAGE_LEVEL") return;
    if (address.addressType === "UNASSIGNED_REVIEW") {
      warnings.push(issue({
        severity: "WARNING",
        index: issueIndex++,
        objectId: address.objectId,
        reason: "Review object is visible but not yet station-addressed.",
        requiredResolution: "Engineering must address, accept as downstream review, or mark not applicable before certification if blocking.",
      }));
      return;
    }
    if (address.addressType === "POINT") {
      if (!address.stationAddress) {
        failures.push(issue({
          severity: "FAIL",
          index: issueIndex++,
          objectId: address.objectId,
          reason: "Required point object lacks Station Address.",
          requiredResolution: "Assign a Station Address before certification.",
        }));
      } else if (!stationExists(args.stationAddressRegistry, address.stationAddress.stationId)) {
        failures.push(issue({
          severity: "FAIL",
          index: issueIndex++,
          objectId: address.objectId,
          reason: "Point object references invalid station.",
          requiredResolution: "Reassign address to a station in the active stationAuthority.",
        }));
      }
    }
    if (address.addressType === "RANGE") {
      if (!address.fromStationAddress || !address.toStationAddress) {
        failures.push(issue({
          severity: "FAIL",
          index: issueIndex++,
          objectId: address.objectId,
          reason: "Required range object lacks from/to Station Address.",
          requiredResolution: "Assign From Station Address and To Station Address before certification.",
        }));
      } else if (Number(address.fromMeasureFeet) >= Number(address.toMeasureFeet)) {
        failures.push(issue({
          severity: "FAIL",
          index: issueIndex++,
          objectId: address.objectId,
          reason: "Range object has invalid measure order.",
          requiredResolution: "Ensure fromMeasureFeet is less than toMeasureFeet.",
        }));
      } else if (!stationExists(args.stationAddressRegistry, address.fromStationAddress.stationId) || !stationExists(args.stationAddressRegistry, address.toStationAddress.stationId)) {
        failures.push(issue({
          severity: "FAIL",
          index: issueIndex++,
          objectId: address.objectId,
          reason: "Range object references station outside Measured Spine.",
          requiredResolution: "Reassign range endpoints to valid stationAuthority stations.",
        }));
      }
    }
    if (address.inheritedFromObjectId && !args.objectAddresses.some((candidate) => candidate.objectId === address.inheritedFromObjectId)) {
      failures.push(issue({
        severity: "FAIL",
        index: issueIndex++,
        objectId: address.objectId,
        reason: "Contained object lacks valid parent address.",
        requiredResolution: "Address the parent object or assign an approved address exception.",
      }));
    }
    if (objectHasCoordinateWithoutStation(address)) {
      failures.push(issue({
        severity: "FAIL",
        index: issueIndex++,
        objectId: address.objectId,
        reason: "Object has coordinate without station address.",
        requiredResolution: "Snap object coordinate to a valid station address.",
      }));
    }
  });

  args.unassignedReviewObjects.forEach((reviewObject) => {
    const severity = reviewObject.blockingStatus === "BLOCKING" ? "FAIL" : "WARNING";
    const target = severity === "FAIL" ? failures : warnings;
    target.push(issue({
      severity,
      index: issueIndex++,
      reviewObjectId: reviewObject.reviewObjectId,
      reason: `${reviewObject.reviewType} remains ${reviewObject.addressStatus}.`,
      requiredResolution: reviewObject.blockingStatus === "BLOCKING"
        ? "Engineering must assign address, mark not applicable, or convert into addressed Spine Object before certification."
        : "Engineering may accept as downstream review if contingency covers cost or schedule impact.",
    }));
  });

  const assignedPointCount = args.objectAddresses.filter((address) => address.addressType === "POINT" && address.stationAddress).length;
  const assignedRangeCount = args.objectAddresses.filter((address) => address.addressType === "RANGE" && address.fromStationAddress && address.toStationAddress).length;
  const packageLevelCount = args.objectAddresses.filter((address) => address.addressType === "PACKAGE_LEVEL").length;
  const pendingReviewCount = args.unassignedReviewObjects.length;
  const status = failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS";

  return {
    validationId: `${args.packageId}:PD002A:ADDRESS-VALIDATION`,
    packageId: args.packageId,
    status,
    checkedObjectCount: args.objectAddresses.length,
    assignedPointCount,
    assignedRangeCount,
    packageLevelCount,
    pendingReviewCount,
    invalidAddressCount: failures.length,
    warnings,
    failures,
    authority: OBJECT_ADDRESSING_VALIDATION_AUTHORITY,
    noScopeVersionCreation: true,
  };
}
