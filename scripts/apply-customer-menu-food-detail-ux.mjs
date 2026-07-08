import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => fs.writeFileSync(file, content);

function replaceOnce(file, search, replacement, label = String(search)) {
  const source = read(file);
  const next = source.replace(search, replacement);
  if (next === source) {
    throw new Error(`Patch not applied in ${file}: ${label}`);
  }
  write(file, next);
}

function appendOnce(file, marker, content) {
  const source = read(file);
  if (source.includes(marker)) return;
  write(file, `${source.trimEnd()}\n\n${content.trim()}\n`);
}

// Modifier validation can be reused for live-state previews without forcing required choices.
replaceOnce(
  "cohan-restaurant-backend/src/services/customerModifierSelection.service.js",
  `  basePrice = 0,\n  session,\n}) {`,
  `  basePrice = 0,\n  session,\n  validateRequired = true,\n}) {`,
  "modifier validateRequired parameter",
);
replaceOnce(
  "cohan-restaurant-backend/src/services/customerModifierSelection.service.js",
  `  groups.forEach((group) => {\n    validateGroupSelection(group, selectedByGroup.get(String(group._id)) || []);\n  });`,
  `  groups.forEach((group) => {\n    const selectedOptionIds = selectedByGroup.get(String(group._id)) || [];\n    if (validateRequired || selectedOptionIds.length) {\n      validateGroupSelection(group, selectedOptionIds);\n    }\n  });`,
  "conditional required modifier validation",
);

// GraphQL cart contract.
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/cart.graphql",
  `"1 dòng trong giỏ hàng"\ntype CartItem {`,
  `type CartModifierPriceRule {\n  rule: String!\n  amount: Float!\n}\n\ntype CartModifierSnapshot {\n  groupId: ID!\n  groupName: String\n  optionId: ID!\n  optionName: String\n  priceRule: CartModifierPriceRule!\n}\n\ninput CartModifierSelectionInput {\n  groupId: ID!\n  optionId: ID!\n}\n\n"1 dòng trong giỏ hàng"\ntype CartItem {`,
  "cart modifier GraphQL types",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/cart.graphql",
  `  note: String\n  servingVariantKey: String\n  holdExpiresAt: DateTime`,
  `  note: String\n  servingVariantKey: String\n  modifiers: [CartModifierSnapshot!]!\n  modifiersPrice: Float!\n  holdExpiresAt: DateTime`,
  "CartItem modifier fields",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/cart.graphql",
  `  note: String\n  servingVariantKey: String\n  holdExpiresAt: DateTime\n  holdStatus: String\n}`,
  `  note: String\n  servingVariantKey: String\n  selectedModifiers: [CartModifierSelectionInput!] = []\n  holdExpiresAt: DateTime\n  holdStatus: String\n}`,
  "AddCartItem modifier input",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/cart.graphql",
  `input MenuItemLiveStateInput {\n  restaurantId: ID!\n  itemType: String!`,
  `input MenuItemLiveStateInput {\n  restaurantId: ID!\n  itemType: String! = "MENU_ITEM"`,
  "live state item type default",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/cart.graphql",
  `  servingVariantKey: String\n  userId: ID\n}`,
  `  servingVariantKey: String\n  selectedModifiers: [CartModifierSelectionInput!] = []\n  userId: ID\n}`,
  "live state modifier selections",
);

