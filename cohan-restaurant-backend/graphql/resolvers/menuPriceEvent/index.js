import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import AuditLog from "../../../models/audit-log.model.js";
import MenuItem from "../../../models/menuitem.model.js";
import MenuPriceEvent from "../../../models/menu-price-event.model.js";
import Recipe from "../../../models/recipe.model.js";
import {
  MENU_PERMISSION,
  requireMenuPermission,
} from "../menu/menuPermission.js";

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const roundWith = (value, roundTo = 0) => {
  const precision = Math.pow(10, roundTo);
  return Math.round(value * precision) / precision;
};

const computeAppliedPrice = ({ price, mode, value, roundTo, floorZero }) => {
  let next = mode === "PERCENT" ? price * (1 + value / 100) : price + value;
  next = roundWith(next, roundTo);
  return floorZero && next < 0 ? 0 : next;
};

const getActorId = (ctx) => ctx?.user?.id || ctx?.user?._id || null;

const scheduleMenuPriceRestore = async (_parent, { input }, ctx) => {
  const {
    restaurantId,
    target,
    mode,
    value,
    roundTo = 0,
    floorZero = true,
    eventName,
    restoreAt,
  } = input || {};

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw badInput("Nhà hàng không hợp lệ.");
  }
  if (!target?.menuItemIds?.length) {
    throw badInput("Hãy chọn ít nhất một món để áp dụng giá tạm thời.");
  }
  if (!target.menuItemIds.every((id) => mongoose.isValidObjectId(id))) {
    throw badInput("Danh sách món có mã không hợp lệ.");
  }
  if (!["PERCENT", "AMOUNT"].includes(mode)) {
    throw badInput("Loại điều chỉnh giá không hợp lệ.");
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw badInput("Giá trị điều chỉnh không hợp lệ.");
  }

  const restoreDate = new Date(restoreAt);
  if (
    Number.isNaN(restoreDate.getTime()) ||
    restoreDate.getTime() < Date.now() + 60_000
  ) {
    throw badInput("Thời điểm hoàn giá phải sau hiện tại ít nhất 1 phút.");
  }

  await requireMenuPermission(
    ctx,
    restaurantId,
    MENU_PERMISSION.UPDATE_PRICE,
  );

  const uniqueItemIds = [...new Set(target.menuItemIds.map(String))];
  const menuItems = await MenuItem.find({
    _id: { $in: uniqueItemIds },
    restaurantId,
  })
    .select({ _id: 1 })
    .lean();

  if (menuItems.length !== uniqueItemIds.length) {
    throw badInput("Một số món không tồn tại hoặc không thuộc nhà hàng đã chọn.");
  }

  const recipes = await Recipe.find({
    restaurantId,
    menuItemId: { $in: uniqueItemIds },
  }).lean();

  const eventItems = recipes
    .map((recipe) => {
      const beforePrices = [];
      const appliedPrices = [];

      for (const variant of recipe.servingVariants || []) {
        const key = String(variant?.key || "").trim();
        const price = Number(variant?.price);
        if (!key || !Number.isFinite(price)) continue;

        const appliedPrice = computeAppliedPrice({
          price,
          mode,
          value: numericValue,
          roundTo,
          floorZero,
        });
        if (appliedPrice === price) continue;

        beforePrices.push({ key, price });
        appliedPrices.push({ key, price: appliedPrice });
      }

      if (!beforePrices.length) return null;
      return {
        recipeId: recipe._id,
        menuItemId: recipe.menuItemId,
        beforePrices,
        appliedPrices,
      };
    })
    .filter(Boolean);

  if (!eventItems.length) {
    throw badInput("Không có giá nào thay đổi để lên lịch hoàn tác.");
  }

  const event = await MenuPriceEvent.create({
    restaurantId,
    timeSlot: input.timeSlot || null,
    eventName: String(eventName || "").trim() || "Sự kiện giá tạm thời",
    restoreAt: restoreDate,
    items: eventItems,
    createdBy: getActorId(ctx),
  });

  await AuditLog.create({
    restaurantId,
    entity: "MenuPriceEvent",
    entityId: event._id,
    action: "create",
    byUserId: getActorId(ctx),
    diff: {
      type: "menu_price_restore_scheduled",
      eventName: event.eventName,
      restoreAt: event.restoreAt,
      menuItemIds: eventItems.map((item) => item.menuItemId),
      mode,
      value: numericValue,
      roundTo,
      floorZero,
    },
  });

  return {
    id: event._id,
    restaurantId: event.restaurantId,
    eventName: event.eventName,
    restoreAt: event.restoreAt,
    status: event.status,
    itemCount: event.items.length,
    createdAt: event.createdAt,
  };
};

export default {
  Mutation: {
    scheduleMenuPriceRestore,
  },
};
