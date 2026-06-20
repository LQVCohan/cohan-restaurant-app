import mongoose from "mongoose";
import {
  CustomerRankSetting,
  DEFAULT_CUSTOMER_RANKS,
} from "../../models/customer-rank-setting.model.js";

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
