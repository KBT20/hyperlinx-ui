import type { CloseEvent, CloseEventType, IOFPackage, ScopeVersion, ScopeVersionRelationshipType, ScopeVersionTruthType } from "../types/dal";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function eventTypeForPackage(iofPackage: IOFPackage): CloseEventType {
  if (iofPackage.packageType === "ENGINEERING") return "ENGINEERING_CLOSE";
  if (iofPackage.packageType === "PERMITTING") return "PERMIT_CLOSE";
  if (iofPackage.packageType === "AS_BUILT") return "AS_BUILT_CLOSE";
  if (iofPackage.packageType === "CONSTRUCTION" || iofPackage.packageType === "SPLICING" || iofPackage.packageType === "TESTING") return "CONSTRUCTION_CLOSE";
  return "FIELD_CLOSE";
}

function relationshipForClose(eventType: CloseEventType): ScopeVersionRelationshipType {
  return eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : "FIELD_CLOSURE";
}

function truthTypeForClose(eventType: CloseEventType): ScopeVersionTruthType {
  return eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : "FIELD_CLOSED";
}

export function createCloseEventFromPackage(iofPackage: IOFPackage, eventType: CloseEventType = eventTypeForPackage(iofPackage)): CloseEvent {
  return {
    closeEventId: createId("close-event"),
    sourceScopeVersionId: iofPackage.scopeVersionId,
    packageId: iofPackage.packageId,
    eventType,
    timestamp: nowIso(),
    payload: {
      packageType: iofPackage.packageType,
      packageStatus: iofPackage.status,
      progress: iofPackage.progress,
    },
  };
}

export function createChildScopeVersionFromCloseEvent(args: {
  parent: ScopeVersion;
  iofPackage: IOFPackage;
  closeEvent: CloseEvent;
}): ScopeVersion {
  const { parent, iofPackage, closeEvent } = args;
  const timestamp = closeEvent.timestamp || nowIso();
  const relationshipType = relationshipForClose(closeEvent.eventType);
  const type = truthTypeForClose(closeEvent.eventType);
  const scopeVersionId = `${type === "AS_BUILT" ? "SV-ASBUILT" : "SV-CLOSE"}-${closeEvent.closeEventId.replace(/^close-event-/, "").slice(0, 18)}`;
  return {
    ...parent,
    scopeVersionId,
    type,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    source: "FieldClosure",
    status: closeEvent.eventType === "AS_BUILT_CLOSE" ? "COMPLETE" : parent.status,
    certificationState: "DRAFT",
    isImmutable: false,
    closureEventId: closeEvent.closeEventId,
    iofPackageIds: Array.from(new Set([...(parent.iofPackageIds ?? []), iofPackage.packageId])),
    updatedAt: timestamp,
    createdAt: timestamp,
    canonicalTruth: {
      ...parent.canonicalTruth,
      parentScopeVersionId: parent.scopeVersionId,
      rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
      relationshipType,
      constitutionalAuthority: "NON_AUTHORITATIVE",
      executionChain: {
        sourceScopeVersionId: parent.scopeVersionId,
        packageId: iofPackage.packageId,
        closeEventId: closeEvent.closeEventId,
        childScopeVersionId: scopeVersionId,
      },
      latestCloseEvent: closeEvent,
      latestIOFPackage: iofPackage,
    },
    events: [
      ...(parent.events ?? []),
      {
        eventId: createId("event"),
        type: "scopeversion.child.created_from_close",
        entityId: scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          sourceScopeVersionId: parent.scopeVersionId,
          packageId: iofPackage.packageId,
          closeEventId: closeEvent.closeEventId,
          relationshipType,
        },
        createdAt: timestamp,
      },
    ],
  };
}
