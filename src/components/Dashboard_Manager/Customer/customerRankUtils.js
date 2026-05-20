export const DEFAULT_RANKS_FALLBACK = [
  { name: "Mới", minPoints: 0, benefits: "" },
  { name: "Thân thiết", minPoints: 5, benefits: "" },
  { name: "VIP", minPoints: 20, benefits: "" },
];

const normalizeName = (value) => String(value || "").trim();

export const normalizeRanks = (ranks = []) => {
  const source = Array.isArray(ranks) && ranks.length ? ranks : DEFAULT_RANKS_FALLBACK;
  return source
    .map((rank) => ({
      name: normalizeName(rank?.name),
      minPoints: Number(rank?.minPoints || 0),
      benefits: rank?.benefits || "",
    }))
    .filter((rank) => rank.name)
    .sort((a, b) => b.minPoints - a.minPoints);
};

export const resolveCustomerRank = (loyaltyPoints, ranks = []) => {
  const points = Math.max(0, Number(loyaltyPoints || 0));
  const sortedRanks = normalizeRanks(ranks);
  return (
    sortedRanks.find((rank) => points >= rank.minPoints) ||
    sortedRanks[sortedRanks.length - 1] ||
    DEFAULT_RANKS_FALLBACK[0]
  );
};

export const getRankDisplayConfig = (rankName, ranks = []) => {
  const normalizedRanks = normalizeRanks(ranks);
  const normalizedName = normalizeName(rankName);

  if (!normalizedName) {
    return { label: DEFAULT_RANKS_FALLBACK[0].name, variant: "new", iconKey: "award" };
  }

  const sortedAsc = [...normalizedRanks].sort((a, b) => a.minPoints - b.minPoints);
  const baseRankName = sortedAsc[0]?.name || DEFAULT_RANKS_FALLBACK[0].name;
  const middleRankName =
    (sortedAsc.length > 2 ? sortedAsc[sortedAsc.length - 2] : sortedAsc[1])?.name ||
    DEFAULT_RANKS_FALLBACK[1].name;

  if (normalizedName.toUpperCase() === "VIP") {
    return { label: normalizedName, variant: "vip", iconKey: "star" };
  }
  if (normalizedName === baseRankName || normalizedName === "Mới") {
    return { label: normalizedName, variant: "new", iconKey: "award" };
  }
  if (normalizedName === middleRankName || normalizedName === "Thân thiết") {
    return { label: normalizedName, variant: "regular", iconKey: "zap" };
  }

  const inSettings = normalizedRanks.some((rank) => rank.name === normalizedName);
  return {
    label: normalizedName,
    variant: inSettings ? "custom" : "regular",
    iconKey: inSettings ? "userCheck" : "zap",
  };
};
