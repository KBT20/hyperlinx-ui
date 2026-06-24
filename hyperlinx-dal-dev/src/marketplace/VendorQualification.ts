export type VendorQualificationStatus =
  | "UNVERIFIED"
  | "REGISTERED"
  | "QUALIFIED"
  | "PREFERRED"
  | "STRATEGIC";

export type VendorReviewStatus =
  | "NOT_REVIEWED"
  | "PENDING"
  | "VERIFIED"
  | "EXPIRED"
  | "REJECTED";

export interface VendorInsuranceRecord {
  status: VendorReviewStatus;
  coverageSummary?: string;
  expirationDate?: string;
  notes?: string;
}

export interface VendorReferenceRecord {
  referenceId: string;
  referenceName: string;
  market?: string;
  notes?: string;
}

export interface VendorQualification {
  qualificationId: string;
  vendorId: string;
  qualificationStatus: VendorQualificationStatus;
  insurance: VendorInsuranceRecord;
  references: VendorReferenceRecord[];
  marketsServed: string[];
  crewCapacity?: number;
  facilityCapacity?: string;
  financialReview: VendorReviewStatus;
  safetyReview: VendorReviewStatus;
  complianceReview: VendorReviewStatus;
  updatedAt: string;
  notes?: string;
}

export const VENDOR_QUALIFICATION_ORDER: readonly VendorQualificationStatus[] = Object.freeze([
  "UNVERIFIED",
  "REGISTERED",
  "QUALIFIED",
  "PREFERRED",
  "STRATEGIC",
]);

export function isVendorAtLeastQualifiedAs(
  currentStatus: VendorQualificationStatus,
  requiredStatus: VendorQualificationStatus,
): boolean {
  return VENDOR_QUALIFICATION_ORDER.indexOf(currentStatus) >= VENDOR_QUALIFICATION_ORDER.indexOf(requiredStatus);
}

