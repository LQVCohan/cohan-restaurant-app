import { beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";

const state = vi.hoisted(() => ({
  restaurants: [],
  knowledge: [],
  resolveScope: vi.fn(),
  createEmbedding: vi.fn(),
}));

const normalize = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const chain = (rows) => ({
  sort: () => chain(rows),
  limit: (limit) => chain(rows.slice(0, limit)),
  lean: async () => rows,
  then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
});

vi.mock("../../src/services/ai/restaurantChatbotCore.service.js", () => ({
  __testables: {
    resolveRestaurantScope: (...args) => state.resolveScope(...args),
  },
}));

vi.mock("../../src/services/ai/restaurantChatbotEmbedding.service.js", () => ({
  createEmbedding: (...args) => state.createEmbedding(...args),
}));

vi.mock("../../models/index.js", () => ({
  Restaurant: {
    find: () =>
      chain(
        state.restaurants.filter(
          (restaurant) =>
            restaurant.businessStatus === "active" &&
            restaurant.publicationStatus === "published" &&
            restaurant.aiChatbotSettings?.enabled !== false,
        ),
      ),
  },
  AiChatbotKnowledgeItem: {
    find: (query = {}) => {
      const allowedIds = new Set(
        (query.restaurantId?.$in || []).map((id) => String(id)),
      );
      let rows = state.knowledge.filter(
        (item) =>
          (!allowedIds.size || allowedIds.has(String(item.restaurantId))) &&
          (query.enabled == null || item.enabled === query.enabled),
      );

      if (query.embedding?.$exists) {
        rows = rows.filter(
          (item) => Array.isArray(item.embedding) && item.embedding.length > 0,
        );
      }

      if (query.$text?.$search) {
        const terms = normalize(query.$text.$search)
          .split(/[^a-z0-9]+/g)
          .filter((term) => term.length >= 2);
        rows = rows.filter((item) => {
          const haystack = normalize(
            `${item.title || ""} ${item.content || ""} ${(item.tags || []).join(" ")}`,
          );
          return terms.some((term) => haystack.includes(term));
        });
      }

      return chain(rows);
    },
  },
}));

import {
  findUniqueKnowledgeRestaurantId,
  resolveUniqueKnowledgeRestaurantOptions,
} from "../../src/services/ai/restaurantChatbotKnowledgeScope.service.js";

const restaurant = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: "Nhà hàng",
  businessStatus: "active",
  publicationStatus: "published",
  aiChatbotSettings: { enabled: true },
  ...overrides,
});

const knowledge = (restaurantId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  restaurantId,
  title: "Tri thức",
  content: "Nội dung",
  tags: [],
  enabled: true,
  priority: 80,
  ...overrides,
});

beforeEach(() => {
  state.restaurants.length = 0;
  state.knowledge.length = 0;
  state.resolveScope.mockReset().mockResolvedValue({
    mode: "global",
    reason: "global",
    restaurantId: null,
  });
  state.createEmbedding.mockReset().mockResolvedValue(null);
});

describe("restaurantChatbotKnowledgeScope", () => {
  it("resolves a global question to the only restaurant with matching knowledge", async () => {
    const first = restaurant({ name: "Cohan A" });
    const second = restaurant({ name: "Cohan B" });
    state.restaurants.push(first, second);
    state.knowledge.push(
      knowledge(first._id, {
        title: "Playbook gợi ý món khi xem bóng đá",
        content:
          "Khi khách nói đang xem bóng đá, coi đá banh hoặc cần món ăn lúc giải trí, ưu tiên món dễ chia sẻ và combo.",
        tags: ["bóng đá", "gợi ý món"],
      }),
      knowledge(second._id, {
        title: "Thông tin bãi giữ xe",
        content: "Nhà hàng có bãi giữ xe máy.",
        tags: ["bãi xe"],
      }),
    );

    const resolved = await resolveUniqueKnowledgeRestaurantOptions({
      message: "Nay coi đá banh, có gì ăn ngon không?",
      pageContext: { pathname: "/" },
    });

    expect(resolved.restaurantId).toBe(String(first._id));
    expect(resolved.pageContext.restaurantId).toBe(String(first._id));
  });

  it("keeps the request global when matching knowledge belongs to multiple restaurants", async () => {
    const first = restaurant({ name: "Cohan A" });
    const second = restaurant({ name: "Cohan B" });
    state.restaurants.push(first, second);
    state.knowledge.push(
      knowledge(first._id, {
        title: "Xem bóng đá ăn gì",
        content: "Gợi ý món khi coi đá banh.",
      }),
      knowledge(second._id, {
        title: "Playbook bóng đá",
        content: "Món dễ chia sẻ khi xem bóng đá.",
      }),
    );

    const resolved = await resolveUniqueKnowledgeRestaurantOptions({
      message: "Coi đá banh ăn gì?",
      pageContext: { pathname: "/" },
    });

    expect(resolved.restaurantId).toBeUndefined();
    expect(resolved.pageContext.restaurantId).toBeUndefined();
  });

  it("does not override a restaurant already resolved by the existing scope flow", async () => {
    const first = restaurant({ name: "Cohan A" });
    state.restaurants.push(first);
    state.knowledge.push(
      knowledge(first._id, {
        title: "Playbook bóng đá",
        content: "Món xem bóng đá.",
      }),
    );
    state.resolveScope.mockResolvedValue({
      mode: "restaurant",
      reason: "uniqueRestaurantName",
      restaurantId: String(first._id),
    });

    const original = {
      message: "Cohan A có món gì?",
      pageContext: { pathname: "/" },
    };
    const resolved = await resolveUniqueKnowledgeRestaurantOptions(original);

    expect(resolved).toBe(original);
  });

  it("ignores knowledge owned by restaurants that are not publicly eligible", async () => {
    const eligible = restaurant({ name: "Cohan A" });
    const hidden = restaurant({
      name: "Cohan Hidden",
      publicationStatus: "draft",
    });
    state.restaurants.push(eligible, hidden);
    state.knowledge.push(
      knowledge(hidden._id, {
        title: "Playbook bóng đá",
        content: "Khi coi đá banh hãy gọi món dễ chia.",
      }),
    );

    const restaurantId = await findUniqueKnowledgeRestaurantId({
      message: "Coi đá banh ăn gì?",
      restaurantIds: [String(eligible._id)],
    });

    expect(restaurantId).toBeNull();
  });
});
