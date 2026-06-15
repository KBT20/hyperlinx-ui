export type CandidateSiteStatus =
  | "IMPORTED"
  | "GEOCODING"
  | "GEOCODED"
  | "FAILED_GEOCODE"
  | "VERIFIED"
  | "ANALYZED"
  | "QUALIFIED"
  | "NON_SERVICEABLE";

export type CandidateGeocodeStatus = "PENDING" | "GEOCODING" | "GEOCODED" | "FAILED" | "FAILED_GEOCODE" | "FALLBACK";

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
  geocodeFailureReason?: string;
  geocodeTimestamp?: string;
  geocodedAt?: string;
  county?: string;
  facilityType?: string;
  marketSegment?: string;
  status: CandidateSiteStatus;
  createdAt: string;
};