// Cart persistence and totals.
replaceOnce(
  "cohan-restaurant-backend/models/cart.model.js",
  `const { Schema, Types } = mongoose;\n\nconst CartItemSchema`,
  `const { Schema, Types } = mongoose;\n\nconst CartModifierIngredientLineSchema = new Schema(\n  {\n    ingredientId: { type: Types.ObjectId, ref: "Ingredient", required: true },\n    qty: { type: Number, default: 0 },\n    unit: { type: String, trim: true },\n    wastePct: { type: Number, default: 0 },\n  },\n  { _id: false },\n);\n\nconst CartModifierSnapshotSchema = new Schema(\n  {\n    groupId: { type: Types.ObjectId, ref: "ModifierGroup", required: true },\n    groupName: { type: String, trim: true },\n    optionId: { type: Types.ObjectId, required: true },\n    optionName: { type: String, trim: true },\n    priceRule: {\n      rule: { type: String, enum: ["DELTA", "SET"], default: "DELTA" },\n      amount: { type: Number, default: 0 },\n    },\n    inventoryRule: {\n      rule: {\n        type: String,\n        enum: ["NONE", "ADD_INGREDIENTS", "REPLACE_INGREDIENTS", "MULTIPLY_BASE_RECIPE"],\n        default: "NONE",\n      },\n      ingredientLines: { type: [CartModifierIngredientLineSchema], default: [] },\n      baseRecipeMultiplier: { type: Number, default: null },\n      note: { type: String, trim: true },\n    },\n  },\n  { _id: false },\n);\n\nconst CartItemSchema`,
  "cart modifier schemas",
);
replaceOnce(
  "cohan-restaurant-backend/models/cart.model.js",
  `    servingName: { type: String, trim: true }, // vd: "1 phần", "100g"\n\n    holdExpiresAt`,
  `    servingName: { type: String, trim: true }, // vd: "1 phần", "100g"\n    modifiers: { type: [CartModifierSnapshotSchema], default: [] },\n    modifiersPrice: { type: Number, default: 0 },\n    modifierSelectionKey: { type: String, trim: true, default: "" },\n\n    holdExpiresAt`,
  "cart item modifier persistence",
);
replaceOnce(
  "cohan-restaurant-backend/models/cart.model.js",
  `holdStatus: { type: String, enum: ["active", "released", "ordered"], default: "active" }`,
  `holdStatus: {\n      type: String,\n      enum: ["active", "released", "ordered", "checkout_pending", "expired"],\n      default: "active",\n    }`,
  "cart hold status values",
);
replaceOnce(
  "cohan-restaurant-backend/models/cartDerivedFields.js",
  `(sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.quantity) || 0),`,
  `(sum, i) =>\n      sum +\n      ((Number(i?.price) || 0) + (Number(i?.modifiersPrice) || 0)) *\n        (Number(i?.quantity) || 0),`,
  "cart total includes modifiers",
);

// Live-state contract and modifier-aware stock check.
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `import { checkAvailabilityForLinesTx } from "../../../src/services/inventory.service.js";`,
  `import { checkAvailabilityForLinesTx } from "../../../src/services/inventory.service.js";\nimport { resolveCustomerModifierSelection } from "../../../src/services/customerModifierSelection.service.js";`,
  "cart query modifier service import",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `function liveStateKey({ restaurantId, menuItemId, servingKey }) {\n  return \`${"${restaurantId}:${menuItemId}:${servingKey}"}\`;\n}`,
  `function liveStateKey({ restaurantId, menuItemId, servingKey, modifierSelectionKey = "" }) {\n  return \`${"${restaurantId}:${menuItemId}:${servingKey}:${modifierSelectionKey}"}\`;\n}`,
  "live-state cache key",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `function readAvailability({ restaurantId, menuItemId, servingKey }) {\n  const key = liveStateKey({ restaurantId, menuItemId, servingKey });`,
  `function readAvailability({ restaurantId, menuItemId, servingKey, modifiers, modifierSelectionKey }) {\n  const key = liveStateKey({ restaurantId, menuItemId, servingKey, modifierSelectionKey });`,
  "modifier-aware availability signature",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `      lines: [{ menuItemId, quantity: 1, servingKey }],`,
  `      lines: [{ menuItemId, quantity: 1, servingKey, modifiers }],`,
  "modifier-aware availability line",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `    const { restaurantId, menuItemId, servingVariantKey, userId } = input || {};`,
  `    const {\n      itemType = "MENU_ITEM",\n      restaurantId,\n      menuItemId,\n      servingVariantKey,\n      selectedModifiers = [],\n      userId,\n    } = input || {};`,
  "live state input destructuring",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `    if (!mongoose.isValidObjectId(menuItemId)) throw new GraphQLError("Invalid menuItemId");\n\n    const normalizedServingKey`,
  `    if (!mongoose.isValidObjectId(menuItemId)) throw new GraphQLError("Invalid menuItemId");\n    const normalizedItemType = String(itemType || "MENU_ITEM").toUpperCase();\n    if (normalizedItemType !== "MENU_ITEM") {\n      throw new GraphQLError("Unsupported itemType", { extensions: { code: "BAD_USER_INPUT" } });\n    }\n\n    const modifierSelection = await resolveCustomerModifierSelection({\n      restaurantId,\n      menuItemId,\n      selectedModifiers,\n      validateRequired: false,\n    });\n\n    const normalizedServingKey`,
  "live state item type and modifier validation",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `        servingKey: normalizedServingKey,\n      }),\n    ]);`,
  `        servingKey: normalizedServingKey,\n        modifiers: modifierSelection.modifiers,\n        modifierSelectionKey: modifierSelection.selectionKey,\n      }),\n    ]);`,
  "pass modifiers to availability",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/query.js",
  `    return {\n      menuItemId,`,
  `    return {\n      itemType: normalizedItemType,\n      menuItemId,`,
  "live state item type output",
);

