import mongoose from "mongoose";
const DEFAULT_CUSTOMER_RANKS = Object.freeze([
  { name: "Mới", minPoints: 0, benefits: "" },
  { name: "Thân thiết", minPoints: 5, benefits: "Ưu đãi dịp đặc biệt" },
  { name: "VIP", minPoints: 20, benefits: "Ưu tiên đặt bàn" },
]);

export function getDefaultCustomerRanks() {
  return DEFAULT_CUSTOMER_RANKS.map((rank) => ({ ...rank }));
}

function hasUsableRanks(ranks) {
  return Array.isArray(ranks) && ranks.some(
    (rank) => String(rank?.name || "").trim() && Number.isFinite(Number(rank?.minPoints)),
  );
}

export async function getEffectiveCustomerRankSetting({ restaurantId, session } = {}) {
  const rid = mongoose.isValidObjectId(restaurantId)
    ? new mongoose.Types.ObjectId(restaurantId)
    : null;

  if (!rid) {
    return {
      restaurantId,
      ranks: getDefaultCustomerRanks(),
      isDefault: true,
    };
  }

  const { CustomerRankSetting } = await import("../../models/customer-rank-setting.model.js");
  const query = CustomerRankSetting.findOne({ restaurantId: rid });
  const doc = await (session ? query.session(session) : query).lean();

  if (doc && hasUsableRanks(doc.ranks)) {
    return doc;
  }

  return {
    restaurantId: rid,
    ranks: getDefaultCustomerRanks(),
    isDefault: true,
  };
}

export function resolveCustomerRankByPoints({ ranks = [], points = 0 } = {}) {
  const normalizedPoints = Number.isFinite(Number(points)) ? Number(points) : 0;

  return [...(Array.isArray(ranks) ? ranks : [])]
    .filter((rank) => String(rank?.name || "").trim() && Number.isFinite(Number(rank?.minPoints)))
    .sort((a, b) => Number(b.minPoints) - Number(a.minPoints))
    .find((rank) => normalizedPoints >= Number(rank.minPoints)) || null;
}

export function normalizeCustomerRankAlias(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeCustomerRankAliasAscii(value) {
  return normalizeCustomerRankAlias(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d");
}

export function buildCustomerRankAliases(value) {
  const normalized = normalizeCustomerRankAlias(value);
  const ascii = normalizeCustomerRankAliasAscii(value);
  return [...new Set([normalized, ascii].filter(Boolean))];
}


const RANK_POINT_DIVISOR = 1_000_000;

export async function loadCustomerRankContext(userId, session) {
  if (!userId || !mongoose.isValidObjectId(userId)) return null;
  const { default: User } = await import("../../models/user.model.js");
  const query = User.findById(new mongoose.Types.ObjectId(userId))
    .select("loyaltyRank customerType loyaltyPoints totalSpending");
  const userDoc = await (session ? query.session(session) : query).lean();

  if (!userDoc) return null;
  return {
    loyaltyRank: userDoc.loyaltyRank,
    customerType: userDoc.customerType,
    loyaltyPoints: userDoc.loyaltyPoints,
    totalSpending: userDoc.totalSpending,
  };
}

export async function resolveCustomerRankAliasesForRestaurant({
  userContext,
  restaurantId,
  session,
}) {
  if (!userContext) return [];

  const aliases = [
    ...buildCustomerRankAliases(userContext.loyaltyRank),
    ...buildCustomerRankAliases(userContext.customerType),
  ];

  const points = Number.isFinite(Number(userContext.loyaltyPoints))
    ? Number(userContext.loyaltyPoints)
    : Math.max(
      0,
      Math.floor((Number(userContext.totalSpending || 0) || 0) / RANK_POINT_DIVISOR),
    );

  const rankSetting = await getEffectiveCustomerRankSetting({ restaurantId, session });
  const matchedRank = resolveCustomerRankByPoints({
    ranks: rankSetting.ranks,
    points,
  });

  if (matchedRank?.name) aliases.push(...buildCustomerRankAliases(matchedRank.name));

  return [...new Set(aliases.filter(Boolean))];
}
