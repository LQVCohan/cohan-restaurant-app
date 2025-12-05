// src/graphql/resolvers/search/index.js

import searchQuery from "./query.js";

/**
 * Type resolver cho SearchResult
 * (để BE biết khi nào return restaurant/menuItem/owner/location)
 */
const SearchResult = {
  timeSlot(parent) {
    if (parent.timeSlot) return parent.timeSlot;
    if (parent.menuItem?.menu?.timeSlot) {
      const ts = parent.menuItem.menu.timeSlot;
      const map = {
        breakfast: "breakfast",
        lunch: "lunch",
        dinner: "dinner",
        late_night: "late_night",
      };
      return map[ts] || null;
    }
    return null;
  },

  restaurant(parent) {
    if (parent.type === "RESTAURANT") return parent.restaurant;
    if (parent.type === "MENU_ITEM") return parent.menuItem?.restaurant || null;
    return null;
  },

  menuItem(parent) {
    if (parent.type === "MENU_ITEM") return parent.menuItem;
    return null;
  },

  owner(parent) {
    if (parent.type === "OWNER") return parent.owner;
    return null;
  },

  locationLabel(parent) {
    return parent.type === "LOCATION" ? parent.location?.label || null : null;
  },
  locationCity(parent) {
    return parent.type === "LOCATION" ? parent.location?.city || null : null;
  },
  locationDistrict(parent) {
    return parent.type === "LOCATION"
      ? parent.location?.district || null
      : null;
  },
};

export default {
  Query: {
    ...searchQuery,
  },

  SearchResult,
};