// Public active modifier catalog remains separate from manager reads.
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/modifier.graphql",
  `extend type Query {\n  modifierGroups(filter: ModifierGroupFilterInput!): [ModifierGroup!]!`,
  `extend type Query {\n  customerModifierGroups(restaurantId: ID!, menuItemId: ID!): [ModifierGroup!]!\n  modifierGroups(filter: ModifierGroupFilterInput!): [ModifierGroup!]!`,
  "customer modifier query schema",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/modifier/query.js",
  `import { requireRestaurantAccess } from "../../guards.js";`,
  `import { requireRestaurantAccess } from "../../guards.js";\nimport { getPublicRestaurantOrThrow } from "../shared/restaurantCapabilityGuards.js";`,
  "public restaurant guard import",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/modifier/query.js",
  `export const ModifierQuery = {\n  /**`,
  `export const ModifierQuery = {\n  customerModifierGroups: async (_, { restaurantId, menuItemId }) => {\n    if (!isValidId(restaurantId) || !isValidId(menuItemId)) {\n      throw new GraphQLError("Invalid restaurantId or menuItemId", {\n        extensions: { code: "BAD_USER_INPUT" },\n      });\n    }\n\n    await getPublicRestaurantOrThrow(restaurantId, "Nhà hàng hiện chưa công khai.");\n    const groups = await ModifierGroup.find({\n      restaurantId: toId(restaurantId),\n      isActive: true,\n      $or: [\n        { coverage: "GLOBAL" },\n        { coverage: "ITEMS", menuItemIds: toId(menuItemId) },\n      ],\n    })\n      .sort({ name: 1, _id: 1 })\n      .lean({ virtuals: true });\n\n    return groups.map((group) => ({\n      ...group,\n      options: (group.options || []).filter((option) => option?.isActive !== false),\n    }));\n  },\n\n  /**`,
  "public customer modifier resolver",
);

