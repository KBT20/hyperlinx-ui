import type { CandidateSite } from "../types/candidateSite";
import { DAL_API, DAL_GEOCODER_PROVIDER, DAL_GOOGLE_GEOCODING_KEY, DAL_MAPBOX_GEOCODING_TOKEN } from "../config/dalApi";

export type GeocodeProviderName = "server" | "priority" | "deterministic" | "census" | "nominatim" | "mapbox" | "google";

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  confidence: number;
  provider: string;
  normalizedAddress?: string;
  candidates?: ServerGeocodeCandidate[];
  raw?: unknown;
};

export type ServerGeocodeCandidate = {
  lat?: number;
  lon?: number;
  confidence?: number;
  provider?: string;
  normalizedAddress?: string;
  raw?: unknown;
};

export type ServerGeocodeResponse = {
  siteId: string;
  status: "CERTIFIED" | "AMBIGUOUS" | "FAILED";
  lat?: number;
  lon?: number;
  confidence: number;
  provider: string;
  geocodeMethod?: CandidateSite["geocodeMethod"];
  rawAddress?: string;
  lookupAddress?: string;
  normalizedAddress?: string;
  suiteDetail?: string;
  addressIssueFlags?: string[];
  suiteStrippingImprovedMatch?: boolean;
  candidates?: ServerGeocodeCandidate[];
  attempts?: CandidateSite["geocodeAttempts"];
  failureReason?: string;
};

export type GeocodeProvider = {
  name: string;
  geocode(site: CandidateSite): Promise<GeocodeResult | null>;
};

export type GeocodeOptions = {
  force?: boolean;
  fallbackToDeterministic?: boolean;
};

const realProviderNames = new Set(["server", "priority", "google", "mapbox", "census", "nominatim"]);

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

function deterministicTexasCoordinate(site: CandidateSite) {
  const seed = hashText(`${site.address}|${site.city}|${site.state}|${site.zipCode}|${site.companyName}`);
  const zip = Number(String(site.zipCode).slice(0, 5));
  const baseByZip = Number.isFinite(zip)
    ? {
        lat: 25.85 + ((zip % 1600) / 1600) * 10.2,
        lon: -106.65 + (((zip * 7) % 1700) / 1700) * 13.2,
      }
    : { lat: 31.2, lon: -97.4 };
  const latJitter = ((seed % 1000) / 1000 - 0.5) * 0.18;
  const lonJitter = (((seed >>> 10) % 1000) / 1000 - 0.5) * 0.18;
  return {
    latitude: Math.max(25.75, Math.min(36.55, baseByZip.lat + latJitter)),
    longitude: Math.max(-106.7, Math.min(-93.45, baseByZip.lon + lonJitter)),
  };
}

function confidenceForSite(site: CandidateSite) {
  let confidence = 0.34;
  if (site.address) confidence += 0.22;
  if (site.city) confidence += 0.14;
  if (site.state) confidence += 0.08;
  if (site.zipCode) confidence += 0.16;
  if (site.companyName) confidence += 0.04;
  return Math.min(0.92, confidence);
}

function oneLineAddress(site: CandidateSite) {
  return [site.address, site.city, site.state, site.zipCode].filter(Boolean).join(", ");
}

export function isValidGeocodeCoordinate(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
}

