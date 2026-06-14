export const ROLE_PERMISSIONS: Record<string, string[]> = {
  engineering: ["engineering_complete"],
  permitting: ["permit_approved"],
  construction: ["construction_complete", "cable_pulled"],
  splicing: ["splice_test_complete"],
  qa: ["asbuilt_verified"],
  admin: ["*"]
};

export const CLOSE_TO_ROLE: Record<string, string> = {
  engineering_complete: "engineering",
  permit_approved: "permitting",
  construction_complete: "construction",
  cable_pulled: "construction",
  splice_test_complete: "splicing",
  asbuilt_verified: "qa"
};