// Safe ingredient summary and public out-of-stock visibility.
replaceOnce(
  "cohan-restaurant-backend/graphql/schema/menu.graphql",
  `  allergenTags: [String!]\n  tasteProfile: MenuItemTasteProfile`,
  `  allergenTags: [String!]\n  ingredientNames: [String!]!\n  tasteProfile: MenuItemTasteProfile`,
  "MenuItem ingredient names field",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/inventory/types.js",
  `import { Recipe, IngredientCategory } from "../../../models/index.js";`,
  `import { Recipe, Ingredient, IngredientCategory } from "../../../models/index.js";`,
  "ingredient model import",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/inventory/types.js",
  `  MenuItem: {\n    servingVariants: async (parent) => {`,
  `  MenuItem: {\n    ingredientNames: async (parent) => {\n      const menuItemId = parent?._id || parent?.id;\n      if (!menuItemId || !mongoose.isValidObjectId(menuItemId)) return [];\n      const recipe = await Recipe.findOne({\n        menuItemId,\n        ...(parent?.restaurantId ? { restaurantId: parent.restaurantId } : {}),\n        isActive: { $ne: false },\n      })\n        .select({ "servingVariants.ingredients.ingredientId": 1 })\n        .lean();\n      const ingredientIds = [\n        ...new Set(\n          (recipe?.servingVariants || [])\n            .flatMap((variant) => variant?.ingredients || [])\n            .map((line) => line?.ingredientId)\n            .filter(Boolean)\n            .map(String),\n        ),\n      ];\n      if (!ingredientIds.length) return [];\n      const ingredients = await Ingredient.find({ _id: { $in: ingredientIds } })\n        .select({ name: 1 })\n        .sort({ name: 1 })\n        .lean();\n      return [...new Set(ingredients.map((ingredient) => ingredient?.name).filter(Boolean))];\n    },\n\n    servingVariants: async (parent) => {`,
  "ingredient names resolver",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/menu/query.js",
  `function applyPublicMenuItemFilter(query) {\n  if (!query.status) query.status = "available";`,
  `function applyPublicMenuItemFilter(query) {\n  if (!query.status) query.status = { $in: ["available", "out_of_stock"] };`,
  "public visible menu statuses",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/menu/query.js",
  `      status: "available",\n    }).lean({ virtuals: true });\n    if (!item) return null;\n\n    if (String(item.inventoryStatus || "") === "OUT_OF_STOCK") return null;`,
  `      status: { $in: ["available", "out_of_stock"] },\n    }).lean({ virtuals: true });\n    if (!item) return null;`,
  "customer menu item can show out of stock",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/category/query.js",
  `  status: "available",`,
  `  status: { $in: ["available", "out_of_stock"] },`,
  "public category counts include out of stock",
);
replaceOnce(
  "src/utils/menuItemAvailability.js",
  `    visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,\n    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,\n    customerMessage: "Món hiện đã hết và chưa thể đặt.",`,
  `    visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,\n    orderability: MENU_ITEM_ORDERABILITY.BLOCKED,\n    customerMessage: "Món hiện đã hết và chưa thể đặt. Bạn vẫn có thể xem chi tiết hoặc đăng ký nhận nhắc.",`,
  "explicit out of stock remains visible",
);
replaceOnce(
  "src/utils/menuItemAvailability.js",
  `      visibility: MENU_ITEM_VISIBILITY.STAFF_ONLY,\n      orderability: MENU_ITEM_ORDERABILITY.BLOCKED,\n      customerMessage: "Món tạm hết nguyên liệu và chưa thể đặt.",`,
  `      visibility: MENU_ITEM_VISIBILITY.CUSTOMER_VISIBLE,\n      orderability: MENU_ITEM_ORDERABILITY.BLOCKED,\n      customerMessage: "Món tạm hết nguyên liệu. Bạn vẫn có thể xem chi tiết hoặc đăng ký nhận nhắc.",`,
  "inventory out of stock remains visible",
);

