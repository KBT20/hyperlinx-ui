export function summarizeValidation(context: any) {
  const validation = context?.validation;
  if (!validation) return { status: "UNKNOWN", issueCount: 0 };
  const issues = Array.isArray(validation?.issues) ? validation.issues : [];
  return {
    status: validation?.status ?? "UNKNOWN",
    issueCount: issues.length,
    failedChecks: issues.filter((issue: any) => issue?.status === "FAIL").map((issue: any) => issue?.check),
    warningChecks: issues.filter((issue: any) => issue?.status === "WARNING").map((issue: any) => issue?.check),
  };
}

