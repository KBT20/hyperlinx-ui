import type { InstantiatedSpineObject } from "./SpineObjectInstantiationContracts";

export function buildSpineObjectHierarchy(objects: InstantiatedSpineObject[]): InstantiatedSpineObject[] {
  const primaryBySegment = new Map<string, string>();
  objects.forEach((object) => {
    if (object.objectClass === "PRIMARY_STRUCTURE" && !primaryBySegment.has(object.constructionSegmentId)) {
      primaryBySegment.set(object.constructionSegmentId, object.spineObjectId);
    }
  });

  const withParents = objects.map((object) => {
    if (object.parentObjectId || object.objectClass !== "CONTAINED_CONNECTION") return { ...object };
    return { ...object, parentObjectId: primaryBySegment.get(object.constructionSegmentId) };
  });

  const byId = new Map(withParents.map((object) => [object.spineObjectId, { ...object, childObjectIds: [] as string[] }]));
  byId.forEach((object) => {
    if (!object.parentObjectId) return;
    const parent = byId.get(object.parentObjectId);
    if (parent && !parent.childObjectIds.includes(object.spineObjectId)) parent.childObjectIds.push(object.spineObjectId);
  });

  function ancestors(object: InstantiatedSpineObject): string[] {
    if (!object.parentObjectId) return [];
    const parent = byId.get(object.parentObjectId);
    return parent ? [parent.spineObjectId, ...ancestors(parent)] : [];
  }

  function descendants(object: InstantiatedSpineObject): string[] {
    return object.childObjectIds.flatMap((childId) => {
      const child = byId.get(childId);
      return child ? [child.spineObjectId, ...descendants(child)] : [childId];
    });
  }

  return Array.from(byId.values()).map((object) => {
    const parent = object.parentObjectId ? byId.get(object.parentObjectId) : undefined;
    const inheritedAddress = object.objectClass === "CONTAINED_CONNECTION" && parent ? {
      stationAddress: object.stationAddress ?? parent.stationAddress,
      fromStationAddress: object.fromStationAddress ?? parent.fromStationAddress,
      toStationAddress: object.toStationAddress ?? parent.toStationAddress,
      addressStatus: "INHERITED" as const,
    } : {};
    return {
      ...object,
      ...inheritedAddress,
      ancestorObjectIds: ancestors(object),
      descendantObjectIds: descendants(object),
    };
  });
}