// Modifier inventory rules are included in every reserve/release calculation.
replaceOnce(
  "cohan-restaurant-backend/src/services/inventory.service.js",
  `    const comps = arr(serving?.ingredients);\n    if (!comps.length) {`,
  `    const comps = arr(serving?.ingredients);\n    const modifiers = arr(line?.modifiers);\n    if (!comps.length) {`,
  "collect line modifiers",
);
replaceOnce(
  "cohan-restaurant-backend/src/services/inventory.service.js",
  `    for (const c of comps)\n      if (c?.ingredientId) ingIdsSet.add(String(c.ingredientId));\n    resolved.push({ line, serving, comps });`,
  `    for (const c of comps) {\n      if (c?.ingredientId) ingIdsSet.add(String(c.ingredientId));\n    }\n    for (const modifier of modifiers) {\n      for (const ingredientLine of arr(modifier?.inventoryRule?.ingredientLines)) {\n        if (ingredientLine?.ingredientId) {\n          ingIdsSet.add(String(ingredientLine.ingredientId));\n        }\n      }\n    }\n    resolved.push({ line, serving, comps, modifiers });`,
  "collect modifier ingredients",
);
replaceOnce(
  "cohan-restaurant-backend/src/services/inventory.service.js",
  /  for \(const r of resolved\) \{\n    const \{ line, serving, comps \} = r;\n    const mult = multiplierForLine\(serving, line\);[\s\S]*?      needs\.set\(k, curr\);\n    \}\n  \}/,
  `  for (const r of resolved) {\n    const { line, serving, comps, modifiers } = r;\n    const mult = multiplierForLine(serving, line);\n    const lineNeeds = new Map();\n\n    const addLineNeed = (component, mode = "ADD") => {\n      const ingredientId = component?.ingredientId;\n      if (!ingredientId) return;\n      const ing = ingMap.get(String(ingredientId));\n      if (!ing) throw new Error(\`Ingredient not found: \${ingredientId}\`);\n      const qty = toNum(component?.qty, 0);\n      if (!(qty > 0)) return;\n      const baseFloat = convertToBaseFloat(qty, component?.unit || ing.baseUnit, ing);\n      if (!(baseFloat > 0)) return;\n      const wastePct = toNum(component?.wastePct, 0);\n      const needFloat = baseFloat * mult * (1 + wastePct / 100);\n      const key = String(ingredientId);\n      lineNeeds.set(key, mode === "REPLACE" ? needFloat : (lineNeeds.get(key) || 0) + needFloat);\n    };\n\n    comps.forEach((component) => addLineNeed(component));\n\n    for (const modifier of modifiers) {\n      const inventoryRule = modifier?.inventoryRule || {};\n      if (inventoryRule.rule === "MULTIPLY_BASE_RECIPE") {\n        const multiplier = toNum(inventoryRule.baseRecipeMultiplier, 1);\n        if (multiplier > 0) {\n          for (const [key, value] of lineNeeds.entries()) {\n            lineNeeds.set(key, value * multiplier);\n          }\n        }\n      } else if (inventoryRule.rule === "ADD_INGREDIENTS") {\n        arr(inventoryRule.ingredientLines).forEach((component) => addLineNeed(component));\n      } else if (inventoryRule.rule === "REPLACE_INGREDIENTS") {\n        arr(inventoryRule.ingredientLines).forEach((component) => addLineNeed(component, "REPLACE"));\n      }\n    }\n\n    for (const [ingredientId, needFloat] of lineNeeds.entries()) {\n      const needInt = ceilInt(needFloat);\n      if (!(needInt > 0)) continue;\n      const curr = needs.get(ingredientId) || { total: 0, parts: [] };\n      curr.total += needInt;\n      curr.parts.push({\n        menuItemId: line.menuItemId,\n        servingKey: s(serving.key),\n        mode: s(serving.mode),\n        sellQty: serving.sellQty,\n        sellUnit: serving.sellUnit,\n        quantity: line.quantity ?? null,\n        weightGrams: line.weightGrams ?? null,\n        need: needInt,\n      });\n      needs.set(ingredientId, curr);\n    }\n  }`,
  "apply modifier inventory rules",
);

