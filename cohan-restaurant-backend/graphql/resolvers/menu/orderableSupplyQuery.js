import {
  getOrderableSupplyCatalogItem,
  listOrderableSupplyCatalogItems,
} from "../../../src/services/orderableSupplyCatalog.service.js";
import { MenuQuery } from "./query.js";

const normalizeSort = (value) =>
  ["name_asc", "name_desc", "price_asc", "price_desc"].includes(value)
    ? value
    : "default";

const compareCatalogItems = (sort) => (left, right) => {
  const normalized = normalizeSort(sort);
  if (normalized === "price_asc") {
    return Number(left?.basePrice || 0) - Number(right?.basePrice || 0);
  }
  if (normalized === "price_desc") {
    return Number(right?.basePrice || 0) - Number(left?.basePrice || 0);
  }

  const nameCompare = String(left?.name || "").localeCompare(
    String(right?.name || ""),
    "vi",
  );
  return normalized === "name_desc" ? -nameCompare : nameCompare;
};

const filterSupplies = (items, filter = {}) =>
  (items || []).filter((item) => {
    if (filter.status && item.status !== filter.status) return false;
    const price = Number(item.basePrice || 0);
    if (typeof filter.minPrice === "number" && price < filter.minPrice) {
      return false;
    }
    if (typeof filter.maxPrice === "number" && price > filter.maxPrice) {
      return false;
    }
    return true;
  });

async function getSuppliesForMenuFilter(filter = {}) {
  if (!filter?.restaurantId || filter?.categoryId) return [];
  const supplies = await listOrderableSupplyCatalogItems({
    restaurantId: filter.restaurantId,
    search: filter.search,
    includeOutOfStock: true,
  });
  return filterSupplies(supplies, filter);
}

export const OrderableSupplyMenuQuery = {
  async menuItems(parent, args, ctx, info) {
    const menuItems = await MenuQuery.menuItems(parent, args, ctx, info);
    if (args?.includeSupplies === false || args?.categoryId) return menuItems;

    const supplies = await getSuppliesForMenuFilter({
      restaurantId: args?.restaurantId,
      search: args?.search,
    });
    const safeLimit = Math.min(Math.max(Number(args?.limit || 50), 1), 500);
    return [...(menuItems || []), ...supplies]
      .sort(compareCatalogItems(args?.sort))
      .slice(0, safeLimit);
  },

  async menuItemsConnection(parent, args, ctx, info) {
    const connection = await MenuQuery.menuItemsConnection(parent, args, ctx, info);
    const filter = args?.filter || {};
    if (
      filter.includeSupplies !== true ||
      args?.cursor ||
      filter.categoryId
    ) {
      return connection;
    }

    const supplies = await getSuppliesForMenuFilter(filter);
    if (!supplies.length) return connection;

    const supplyEdges = supplies
      .sort(compareCatalogItems(filter.sort))
      .map((item) => ({
        node: item,
        cursor: `supply:${item.supplyId || item.id}`,
      }));

    return {
      edges: [...supplyEdges, ...(connection?.edges || [])],
      pageInfo: connection?.pageInfo || {
        endCursor: null,
        hasNextPage: false,
      },
    };
  },

  async customerMenuItem(parent, args, ctx, info) {
    const menuItem = await MenuQuery.customerMenuItem(parent, args, ctx, info);
    if (menuItem || !args?.restaurantId) return menuItem;

    return getOrderableSupplyCatalogItem({
      restaurantId: args.restaurantId,
      supplyId: args.id,
      includeOutOfStock: true,
    });
  },
};

export default OrderableSupplyMenuQuery;
