import { GraphQLError } from "graphql";
import mongoose from "mongoose";
import { AuditLog, Menu, MenuItem, Recipe, Restaurant } from "../../../models/index.js";
import { MenuMutation } from "./mutation.js";
import { MENU_PERMISSION, requireMenuPermission } from "./menuPermission.js";

const TIME_SLOTS = new Set(["breakfast", "lunch", "dinner", "late_night"]);
const ITEM_STATUSES = new Set(["available", "unavailable", "out_of_stock", "hidden"]);
const PREP_STATIONS = new Set(["kitchen", "bar"]);
const FOOD_TYPES = new Set([
  "VEGETARIAN",
  "NON_VEGETARIAN",
  "VEGAN",
  "MIXED",
  "UNKNOWN",
]);
const MEAT_TYPES = new Set([
  "BEEF",
  "PORK",
  "CHICKEN",
  "DUCK",
  "SEAFOOD",
  "FISH",
  "LAMB",
  "OTHER",
]);
const DIET_TAGS = new Set(["vegan", "keto", "halal"]);
const ALLERGEN_TAGS = new Set(["seafood", "peanut", "milk", "egg", "gluten"]);

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
const isOid = (value) => mongoose.isValidObjectId(value);
const getActorId = (ctx) => ctx?.user?.id || ctx?.user?._id || null;

const optionalNumber = (value, field, max = Infinity) => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw badInput(`${field} không hợp lệ`);
  }
  return number;
};