// Cart mutation uses Recipe as source of truth and stores server-validated modifier snapshots.
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `import { Cart, Warehouse, MenuItem, Menu, Combo } from "../../../models/index.js";`,
  `import { Cart, Warehouse, MenuItem, Menu, Combo, Recipe } from "../../../models/index.js";`,
  "Recipe import for cart",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `} from "../../../src/services/menuAvailabilityWatch.service.js";`,
  `} from "../../../src/services/menuAvailabilityWatch.service.js";\nimport { resolveCustomerModifierSelection } from "../../../src/services/customerModifierSelection.service.js";`,
  "modifier service import in cart mutation",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `    const price = i.price || 0;\n    totalQuantity += qty;\n    totalAmount += qty * price;`,
  `    const price = (Number(i.price) || 0) + (Number(i.modifiersPrice) || 0);\n    totalQuantity += qty;\n    totalAmount += qty * price;`,
  "cart mutation totals include modifiers",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `function isSameCartIdentity(item, { restaurantId, menuItemId, servingKey, note }) {`,
  `function isSameCartIdentity(item, { restaurantId, menuItemId, servingKey, note, modifierSelectionKey }) {`,
  "cart identity modifier key argument",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `    String(item?.restaurantId) === String(restaurantId) &&\n    normalizeCartItemNote(item?.note) === normalizeCartItemNote(note)`,
  `    String(item?.restaurantId) === String(restaurantId) &&\n    normalizeCartItemNote(item?.note) === normalizeCartItemNote(note) &&\n    String(item?.modifierSelectionKey || "") === String(modifierSelectionKey || "")`,
  "cart identity checks modifier key",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `    servingKey: getCartServingKey(item.servingKey || item.servingVariantKey),\n  };`,
  `    servingKey: getCartServingKey(item.servingKey || item.servingVariantKey),\n    modifiers: item.modifiers || [],\n  };`,
  "release line includes modifiers",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `      servingVariantKey,\n    } = input;`,
  `      servingVariantKey,\n      selectedModifiers = [],\n    } = input;`,
  "add cart modifier input",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `    const availableVariants = Array.isArray(menuItem.servingVariants) ? menuItem.servingVariants : [];\n    const matchedVariant`,
  `    const recipe = await Recipe.findOne({ restaurantId, menuItemId, isActive: { $ne: false } })\n      .select({ servingVariants: 1 })\n      .lean();\n    const availableVariants = Array.isArray(recipe?.servingVariants) ? recipe.servingVariants : [];\n    const matchedVariant`,
  "cart serving variants from recipe",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `    const serverSnapshotPrice = Number(matchedVariant?.price ?? menuItem.basePrice ?? 0);\n    const serverSnapshotName`,
  `    const serverSnapshotPrice = Number(matchedVariant?.price ?? menuItem.basePrice ?? 0);\n    const modifierSelection = await resolveCustomerModifierSelection({\n      restaurantId,\n      menuItemId,\n      selectedModifiers,\n      basePrice: serverSnapshotPrice,\n    });\n    const serverSnapshotName`,
  "resolve authoritative modifier selection",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `          isSameCartIdentity(it, { restaurantId, menuItemId, servingKey, note })`,
  `          isSameCartIdentity(it, {\n            restaurantId,\n            menuItemId,\n            servingKey,\n            note,\n            modifierSelectionKey: modifierSelection.selectionKey,\n          })`,
  "find existing modifier-specific cart line",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `            servingKey,\n          },`,
  `            servingKey,\n            modifiers: modifierSelection.modifiers,\n          },`,
  "reserve cart modifier inventory",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `          existing.servingKey = servingKey;\n        } else {`,
  `          existing.servingKey = servingKey;\n          existing.modifiers = modifierSelection.modifiers;\n          existing.modifiersPrice = modifierSelection.modifiersPrice;\n          existing.modifierSelectionKey = modifierSelection.selectionKey;\n          existing.price = serverSnapshotPrice;\n        } else {`,
  "refresh existing cart modifier snapshot",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `            servingKey,\n            holdExpiresAt,`,
  `            servingKey,\n            modifiers: modifierSelection.modifiers,\n            modifiersPrice: modifierSelection.modifiersPrice,\n            modifierSelectionKey: modifierSelection.selectionKey,\n            holdExpiresAt,`,
  "store new cart modifier snapshot",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `meta: { menuItemId, quantity: qty, price: serverSnapshotPrice, servingVariantKey: servingKey }`,
  `meta: {\n            menuItemId,\n            quantity: qty,\n            price: serverSnapshotPrice,\n            modifiersPrice: modifierSelection.modifiersPrice,\n            modifierSelectionKey: modifierSelection.selectionKey,\n            servingVariantKey: servingKey,\n          }`,
  "cart audit modifier meta",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `lines: [{ menuItemId: it.menuItemId, quantity: delta, servingKey }],`,
  `lines: [{ menuItemId: it.menuItemId, quantity: delta, servingKey, modifiers: it.modifiers || [] }],`,
  "increase cart modifier inventory",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `lines: [{ menuItemId: it.menuItemId, quantity: Math.abs(delta), servingKey }],`,
  `lines: [{ menuItemId: it.menuItemId, quantity: Math.abs(delta), servingKey, modifiers: it.modifiers || [] }],`,
  "decrease cart modifier inventory",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/cart/mutation.js",
  `lines: [{ menuItemId, quantity: it.quantity, servingKey }],`,
  `lines: [{ menuItemId, quantity: it.quantity, servingKey, modifiers: it.modifiers || [] }],`,
  "remove cart modifier inventory",
);