export function realGeocoderConfigured() {
  return realProviderNames.has(DAL_GEOCODER_PROVIDER.toLowerCase());
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export const deterministicGeocoder: GeocodeProvider = {
  name: "deterministic-local-texas",
  async geocode(site) {
    return {
      ...deterministicTexasCoordinate(site),
      confidence: confidenceForSite(site) * 0.7,
      provider: "deterministic-local-texas",
    };
  },
};

export const serverProxyGeocoder: GeocodeProvider = {
  name: "dal-server-geocode-proxy",
  async geocode(site) {
    const response = await fetch(`${DAL_API}/api/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        siteId: site.candidateId,
        companyName: site.companyName,
        address: site.address,
        city: site.city,
        state: site.state,
        zip: site.zipCode,
      }),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = (await response.json()) as ServerGeocodeResponse;
    if (!isValidGeocodeCoordinate(data.lat, data.lon)) return null;
    return {
      latitude: Number(data.lat),
      longitude: Number(data.lon),
      confidence: Number(data.confidence || 0),
      provider: data.provider,
      normalizedAddress: data.normalizedAddress,
      candidates: data.candidates,
      raw: data,
    };
  },
};

export const censusGeocoder: GeocodeProvider = {
  name: "us-census",
  async geocode(site) {
    const address = oneLineAddress(site);
    if (!address) return null;
    try {
      const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
      const data = await fetchJson(url);
      const match = data?.result?.addressMatches?.[0];
      const coordinates = match?.coordinates;
      if (!coordinates || !Number.isFinite(Number(coordinates.y)) || !Number.isFinite(Number(coordinates.x))) return null;
      return {
        latitude: Number(coordinates.y),
        longitude: Number(coordinates.x),
        confidence: match?.tigerLine ? 0.86 : 0.74,
        provider: "us-census",
        raw: match,
      };
    } catch {
      return null;
    }
  },
};

export const nominatimGeocoder: GeocodeProvider = {
  name: "nominatim",
  async geocode(site) {
    const address = oneLineAddress(site);
    if (!address) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;
      const data = await fetchJson(url);
      const match = Array.isArray(data) ? data[0] : null;
      if (!match || !Number.isFinite(Number(match.lat)) || !Number.isFinite(Number(match.lon))) return null;
      return {
        latitude: Number(match.lat),
        longitude: Number(match.lon),
        confidence: Number(match.importance ?? 0.65),
        provider: "nominatim",
        raw: match,
      };
    } catch {
      return null;
    }
  },
};

export const mapboxGeocoder: GeocodeProvider = {
  name: "mapbox",
  async geocode(site) {
    const address = oneLineAddress(site);
    if (!address || !DAL_MAPBOX_GEOCODING_TOKEN) return null;
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&country=US&access_token=${encodeURIComponent(DAL_MAPBOX_GEOCODING_TOKEN)}`;
      const data = await fetchJson(url);
      const feature = data?.features?.[0];
      const center = feature?.center;
      if (!Array.isArray(center) || !Number.isFinite(Number(center[1])) || !Number.isFinite(Number(center[0]))) return null;
      return {
        latitude: Number(center[1]),
        longitude: Number(center[0]),
        confidence: Number(feature?.relevance ?? 0.78),
        provider: "mapbox",
        raw: feature,
      };
    } catch {
      return null;
    }
  },
};

export const googleGeocoder: GeocodeProvider = {
  name: "google",
  async geocode(site) {
    const address = oneLineAddress(site);
    if (!address || !DAL_GOOGLE_GEOCODING_KEY) return null;
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(DAL_GOOGLE_GEOCODING_KEY)}`;
      const data = await fetchJson(url);
      const result = data?.results?.[0];
      const location = result?.geometry?.location;
      if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) return null;
      return {
        latitude: Number(location.lat),
        longitude: Number(location.lng),
        confidence: result?.partial_match ? 0.72 : 0.9,
        provider: "google",
        raw: result,
      };
    } catch {
      return null;
    }
  },
};

export const priorityGeocoder: GeocodeProvider = {
  name: "priority-google-mapbox-census-nominatim",
  async geocode(site) {
    const providers = [googleGeocoder, mapboxGeocoder, censusGeocoder, nominatimGeocoder];
    for (const provider of providers) {
      const result = await provider.geocode(site);
      if (result) return result;
    }
    return null;
  },
};

export const geocodeProviders: Record<GeocodeProviderName, GeocodeProvider> = {
  server: serverProxyGeocoder,
  priority: priorityGeocoder,
  deterministic: deterministicGeocoder,
  census: censusGeocoder,
  nominatim: nominatimGeocoder,
  mapbox: mapboxGeocoder,
  google: googleGeocoder,
};

export function configuredGeocoder() {
  const providerName = DAL_GEOCODER_PROVIDER.toLowerCase() as GeocodeProviderName;
  return geocodeProviders[providerName] ?? deterministicGeocoder;
}

function geocodeFailure(site: CandidateSite, providerName: string, reason: string): CandidateSite {
  return {
    ...site,
    latitude: undefined,
    longitude: undefined,
    status: "FAILED_GEOCODE",
    geocodeStatus: "FAILED_GEOCODE",
    geocodeProvider: providerName,
    geocodeFailureReason: reason,
  };
}

export function certifiedGeocode(site: CandidateSite) {
  return site.geocodeStatus === "CERTIFIED" || site.geocodeMethod === "HUMAN_APPROVED";
}

export async function geocodeCandidateSiteViaServer(site: CandidateSite, options: GeocodeOptions = {}): Promise<CandidateSite> {
  const existingCertified = certifiedGeocode(site) && isValidGeocodeCoordinate(site.latitude, site.longitude);
  if (!options.force && existingCertified) return site;
  const timestamp = new Date().toISOString();
  try {
    const response = await fetch(`${DAL_API}/api/geocode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        siteId: site.candidateId,
        companyName: site.companyName,
        address: site.address,
        city: site.city,
        state: site.state,
        zip: site.zipCode,
      }),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = (await response.json()) as ServerGeocodeResponse;
    const hasCoordinate = isValidGeocodeCoordinate(data.lat, data.lon);
    if (data.status === "CERTIFIED" && hasCoordinate) {
      return {
        ...site,
        latitude: Number(data.lat),
        longitude: Number(data.lon),
        status: "VERIFIED",
        geocodeStatus: "CERTIFIED",
        geocodeMethod: data.geocodeMethod ?? "SERVER_PROXY",
        geocodeProvider: data.provider,
        geocodeConfidence: data.confidence,
        normalizedAddress: data.normalizedAddress ?? data.lookupAddress,
        geocodeCandidates: data.candidates,
        geocodeAttempts: data.attempts,
        rawAddress: data.rawAddress,
        suiteDetail: data.suiteDetail,
        addressIssueFlags: data.addressIssueFlags,
        suiteStrippingImprovedMatch: data.suiteStrippingImprovedMatch,
        geocodeTimestamp: timestamp,
        geocodedAt: timestamp,
      };
    }
    if (data.status === "AMBIGUOUS") {
      return {
        ...site,
        latitude: hasCoordinate ? Number(data.lat) : undefined,
        longitude: hasCoordinate ? Number(data.lon) : undefined,
        status: "AMBIGUOUS_GEOCODE",
        geocodeStatus: "AMBIGUOUS",
        geocodeMethod: data.geocodeMethod ?? "SERVER_PROXY",
        geocodeProvider: data.provider,
        geocodeConfidence: data.confidence,
        normalizedAddress: data.normalizedAddress ?? data.lookupAddress,
        geocodeCandidates: data.candidates,
        geocodeAttempts: data.attempts,
        rawAddress: data.rawAddress,
        suiteDetail: data.suiteDetail,
        addressIssueFlags: data.addressIssueFlags,
        suiteStrippingImprovedMatch: data.suiteStrippingImprovedMatch,
        geocodeFailureReason: data.failureReason ?? "Ambiguous geocode candidate. Human review required.",
        geocodeTimestamp: timestamp,
        geocodedAt: timestamp,
      };
    }
    return {
      ...geocodeFailure(site, data.provider || "dal-server-geocode-proxy", data.failureReason ?? "Server geocoder returned no certified coordinates"),
      geocodeAttempts: data.attempts,
      rawAddress: data.rawAddress,
      normalizedAddress: data.normalizedAddress ?? data.lookupAddress,
      suiteDetail: data.suiteDetail,
      addressIssueFlags: data.addressIssueFlags,
      suiteStrippingImprovedMatch: data.suiteStrippingImprovedMatch,
      geocodeCandidates: data.candidates,
    };
  } catch (err) {
    return geocodeFailure(site, "dal-server-geocode-proxy", err instanceof Error ? err.message : String(err));
  }
}

