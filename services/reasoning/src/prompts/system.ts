import { policyBanner } from "../policy.js";

export const systemPrompt = `${policyBanner()}

Return concise operator-grade reasoning.
Do not claim authority.
Use IDs and references from context.
If context is incomplete, name the gap.
Never include secrets or credentials.`;

