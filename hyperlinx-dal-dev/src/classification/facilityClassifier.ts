import type { CandidateSite } from "../types/candidateSite";

type Classification = {
  facilityType: string;
  marketSegment: string;
};

const rules: Array<{ facilityType: string; marketSegment: string; patterns: RegExp[] }> = [
  { facilityType: "Water Plant", marketSegment: "Utility", patterns: [/water/i, /wastewater/i, /treatment/i, /wwtp/i] },
  { facilityType: "Municipal", marketSegment: "Government", patterns: [/city of/i, /municipal/i, /town of/i, /village/i] },
  { facilityType: "County", marketSegment: "Government", patterns: [/county/i] },
  { facilityType: "State", marketSegment: "Government", patterns: [/\bstate\b/i, /txdot/i, /department of/i] },
  { facilityType: "Federal", marketSegment: "Government", patterns: [/federal/i, /\busda\b/i, /\bfema\b/i, /\bva\b/i, /army/i, /air force/i] },
  { facilityType: "Public Safety", marketSegment: "Public Safety", patterns: [/police/i, /fire/i, /ems/i, /sheriff/i, /dispatch/i, /public safety/i] },
  { facilityType: "School", marketSegment: "Education", patterns: [/school/i, /\bisd\b/i, /college/i, /university/i, /academy/i] },
  { facilityType: "Hospital", marketSegment: "Healthcare", patterns: [/hospital/i, /medical/i, /clinic/i, /health/i] },
  { facilityType: "Utility", marketSegment: "Utility", patterns: [/electric/i, /power/i, /utility/i, /gas/i, /coop/i, /co-op/i] },
  { facilityType: "Government", marketSegment: "Government", patterns: [/courthouse/i, /government/i, /admin/i, /public works/i] },
];

export function classifyFacility(site: Pick<CandidateSite, "companyName" | "address" | "city">): Classification {
  const text = `${site.companyName} ${site.address} ${site.city}`;
  const match = rules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  return match ? { facilityType: match.facilityType, marketSegment: match.marketSegment } : { facilityType: "Enterprise", marketSegment: "Commercial" };
}

export function classifyCandidateSite(site: CandidateSite): CandidateSite {
  const classification = classifyFacility(site);
  return {
    ...site,
    facilityType: site.facilityType ?? classification.facilityType,
    marketSegment: site.marketSegment ?? classification.marketSegment,
  };
}

export function classifyCandidateSites(sites: CandidateSite[]) {
  return sites.map(classifyCandidateSite);
}

