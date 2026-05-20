import {
  DEFAULT_RANKS_FALLBACK,
  resolveCustomerRank,
  getRankDisplayConfig,
} from "./customerRankUtils";

describe("customerRankUtils", () => {
  it("resolves fallback thresholds", () => {
    expect(resolveCustomerRank(0, []).name).toBe("Mới");
    expect(resolveCustomerRank(5, []).name).toBe("Thân thiết");
    expect(resolveCustomerRank(20, []).name).toBe("VIP");
  });

  it("resolves custom ranks correctly", () => {
    const ranks = [
      { name: "Starter", minPoints: 0 },
      { name: "Gold", minPoints: 10 },
      { name: "Diamond", minPoints: 50 },
    ];
    expect(resolveCustomerRank(12, ranks).name).toBe("Gold");
  });

  it("keeps custom rank display without falling back to Mới", () => {
    const ranks = [...DEFAULT_RANKS_FALLBACK, { name: "Kim cương", minPoints: 100 }];
    const cfg = getRankDisplayConfig("Kim cương", ranks);
    expect(cfg.label).toBe("Kim cương");
    expect(["custom", "regular"]).toContain(cfg.variant);
  });

  it("maps Thân thiết to regular variant", () => {
    const cfg = getRankDisplayConfig("Thân thiết", DEFAULT_RANKS_FALLBACK);
    expect(cfg.variant).toBe("regular");
  });
});
