import { GraphQLError } from "graphql";
import { Restaurant } from "../../../models/index.js";
import { computeRestaurantAvailability } from "../../../src/services/restaurantAvailability.service.js";

const PUBLIC_BUSINESS_STATUSES = new Set(["active"]);
const PUBLIC_PUBLICATION_STATUSES = new Set(["published"]);

export async function getPublicRestaurantOrThrow(
  restaurantId,
  message = "Nhà hàng hiện chưa nhận đặt món.",
  options = {},
) {
  const restaurant = await Restaurant.findById(restaurantId).lean();
  const availability = computeRestaurantAvailability(
    restaurant || {},
    options,
  );
  const isPublic =
    !!restaurant &&
    PUBLIC_BUSINESS_STATUSES.has(String(availability.businessStatus || "")) &&
    PUBLIC_PUBLICATION_STATUSES.has(String(availability.publicationStatus || ""));
  if (!isPublic) {
    throw new GraphQLError(message, { extensions: { code: "RESTAURANT_NOT_ACCEPTING_ORDERS" } });
  }
  return { restaurant, availability };
}

export function assertRestaurantCanOrder(availability) {
  if (!availability?.canOrder) {
    throw new GraphQLError("Nhà hàng hiện chưa nhận đặt món.", { extensions: { code: "RESTAURANT_NOT_ACCEPTING_ORDERS" } });
  }
}

export function assertRestaurantCanReserve(availability) {
  if (!availability?.canReserve) {
    throw new GraphQLError("Nhà hàng hiện không nhận đặt bàn.", { extensions: { code: "BAD_USER_INPUT" } });
  }
}

