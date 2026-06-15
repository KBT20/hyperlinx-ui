import type { CandidateSite } from "../types/candidateSite";
import type { ParcelClassification, ParcelIntelligence, SpatialLayers } from "./types";
import { clamp, siteCoordinate, siteText, stableHash } from "./spatialUtils";

function classifyParcel(site: CandidateSite): ParcelClassification {
  const text = siteText(site);
  if (/\b(city of|municipal|town of|village|public works)\b/.test(text)) return "Municipal";
  if (/\bcounty\b/.test(text)) return "County";
  if (/\b(txdot|state of|department of transportation|state )\b/.test(text)) return "State";
  if (/\b(federal|usda|fema|army|air force|navy|va |veterans|postal)\b/.test(text)) return "Federal";
  if (/\b(utility|electric|power|water|wastewater|gas|coop|co-op)\b/.test(text)) return "Utility";
  if (/\b(industrial|manufacturing|warehouse|logistics|plant|mill)\b/.test(text)) return "Industrial";
  if (/\b(apartment|residential|housing|hoa|subdivision)\b/.test(text)) return "Residential";
  if (site.address || site.companyName) return "Commercial";
  return "Unknown";
}

function parcelScoreFor(type: ParcelClassification) {
  const scores: Record<ParcelClassification, number> = {
    Municipal: 78,
    County: 70,
    State: 58,
    Federal: 40,
    Utility: 84,
    Commercial: 74,
    Industrial: 69,
    Residential: 52,
    Unknown: 45,
  };
  return scores[type];
}

export function analyzeParcel(site: CandidateSite, layers?: SpatialLayers): ParcelIntelligence {
  const coordinate = siteCoordinate(site);
  const explicitParcel = layers?.parcels?.[0];
  if (explicitParcel) {
    return {
      parcel: explicitParcel,
      parcelScore: parcelScoreFor(explicitParcel.ownershipType),
      notes: ["Parcel layer match supplied by spatial layers."],
    };
  }

  const ownershipType = classifyParcel(site);
  const zip = String(site.zipCode || "00000").slice(0, 5).padEnd(5, "0");
  const hash = stableHash(`${site.companyName}|${site.address}|${site.city}|${zip}`).toString(16);
  const confidence = clamp((site.address ? 34 : 0) + (site.city ? 22 : 0) + (site.zipCode ? 24 : 0) + (site.companyName ? 12 : 0), 28, 92);

  return {
    parcel: {
      parcelId: `parcel-${zip}-${hash.slice(0, 8)}`,
      coordinate,
      parcelType: ownershipType,
      landUse: ownershipType,
      ownershipType,
      confidence,
    },
    parcelScore: parcelScoreFor(ownershipType),
    notes: [`Inferred ${ownershipType} parcel classification from candidate metadata.`],
  };
}
