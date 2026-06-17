import {
  deriveRouteCertificationState,
  type CertificationAuthorityDecision,
  type CertificationAuthorityInput,
} from "../certification/CertificationAuthority";

type CertificationAuthorityStripProps = {
  title?: string;
  decision?: CertificationAuthorityDecision;
  input?: CertificationAuthorityInput;
};

export default function CertificationAuthorityStrip({ title = "Certification Authority", decision, input }: CertificationAuthorityStripProps) {
  const authority = decision ?? (input ? deriveRouteCertificationState(input) : null);
  if (!authority) {
    return (
      <div className="dal-status">
        <b>{title}</b>
        <div>No route certification authority is available for the selected route.</div>
      </div>
    );
  }

  return (
    <div className="dal-status">
      <b>{title}</b>
      <div className="dal-metrics">
        <span>Route Certification State: {authority.state}</span>
        <span>Evidence Grade: {authority.evidenceGrade}</span>
        <span>Evidence Status: {authority.evidenceStatus}</span>
        <span>Constraint Completeness: {authority.constraintCompletenessPercent}%</span>
        <span>Missing Layers: {authority.missingConstraintLayers.join(", ") || "none"}</span>
        <span>Can Create Child ScopeVersion: {authority.canCreateChildScopeVersion ? "YES" : "NO"}</span>
        <span>Can Generate Quote: {authority.canGenerateQuote ? "YES" : "NO"}</span>
        <span>Can Proceed To Package: {authority.canProceedToPackage ? "YES" : "NO"}</span>
        <span>Provisional: {authority.provisional ? "YES" : "NO"}</span>
      </div>
      {authority.reasons.length ? (
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Reasons</th>
                <th>Required Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(authority.reasons.length, authority.requiredActions.length) }).map((_, index) => (
                <tr key={index}>
                  <td>{authority.reasons[index] ?? ""}</td>
                  <td>{authority.requiredActions[index] ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
