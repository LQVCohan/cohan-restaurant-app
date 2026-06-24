import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rewriteRestaurantProfileDescription } from "../../src/services/ai/restaurantProfileRewrite.service.js";

const ORIGINAL_ENV = { ...process.env };

const makeGeminiPayload = (text) => ({
  candidates: [
    {
      content: {
        parts: [{ text }],
      },
    },
  ],
});

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.GEMINI_REWRITE_MODEL;
  process.env.GEMINI_REWRITE_TIMEOUT_MS = "5000";
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("rewriteRestaurantProfileDescription", () => {
  it("returns a useful fallback when Gemini key is missing", async () => {
    const result = await rewriteRestaurantProfileDescription({
      restaurantName: "Cohan Restaurant",
      cuisineType: "Chưa chọn ẩm thực",
      currentText: "",
      chefName: "",
    });

    expect(result.provider).toBe("fallback");
    expect(result.usedGemini).toBe(false);
    expect(result.text).toContain("Cohan Restaurant");
    expect(result.text).not.toMatch(/Chưa chọn ẩm thực/i);
    expect(result.text.split(/[.!?]+/).filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });

  it("uses Gemini when the model returns valid copy", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_REWRITE_MODEL = "gemini-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          makeGeminiPayload(
            "Cohan Restaurant mang đến không gian ẩm thực ấm cúng, nơi thực khách có thể thưởng thức các món ăn được chuẩn bị kỹ lưỡng và phục vụ chỉn chu. Nhà hàng phù hợp cho bữa ăn gia đình, gặp gỡ bạn bè hoặc những dịp cần một trải nghiệm gần gũi nhưng vẫn chuyên nghiệp.",
          ),
      }),
    );

    const result = await rewriteRestaurantProfileDescription({
      restaurantName: "Cohan Restaurant",
      cuisineType: "ẩm thực hiện đại",
      currentText: "Không gian ấm cúng",
    });

    expect(result.provider).toBe("gemini");
    expect(result.usedGemini).toBe(true);
    expect(result.reason).toBe("model:gemini-test");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("repairs short Gemini output before accepting it", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_REWRITE_MODEL = "gemini-test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeGeminiPayload("Cohan Restaurant mang đến trải nghiệm"),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeGeminiPayload(
            "Cohan Restaurant là điểm hẹn ẩm thực hiện đại với không gian gần gũi, phục vụ chỉn chu và món ăn được chuẩn bị kỹ lưỡng cho từng bữa dùng. Nhà hàng phù hợp cho khách muốn tìm một nơi dễ chịu để dùng bữa, gặp gỡ bạn bè hoặc tận hưởng trải nghiệm ẩm thực đáng tin cậy.",
          ),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await rewriteRestaurantProfileDescription({
      restaurantName: "Cohan Restaurant",
      cuisineType: "ẩm thực hiện đại",
    });

    expect(result.provider).toBe("gemini");
    expect(result.usedGemini).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back when all Gemini attempts return invalid output", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_REWRITE_MODEL = "gemini-test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => makeGeminiPayload("Câu cụt"),
      }),
    );

    const result = await rewriteRestaurantProfileDescription({
      restaurantName: "Cohan Restaurant",
      cuisineType: "ẩm thực hiện đại",
    });

    expect(result.provider).toBe("fallback");
    expect(result.usedGemini).toBe(false);
    expect(result.reason).toMatch(/invalid rewrite/i);
  });
});
