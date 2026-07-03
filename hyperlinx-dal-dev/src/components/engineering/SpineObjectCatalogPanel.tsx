import type { DraftIofPackageRuntime } from "../../api/teralinxRuntime";

type SpineObjectCatalogPanelProps = {
  draftPackage: DraftIofPackageRuntime;
};

function text(value: unknown, fallback = "n/a") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

export function SpineObjectCatalogPanel({ draftPackage }: SpineObjectCatalogPanelProps) {
  const catalogSummary = record(draftPackage.spineObjectCatalogSummary);
  const manifestSummary = record(draftPackage.auditObjectManifestSummary);
  const catalogEntries = list(draftPackage.spineObjectCatalogEntries).slice(0, 8);
  const manifestEntries = list(draftPackage.auditObjectManifestEntries).slice(0, 8);
  const reviewObjects = list(draftPackage.auditManifestReviewObjects);
  const objectProductionProfiles = list(draftPackage.objectProductionProfiles);
  const instantiatedObjects = list(draftPackage.instantiatedSpineObjects);
  const instantiationSummary = record(draftPackage.instantiationSummary);
  const instantiationHealth = record(draftPackage.instantiationHealth);
  const hierarchySummary = record(draftPackage.hierarchySummary);

  return (
    <section className="dal-panel spine-object-catalog-panel">
      <div className="dal-panel-title-row">
        <div>
          <h3>Spine Object Catalog</h3>
          <span>Manifest Entries, Expected Quantities, Object Classes, Construction Methods, Placement Strategies, Hierarchy, Dependencies, Sequence Templates, Evidence Templates, Visibility Profiles, Recommendation Templates</span>
        </div>
        <span className={`dal-badge ${instantiatedObjects.length ? "pass" : "warning"}`}>{instantiatedObjects.length ? "Instantiated" : "Not Instantiated Yet"}</span>
      </div>

      <div className="teralinx-summary-grid">
        <div><span>Catalog Entries</span><b>{text(catalogSummary.catalogEntryCount, "0")}</b></div>
        <div><span>Manifest Entries</span><b>{text(manifestSummary.manifestEntryCount, "0")}</b></div>
        <div><span>Review Objects</span><b>{reviewObjects.length.toLocaleString()}</b></div>
        <div><span>Instantiation Status</span><b>{text(manifestSummary.instantiationStatus, "NOT_INSTANTIATED_YET").replaceAll("_", " ")}</b></div>
        <div><span>Instantiated Spine Objects</span><b>{text(instantiationSummary.createdObjects ?? instantiatedObjects.length, "0")}</b></div>
        <div><span>Instantiation Health</span><b>{text(instantiationHealth.instantiationStatus, "MISSING")}</b></div>
      </div>

      {instantiatedObjects.length ? (
        <details open>
          <summary>Instantiated Spine Objects</summary>
          <div className="engineering-certification-list">
            {instantiatedObjects.slice(0, 12).map((object) => {
              const stationAddress = record(object.stationAddress);
              const fromAddress = record(object.fromStationAddress);
              const toAddress = record(object.toStationAddress);
              return (
                <div key={text(object.spineObjectId)}>
                  <b>{text(object.objectType, "Spine Object")} / {text(object.spineObjectId)}</b>
                  <span className={`dal-badge ${object.reviewStatus === "READY_FOR_ENGINEERING_REVIEW" ? "pass" : "warning"}`}>{text(object.reviewStatus, "Review Status").replaceAll("_", " ")}</span>
                  <small>Hierarchy: Parent {text(object.parentObjectId, "root")} / Children {list(object.childObjectIds).length.toLocaleString()} / Valid {text(hierarchySummary.hierarchyValid, "pending")}</small>
                  <small>Production Profile: {list(object.productionProfileIds).map((item) => text(item)).join(", ") || text(object.productionProfileId)}</small>
                  <small>Construction Method: {text(object.constructionMethod)}</small>
                  <small>Dependencies: {list(record(object.dependencyTemplate).templates).length.toLocaleString()} template(s)</small>
                  <small>Execution Sequence: {list(record(object.executionSequenceTemplate).templates).map((item) => text(item.label)).join(" > ") || "n/a"}</small>
                  <small>Evidence: {list(record(object.evidenceTemplate).requiredEvidence).map((item) => text(item)).join(", ") || "n/a"}</small>
                  <small>Current State: {text(object.currentState, "PLANNED")}</small>
                  <small>Address: {text(stationAddress.stationLabel ?? fromAddress.stationLabel, "pending")} {toAddress.stationLabel ? `to ${text(toAddress.stationLabel)}` : ""}</small>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      <div className="engineering-certification-list">
        {manifestEntries.map((entry) => {
              const catalogEntry = record(entry.catalogEntry);
              const hierarchy = record(entry.expectedHierarchy);
              const placementStrategy = record(entry.placementStrategy);
              const visibility = record(entry.visibility);
              const recommendations = list(entry.recommendationTemplates).map((item) => text(item.recommendation)).join(", ");
              const productionProfiles = objectProductionProfiles
                .filter((item) => text(item.manifestEntryId) === text(entry.manifestEntryId))
                .slice(0, 3);
              return (
                <div key={text(entry.manifestEntryId)}>
                  <b>{text(catalogEntry.displayName ?? entry.objectType, "Manifest Entry")}</b>
                  <span className="dal-badge warning">Not Instantiated Yet</span>
                  <small>Expected Quantity: {text(entry.expectedQuantity, "0")} {text(entry.expectedQuantityUnit, "")}</small>
                  <small>Expected Hierarchy: {text(hierarchy.hierarchyStatus, "REVIEW_REQUIRED").replaceAll("_", " ")}</small>
                  <small>Construction Methods: {list(entry.constructionMethodTemplates).map((item) => text(item.method)).join(", ") || text((entry.constructionMethods as unknown[] | undefined)?.join?.(", "), "n/a")}</small>
                  <small>Placement Strategies: {text(placementStrategy.placementMethod)} / {text(placementStrategy.engineeringReview)}</small>
                  {productionProfiles.map((item) => {
                    const profile = record(item.profile);
                    return (
                      <small key={text(item.objectProductionProfileId)}>
                        Production Profile: {text(profile.profileId)} / Rate {text(profile.productionRate)} {text(profile.productionRateUnit)} / Crew {text(profile.crewType)} / Schedule {profile.scheduleParticipation ? "YES" : "NO"} / Payment {profile.paymentParticipation ? "YES" : "NO"} / Human Override {list(item.humanOverrides).length ? "RECORDED" : "NONE"} / Review Required {item.requiresHumanReview ? "YES" : "NO"}
                      </small>
                    );
                  })}
                  <small>Visibility Profiles: Commercial {text(visibility.commercial)} / Engineering {text(visibility.engineering)} / Field {text(visibility.field)} / Operational Twin {text(visibility.operationalTwin ?? visibility.twin)}</small>
                  <small>Recommendation Templates: {recommendations || "n/a"}</small>
                </div>
              );
            })}
        {!manifestEntries.length ? <div className="dal-status">Audit Object Manifest has not been assembled for this Draft IOF Package.</div> : null}
      </div>

      <details>
        <summary>Catalog Entries</summary>
        <div className="engineering-certification-list">
          {catalogEntries.map((entry) => (
            <div key={text(entry.catalogEntryId)}>
              <b>{text(entry.displayName ?? entry.objectType, "Catalog Entry")}</b>
              <small>{text(entry.objectClass)} / {text(entry.addressType)} / {text(entry.lifecycleParticipation)}</small>
              <small>Dependencies: {list(entry.defaultDependencies).map((item) => text(item.dependencyType)).join(", ")}</small>
              <small>Sequence Templates: {list(entry.defaultExecutionSequence).map((item) => text(item.label)).join(" > ")}</small>
              <small>Evidence Templates: {list(entry.requiredEvidence).map((item) => text(item)).join(", ")}</small>
              <small>Production Profiles: {list(entry.productionProfileIds).map((item) => text(item)).join(", ") || "n/a"}</small>
            </div>
          ))}
        </div>
      </details>

      <details>
        <summary>Review Objects</summary>
        <div className="engineering-certification-list">
          {reviewObjects.map((item) => (
            <div key={text(item.reviewObjectId)}>
              <b>{text(item.label, "Review Object")}</b>
              <span className={`dal-badge ${item.blocking ? "warning" : "pass"}`}>{item.blocking ? "Blocking" : "Non-blocking"}</span>
              <small>{text(item.reviewType)} / Engineering disposition required: {item.engineeringDispositionRequired ? "YES" : "NO"}</small>
            </div>
          ))}
          {!reviewObjects.length ? <div className="dal-status">No Audit Object Manifest review objects are open.</div> : null}
        </div>
      </details>
    </section>
  );
}
