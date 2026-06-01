export const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const stripJsonFences = (value = "") => String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

export function safeParseGeminiJson(text) {
  const raw = stripJsonFences(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
    }
    return null;
  }
}

export async function generateGeminiJson({ apiKey, model = "gemini-1.5-flash", systemInstruction = "", prompt = "", timeoutMs = 8000, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  if (!model || /^gpt-/i.test(model)) throw new Error("A Gemini model name is required");
  if (typeof fetchImpl !== "function") throw new Error("fetch is not available");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(Number(timeoutMs) || 8000, 1000));
  try {
    const endpoint = `${GEMINI_ENDPOINT_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("\n").trim();
    const parsed = safeParseGeminiJson(text);
    if (!parsed) throw new Error("Gemini returned invalid JSON");
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