// Cart hold checkout validates modifier identity and releases/restores the same ingredients.
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/order/mutation.js",
  `function buildInventoryLineFromItem(it) {`,
  `function buildModifierSelectionKey(modifiers = []) {\n  return (modifiers || [])\n    .map((modifier) => \`${"${modifier?.groupId || \"\"}:${modifier?.optionId || \"\"}"}\`)\n    .sort()\n    .join("|");\n}\n\nfunction buildInventoryLineFromItem(it) {`,
  "order modifier identity helper",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/order/mutation.js",
  `      preparationMethodName: it.servingVariant?.name ?? null,\n    };`,
  `      preparationMethodName: it.servingVariant?.name ?? null,\n      modifiers: it.modifiers || [],\n    };`,
  "weighted order inventory modifiers",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/order/mutation.js",
  `    preparationMethodName: it.servingVariant?.name ?? null,\n  };`,
  `    preparationMethodName: it.servingVariant?.name ?? null,\n    modifiers: it.modifiers || [],\n  };`,
  "portion order inventory modifiers",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/order/mutation.js",
  `    Number(cartItem.quantity || 0) !== Number(orderItem.quantity || 0)\n  ) {`,
  `    Number(cartItem.quantity || 0) !== Number(orderItem.quantity || 0) ||\n    buildModifierSelectionKey(cartItem.modifiers || []) !==\n      buildModifierSelectionKey(orderItem.modifiers || [])\n  ) {`,
  "checkout modifier identity validation",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/order/mutation.js",
  `        servingKey: cartServingKey,\n      },`,
  `        servingKey: cartServingKey,\n        modifiers: cartItem.modifiers || [],\n      },`,
  "checkout release modifier inventory",
);
replaceOnce(
  "cohan-restaurant-backend/graphql/resolvers/order/orderConflictHardening.js",
  `    servingKey: normalizeServingKey(cartItem.servingKey || cartItem.servingVariantKey),\n  };`,
  `    servingKey: normalizeServingKey(cartItem.servingKey || cartItem.servingVariantKey),\n    modifiers: cartItem.modifiers || [],\n  };`,
  "order hardening cart modifier inventory",
);

// Frontend cart receives and displays modifier snapshots without double counting.
replaceOnce(
  "src/context/CartProvider.jsx",
  `        servingVariantKey\n        holdExpiresAt`,
  `        servingVariantKey\n        modifiersPrice\n        modifiers {\n          groupId\n          groupName\n          optionId\n          optionName\n          priceRule { rule amount }\n        }\n        holdExpiresAt`,
  "cart context GraphQL modifier fields",
);
replaceOnce(
  "src/context/CartProvider.jsx",
  `  servingVariantKey: item.servingVariantKey || "portion",\n  holdExpiresAt`,
  `  servingVariantKey: item.servingVariantKey || "portion",\n  modifiers: item.modifiers || [],\n  selectedModifiers: (item.modifiers || []).map((modifier) => ({\n    groupId: modifier.groupId,\n    optionId: modifier.optionId,\n  })),\n  modifiersPrice: Number(item.modifiersPrice || 0),\n  holdExpiresAt`,
  "map server cart modifiers",
);
replaceOnce(
  "src/context/CartProvider.jsx",
  `  const price = Number(variant?.price ?? menuItem.basePrice ?? cartItem.price ?? 0);`,
  `  const price = Number(\n    cartItem.backendCartItemId\n      ? cartItem.price ?? variant?.price ?? menuItem.basePrice ?? 0\n      : variant?.price ?? menuItem.basePrice ?? cartItem.price ?? 0,\n  );`,
  "preserve authoritative cart base price",
);
replaceOnce(
  "src/components/Customer/Homepage_Client/components/Cart.jsx",
  `      const line = (i.price || 0) * (i.quantity || 1);`,
  `      const line =\n        ((Number(i.price) || 0) + (Number(i.modifiersPrice) || 0)) *\n        (i.quantity || 1);`,
  "cart group subtotal modifier price",
);
replaceOnce(
  "src/components/Customer/Homepage_Client/components/Cart.jsx",
  `          const line = (item.price || 0) * (item.quantity || 1);`,
  `          const line =\n            ((Number(item.price) || 0) + (Number(item.modifiersPrice) || 0)) *\n            (item.quantity || 1);`,
  "cart line total modifier price",
);
replaceOnce(
  "src/components/Customer/Homepage_Client/components/Cart.jsx",
  `{formatVND(item.price)}`,
  `{formatVND((Number(item.price) || 0) + (Number(item.modifiersPrice) || 0))}`,
  "cart unit price includes modifiers",
);
replaceOnce(
  "src/components/Customer/Homepage_Client/components/Cart.jsx",
  `\`${"${m.optionName || m.name}${m.price ? ` +${formatVND(m.price)}` : \"\"}"}\``,
  `\`${"${m.optionName || m.name}${Number(m.priceRule?.amount || m.price || 0) ? ` ${Number(m.priceRule?.amount || m.price || 0) > 0 ? \"+\" : \"−\"}${formatVND(Math.abs(Number(m.priceRule?.amount || m.price || 0)))}` : \"\"}"}\``,
  "cart modifier price label",
);

