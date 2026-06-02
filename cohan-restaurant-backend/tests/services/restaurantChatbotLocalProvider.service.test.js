import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callLocalChatProvider, createLocalEmbedding, getLocalAiConfig, isLocalAiEnabled } from "../../src/services/ai/localAiProvider.service.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv, LOCAL_AI_ENABLED: "true", LOCAL_AI_PROVIDER: "ollama", LOCAL_AI_BASE_URL: "http://127.0.0.1:11434", LOCAL_AI_CHAT_MODEL: "qwen3:8b", LOCAL_AI_EMBEDDING_MODEL: "bge-m3", LOCAL_AI_TIMEOUT_MS: "50" };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("localAiProvider Phase 27", () => {
  it("detects enabled config without exposing secrets", () => {
    expect(isLocalAiEnabled()).toBe(true);
    expect(getLocalAiConfig()).toMatchObject({ provider: "ollama", chatModel: "qwen3:8b", embeddingModel: "bge-m3" });
  });

  it("local chat success normalizes Ollama response", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: { content: '{"answer":"Xin chào","intent":"support","confidence":0.9}' } }) }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callLocalChatProvider({ messages: [{ role: "user", content: "hi" }], systemInstruction: "system" });
    expect(out.content).toContain("Xin chào");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:11434/api/chat", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("qwen3:8b");
    expect(body.messages[0]).toEqual({ role: "system", content: "system" });
  });

  it("local chat timeout/error returns null and logs safe metadata only", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    })));
    const pending = callLocalChatProvider({ messages: [{ role: "user", content: "hi" }] });
    await vi.advanceTimersByTimeAsync(60);
    await expect(pending).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("127.0.0.1");
  });

  it("local embedding success normalizes Ollama response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ embedding: [0.1, 0.2, 0.3] }) })));
    const out = await createLocalEmbedding("deposit policy");
    expect(out).toMatchObject({ model: "bge-m3", provider: "local", embedding: [0.1, 0.2, 0.3] });
  });

  it("local embedding error returns null", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    await expect(createLocalEmbedding("x")).resolves.toBeNull();
  });
});
