import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Save,
  Plus,
  Trash2,
  ChefHat,
  DollarSign,
  Clock,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Modal from "../../../../common/Modal";
import LocalImagePicker from "../../../../common/LocalImagePicker";
import { getImagePersistenceStatus } from "../../../../../utils/imagePersistence";
import "./MenuItemModal.scss";
import "./MenuItemModalPolish.scss";

import useMenuManagement from "../../../../../hooks/useMenuManagement";
import { useRecipes } from "../../../../../hooks/useRecipes";
import useModalDraft from "../../../../../hooks/useModalDraft";

const getGraphQLErrorMessage = (
  error,
  fallback = "Không thể lưu món ăn.",
) => {
  const graphQlMessage = error?.graphQLErrors
    ?.map((entry) => entry?.message)
    .filter(Boolean)
    .join("; ");

  if (graphQlMessage) return graphQlMessage;
  if (error?.networkError?.result?.errors?.length) {
    return error.networkError.result.errors
      .map((entry) => entry?.message)
      .filter(Boolean)
      .join("; ");
  }

  return error?.message || fallback;
};

const cloneIngredients = (ingredients = []) =>
  Array.isArray(ingredients)
    ? ingredients.map((ingredient) => ({
        ingredientId: ingredient?.ingredientId,
        qty: Number(ingredient?.qty || 0),
        unit: ingredient?.unit || ingredient?.baseUnit || "",
        wastePct: Number(ingredient?.wastePct || 0),
      }))
    : [];

const normalizeVariantNameForCompare = (name) =>
  String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");

