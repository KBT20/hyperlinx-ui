import {
  PD003_PRODUCTION_AUTHORITY,
  type ObjectProductionProfile,
  type ProductionPaymentProjection,
  type ProductionReviewObject,
  type ProductionValidation,
} from "./PD003ProductionContracts";

export function createProductionValidation(args: {
  packageId: string;
  objectProductionProfiles: ObjectProductionProfile[];
  paymentProjection: ProductionPaymentProjection[];
  reviewObjects: ProductionReviewObject[];
}): ProductionValidation {
  const missingProfileReferenceCount = args.objectProductionProfiles.filter((item) => !item.profile?.profileId).length;
  const unknownProductionValueCount = args.reviewObjects.filter((item) => item.reviewType === "UNKNOWN_PRODUCTION_VALUE" || item.reviewType === "CONFIGURABLE_RATE").length;
  const paymentAuthorizationViolationCount = args.paymentProjection.filter((item) => item.paymentEligible !== false || item.noPaymentAuthorization !== true).length;
  const failures = [
    ...(missingProfileReferenceCount ? [`${missingProfileReferenceCount} production profile references are missing.`] : []),
    ...(paymentAuthorizationViolationCount ? [`${paymentAuthorizationViolationCount} payment projections attempted authorization.`] : []),
  ];
  const warnings = [
    ...(unknownProductionValueCount ? [`${unknownProductionValueCount} production values require human review.`] : []),
    ...args.reviewObjects.filter((item) => item.reviewType === "HUMAN_REVIEW_REQUIRED").map((item) => item.reason),
  ];
  return {
    validationId: `${args.packageId}:PD003-PRODUCTION-VALIDATION`,
    packageId: args.packageId,
    status: failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS",
    checkedProfileCount: new Set(args.objectProductionProfiles.map((item) => item.profileId)).size,
    checkedObjectProductionProfileCount: args.objectProductionProfiles.length,
    missingProfileReferenceCount,
    unknownProductionValueCount,
    paymentAuthorizationViolationCount,
    warnings,
    failures,
    authority: PD003_PRODUCTION_AUTHORITY,
    noScopeVersionCreation: true,
  };
}
