import {
  Restaurant,
  AuditLog,
} from "../../models/index.js";
import {
  SNAPSHOT_KIND,
  SNAPSHOT_SCHEMA_VERSION,
  calculateSnapshotChecksum,
  importRestaurantConfigSnapshot,
} from "./restaurantConfigBackup.service.js";
import {
  getRestaurantCuisineTemplate,
  listRestaurantCuisineTemplateSummaries,
} from "../data/restaurantCuisineTemplates.js";

const TEMPLATE_SECTIONS = {
  restaurantProfile: true,
  menuCatalog: true,
  inventoryMaster: true,
  systemSettings: false,
  printSettings: false,
  customerRankSettings: false,
  payrollSettings: false,
  schedulingPolicy: false,
  floorTableLayout: false,
  promotionConfig: false,
  aiChatbotConfig: false,
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function safeAuditLog(payload) {
  try {
    await AuditLog.create(payload);
  } catch (error) {
    console.warn("[restaurant-cuisine-template] audit log failed", error?.message || error);
  }
}

export function listCuisineTemplates() {
  return listRestaurantCuisineTemplateSummaries();
}

export function buildCuisineTemplateSnapshot({ restaurant, template, actorId } = {}) {
  if (!restaurant?._id && !restaurant?.id) throw new Error("Restaurant is required");
  if (!template) throw new Error("Cuisine template is required");

  const sections = cloneJson(template.sections);
  const snapshot = {
    kind: SNAPSHOT_KIND,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    source: {
      restaurantId: `template:${template.key}:v${template.version}`,
      restaurantName: restaurant.name || template.name,
      app: "cohan-restaurant-app",
      actorId: actorId ? String(actorId) : undefined,
    },
    sections,
    counts: {
      floors: 0,
      tables: 0,
      menuItems: template.menuItemCount,
      menus: template.menuCount,
      categories: sections.menuCatalog?.categories?.length || 0,
      ingredients: template.ingredientCount,
      promotions: 0,
      coupons: 0,
    },
  };
  snapshot.checksum = calculateSnapshotChecksum(snapshot);
  return snapshot;
}

export async function applyCuisineTemplate({ restaurantId, templateKey, actorId } = {}) {
  const template = getRestaurantCuisineTemplate(templateKey);
  if (!template) throw new Error("Mô hình ẩm thực không tồn tại.");

  const lockedRestaurant = await Restaurant.findOneAndUpdate(
    { _id: restaurantId, "initialSetup.status": "pending" },
    { $set: { "initialSetup.status": "applying" } },
    { new: true },
  );
  if (!lockedRestaurant) {
    throw new Error("Chi nhánh này đã được thiết lập hoặc không còn chờ thiết lập.");
  }

  try {
    const snapshot = buildCuisineTemplateSnapshot({
      restaurant: lockedRestaurant,
      template,
      actorId,
    });
    const result = await importRestaurantConfigSnapshot({
      targetRestaurantId: restaurantId,
      snapshot,
      mode: "clone",
      sections: TEMPLATE_SECTIONS,
      actorId,
      dryRun: false,
      replaceExisting: false,
    });

    if (!result?.success || result?.errors?.length) {
      throw new Error(result?.errors?.join("; ") || "Không thể áp dụng gói cấu hình.");
    }

    const completedAt = new Date();
    const restaurant = await Restaurant.findOneAndUpdate(
      { _id: restaurantId, "initialSetup.status": "applying" },
      {
        $set: {
          "initialSetup.status": "completed",
          "initialSetup.templateKey": template.key,
          "initialSetup.templateVersion": template.version,
          "initialSetup.completedAt": completedAt,
          "initialSetup.completedBy": actorId || null,
        },
      },
      { new: true },
    ).lean();

    if (!restaurant) {
      throw new Error("Không thể hoàn tất trạng thái thiết lập của chi nhánh.");
    }

    await safeAuditLog({
      action: "RESTAURANT_CUISINE_TEMPLATE_APPLIED",
      module: "restaurant",
      targetType: "Restaurant",
      targetId: restaurantId,
      restaurantId,
      actorId: actorId || undefined,
      byUserId: actorId || undefined,
      after: {
        templateKey: template.key,
        templateVersion: template.version,
        ingredientCount: template.ingredientCount,
        menuCount: template.menuCount,
        menuItemCount: template.menuItemCount,
      },
    });

    return {
      success: true,
      restaurant,
      ingredientCount: template.ingredientCount,
      menuCount: template.menuCount,
      menuItemCount: template.menuItemCount,
      warnings: result.warnings || [],
    };
  } catch (error) {
    await Restaurant.updateOne(
      { _id: restaurantId, "initialSetup.status": "applying" },
      { $set: { "initialSetup.status": "pending" } },
    );
    throw error;
  }
}

export async function skipCuisineTemplateSetup({ restaurantId, actorId } = {}) {
  const completedAt = new Date();
  const restaurant = await Restaurant.findOneAndUpdate(
    { _id: restaurantId, "initialSetup.status": "pending" },
    {
      $set: {
        "initialSetup.status": "skipped",
        "initialSetup.templateKey": null,
        "initialSetup.templateVersion": null,
        "initialSetup.completedAt": completedAt,
        "initialSetup.completedBy": actorId || null,
      },
    },
    { new: true },
  ).lean();

  if (!restaurant) {
    throw new Error("Chi nhánh này đã được thiết lập hoặc không còn chờ thiết lập.");
  }

  await safeAuditLog({
    action: "RESTAURANT_CUISINE_TEMPLATE_SKIPPED",
    module: "restaurant",
    targetType: "Restaurant",
    targetId: restaurantId,
    restaurantId,
    actorId: actorId || undefined,
    byUserId: actorId || undefined,
    after: { status: "skipped" },
  });

  return restaurant;
}