const normalizeDefaultVariant = (variants = []) => {
  if (!Array.isArray(variants) || !variants.length) return [];

  let defaultIndex = variants.findIndex((variant) => !!variant?.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;

  return variants.map((variant, index) => ({
    ...variant,
    isDefault: index === defaultIndex,
  }));
};

const findMatchingExistingVariant = (method, existingVariants = []) => {
  const methodKey = String(method?.key || "").trim();
  if (methodKey) {
    const matchedByKey = existingVariants.find(
      (variant) => String(variant?.key || "").trim() === methodKey,
    );
    if (matchedByKey) return matchedByKey;
  }

  const normalizedName = normalizeVariantNameForCompare(method?.name);
  if (!normalizedName) return null;

  return (
    existingVariants.find(
      (variant) =>
        normalizeVariantNameForCompare(variant?.name) === normalizedName,
    ) || null
  );
};

const validatePreparationMethods = (methods = []) => {
  if (!Array.isArray(methods) || !methods.length) {
    throw new Error("Vui lòng thêm ít nhất một cách chế biến.");
  }

  return methods.map((method, index) => {
    const name = String(method?.name || "").trim();
    if (!name) {
      throw new Error(`Vui lòng nhập tên cách chế biến số ${index + 1}.`);
    }

    const hasPrice =
      method?.price !== "" &&
      method?.price !== null &&
      method?.price !== undefined;
    const price = Number(method?.price);

    if (!hasPrice || !Number.isFinite(price) || price < 0) {
      throw new Error(
        `Giá bán của cách chế biến “${name}” phải lớn hơn hoặc bằng 0.`,
      );
    }

    return {
      ...method,
      name,
      price,
    };
  });
};

const MENU_ITEM_STATUS_OPTIONS = [
  { value: "available", label: "Đang bán" },
  { value: "out_of_stock", label: "Hết món" },
  { value: "unavailable", label: "Tạm ngưng bán" },
  { value: "hidden", label: "Ẩn khỏi thực đơn" },
];

const MENU_ITEM_STATUS_SET = new Set(
  MENU_ITEM_STATUS_OPTIONS.map(({ value }) => value),
);

const PREP_STATION_OPTIONS = [
  {
    value: "kitchen",
    label: "Bếp chính",
    helper: "Món sẽ xuất hiện trong hàng chờ của bếp chính.",
  },
  {
    value: "bar",
    label: "Quầy bar",
    helper: "Đồ uống hoặc món sẽ xuất hiện trong hàng chờ của quầy bar.",
  },
];
const PREP_STATION_SET = new Set(
  PREP_STATION_OPTIONS.map(({ value }) => value),
);
const normalizePrepStation = (value) =>
  PREP_STATION_SET.has(value) ? value : "kitchen";


const FOR_YOU_DEFAULTS = {
  foodType: "UNKNOWN",
  meatTypes: [],
  dietTags: [],
  allergenTags: [],
  tasteProfile: {
    containsOnion: false,
    containsCilantro: false,
    sugar: 100,
    spice: "Vừa",
  },
};

const FOOD_TYPE_OPTIONS = [
  {
    value: "UNKNOWN",
    label: "Chưa xác định",
    helper: "Chọn mục này khi chưa xác định rõ nhóm nguyên liệu chính.",
  },
  {
    value: "VEGETARIAN",
    label: "Món chay",
    helper: "Không dùng thịt, cá hoặc hải sản.",
  },
  {
    value: "VEGAN",
    label: "Món thuần chay",
    helper: "Không dùng nguyên liệu có nguồn gốc động vật.",
  },
  {
    value: "NON_VEGETARIAN",
    label: "Có thịt hoặc hải sản",
    helper: "Món có thịt, cá hoặc hải sản.",
  },
  {
    value: "MIXED",
    label: "Có lựa chọn chay và món có thịt",
    helper: "Các cách chế biến của món gồm cả lựa chọn chay và có thịt.",
  },
];

const MEAT_TYPE_OPTIONS = [
  { value: "BEEF", label: "Bò" },
  { value: "PORK", label: "Heo" },
  { value: "CHICKEN", label: "Gà" },
  { value: "DUCK", label: "Vịt" },
  { value: "SEAFOOD", label: "Hải sản" },
  { value: "FISH", label: "Cá" },
  { value: "LAMB", label: "Cừu" },
  { value: "OTHER", label: "Khác" },
];

const FOR_YOU_DIET_OPTIONS = [
  {
    value: "vegan",
    label: "Ăn chay hoặc thuần chay",
    helper: "Phù hợp với khách đang ăn chay.",
  },
  {
    value: "keto",
    label: "Keto hoặc ít tinh bột",
    helper: "Phù hợp với khách hạn chế tinh bột và đường.",
  },
  {
    value: "halal",
    label: "Halal",
    helper: "Phù hợp với khách yêu cầu món Halal.",
  },
];

const FOR_YOU_ALLERGEN_OPTIONS = [
  {
    value: "seafood",
    label: "Hải sản",
    helper: "Tôm, cua, mực, sò, ốc và các loại hải sản khác.",
  },
  {
    value: "peanut",
    label: "Đậu phộng",
    helper: "Đậu phộng, bơ đậu phộng hoặc lạc rang.",
  },
  {
    value: "milk",
    label: "Sữa và sản phẩm từ sữa",
    helper: "Sữa, phô mai, kem hoặc bơ sữa.",
  },
  {
    value: "egg",
    label: "Trứng",
    helper: "Trứng, sốt mayonnaise hoặc sốt có trứng.",
  },
  {
    value: "gluten",
    label: "Gluten hoặc bột mì",
    helper: "Bánh mì, mì, pasta hoặc nguyên liệu từ bột mì.",
  },
];

const FOR_YOU_SUGAR_OPTIONS = [
  { value: 0, label: "Không đường" },
  { value: 30, label: "Ít ngọt - 30%" },
  { value: 50, label: "Ngọt vừa - 50%" },
  { value: 70, label: "Khá ngọt - 70%" },
  { value: 100, label: "Mức ngọt tiêu chuẩn - 100%" },
];

const FOR_YOU_SPICE_OPTIONS = ["Không", "Vừa", "Nồng", "Rất cay"];

const normalizeMenuItemStatus = (status) =>
  MENU_ITEM_STATUS_SET.has(status) ? status : "available";

const buildRecipeForm = (methods = [], existingVariants = []) => {
  const normalizedMethods = validatePreparationMethods(methods);

  return {
    servingVariants: normalizeDefaultVariant(
      normalizedMethods.map((method, index) => {
        const existingVariant = findMatchingExistingVariant(
          method,
          existingVariants,
        );
        const fallbackKey =
          method.name.toLowerCase().replace(/\s+/g, "_") || `sv_${index}`;
        const mode = method.mode || existingVariant?.mode || "PORTION";
        const ingredients = existingVariant
          ? cloneIngredients(existingVariant.ingredients)
          : Array.isArray(method.ingredients)
            ? cloneIngredients(method.ingredients)
            : [];

        return {
          key: method.key || existingVariant?.key || fallbackKey,
          name: method.name,
          mode,
          sellQty:
            Number(method.sellQty ?? existingVariant?.sellQty ?? 1) || 1,
          sellUnit:
            method.sellUnit ||
            existingVariant?.sellUnit ||
            (mode === "BY_WEIGHT" ? "kg" : "portion"),
          ingredients,
          price: method.price,
          isDefault: !!method.isDefault,
        };
      }),
    ),
  };
};

const hasVerifiedRecipeData = (recipeItem) =>
  !!(recipeItem?._rawRecipeId || recipeItem?._rawRecipe);

const MenuItemModal = ({
  isOpen,
  editId,
  initialFocusSection,
  categories,
  menuItems,
  restaurantId,
  timeSlot,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    categoryId: "",
    status: normalizeMenuItemStatus(),
    prepStation: "kitchen",
    thumbImage: "",
    description: "",
    preparationMethods: [],
    ...FOR_YOU_DEFAULTS,
  });

  const [imageSyncStatus, setImageSyncStatus] = useState("idle");
  const [toasts, setToasts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const savedMenuItemIdRef = useRef(null);
  const forYouSectionRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !editId || initialFocusSection !== "for-you") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      forYouSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      forYouSectionRef.current
        ?.querySelector("button, input, select, textarea")
        ?.focus?.();
    }, 140);

    return () => window.clearTimeout(timer);
  }, [initialFocusSection, isOpen, editId]);

  const pushToast = (text, type = "success") => {
    const id = Date.now();
    setToasts((current) => [...current, { id, text, type }]);
    setTimeout(
      () =>
        setToasts((current) => current.filter((item) => item.id !== id)),
      3000,
    );
  };

  const currentItem = useMemo(
    () =>
      Array.isArray(menuItems) && editId
        ? menuItems.find((item) => item.id === editId)
        : null,
    [menuItems, editId],
  );

  const { createMenuItem, updateMenuItem } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: timeSlot,
    pageSize: 1,
    useConnection: false,
  });

  const {
    recipes: recipeItems,
    updateRecipe,
    ensureRecipeLoaded,
    recipeDetailsByMenuItemId,
  } = useRecipes(restaurantId, timeSlot, {
    search: null,
    categoryId: null,
  });

  const currentRecipeItem = useMemo(
    () =>
      Array.isArray(recipeItems) && editId
        ? recipeItems.find(
            (item) =>
              String(item?.menuItemId || item?.id) === String(editId),
          )
        : null,
    [recipeItems, editId],
  );

  const recipeDetailState = useMemo(
    () =>
      editId ? recipeDetailsByMenuItemId[String(editId)] || null : null,
    [recipeDetailsByMenuItemId, editId],
  );

  const verifiedCurrentRecipeItem = useMemo(
    () =>
      hasVerifiedRecipeData(currentRecipeItem) ? currentRecipeItem : null,
    [currentRecipeItem],
  );

  const verifiedRecipeItem = useMemo(() => {
    if (verifiedCurrentRecipeItem) return verifiedCurrentRecipeItem;
    if (
      recipeDetailState?.status === "loaded" &&
      hasVerifiedRecipeData(recipeDetailState?.recipe)
    ) {
      return recipeDetailState.recipe;
    }
    return null;
  }, [verifiedCurrentRecipeItem, recipeDetailState]);

  const existingServingVariants = useMemo(
    () =>
      Array.isArray(verifiedRecipeItem?.servingVariants)
        ? verifiedRecipeItem.servingVariants
        : [],
    [verifiedRecipeItem],
  );

  const recipeGuardStatus = useMemo(() => {
    if (!editId) return "ready";
    if (verifiedRecipeItem) return "ready";
    if (recipeDetailState?.status === "missing") return "ready";
    if (recipeDetailState?.status === "error") return "error";
    return "loading";
  }, [editId, verifiedRecipeItem, recipeDetailState]);

  const isRecipeGuardPending =
    !!editId && recipeGuardStatus === "loading";
  const isRecipeGuardBlocked = !!editId && recipeGuardStatus === "error";

  const defaultMethod = {
    key: "",
    name: "",
    price: "",
    cookTime: "",
    mode: "PORTION",
    sellQty: 1,
    sellUnit: "portion",
    ingredients: [],
    isDefault: true,
  };

  const isDirty = useMemo(() => {
    const hasValues =
      (formData.name || "").trim() ||
      formData.categoryId ||
      normalizePrepStation(formData.prepStation) !== "kitchen" ||
      (formData.description || "").trim() ||
      (formData.thumbImage || "").trim() ||
      formData.foodType !== FOR_YOU_DEFAULTS.foodType ||
      (Array.isArray(formData.meatTypes) && formData.meatTypes.length > 0) ||
      (Array.isArray(formData.preparationMethods) &&
        formData.preparationMethods.some(
          (method) =>
            (method?.name || "").trim() ||
            method?.price !== "" ||
            method?.cookTime !== "",
        ));
    return !!hasValues;
  }, [formData]);

  const { requestCloseWithDraft, clearDraft } = useModalDraft({
    enabled: isOpen,
    draftIdentity: {
      module: "menu",
      modal: "menu-item-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: editId ? "edit" : "create",
      entityType: "menu-item",
      recordId: editId || null,
      context: timeSlot || "all-day",
      schemaVersion: "1",
    },
    formValue: formData,
    isDirty,
    sanitize: (value) => ({
      name: value?.name || "",
      categoryId: value?.categoryId || "",
      status: normalizeMenuItemStatus(value?.status),
      prepStation: normalizePrepStation(value?.prepStation),
      thumbImage: value?.thumbImage || "",
      description: value?.description || "",
      foodType: value?.foodType || FOR_YOU_DEFAULTS.foodType,
      meatTypes: Array.isArray(value?.meatTypes) ? value.meatTypes : [],
      dietTags: Array.isArray(value?.dietTags) ? value.dietTags : [],
      allergenTags: Array.isArray(value?.allergenTags)
        ? value.allergenTags
        : [],
      tasteProfile: {
        ...FOR_YOU_DEFAULTS.tasteProfile,
        ...(value?.tasteProfile || {}),
      },
      preparationMethods: Array.isArray(value?.preparationMethods)
        ? value.preparationMethods
        : [],
    }),
    onRestore: (draft) =>
      setFormData((current) => ({ ...current, ...draft })),
    notify: (message, type) =>
      pushToast(message, type === "error" ? "error" : "success"),
  });

  useEffect(() => {
    if (
      !isOpen ||
      !editId ||
      !restaurantId ||
      verifiedCurrentRecipeItem
    ) {
      return;
    }
    if (
      ["loading", "loaded", "missing"].includes(recipeDetailState?.status)
    ) {
      return;
    }
    ensureRecipeLoaded(editId);
  }, [
    isOpen,
    editId,
    restaurantId,
    verifiedCurrentRecipeItem,
    recipeDetailState,
    ensureRecipeLoaded,
  ]);

  useEffect(() => {
    if (isOpen) {
      setImageSyncStatus("idle");
      setIsSubmitting(false);
      submitLockRef.current = false;
      savedMenuItemIdRef.current = editId || null;

      if (editId && currentItem) {
        const sourceVariants =
          existingServingVariants.length > 0
            ? existingServingVariants
            : Array.isArray(currentItem.servingVariants)
              ? currentItem.servingVariants
              : [];

        const methods =
          sourceVariants.length > 0
            ? normalizeDefaultVariant(
                sourceVariants.map((servingVariant) => ({
                  key: servingVariant.key || "",
                  name: servingVariant.name || "",
                  price:
                    typeof servingVariant.price === "number"
                      ? servingVariant.price
                      : "",
                  cookTime: currentItem.avgPrepTimeMin || "",
                  mode: servingVariant.mode || "PORTION",
                  sellQty: servingVariant.sellQty || 1,
                  sellUnit: servingVariant.sellUnit || "portion",
                  ingredients: Array.isArray(servingVariant.ingredients)
                    ? cloneIngredients(servingVariant.ingredients)
                    : [],
                  isDefault: !!servingVariant.isDefault,
                })),
              )
            : [{ ...defaultMethod }];

        setFormData({
          name: currentItem.name || "",
          categoryId:
            currentItem.categoryId ||
            currentItem.category?.id ||
            currentItem.category ||
            "",
          status: normalizeMenuItemStatus(currentItem.status),
          prepStation: normalizePrepStation(currentItem.prepStation),
          thumbImage: currentItem.thumbImage || "",
          description: currentItem.description || "",
          preparationMethods: methods,
          foodType: currentItem.foodType || FOR_YOU_DEFAULTS.foodType,
          meatTypes: Array.isArray(currentItem.meatTypes)
            ? currentItem.meatTypes
            : [],
          dietTags: Array.isArray(currentItem.dietTags)
            ? currentItem.dietTags
            : [],
          allergenTags: Array.isArray(currentItem.allergenTags)
            ? currentItem.allergenTags
            : [],
          tasteProfile: {
            ...FOR_YOU_DEFAULTS.tasteProfile,
            ...(currentItem.tasteProfile || {}),
          },
        });
      } else {
        setFormData({
          name: "",
          categoryId: "",
          status: normalizeMenuItemStatus(),
          prepStation: "kitchen",
          thumbImage: "",
          description: "",
          preparationMethods: [{ ...defaultMethod }],
          ...FOR_YOU_DEFAULTS,
        });
      }
    } else {
      setIsSubmitting(false);
      submitLockRef.current = false;
      savedMenuItemIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, currentItem, isOpen]);

  const handleRequestClose = () => {
    if (isSubmitting) return;
    requestCloseWithDraft(onClose);
  };

  const handleInputChange = (field, value) => {
    setFormData((current) => {
      if (
        field === "foodType" &&
        !["NON_VEGETARIAN", "MIXED"].includes(value)
      ) {
        return { ...current, [field]: value, meatTypes: [] };
      }
      return { ...current, [field]: value };
    });
    if (field === "thumbImage") {
      setImageSyncStatus("idle");
    }
  };

  const handlePMChange = (index, field, value) => {
    setFormData((current) => ({
      ...current,
      preparationMethods: current.preparationMethods.map(
        (method, currentIndex) =>
          currentIndex === index ? { ...method, [field]: value } : method,
      ),
    }));
  };

  const toggleArrayValue = (field, value) => {
    setFormData((current) => {
      const values = Array.isArray(current[field]) ? current[field] : [];
      return {
        ...current,
        [field]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  };

  const addPM = () => {
    if (isSubmitting) return;

    setFormData((current) => ({
      ...current,
      preparationMethods: [
        ...current.preparationMethods,
        { ...defaultMethod, isDefault: false },
      ],
    }));
  };

  const removePM = (index) => {
    if (isSubmitting) return;

    if (formData.preparationMethods.length > 1) {
      setFormData((current) => ({
        ...current,
        preparationMethods: current.preparationMethods.filter(
          (_, currentIndex) => currentIndex !== index,
        ),
      }));
    } else {
      pushToast("Món cần có ít nhất một cách chế biến.", "error");
    }
  };

  const handleRetryRecipeLoad = async () => {
    if (!editId || isSubmitting || isRecipeGuardPending) return;

    const nextState = await ensureRecipeLoaded(editId);
    if (nextState?.status === "error") {
      pushToast(
        `Không thể tải định lượng nguyên liệu: ${getGraphQLErrorMessage(
          nextState.error,
          "Vui lòng thử lại.",
        )}`,
        "error",
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitLockRef.current) return;
    if (isRecipeGuardPending) {
      pushToast(
        "Đang tải định lượng nguyên liệu. Vui lòng chờ thêm một chút.",
        "error",
      );
      return;
    }
    if (isRecipeGuardBlocked) {
      await handleRetryRecipeLoad();
      return;
    }
    if (!restaurantId) {
      pushToast(
        "Không xác định được nhà hàng. Vui lòng chọn lại nhà hàng.",
        "error",
      );
      return;
    }

    const itemName = String(formData.name || "").trim();
    if (!itemName) {
      pushToast("Vui lòng nhập tên món ăn.", "error");
      return;
    }

    const categoryId = String(formData.categoryId || "").trim();
    if (!categoryId) {
      pushToast("Vui lòng chọn danh mục món.", "error");
      return;
    }

    let normalizedMethods;
    try {
      normalizedMethods = validatePreparationMethods(
        formData.preparationMethods,
      );
    } catch (error) {
      pushToast(error.message, "error");
      return;
    }

    const cookTimes = normalizedMethods
      .map((method) => parseInt(method.cookTime, 10))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgPrepTimeMin =
      cookTimes.length > 0
        ? Math.round(
            cookTimes.reduce((sum, value) => sum + value, 0) /
              cookTimes.length,
          )
        : undefined;

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const menuItemPayload = {
        name: itemName,
        categoryId,
        status: normalizeMenuItemStatus(formData.status),
        prepStation: normalizePrepStation(formData.prepStation),
        description: formData.description,
        ...(Number.isFinite(avgPrepTimeMin) ? { avgPrepTimeMin } : {}),
        ...(formData.thumbImage?.trim()
          ? { thumbImage: formData.thumbImage.trim() }
          : {}),
        dietTags: Array.from(
          new Set((formData.dietTags || []).filter(Boolean)),
        ),
        allergenTags: Array.from(
          new Set((formData.allergenTags || []).filter(Boolean)),
        ),
        foodType: formData.foodType || FOR_YOU_DEFAULTS.foodType,
        meatTypes: ["NON_VEGETARIAN", "MIXED"].includes(
          formData.foodType,
        )
          ? Array.from(new Set((formData.meatTypes || []).filter(Boolean)))
          : [],
        tasteProfile: {
          ...FOR_YOU_DEFAULTS.tasteProfile,
          ...(formData.tasteProfile || {}),
        },
      };

      let targetMenuItemId =
        editId || savedMenuItemIdRef.current || null;

      try {
        if (targetMenuItemId) {
          await updateMenuItem({
            id: targetMenuItemId,
            ...menuItemPayload,
          });
        } else {
          const created = await createMenuItem({
            ...menuItemPayload,
            timeSlot,
          });
          targetMenuItemId = created?.id;
          savedMenuItemIdRef.current = targetMenuItemId || null;
        }
      } catch (error) {
        pushToast(getGraphQLErrorMessage(error), "error");
        return;
      }

      if (!targetMenuItemId) {
        pushToast(
          "Không thể xác nhận món vừa lưu. Vui lòng thử lại.",
          "error",
        );
        return;
      }

      try {
        const recipeForm = buildRecipeForm(
          normalizedMethods,
          existingServingVariants,
        );
        await updateRecipe(targetMenuItemId, recipeForm);
      } catch (error) {
        const actionLabel = editId ? "cập nhật" : "tạo";
        pushToast(
          `Món đã được ${actionLabel}, nhưng cách chế biến hoặc định lượng nguyên liệu chưa lưu được: ${getGraphQLErrorMessage(
            error,
            "Không thể lưu định lượng nguyên liệu.",
          )}`,
          "error",
        );
        return;
      }

      try {
        await onSave?.();
      } catch (error) {
        pushToast(
          `Đã lưu món và định lượng nguyên liệu nhưng chưa thể làm mới danh sách: ${getGraphQLErrorMessage(
            error,
            "Không thể tải lại dữ liệu.",
          )}`,
          "error",
        );
        return;
      }

      clearDraft();
      pushToast(
        editId
          ? "Đã lưu thay đổi món ăn."
          : "Đã tạo món mới.",
        "success",
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const isSaving = isSubmitting;
  const isSubmitDisabled = isSaving || isRecipeGuardPending;

  const recipeTrackingStatus = useMemo(() => {
    const methods = Array.isArray(formData.preparationMethods)
      ? formData.preparationMethods
      : [];
    const hasMethods =
      methods.length > 0 &&
      methods.some((method) => String(method?.name || "").trim());
    const hasIngredients = methods.some(
      (method) =>
        Array.isArray(method?.ingredients) && method.ingredients.length > 0,
    );
    if (hasIngredients) return "tracked";
    if (hasMethods) return "missing_ingredients";
    return "not_tracked";
  }, [formData.preparationMethods]);

  const dietLabelMap = useMemo(
    () =>
      new Map(
        FOR_YOU_DIET_OPTIONS.map((option) => [
          option.value,
          option.label,
        ]),
      ),
    [],
  );

  const allergenLabelMap = useMemo(
    () =>
      new Map(
        FOR_YOU_ALLERGEN_OPTIONS.map((option) => [
          option.value,
          option.label,
        ]),
      ),
    [],
  );

  const selectedDietLabels = (formData.dietTags || []).map(
    (tag) => dietLabelMap.get(tag) || tag,
  );
  const selectedAllergenLabels = (formData.allergenTags || []).map(
    (tag) => allergenLabelMap.get(tag) || tag,
  );
  const foodTypeLabel =
    FOOD_TYPE_OPTIONS.find((option) => option.value === formData.foodType)
      ?.label || FOOD_TYPE_OPTIONS[0].label;
  const selectedMeatLabels = (formData.meatTypes || []).map(
    (type) =>
      MEAT_TYPE_OPTIONS.find((option) => option.value === type)?.label || type,
  );
  const shouldShowMeatTypes = ["NON_VEGETARIAN", "MIXED"].includes(formData.foodType);
  const currentSugarValue = Number(formData.tasteProfile?.sugar ?? 100);
  const sugarPreviewLabel =
    FOR_YOU_SUGAR_OPTIONS.find(
      (option) => option.value === currentSugarValue,
    )?.label || `${currentSugarValue}%`;
  const spicePreviewLabel = formData.tasteProfile?.spice ?? "Vừa";
  const tasteNotes = [
    formData.tasteProfile?.containsOnion ? "Có hành" : null,
    formData.tasteProfile?.containsCilantro ? "Có ngò (rau mùi)" : null,
    `Mức ngọt: ${sugarPreviewLabel}`,
    `Mức cay: ${spicePreviewLabel}`,
  ].filter(Boolean);
  const hasForYouMetadata =
    selectedDietLabels.length > 0 ||
    selectedAllergenLabels.length > 0 ||
    formData.foodType !== FOR_YOU_DEFAULTS.foodType ||
    selectedMeatLabels.length > 0 ||
    !!formData.tasteProfile?.containsOnion ||
    !!formData.tasteProfile?.containsCilantro ||
    currentSugarValue !== FOR_YOU_DEFAULTS.tasteProfile.sugar ||
    spicePreviewLabel !== FOR_YOU_DEFAULTS.tasteProfile.spice;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleRequestClose}
      size="xl"
      className="menu-item-modal-modern"
    >
      <Modal.Header onClose={handleRequestClose}>
        {editId ? "Chỉnh sửa món ăn" : "Thêm món mới"}
      </Modal.Header>

      <Modal.Body>
        <form
          id="menu-form"
          onSubmit={handleSubmit}
          className="modern-form-layout"
        >
          <div className="left-col">
            <h4 className="col-title">
              <Info size={18} /> Thông tin món ăn
            </h4>

            <div className="form-group">
              <label>
                Tên món ăn <span className="req">*</span>
              </label>
              <input
                type="text"
                className="modern-input"
                value={formData.name}
                onChange={(event) =>
                  handleInputChange("name", event.target.value)
                }
                placeholder="Ví dụ: Phở bò tái"
                required
                autoFocus
                disabled={isSaving}
              />
            </div>

            <div className="row-2-col">
              <div className="form-group">
                <label>
                  Danh mục món <span className="req">*</span>
                </label>
                <select
                  className="modern-select"
                  value={formData.categoryId}
                  onChange={(event) =>
                    handleInputChange("categoryId", event.target.value)
                  }
                  required
                  disabled={isSaving}
                >
                  <option value="">Chọn danh mục món</option>
                  {categories?.map((category) => (
                    <option
                      key={category.id || category._id}
                      value={category.id || category._id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Trạng thái bán</label>
                <select
                  className="modern-select"
                  value={formData.status}
                  onChange={(event) =>
                    handleInputChange("status", event.target.value)
                  }
                  disabled={isSaving}
                >
                  {MENU_ITEM_STATUS_OPTIONS.map((statusOption) => (
                    <option
                      key={statusOption.value}
                      value={statusOption.value}
                    >
                      {statusOption.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="menu-item-prep-station">
                Khu chế biến <span className="req">*</span>
              </label>
              <select
                id="menu-item-prep-station"
                className="modern-select"
                value={normalizePrepStation(formData.prepStation)}
                onChange={(event) =>
                  handleInputChange("prepStation", event.target.value)
                }
                aria-describedby="menu-item-prep-station-hint"
                required
                disabled={isSaving}
              >
                {PREP_STATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p
                id="menu-item-prep-station-hint"
                className="for-you-option-group__hint"
              >
                {PREP_STATION_OPTIONS.find(
                  (option) =>
                    option.value === normalizePrepStation(formData.prepStation),
                )?.helper}
              </p>
            </div>

            <div className="form-group">
              <label>Ảnh món ăn</label>
              <LocalImagePicker
                value={formData.thumbImage || ""}
                onChange={(value) =>
                  handleInputChange("thumbImage", value)
                }
                disabled={isSaving}
                ownerKey={
                  editId ||
                  savedMenuItemIdRef.current ||
                  restaurantId ||
                  "menu-item-draft"
                }
                purpose="menu-item-thumb"
                label="Chọn ảnh món"
                placeholder="Chưa có ảnh món"
                helperText="Ảnh sẽ được nén và tạo kích thước phù hợp để tải nhanh trên các trang có món ăn."
                onStatusChange={setImageSyncStatus}
              />
              {(imageSyncStatus === "localOnly" ||
                getImagePersistenceStatus(formData.thumbImage) ===
                  "localOnly") && (
                <small className="error-text">
                  Ảnh mới chỉ được lưu trên thiết bị này. Hãy tải ảnh lên hệ
                  thống để ảnh hiển thị trên thiết bị khác.
                </small>
              )}
              {(imageSyncStatus === "synced" ||
                getImagePersistenceStatus(formData.thumbImage) ===
                  "synced") && (
                <small
                  style={{
                    color: "#0f766e",
                    display: "block",
                    marginTop: 6,
                  }}
                >
                  Ảnh đã được lưu trên hệ thống.
                </small>
              )}
            </div>

            <div className="form-group">
              <label>Mô tả món</label>
              <textarea
                className="modern-textarea"
                rows="4"
                value={formData.description}
                onChange={(event) =>
                  handleInputChange("description", event.target.value)
                }
                placeholder="Mô tả ngắn về hương vị, nguyên liệu nổi bật hoặc cách dùng"
                disabled={isSaving}
              />
            </div>

            <div
              ref={forYouSectionRef}
              className={`for-you-meta-section ${
                initialFocusSection === "for-you" && editId
                  ? "is-focus-target"
                  : ""
              }`}
            >
              <div className="for-you-meta-section__header">
                <h5 className="for-you-meta-section__title">
                  Thông tin tư vấn món
                </h5>
                <p className="for-you-meta-section__description">
                  Khai báo chế độ ăn, thành phần dị ứng và khẩu vị để nhân viên
                  và khách chọn món phù hợp hơn.
                </p>
              </div>

              <div className="for-you-option-group">
                <div className="for-you-option-group__title">
                  Phân loại món ăn
                </div>
                <select
                  className="modern-select"
                  value={formData.foodType || FOR_YOU_DEFAULTS.foodType}
                  onChange={(event) =>
                    handleInputChange("foodType", event.target.value)
                  }
                  disabled={isSaving}
                >
                  {FOOD_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="for-you-option-group__hint">
                  {FOOD_TYPE_OPTIONS.find(
                    (option) => option.value === formData.foodType,
                  )?.helper || FOOD_TYPE_OPTIONS[0].helper}
                </p>
              </div>

              {shouldShowMeatTypes ? (
                <div className="for-you-option-group">
                  <div className="for-you-option-group__title">
                    Loại thịt / đạm động vật
                  </div>
                  <div className="for-you-option-grid for-you-option-grid--compact">
                    {MEAT_TYPE_OPTIONS.map((option) => {
                      const isSelected = (formData.meatTypes || []).includes(
                        option.value,
                      );
                      return (
                        <label
                          key={option.value}
                          className={`for-you-option-card for-you-option-card--compact ${
                            isSelected
                              ? "for-you-option-card--selected"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              toggleArrayValue("meatTypes", option.value)
                            }
                            disabled={isSaving}
                          />
                          <span className="for-you-option-card__label">
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="for-you-option-group">
                <div className="for-you-option-group__title">
                  Chế độ ăn phù hợp
                </div>
                <div className="for-you-option-grid">
                  {FOR_YOU_DIET_OPTIONS.map((option) => {
                    const isSelected = (formData.dietTags || []).includes(
                      option.value,
                    );
                    return (
                      <label
                        key={option.value}
                        className={`for-you-option-card ${
                          isSelected ? "for-you-option-card--selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleArrayValue("dietTags", option.value)
                          }
                          disabled={isSaving}
                        />
                        <span className="for-you-option-card__label">
                          {option.label}
                        </span>
                        <span className="for-you-option-card__helper">
                          {option.helper}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="for-you-option-group">
                <div className="for-you-option-group__title">
                  Thành phần có thể gây dị ứng
                </div>
                <div className="for-you-option-grid">
                  {FOR_YOU_ALLERGEN_OPTIONS.map((option) => {
                    const isSelected = (formData.allergenTags || []).includes(
                      option.value,
                    );
                    return (
                      <label
                        key={option.value}
                        className={`for-you-option-card ${
                          isSelected ? "for-you-option-card--selected" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleArrayValue("allergenTags", option.value)
                          }
                          disabled={isSaving}
                        />
                        <span className="for-you-option-card__label">
                          {option.label}
                        </span>
                        <span className="for-you-option-card__helper">
                          {option.helper}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="for-you-meta-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={!!formData.tasteProfile?.containsOnion}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        tasteProfile: {
                          ...current.tasteProfile,
                          containsOnion: event.target.checked,
                        },
                      }))
                    }
                    disabled={isSaving}
                  />
                  Món có hành
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!formData.tasteProfile?.containsCilantro}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        tasteProfile: {
                          ...current.tasteProfile,
                          containsCilantro: event.target.checked,
                        },
                      }))
                    }
                    disabled={isSaving}
                  />
                  Món có ngò (rau mùi)
                </label>
                <label>
                  Mức ngọt mặc định
                  <select
                    className="modern-select small"
                    value={formData.tasteProfile?.sugar ?? 100}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        tasteProfile: {
                          ...current.tasteProfile,
                          sugar: Number(event.target.value),
                        },
                      }))
                    }
                    disabled={isSaving}
                  >
                    {FOR_YOU_SUGAR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Mức cay mặc định
                  <select
                    className="modern-select small"
                    value={formData.tasteProfile?.spice ?? "Vừa"}
                    onChange={(event) =>
                      setFormData((current) => ({
                        ...current,
                        tasteProfile: {
                          ...current.tasteProfile,
                          spice: event.target.value,
                        },
                      }))
                    }
                    disabled={isSaving}
                  >
                    {FOR_YOU_SPICE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="for-you-meta-preview">
                <div className="for-you-meta-preview__title">
                  Tóm tắt thông tin tư vấn
                </div>
                {hasForYouMetadata ? (
                  <ul>
                    <li>
                      Nhóm món: {foodTypeLabel}
                      {selectedMeatLabels.length
                        ? ` (${selectedMeatLabels.join(" / ")})`
                        : ""}
                    </li>
                    <li>
                      Phù hợp với: {selectedDietLabels.length
                        ? selectedDietLabels.join(" / ")
                        : "Chưa khai báo"}
                    </li>
                    <li>
                      Thành phần dị ứng: {selectedAllergenLabels.length
                        ? selectedAllergenLabels.join(" / ")
                        : "Chưa khai báo"}
                    </li>
                    <li>Khẩu vị: {tasteNotes.join(", ")}</li>
                  </ul>
                ) : (
                  <p>
                    Chưa có thông tin tư vấn. Hệ thống vẫn có thể gợi ý theo tên
                    và mô tả món, nhưng độ chính xác sẽ thấp hơn.
                  </p>
                )}
              </div>

              <div className="for-you-meta-help">
                Gợi ý: chọn “Hải sản” khi món có tôm, cua hoặc mực; chọn “Sữa và
                sản phẩm từ sữa” khi món có sữa hoặc phô mai.
              </div>
            </div>
          </div>

          <div className="right-col">
            <div className="header-action">
              <h4 className="col-title">
                <ChefHat size={18} /> Cách chế biến và giá bán
              </h4>
              <button
                type="button"
                className="btn-add-variant"
                onClick={addPM}
                disabled={isSaving}
              >
                <Plus size={16} /> Thêm cách chế biến
              </button>
            </div>

            <div className={`recipe-tracking-card ${recipeTrackingStatus}`}>
              <p className="recipe-tracking-card__title">
                {recipeTrackingStatus === "tracked"
                  ? "Đã thiết lập định lượng nguyên liệu."
                  : recipeTrackingStatus === "missing_ingredients"
                    ? "Đã có cách chế biến và giá bán, nhưng chưa khai báo nguyên liệu."
                    : "Chưa thiết lập định lượng nguyên liệu cho món này."}
              </p>
              <p className="recipe-tracking-card__description">
                {recipeTrackingStatus === "tracked"
                  ? "Hệ thống có thể tự tính số lượng món còn bán được dựa trên tồn kho."
                  : "Hãy khai báo nguyên liệu và định lượng để tồn kho được cập nhật chính xác."}
              </p>
              <button
                type="button"
                className="recipe-tracking-card__cta"
                title="Mở phần quản lý định lượng nguyên liệu trong Kho"
                onClick={() => {
                  window.location.href = "/manager#storage";
                }}
              >
                Mở phần định lượng nguyên liệu
              </button>
            </div>

            <div className="methods-scroll-container">
              {formData.preparationMethods.map((method, index) => (
                <div key={method.key || index} className="method-card">
                  <div className="method-card-header">
                    <span className="badge-index">Cách {index + 1}</span>
                    {formData.preparationMethods.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove"
                        onClick={() => removePM(index)}
                        title="Xóa cách chế biến này"
                        aria-label={`Xóa cách chế biến số ${index + 1}`}
                        disabled={isSaving}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="method-grid">
                    <div className="form-group full-width">
                      <label>
                        Tên cách chế biến <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        className="modern-input small"
                        value={method.name}
                        onChange={(event) =>
                          handlePMChange(index, "name", event.target.value)
                        }
                        placeholder="Ví dụ: Nướng, chiên, hấp"
                        required
                        disabled={isSaving}
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        <DollarSign size={12} /> Giá bán
                      </label>
                      <input
                        type="number"
                        className="modern-input small"
                        value={method.price}
                        onChange={(event) =>
                          handlePMChange(index, "price", event.target.value)
                        }
                        placeholder="0"
                        min="0"
                        required
                        disabled={isSaving}
                      />
                    </div>

                    <div className="form-group">
                      <label>
                        <Clock size={12} /> Thời gian chế biến (phút)
                      </label>
                      <input
                        type="number"
                        className="modern-input small"
                        value={method.cookTime}
                        onChange={(event) =>
                          handlePMChange(index, "cookTime", event.target.value)
                        }
                        placeholder="10"
                        min="0"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="toast-wrapper">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast-item ${toast.type}`}>
              {toast.type === "success" ? (
                <CheckCircle2 size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{toast.text}</span>
            </div>
          ))}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleRequestClose}
          disabled={isSaving}
        >
          Đóng
        </button>
        <button
          type={isRecipeGuardBlocked ? "button" : "submit"}
          form={isRecipeGuardBlocked ? undefined : "menu-form"}
          className="btn-primary"
          disabled={isSubmitDisabled}
          onClick={
            isRecipeGuardBlocked ? handleRetryRecipeLoad : undefined
          }
        >
          {isSaving ? (
            "Đang lưu..."
          ) : isRecipeGuardPending ? (
            "Đang tải định lượng nguyên liệu..."
          ) : isRecipeGuardBlocked ? (
            "Tải lại định lượng nguyên liệu"
          ) : (
            <>
              <Save size={18} /> {editId ? "Lưu thay đổi" : "Tạo món mới"}
            </>
          )}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default MenuItemModal;