export async function batchGeocodeCandidateSitesViaServer(sites: CandidateSite[], options: GeocodeOptions = {}) {
  const geocoded: CandidateSite[] = [];
  for (const site of sites) geocoded.push(await geocodeCandidateSiteViaServer(site, options));
  return geocoded;
}

export async function geocodeCandidateSite(
  site: CandidateSite,
  provider: GeocodeProvider = configuredGeocoder(),
  options: GeocodeOptions = {}
): Promise<CandidateSite> {
  const existingIsSyntheticUnderRealProvider =
    realGeocoderConfigured() &&
    (site.geocodeStatus === "FALLBACK" || String(site.geocodeProvider ?? "").toLowerCase().includes("deterministic"));
  if (!options.force && isValidGeocodeCoordinate(site.latitude, site.longitude) && !existingIsSyntheticUnderRealProvider) {
    const timestamp = site.geocodeTimestamp ?? site.geocodedAt ?? new Date().toISOString();
    return {
      ...site,
      status: site.status === "IMPORTED" ? "GEOCODED" : site.status,
      geocodeStatus: "GEOCODED",
      geocodeProvider: site.geocodeProvider ?? "existing-coordinate",
      geocodeConfidence: site.geocodeConfidence ?? 1,
      geocodeTimestamp: timestamp,
      geocodedAt: timestamp,
    };
  }

  const fallbackToDeterministic = options.fallbackToDeterministic ?? !realGeocoderConfigured();
  let result = await provider.geocode(site);
  let failureReason: string | undefined;
  if (!result && fallbackToDeterministic && provider.name !== deterministicGeocoder.name && provider.name !== priorityGeocoder.name) {
    failureReason = `${provider.name} returned no coordinate`;
    result = await deterministicGeocoder.geocode(site);
  }
  if (!result) {
    return geocodeFailure(site, provider.name, `${provider.name} returned no coordinate`);
  }
  if (!isValidGeocodeCoordinate(result.latitude, result.longitude)) {
    return geocodeFailure(site, result.provider, `${result.provider} returned invalid coordinate`);
  }
  const timestamp = new Date().toISOString();
  return {
    ...site,
    latitude: result.latitude,
    longitude: result.longitude,
    status: "GEOCODED",
    geocodeProvider: result.provider,
    geocodeConfidence: result.confidence,
    geocodeStatus: result.provider === deterministicGeocoder.name ? "FALLBACK" : "GEOCODED",
    geocodeMethod: result.provider === deterministicGeocoder.name ? "DETERMINISTIC_FALLBACK" : "BROWSER_PROVIDER",
    normalizedAddress: result.normalizedAddress,
    geocodeCandidates: result.candidates,
    geocodeFailureReason: failureReason,
    geocodeTimestamp: timestamp,
    geocodedAt: timestamp,
  };
}

export async function batchGeocodeCandidateSites(
  sites: CandidateSite[],
  provider: GeocodeProvider = configuredGeocoder(),
  options: GeocodeOptions = {}
) {
  const geocoded: CandidateSite[] = [];
  for (const site of sites) geocoded.push(await geocodeCandidateSite(site, provider, options));
  return geocoded;
}
