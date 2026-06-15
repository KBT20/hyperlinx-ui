import type { CapacityAnalysis, CapacityStatus } from "../types/networkAffinity";

function statusFromLoad(load: number): CapacityStatus {
  if (load < 0.45) return "LOW";
  if (load < 0.7) return "MEDIUM";
  if (load < 0.9) return "HIGH";
  return "CRITICAL";
}

function deterministicLoad(id: string | undefined, salt: number) {
  if (!id) return 0.2;
  let hash = salt;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return (hash % 100) / 100;
}

export function analyzeCapacity(routeId?: string, nodeId?: string, stationId?: string, addedRevenueMonthly = 0): CapacityAnalysis {
  const addedLoad = Math.min(addedRevenueMonthly / 100000, 0.18);
  const routeLoad = deterministicLoad(routeId, 7);
  const nodeLoad = deterministicLoad(nodeId, 13);
  const stationLoad = deterministicLoad(stationId, 19);
  const projected = Math.max(routeLoad, nodeLoad, stationLoad) + addedLoad;
  return {
    routeUtilization: statusFromLoad(routeLoad),
    nodeUtilization: statusFromLoad(nodeLoad),
    stationUtilization: statusFromLoad(stationLoad),
    projectedUtilization: statusFromLoad(projected),
  };
}

