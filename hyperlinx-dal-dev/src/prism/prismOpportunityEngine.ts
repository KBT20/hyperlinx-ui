import { createId, now } from "../api/dalClient";
import type { DALCoordinate, InventoryGraph, InventoryNode, InventoryRoute, InventoryStation } from "../types/dal";
import type { BuildCostModel, CandidateSite, DistanceAnalysis, OpportunitySeed, PricingModel } from "../types/portfolio";
import { estimateBuildCost, DEFAULT_BUILD_COST_MODEL } from "./buildCostEstimator";
import { scoreEngineering } from "./engineeringScoringEngine";
import { scoreFinancials } from "./financialScoringEngine";
import { rankOpportunitySeeds } from "./opportunityRankingEngine";
import { DEFAULT_PRICING_MODEL, estimateRevenue } from "./revenueEstimator";
import { scoreStrategicFit } from "./strategicScoringEngine";

function haversineFeet(a: DALCoordinate, b: DALCoordinate) {
  const r = 6371008.8;
  const toRad = Math.PI / 180;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h)) * 3.28084;
}

function sampledStep(length: number, maxItems: number) {
  return Math.max(1, Math.ceil(length / maxItems));
}

function nearestRoute(routes: InventoryRoute[], target: DALCoordinate) {
  let best: { route: InventoryRoute; distanceFeet: number } | null = null;
  const routeStep = sampledStep(routes.length, 8000);
  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += routeStep) {
    const route = routes[routeIndex];
    const coordStep = sampledStep(route.coordinates.length, 200);
    for (let i = 0; i < route.coordinates.length; i += coordStep) {
      const distanceFeet = haversineFeet(route.coordinates[i], target);
      if (!best || distanceFeet < best.distanceFeet) best = { route, distanceFeet };
    }
  }
  return best;
}

function nearestNode(nodes: InventoryNode[], target: DALCoordinate, maxItems = 30000) {
  let best: { node: InventoryNode; distanceFeet: number } | null = null;
  const step = sampledStep(nodes.length, maxItems);
  for (let i = 0; i < nodes.length; i += step) {
    const node = nodes[i];
    const distanceFeet = haversineFeet([node.lon, node.lat], target);
    if (!best || distanceFeet < best.distanceFeet) best = { node, distanceFeet };
  }
  return best;
}

function nearestStation(stations: InventoryStation[], target: DALCoordinate) {
  let best: { station: InventoryStation; distanceFeet: number } | null = null;
  const step = sampledStep(stations.length, 30000);
  for (let i = 0; i < stations.length; i += step) {
    const station = stations[i];
    const distanceFeet = haversineFeet([station.lon, station.lat], target);
    if (!best || distanceFeet < best.distanceFeet) best = { station, distanceFeet };
  }
  return best;
}

function popNodes(graph: InventoryGraph) {
  const candidates = graph.nodes.filter((node) => node.routeIds.length >= 3);
  return candidates.length ? candidates : graph.nodes;
}

export function analyzeCandidateDistance(graph: InventoryGraph, candidate: CandidateSite): DistanceAnalysis {
  const target: DALCoordinate = [candidate.longitude, candidate.latitude];
  const route = nearestRoute(graph.routes, target);
  const node = nearestNode(graph.nodes, target);
  const station = nearestStation(graph.stations, target);
  const pop = nearestNode(popNodes(graph), target, 10000);
  const distanceToNearestRouteFeet = route?.distanceFeet ?? Infinity;
  const distanceToNearestStationFeet = station?.distanceFeet ?? Infinity;
  const distanceToNearestNodeFeet = node?.distanceFeet ?? Infinity;
  const distanceToNearestPopFeet = pop?.distanceFeet ?? Infinity;
  return {
    nearestRouteId: route?.route.routeId,
    nearestNodeId: node?.node.nodeId,
    nearestStationId: station?.station.stationId,
    nearestPopId: pop?.node.nodeId,
    distanceToNearestRouteFeet,
    distanceToNearestStationFeet,
    distanceToNearestNodeFeet,
    distanceToNearestPopFeet,
    distanceFeet: Math.min(distanceToNearestRouteFeet, distanceToNearestStationFeet, distanceToNearestNodeFeet, distanceToNearestPopFeet),
  };
}

