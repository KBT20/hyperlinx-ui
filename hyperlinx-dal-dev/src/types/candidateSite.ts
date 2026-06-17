export type CandidateSiteStatus =
  | "IMPORTED"
  | "GEOCODING"
  | "GEOCODED"
  | "FAILED_GEOCODE"
  | "AMBIGUOUS_GEOCODE"
  | "VERIFIED"
  | "ANALYZED"
  | "QUALIFIED"
  | "NON_SERVICEABLE";

export type CandidateGeocodeStatus =
  | "PENDING"
  | "GEOCODING"
  | "GEOCODED"
  | "CERTIFIED"
  | "AMBIGUOUS"
  | "FAILED"
  | "FAILED_GEOCODE"
  | "FALLBACK";

export type CandidateGeocodeMethod = "SERVER_PROXY" | "NORMALIZED_ADDRESS" | "BROWSER_PROVIDER" | "DETERMINISTIC_FALLBACK" | "HUMAN_APPROVED";

export type CandidateCertificationStage = "GEOCODE_CERTIFIED" | "STREET_SNAP_CERTIFIED" | "ATTACHMENT_CERTIFIED";

export type CandidateGeocodeCandidate = {
  lat?: number;
  lon?: number;
  confidence?: number;
  provider?: string;
  normalizedAddress?: string;
  raw?: unknown;
};

export type CandidateGeocodeAttempt = {
  rawAddress: string;
  normalizedAddress: string;
  provider: string;
  providerUrl?: string;
  responseStatus?: number | string;
  responseBodySummary?: string;
  failureReason?: string;
  confidence?: number;
  candidates?: CandidateGeocodeCandidate[];
  addressVariant?: "RAW" | "NORMALIZED";
};

export type CandidateSite = {
  candidateId: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  geocodeProvider?: string;
  geocodeConfidence?: number;
  geocodeStatus?: CandidateGeocodeStatus;
  geocodeMethod?: CandidateGeocodeMethod;
  geocodeFailureReason?: string;
  geocodeTimestamp?: string;
  geocodedAt?: string;
  normalizedAddress?: string;
  geocodeCandidates?: CandidateGeocodeCandidate[];
  geocodeAttempts?: CandidateGeocodeAttempt[];
  rawAddress?: string;
  suiteDetail?: string;
  addressIssueFlags?: string[];
  suiteStrippingImprovedMatch?: boolean;
  certifiedBy?: string;
  certifiedAt?: string;
  certificationStages?: CandidateCertificationStage[];
  streetSnapCertified?: boolean;
  attachmentCertified?: boolean;
  county?: string;
  facilityType?: string;
  marketSegment?: string;
  classification?: string;
  sourceDatasetId?: string;
  status: CandidateSiteStatus;
  createdAt: string;
};