const normalizeEnumArray = (values, allowed, field) => {
  if (values === undefined) return undefined;
  if (!Array.isArray(values)) throw badInput(`${field} phải là danh sách`);
  const normalized = [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
  const invalid = normalized.find((value) => !allowed.has(value));
  if (invalid) throw badInput(`${field} chứa giá trị không hợp lệ: ${invalid}`);
  return normalized;
};

const normalizeTasteProfile = (profile) => {
  if (profile === undefined) return undefined;
  const sugar = Number(profile?.sugar ?? 100);
  const spice = String(profile?.spice ?? "Vừa");
  if (![0, 30, 50, 70, 100].includes(sugar)) {
    throw badInput("tasteProfile.sugar không hợp lệ");
  }
  if (!["Không", "Vừa", "Nồng", "Rất cay"].includes(spice)) {
    throw badInput("tasteProfile.spice không hợp lệ");
  }
  return {
    containsOnion: Boolean(profile?.containsOnion),
    containsCilantro: Boolean(profile?.containsCilantro),
    sugar,
    spice,
  };
};

export const MenuMultiSlotMutation = {
  ensureMenu: async (_, { input }, ctx) => {
    const {
      id,
      restaurantId,
      timeSlot,
      name,
      description,
      coverImage,
      isActive,
      categoryMenuId,
    } = input || {};

    if (!isOid(restaurantId)) throw badInput("restaurantId không hợp lệ");
    if (!TIME_SLOTS.has(timeSlot)) throw badInput("Khung giờ không hợp lệ");
    if (id && !isOid(id)) throw badInput("menuId không hợp lệ");
    if (categoryMenuId && !isOid(categoryMenuId)) {
      throw badInput("categoryMenuId không hợp lệ");
    }

    const before = id
      ? await Menu.findOne({ _id: id, restaurantId }).lean()
      : null;
    if (id && !before) throw new GraphQLError("Không tìm thấy thực đơn");

    await requireMenuPermission(
      ctx,
      restaurantId,
      before ? MENU_PERMISSION.UPDATE_MENU : MENU_PERMISSION.CREATE_MENU,
    );
    if (!(await Restaurant.exists({ _id: restaurantId }))) {
      throw new GraphQLError("Không tìm thấy nhà hàng");
    }

    const values = {
      restaurantId,
      timeSlot,
      name: String(name || "Menu").trim() || "Menu",
      description: description ?? null,
      coverImage: coverImage ?? null,
      categoryMenuId: categoryMenuId || null,
      isActive: typeof isActive === "boolean" ? isActive : true,
    };

    const document = before
      ? await Menu.findOneAndUpdate(
          { _id: before._id, restaurantId },
          { $set: values },
          { new: true, runValidators: true },
        ).lean({ virtuals: true })
      : await Menu.create(values).then((created) =>
          created.toObject({ virtuals: true }),
        );

    await AuditLog.create({
      restaurantId,
      entity: "Menu",
      entityId: document._id || document.id,
      action: before ? "update" : "create",
      byUserId: getActorId(ctx),
      diff: { before, after: values },
    });
    return document;
  },

  createMenuItem: async (parent, { input }, ctx) => {
    if (!input?.menuId) {
      return MenuMutation.createMenuItem(parent, { input }, ctx);
    }
    if (![input.restaurantId, input.menuId, input.categoryId].every(isOid)) {
      throw badInput("restaurantId, menuId hoặc categoryId không hợp lệ");
    }

    const menu = await Menu.findOne({
      _id: input.menuId,
      restaurantId: input.restaurantId,
    }).lean();
    if (!menu) throw new GraphQLError("Không tìm thấy thực đơn");
    if (input.timeSlot && input.timeSlot !== menu.timeSlot) {
      throw badInput("Thực đơn không thuộc khung giờ đã chọn");
    }

    const name = String(input.name || "").trim();
    if (!name) throw badInput("Tên món là bắt buộc");
    const status = input.status || "available";
    if (!ITEM_STATUSES.has(status)) throw badInput("Trạng thái món không hợp lệ");
    const prepStation = String(input.prepStation || "kitchen").toLowerCase();
    if (!PREP_STATIONS.has(prepStation)) {
      throw badInput("Khu chế biến phải là kitchen hoặc bar");
    }

    const foodType = String(input.foodType || "UNKNOWN").toUpperCase();
    if (!FOOD_TYPES.has(foodType)) throw badInput("foodType không hợp lệ");
    const basePrice = optionalNumber(input.basePrice, "basePrice") ?? 0;

    await requireMenuPermission(
      ctx,
      input.restaurantId,
      MENU_PERMISSION.CREATE_ITEM,
    );

    const payload = {
      restaurantId: input.restaurantId,
      menuId: menu._id,
      categoryId: input.categoryId,
      name,
      description: input.description,
      basePrice,
      thumbImage: input.thumbImage,
      mediaAssetIds: input.mediaAssetIds,
      modifierGroupIds: input.modifierGroupIds,
      status,
      prepStation,
      avgPrepTimeMin: optionalNumber(input.avgPrepTimeMin, "avgPrepTimeMin"),
      point: optionalNumber(input.point, "point"),
      rate: optionalNumber(input.rate, "rate", 5),
      orderCounter: optionalNumber(input.orderCounter, "orderCounter"),
      notes: input.notes,
      foodType,
      meatTypes: normalizeEnumArray(input.meatTypes, MEAT_TYPES, "meatTypes") || [],
      dietTags: normalizeEnumArray(input.dietTags, DIET_TAGS, "dietTags") || [],
      allergenTags:
        normalizeEnumArray(input.allergenTags, ALLERGEN_TAGS, "allergenTags") || [],
      tasteProfile: normalizeTasteProfile(input.tasteProfile),
    };

    const session = await mongoose.startSession();
    try {
      let created = null;
      await session.withTransaction(async () => {
        created = await MenuItem.create([payload], { session }).then(
          (rows) => rows[0],
        );
        await Recipe.create(
          [
            {
              restaurantId: input.restaurantId,
              menuItemId: created._id,
              servingVariants: [
                {
                  key: "default",
                  name: "Mặc định",
                  mode: "PORTION",
                  sellQty: 1,
                  sellUnit: "portion",
                  ingredients: [],
                  price: basePrice,
                  isDefault: true,
                },
              ],
              notes: "",
              isActive: true,
            },
          ],
          { session },
        );
      });

      const document = await MenuItem.findById(created._id).lean({
        virtuals: true,
      });
      await AuditLog.create({
        restaurantId: input.restaurantId,
        entity: "MenuItem",
        entityId: document._id || document.id,
        action: "create",
        byUserId: getActorId(ctx),
        diff: {
          menuId: menu._id,
          categoryId: document.categoryId,
          name: document.name,
          prepStation: document.prepStation,
          basePrice: document.basePrice,
          status: document.status,
        },
      });
      return document;
    } finally {
      await session.endSession();
    }
  },
};