export function evaluatePortfolioOpportunities(
  graph: InventoryGraph,
  candidates: CandidateSite[],
  pricingModel: PricingModel = DEFAULT_PRICING_MODEL,
  buildCostModel: BuildCostModel = DEFAULT_BUILD_COST_MODEL
): OpportunitySeed[] {
  const createdAt = now();
  const seeds = candidates
    .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude))
    .map((candidate) => {
      const distance = analyzeCandidateDistance(graph, candidate);
      const build = estimateBuildCost(distance.distanceToNearestRouteFeet, candidate.candidateType, buildCostModel);
      const revenue = estimateRevenue(candidate, pricingModel);
      const financial = scoreFinancials(build, revenue);
      const strategic = scoreStrategicFit(graph, candidate, distance);
      const engineering = scoreEngineering(distance, build);
      const confidence = Math.max(0.45, Math.min(0.98, 0.92 - Math.min(distance.distanceFeet / 100000, 0.35)));
      return {
        id: createId("seed"),
        inventoryId: graph.inventoryId,
        graphId: graph.graphId,
        candidateType: candidate.candidateType,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        nearestRouteId: distance.nearestRouteId,
        nearestNodeId: distance.nearestNodeId,
        nearestStationId: distance.nearestStationId,
        nearestPopId: distance.nearestPopId,
        distanceFeet: distance.distanceFeet,
        buildCost: build.totalCost,
        estimatedRevenueMonthly: revenue.estimatedRevenueMonthly,
        estimatedRevenueAnnual: revenue.estimatedRevenueAnnual,
        estimatedNRC: revenue.estimatedNRC,
        estimatedMRC: revenue.estimatedMRC,
        estimatedTCV: revenue.estimatedTCV,
        paybackMonths: financial.paybackMonths,
        strategicScore: strategic.strategicScore,
        financialScore: financial.financialScore,
        engineeringScore: engineering.engineeringScore,
        overallScore: 0,
        confidence,
        createdAt,
        siteName: candidate.name,
        distanceAnalysis: distance,
        buildCostEstimate: build,
        revenueEstimate: revenue,
        financialAnalysis: financial,
        strategicAnalysis: strategic,
        engineeringAnalysis: engineering,
      } satisfies OpportunitySeed;
    });
  return rankOpportunitySeeds(seeds);
}

export function generateCandidateSitesFromGraph(graph: InventoryGraph, count: number, candidateType = "enterprise" as CandidateSite["candidateType"]): CandidateSite[] {
  const routes = graph.routes.length ? graph.routes : [];
  if (!routes.length) return [];
  const candidates: CandidateSite[] = [];
  for (let i = 0; i < count; i += 1) {
    const route = routes[Math.floor((i / Math.max(count, 1)) * routes.length)] ?? routes[i % routes.length];
    const coords = route.coordinates.length ? route.coordinates : [[-96.8, 32.8] as DALCoordinate];
    const coord = coords[Math.floor((i * 17) % coords.length)];
    const offset = ((i % 9) - 4) * 0.0025;
    candidates.push({
      id: `site-${String(i + 1).padStart(3, "0")}`,
      name: `FiberLight Site ${String(i + 1).padStart(3, "0")}`,
      candidateType,
      latitude: coord[1] + offset,
      longitude: coord[0] - offset,
    });
  }
  return candidates;
}

function normalizeCandidateType(value: string, fallback: CandidateSite["candidateType"]): CandidateSite["candidateType"] {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const allowed: CandidateSite["candidateType"][] = ["enterprise", "tower", "data_center", "wireless", "carrier", "hyperscaler", "residential_cluster"];
  return allowed.includes(normalized as CandidateSite["candidateType"]) ? (normalized as CandidateSite["candidateType"]) : fallback;
}

export function parseCandidateCsv(text: string, fallbackType: CandidateSite["candidateType"] = "enterprise"): CandidateSite[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map((item) => item.trim().toLowerCase());
  const hasHeader = header.some((item) => ["lat", "latitude", "lon", "lng", "longitude"].includes(item));
  const rows = hasHeader ? lines.slice(1) : lines;
  const lookup = (cells: string[], names: string[], fallbackIndex: number) => {
    const index = names.map((name) => header.indexOf(name)).find((idx) => idx >= 0);
    return cells[index ?? fallbackIndex] ?? "";
  };
  return rows
    .map((line, index) => {
      const cells = line.split(",").map((item) => item.trim());
      const id = lookup(cells, ["id", "site_id", "site"], 0) || `site-${index + 1}`;
      const name = lookup(cells, ["name", "site_name", "label"], 1) || id;
      const candidateType = normalizeCandidateType(lookup(cells, ["type", "candidate_type"], 2) || fallbackType, fallbackType);
      const latitude = Number(lookup(cells, ["latitude", "lat"], hasHeader ? 0 : 2));
      const longitude = Number(lookup(cells, ["longitude", "lng", "lon"], hasHeader ? 1 : 3));
      return { id, name, candidateType, latitude, longitude };
    })
    .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude));
}
