import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHostedAiFetch,
  getAiRuntimeTimeouts,
} from "../../src/services/ai/aiRuntimeTimeout.service.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AI runtime timeout policy", () => {
  it("uses quality-first defaults and supports explicit overrides", () => {
    expect(getAiRuntimeTimeouts({})).toEqual({
      hostedMs: 30000,
      localChatMs: 15000,
      localEmbeddingMs: 8000,
    });

    expect(getAiRuntimeTimeouts({
      AI_CHATBOT_GEMINI_TIMEOUT_MS: "22000",
      AI_CHATBOT_LOCAL_TIMEOUT_MS: "12000",
      AI_CHATBOT_EMBEDDING_TIMEOUT_MS: "6000",
    })).toEqual({
      hostedMs: 22000,
      localChatMs: 12000,
      localEmbeddingMs: 6000,
    });
  });

  it("aborts a Gemini request that exceeds the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_, init = {}) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }));
    const fetchWithTimeout = createHostedAiFetch({
      fetchImpl,
      env: { AI_CHATBOT_GEMINI_TIMEOUT_MS: "25" },
    });

    const pending = fetchWithTimeout(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      { method: "POST" },
    );
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("does not alter non-Gemini requests or an existing caller signal", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    const fetchWithTimeout = createHostedAiFetch({ fetchImpl, env: {} });

    await fetchWithTimeout("https://example.com/data", { method: "GET" });
    expect(fetchImpl.mock.calls[0][1].signal).toBeUndefined();

    const controller = new AbortController();
    await fetchWithTimeout(
      "https://generativelanguage.googleapis.com/v1beta/models/test:generateContent",
      { signal: controller.signal },
    );
    expect(fetchImpl.mock.calls[1][1].signal).toBe(controller.signal);
  });
});