// Reorder keeps modifier choices when present.
replaceOnce(
  "src/components/Customer/RestaurantMenu/RestaurantMenu.jsx",
  `        servingVariantKey\n        holdExpiresAt`,
  `        servingVariantKey\n        modifiersPrice\n        modifiers {\n          groupId\n          groupName\n          optionId\n          optionName\n          priceRule { rule amount }\n        }\n        holdExpiresAt`,
  "reorder mutation modifier response",
);
replaceOnce(
  "src/components/Customer/RestaurantMenu/RestaurantMenu.jsx",
  `                 servingVariantKey,\n               },`,
  `                 servingVariantKey,\n                 selectedModifiers: (item.selectedModifiers || item.modifiers || [])\n                   .map((modifier) => ({\n                     groupId: modifier.groupId,\n                     optionId: modifier.optionId,\n                   }))\n                   .filter((modifier) => modifier.groupId && modifier.optionId),\n               },`,
  "reorder modifier input",
);
replaceOnce(
  "src/components/Customer/RestaurantMenu/RestaurantMenu.jsx",
  `             note: returnedItem?.note ?? note,`,
  `             note: returnedItem?.note ?? note,\n             modifiers: returnedItem?.modifiers || item.modifiers || [],\n             selectedModifiers: (returnedItem?.modifiers || item.selectedModifiers || item.modifiers || []).map((modifier) => ({\n               groupId: modifier.groupId,\n               optionId: modifier.optionId,\n             })),\n             modifiersPrice: Number(returnedItem?.modifiersPrice || item.modifiersPrice || 0),`,
  "reorder local cart modifier snapshot",
);

// Route the customer page to the rebuilt detail screen.
replaceOnce(
  "src/routes/AppRouter.jsx",
  `import FoodDetail from "@/components/Customer/Food/FoodDetail";`,
  `import FoodDetail from "@/components/Customer/Food/FoodDetailV2";`,
  "FoodDetailV2 route import",
);

// Menu control/card additions reuse the existing SCSS stack.
appendOnce(
  "src/components/Customer/RestaurantMenu/styles/MenuDetailViewPolish.scss",
  ".menu-sort-control",
  `.menu-sort-control {\n  display: grid;\n  gap: 0.2rem;\n  color: #746557;\n  font-size: 0.72rem;\n  font-weight: 700;\n}\n\n.menu-sort-control select {\n  min-height: 42px;\n  padding: 0 2.2rem 0 0.75rem;\n  border: 1px solid rgba(111, 76, 45, 0.18);\n  border-radius: 0.75rem;\n  background: #fffdf9;\n  color: #35291f;\n}\n\n.menu-sort-control select:focus-visible {\n  outline: 3px solid rgba(154, 79, 8, 0.25);\n  outline-offset: 2px;\n}\n\n.item-card:focus-visible {\n  outline: 3px solid rgba(154, 79, 8, 0.28);\n  outline-offset: 4px;\n}\n\n.item-card.inactive {\n  cursor: pointer;\n}\n\n.item-card.inactive .thumb img {\n  filter: saturate(0.82);\n}\n\n.menu-item-card__meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 0.45rem;\n  margin-top: 0.55rem;\n}\n\n.menu-item-card__meta span {\n  display: inline-flex;\n  align-items: center;\n  gap: 0.3rem;\n  color: #75675a;\n  font-size: 0.74rem;\n}\n\n.menu-state button {\n  min-height: 42px;\n  margin-top: 0.75rem;\n  padding: 0.55rem 0.9rem;\n  border: 1px solid #874308;\n  border-radius: 0.7rem;\n  background: transparent;\n  color: #743804;\n  font-weight: 800;\n  cursor: pointer;\n}\n\n@media (max-width: 720px) {\n  .menu-sort-control {\n    width: 100%;\n  }\n\n  .menu-sort-control select {\n    width: 100%;\n  }\n}`,
);

console.log("Customer menu and food detail UX patch applied.");
