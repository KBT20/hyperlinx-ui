import { callOpenAI } from "./llmGateway";

export async function runPrismLLM(routeCoords: number[][]) {
  const prompt = `
Given this fiber route:
${JSON.stringify(routeCoords)}

Find 5 enterprise or commercial targets near the route.

Return ONLY JSON in this format:
{
  "targets": [
    { "lat": number, "lon": number, "type": "enterprise", "confidence": number }
  ]
}
`;

  const raw = await callOpenAI(prompt);

  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed.targets || [];
  } catch (e) {
    console.error("LLM parse error:", raw);
    return [];
  }
}