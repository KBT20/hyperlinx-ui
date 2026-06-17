import { errorResponse, handleOptions, jsonResponse, readRequestJson } from "./_shared.js";

function summarizeBody(body) {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? {});
  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
}

async function fetchJsonWithDiagnostics(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Hyperlinx-DAL/1.0",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = text;
    }
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
      summary: summarizeBody(body),
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeAddressForLookup(input = {}) {
  const rawAddress = String(input.rawAddress ?? input.address ?? "").trim();
  const city = String(input.city ?? "").trim();
  const state = String(input.state ?? "").trim();
  const zip = String(input.zipCode ?? input.zip ?? "").trim();
  const companyName = String(input.companyName ?? input.name ?? "").trim();
  const suiteMatches = rawAddress.match(/\b(?:suite|ste|unit|floor|fl|room|rm|#)\s*[\w-]+/gi) ?? [];
  let normalizedStreet = rawAddress
    .replace(/\b(?:suite|ste|unit|floor|fl|room|rm)\s*[\w-]+/gi, "")
    .replace(/#\s*[\w-]+/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*$/g, "")
    .trim();
  if (companyName && normalizedStreet.toLowerCase().startsWith(companyName.toLowerCase())) {
    normalizedStreet = normalizedStreet.slice(companyName.length).replace(/^\s*,?\s*/, "");
  }
  const rawAddressLine = [rawAddress, city, state, zip].filter(Boolean).join(", ");
  const normalizedAddress = [normalizedStreet, city, state, zip].filter(Boolean).join(", ");
  const issueFlags = [];
  if (suiteMatches.length) issueFlags.push("suite/unit/floor stripped");
  if (rawAddress && !/^\s*\d+/.test(normalizedStreet)) issueFlags.push("missing street number");
  if (!city) issueFlags.push("missing city");
  if (!state) issueFlags.push("missing state");
  if (!zip) issueFlags.push("missing zip");
  return {
    rawAddress,
    rawAddressLine,
    normalizedStreet,
    normalizedAddress,
    suiteDetail: suiteMatches.join(", "),
    suiteStripped: suiteMatches.length > 0 || rawAddress !== normalizedStreet,
    issueFlags,
  };
}

function normalizeGeocodeCandidate(provider, candidate = {}) {
  const lat = Number(candidate.lat ?? candidate.latitude ?? candidate.y);
  const lon = Number(candidate.lon ?? candidate.lng ?? candidate.longitude ?? candidate.x);
  return {
    provider,
    lat,
    lon,
    confidence: Number(candidate.confidence ?? candidate.score ?? candidate.importance ?? candidate.relevance ?? 0),
    normalizedAddress: candidate.normalizedAddress ?? candidate.address ?? candidate.display_name ?? candidate.place_name,
    raw: candidate.raw ?? candidate,
  };
}

function certifiedCandidate(candidates) {
  return candidates
    .filter((candidate) => Number.isFinite(candidate.lat) && Number.isFinite(candidate.lon))
    .sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0))[0];
}

async function attemptProvider(args) {
  const started = Date.now();
  try {
    const response = await fetchJsonWithDiagnostics(args.url);
    const candidates = args.extract(response.body);
    return {
      provider: args.provider,
      providerUrl: args.url,
      addressVariant: args.addressVariant,
      responseStatus: response.status,
      responseBodySummary: response.summary,
      confidence: candidates[0]?.confidence,
      candidates,
      latencyMs: Date.now() - started,
      failureReason: response.ok ? undefined : `${response.status} ${response.statusText}`,
    };
  } catch (err) {
    return {
      provider: args.provider,
      providerUrl: args.url,
      addressVariant: args.addressVariant,
      responseStatus: "ERROR",
      responseBodySummary: "",
      candidates: [],
      latencyMs: Date.now() - started,
      failureReason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function geocodeAddress(address, addressVariant) {
  const encoded = encodeURIComponent(address);
  const attempts = [];
  attempts.push(
    await attemptProvider({
      provider: "us-census",
      addressVariant,
      url: `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`,
      extract: (body) =>
        (body?.result?.addressMatches ?? []).map((match) =>
          normalizeGeocodeCandidate("us-census", {
            lat: match?.coordinates?.y,
            lon: match?.coordinates?.x,
            confidence: 0.92,
            normalizedAddress: match?.matchedAddress,
            raw: match,
          })
        ),
    })
  );
  attempts.push(
    await attemptProvider({
      provider: "arcgis-esri",
      addressVariant,
      url: `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&countryCode=USA&maxLocations=5&SingleLine=${encoded}`,
      extract: (body) =>
        (body?.candidates ?? []).map((candidate) =>
          normalizeGeocodeCandidate("arcgis-esri", {
            lat: candidate?.location?.y,
            lon: candidate?.location?.x,
            confidence: Number(candidate?.score ?? 0) / 100,
            normalizedAddress: candidate?.address,
            raw: candidate,
          })
        ),
    })
  );
  attempts.push(
    await attemptProvider({
      provider: "nominatim-osm",
      addressVariant,
      url: `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&q=${encoded}`,
      extract: (body) => (Array.isArray(body) ? body : []).map((match) => normalizeGeocodeCandidate("nominatim-osm", match)),
    })
  );
  return attempts;
}

async function resolveGeocode(input) {
  const normalization = normalizeAddressForLookup(input);
  const variants = [
    { addressVariant: "RAW", address: normalization.rawAddressLine },
    ...(normalization.normalizedAddress && normalization.normalizedAddress !== normalization.rawAddressLine
      ? [{ addressVariant: "NORMALIZED", address: normalization.normalizedAddress }]
      : []),
  ].filter((variant) => variant.address);

  const attempts = [];
  const candidates = [];
  for (const variant of variants) {
    const nextAttempts = await geocodeAddress(variant.address, variant.addressVariant);
    attempts.push(...nextAttempts);
    nextAttempts.forEach((attempt) => {
      attempt.candidates.forEach((candidate) => candidates.push({ ...candidate, addressVariant: variant.addressVariant }));
    });
  }

  const best = certifiedCandidate(candidates);
  if (best && Number(best.confidence ?? 0) >= 0.72) {
    const usedNormalized = best.addressVariant === "NORMALIZED";
    return {
      status: "CERTIFIED",
      lat: best.lat,
      lon: best.lon,
      provider: best.provider,
      confidence: best.confidence,
      geocodeMethod: usedNormalized ? "NORMALIZED_ADDRESS" : "SERVER_PROXY",
      rawAddress: normalization.rawAddressLine,
      normalizedAddress: normalization.normalizedAddress,
      lookupAddress: usedNormalized ? normalization.normalizedAddress : normalization.rawAddressLine,
      suiteDetail: normalization.suiteDetail,
      addressIssueFlags: normalization.issueFlags,
      suiteStrippingImprovedMatch: usedNormalized && normalization.suiteStripped,
      candidates,
      attempts,
    };
  }

  if (best) {
    return {
      status: "AMBIGUOUS",
      lat: best.lat,
      lon: best.lon,
      provider: best.provider,
      confidence: best.confidence,
      geocodeMethod: best.addressVariant === "NORMALIZED" ? "NORMALIZED_ADDRESS" : "SERVER_PROXY",
      rawAddress: normalization.rawAddressLine,
      normalizedAddress: normalization.normalizedAddress,
      lookupAddress: best.addressVariant === "NORMALIZED" ? normalization.normalizedAddress : normalization.rawAddressLine,
      suiteDetail: normalization.suiteDetail,
      addressIssueFlags: normalization.issueFlags,
      suiteStrippingImprovedMatch: best.addressVariant === "NORMALIZED" && normalization.suiteStripped,
      candidates,
      attempts,
      failureReason: "Best geocode candidate is below certification confidence threshold.",
    };
  }

  return {
    status: "FAILED_GEOCODE",
    provider: "dal-server-geocode-proxy",
    confidence: 0,
    geocodeMethod: "SERVER_PROXY",
    rawAddress: normalization.rawAddressLine,
    normalizedAddress: normalization.normalizedAddress,
    lookupAddress: normalization.normalizedAddress,
    suiteDetail: normalization.suiteDetail,
    addressIssueFlags: normalization.issueFlags,
    suiteStrippingImprovedMatch: false,
    candidates,
    attempts,
    failureReason: attempts.map((attempt) => `${attempt.provider}: ${attempt.failureReason ?? "No certified match"}`).join("; ") || "No geocoder returned candidate coordinates. Manual pin required.",
  };
}

export async function handleGeocode(req, res, pathname) {
  if (pathname !== "/api/geocode") return false;
  if (handleOptions(req, res)) return true;
  if (req.method !== "POST") {
    errorResponse(res, 405, "POST /api/geocode required.");
    return true;
  }
  const body = await readRequestJson(req);
  jsonResponse(res, 200, await resolveGeocode(body));
  return true;
}
