import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import Modal from "@/components/common/Modal";
import { formatCurrency } from "@/utils/formatters";
import { TABLE_ORDER_ACCESS_REQUIRED_EVENT } from "./TableOrderAccessGate";
import "./TableOrderDraftLauncher.scss";
import "./TableOrderDraftLauncherV2.scss";

const ROUTE = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;

const CONTEXT = gql`
  query TableOrderDraftContext($restaurantId: ID!, $tableId: ID!, $token: String!) {
    publicActiveTableSessionOrders(
      restaurantId: $restaurantId
      tableId: $tableId
      token: $token
    ) {
      tableCode
      canRequestOrderAccess
      orderAccessConfirmed
    }
  }
`;

const MENU = gql`
  query TableOrderDraftMenu($filter: MenuItemFilter!, $limit: Int) {
    menuItemsConnection(filter: $filter, limit: $limit) {
      edges {
        node {
          id
          menuId
          categoryId
          name
          description
          basePrice
          thumbImage
          status
          defaultServingKey
          servingVariants {
            key
            name
            mode
            price
            sellQty
            sellUnit
            isDefault
          }
        }
      }
    }
  }
`;

const ITEM_MODIFIERS = gql`
  query TableOrderDraftItemModifiers($restaurantId: ID!, $menuItemId: ID!) {
    customerModifierGroups(
      restaurantId: $restaurantId
      menuItemId: $menuItemId
    ) {
      id
      name
      selectionType
      required
      minSelected
      maxSelected
      options {
        id
        name
        isDefault
        priceRule {
          rule
          amount
        }
      }
    }
  }
`;

const SUBMIT = gql`
  mutation SubmitTableOrderDraft($input: PublicSubmitTableOrderInput!) {
    publicSubmitTableOrder(input: $input) {
      ok
      message
      order {
        id
        orderCode
      }
    }
  }
`;

const createKey = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `table-draft-${crypto.randomUUID()}`
    : `table-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const variantOf = (item) =>
  item?.servingVariants?.find((variant) => variant.isDefault) ||
  item?.servingVariants?.find((variant) => variant.key === item?.defaultServingKey) ||
  item?.servingVariants?.[0] || {
    key: item?.defaultServingKey || "portion",
    name: "Phần tiêu chuẩn",
    mode: "PORTION",
    price: Number(item?.basePrice || 0),
    sellQty: 1,
    sellUnit: "portion",
  };

const normalizeSelectionType = (value) => String(value || "").toLowerCase();

const defaultWeightKg = (variant) => {
  const sellQty = Number(variant?.sellQty || 1);
  const kilograms = variant?.sellUnit === "g" ? sellQty / 1000 : sellQty;
  const safeValue = Number.isFinite(kilograms) && kilograms > 0 ? kilograms : 0.5;
  return String(Number(safeValue.toFixed(3))).replace(".", ",");
};

const parseWeightKg = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!/^\d+(?:\.\d{0,3})?$/.test(normalized)) return null;
  const kilograms = Number(normalized);
  if (!Number.isFinite(kilograms) || kilograms <= 0 || kilograms > 100) return null;
  return kilograms;
};

const formatWeight = (grams) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(
    Number(grams || 0) / 1000,
  )} kg`;

const getModifierSelectionError = (groups = [], selected = {}) => {
  for (const group of groups) {
    const count = (selected[group.id] || []).length;
    if (normalizeSelectionType(group.selectionType) === "single") {
      if (group.required && count < 1) return `Vui lòng chọn ${group.name}.`;
      if (count > 1) return `${group.name} chỉ cho phép một lựa chọn.`;
      continue;
    }

    const minimum = group.required
      ? Math.max(1, Number(group.minSelected || 0))
      : Number(group.minSelected || 0);
    const maximum = group.maxSelected == null ? null : Number(group.maxSelected);
    if (!group.required && count === 0) continue;
    if (count < minimum) {
      return `Vui lòng chọn ít nhất ${minimum} lựa chọn cho ${group.name}.`;
    }
    if (maximum != null && count > maximum) {
      return `Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`;
    }
  }
  return "";
};

const calculateConfiguredUnitPrice = (basePrice, groups = [], selected = {}) => {
  let setPrice = null;
  let delta = 0;

  for (const group of groups) {
    for (const optionId of selected[group.id] || []) {
      const option = (group.options || []).find(
        (candidate) => String(candidate.id) === String(optionId),
      );
      if (!option) continue;
      const amount = Number(option.priceRule?.amount || 0);
      if (option.priceRule?.rule === "SET") setPrice = amount;
      else delta += amount;
    }
  }

  return Math.max(0, Number(setPrice == null ? basePrice : setPrice) + delta);
};

const getLineTotal = (line) => {
  const unitPrice = Number(line.configuredUnitPrice ?? line.basePrice ?? 0);
  if (line.servingVariant?.mode === "BY_WEIGHT") {
    const grams = Number(line.weightGrams || 0);
    const sellQty = Number(line.servingVariant?.sellQty || 1);
    const sold = line.servingVariant?.sellUnit === "g" ? grams : grams / 1000;
    return Math.round(unitPrice * (sold / sellQty));
  }
  return Math.round(unitPrice * Number(line.quantity || 1));
};

const createLineSignature = (line) =>
  JSON.stringify({
    dishId: line.dishId,
    servingKey: line.servingKey,
    modifiers: [...(line.selectedModifiers || [])]
      .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
      .sort(),
    note: line.note || "",
  });

export default function TableOrderDraftLauncher() {
  const location = useLocation();
  const match = location.pathname.match(ROUTE);
  const restaurantId = match?.[1] || "";
  const tableId = match?.[2] || "";
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search],
  );

  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [waitingToSubmit, setWaitingToSubmit] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartExpanded, setCartExpanded] = useState(false);

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [weightKg, setWeightKg] = useState("0,5");
  const [itemNote, setItemNote] = useState("");
  const [itemError, setItemError] = useState("");

  const { data, refetch } = useQuery(CONTEXT, {
    variables: { restaurantId, tableId, token },
    skip: !restaurantId || !tableId || !token,
    fetchPolicy: "cache-and-network",
    pollInterval: 8000,
  });
  const context = data?.publicActiveTableSessionOrders;
  const draftMode = Boolean(
    context?.canRequestOrderAccess && !context?.orderAccessConfirmed,
  );

  const { data: menuData, loading } = useQuery(MENU, {
    variables: { filter: { restaurantId, sort: "default" }, limit: 60 },
    skip: !restaurantId || !open || !draftMode,
    fetchPolicy: "cache-and-network",
  });

  const items = useMemo(
    () =>
      (menuData?.menuItemsConnection?.edges || [])
        .map((edge) => edge?.node)
        .filter(Boolean)
        .filter(
          (item) =>
            !["inactive", "archived"].includes(
              String(item.status || "").toLowerCase(),
            ),
        ),
    [menuData?.menuItemsConnection?.edges],
  );

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLocaleLowerCase("vi");
    if (!keyword) return items;
    return items.filter((item) => {
      const variants = item.servingVariants || [variantOf(item)];
      return `${item.name || ""} ${item.description || ""} ${variants
        .map((variant) => variant.name || "")
        .join(" ")}`
        .toLocaleLowerCase("vi")
        .includes(keyword);
    });
  }, [items, searchTerm]);

  const { data: modifierData, loading: modifierLoading } = useQuery(
    ITEM_MODIFIERS,
    {
      variables: { restaurantId, menuItemId: selectedItem?.id || "" },
      skip: !restaurantId || !selectedItem?.id,
      fetchPolicy: "network-only",
    },
  );
  const modifierGroups = modifierData?.customerModifierGroups || [];

  const selectedVariant = useMemo(() => {
    if (!selectedItem) return null;
    const variants = selectedItem.servingVariants || [];
    return (
      variants.find((variant) => variant.key === selectedVariantKey) ||
      variants[0] ||
      variantOf(selectedItem)
    );
  }, [selectedItem, selectedVariantKey]);

  const configuredUnitPrice = useMemo(
    () =>
      calculateConfiguredUnitPrice(
        selectedVariant?.price ?? selectedItem?.basePrice ?? 0,
        modifierGroups,
        selectedModifiers,
      ),
    [modifierGroups, selectedItem?.basePrice, selectedModifiers, selectedVariant?.price],
  );

  const parsedWeightKg = parseWeightKg(weightKg);
  const previewWeightGrams = parsedWeightKg == null ? 0 : Math.round(parsedWeightKg * 1000);
  const previewTotal = selectedVariant
    ? getLineTotal({
        configuredUnitPrice,
        servingVariant: selectedVariant,
        quantity,
        weightGrams: previewWeightGrams,
      })
    : 0;

  const [submit, { loading: submitting }] = useMutation(SUBMIT);

  const sendDraft = useCallback(async () => {
    if (!cart.length || submitting) return;
    setError("");
    try {
      const result = await submit({
        variables: {
          input: {
            restaurantId,
            tableId,
            token,
            identityToken: null,
            items: cart.map(
              ({
                localId: _localId,
                configuredUnitPrice: _configuredUnitPrice,
                modifierLabels: _modifierLabels,
                signature: _signature,
                ...line
              }) => line,
            ),
            note: "Khách chọn món sau khi quét QR tại bàn.",
            idempotencyKey: createKey(),
          },
        },
      });
      setMessage(
        result.data?.publicSubmitTableOrder?.message ||
          "Đã gửi món. Nhân viên sẽ tiếp nhận và xác nhận.",
      );
      setCart([]);
      setOpen(false);
      setCartExpanded(false);
      setWaitingToSubmit(false);
    } catch {
      setError(
        "Chưa thể gửi món. Vui lòng thử lại sau khi nhân viên xác nhận thiết bị.",
      );
      setWaitingToSubmit(false);
    }
  }, [cart, restaurantId, submit, submitting, tableId, token]);

  useEffect(() => {
    const handleConfirmed = async () => {
      setWaitingToSubmit(true);
      await refetch();
    };
    window.addEventListener(
      "cohan:table-order-access-confirmed",
      handleConfirmed,
    );
    return () =>
      window.removeEventListener(
        "cohan:table-order-access-confirmed",
        handleConfirmed,
      );
  }, [refetch]);

  useEffect(() => {
    if (context?.orderAccessConfirmed && waitingToSubmit && cart.length) {
      void sendDraft();
    }
  }, [cart.length, context?.orderAccessConfirmed, sendDraft, waitingToSubmit]);

  useEffect(() => {
    if (!selectedItem) return;
    const initialVariant = variantOf(selectedItem);
    setSelectedVariantKey(initialVariant.key || "portion");
    setSelectedModifiers({});
    setQuantity(1);
    setWeightKg(defaultWeightKg(initialVariant));
    setItemNote("");
    setItemError("");
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem || !modifierGroups.length) return;
    const defaults = {};
    for (const group of modifierGroups) {
      const defaultOptions = (group.options || [])
        .filter((option) => option.isDefault)
        .map((option) => option.id);
      if (!defaultOptions.length) continue;
      defaults[group.id] =
        normalizeSelectionType(group.selectionType) === "single"
          ? [defaultOptions[0]]
          : defaultOptions;
    }
    setSelectedModifiers(defaults);
  }, [modifierGroups, selectedItem]);

  if (!draftMode) {
    return message ? (
      <div className="table-order-draft-toast" role="status">
        {message}
      </div>
    ) : null;
  }

  const count = cart.reduce(
    (sum, line) =>
      sum +
      (line.servingVariant?.mode === "BY_WEIGHT"
        ? 1
        : Number(line.quantity || 1)),
    0,
  );
  const total = cart.reduce((sum, line) => sum + getLineTotal(line), 0);

  const selectedCountForItem = (itemId) =>
    cart.reduce(
      (sum, line) =>
        line.dishId === itemId
          ? sum +
            (line.servingVariant?.mode === "BY_WEIGHT"
              ? 1
              : Number(line.quantity || 1))
          : sum,
      0,
    );

  const openItemConfiguration = (item) => {
    setSelectedItem(item);
    setItemError("");
  };

  const selectVariant = (variant) => {
    setSelectedVariantKey(variant.key);
    if (variant.mode === "BY_WEIGHT") {
      setWeightKg(defaultWeightKg(variant));
    }
    setItemError("");
  };

  const toggleModifier = (group, optionId) => {
    setSelectedModifiers((current) => {
      const selected = current[group.id] || [];
      if (normalizeSelectionType(group.selectionType) === "single") {
        return { ...current, [group.id]: [optionId] };
      }

      const exists = selected.includes(optionId);
      if (exists) {
        return {
          ...current,
          [group.id]: selected.filter((id) => id !== optionId),
        };
      }

      const maximum = group.maxSelected == null ? null : Number(group.maxSelected);
      if (maximum != null && selected.length >= maximum) return current;
      return { ...current, [group.id]: [...selected, optionId] };
    });
    setItemError("");
  };

  const addConfiguredItem = () => {
    if (!selectedItem || !selectedVariant) return;

    const modifierError = getModifierSelectionError(
      modifierGroups,
      selectedModifiers,
    );
    if (modifierError) {
      setItemError(modifierError);
      return;
    }

    const isWeighted = selectedVariant.mode === "BY_WEIGHT";
    const kilograms = parseWeightKg(weightKg);
    if (isWeighted && kilograms == null) {
      setItemError("Vui lòng nhập khối lượng hợp lệ, ví dụ 0,5 kg hoặc 1,25 kg.");
      return;
    }

    const safeQuantity = Math.max(1, Math.min(20, Number(quantity || 1)));
    const selectedModifierList = modifierGroups.flatMap((group) =>
      (selectedModifiers[group.id] || []).map((optionId) => ({
        groupId: group.id,
        optionId,
      })),
    );
    const modifierLabels = modifierGroups.flatMap((group) =>
      (selectedModifiers[group.id] || [])
        .map((optionId) =>
          (group.options || []).find(
            (option) => String(option.id) === String(optionId),
          ),
        )
        .filter(Boolean)
        .map((option) => option.name),
    );
    const basePrice = Number(selectedVariant.price ?? selectedItem.basePrice ?? 0);
    const line = {
      localId: createKey(),
      dishId: selectedItem.id,
      menuId: selectedItem.menuId,
      categoryId: selectedItem.categoryId,
      name: selectedItem.name,
      unit: selectedVariant.sellUnit || "portion",
      image: selectedItem.thumbImage || null,
      basePrice,
      configuredUnitPrice,
      servingKey:
        selectedVariant.key || selectedItem.defaultServingKey || "portion",
      servingVariant: {
        key: selectedVariant.key || "portion",
        name: selectedVariant.name || "Phần tiêu chuẩn",
        mode: selectedVariant.mode || "PORTION",
        price: basePrice,
        sellQty: Number(selectedVariant.sellQty || 1),
        sellUnit: selectedVariant.sellUnit || "portion",
      },
      quantity: isWeighted ? 1 : safeQuantity,
      weightGrams: isWeighted ? Math.round(kilograms * 1000) : null,
      selectedModifiers: selectedModifierList,
      modifierLabels,
      note: itemNote.trim() || null,
      priority: "MEDIUM",
      status: "pending",
    };
    line.signature = createLineSignature(line);

    setCart((current) => {
      if (isWeighted) return [...current, line];
      const existingIndex = current.findIndex(
        (entry) => entry.signature === line.signature,
      );
      if (existingIndex < 0) return [...current, line];
      const existing = current[existingIndex];
      const combinedQuantity = Number(existing.quantity || 1) + safeQuantity;
      if (combinedQuantity > 20) return [...current, line];
      return current.map((entry, index) =>
        index === existingIndex
          ? { ...entry, quantity: combinedQuantity }
          : entry,
      );
    });

    setMessage("");
    setError("");
    setSelectedItem(null);
  };

  const updateQuantity = (localId, delta) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.localId !== localId) return [line];
        if (line.servingVariant?.mode === "BY_WEIGHT") return [line];
        const nextQuantity = Number(line.quantity || 1) + delta;
        if (nextQuantity <= 0) return [];
        return [{ ...line, quantity: Math.min(20, nextQuantity) }];
      }),
    );
  };

  const removeLine = (localId) => {
    setCart((current) =>
      current.filter((entry) => entry.localId !== localId),
    );
  };

  return (
    <>
      <button
        className={`table-order-draft-launcher ${open ? "is-hidden" : ""}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <ShoppingBag aria-hidden="true" />
        <span>
          <strong>Chọn món tại bàn</strong>
          <small>{count ? `${count} món đang chờ gửi` : "Mở thực đơn và chọn món"}</small>
        </span>
        {count ? <b aria-label={`${count} món đã chọn`}>{count}</b> : null}
      </button>

      <Modal
        isOpen={open}
        onClose={() => !submitting && setOpen(false)}
        title={`Chọn món · Bàn ${context?.tableCode || "--"}`}
        size="xl"
        className="table-order-draft-modal table-order-draft-modal--v2"
        zIndex={1200}
      >
        <div className="table-order-draft table-order-draft--v2">
          <div className="table-order-draft__toolbar">
            <label className="table-order-draft__search">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm món ăn, đồ uống…"
                aria-label="Tìm món"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Xóa từ khóa tìm kiếm"
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <span aria-live="polite">
              {loading ? "Đang tải…" : `${filteredItems.length} món`}
            </span>
          </div>

          <section className="table-order-draft__menu" aria-label="Danh sách món">
            {loading ? (
              <div className="table-order-draft__state">Đang tải thực đơn…</div>
            ) : null}
            {!loading && !items.length ? (
              <div className="table-order-draft__state">Chưa có món đang bán.</div>
            ) : null}
            {!loading && items.length > 0 && !filteredItems.length ? (
              <div className="table-order-draft__state">
                Không tìm thấy món phù hợp với “{searchTerm.trim()}”.
              </div>
            ) : null}
            {filteredItems.map((item) => {
              const variant = variantOf(item);
              const selectedCount = selectedCountForItem(item.id);
              const weighted = variant.mode === "BY_WEIGHT";
              return (
                <article key={item.id} className={selectedCount ? "is-selected" : ""}>
                  <div className="table-order-draft__image">
                    <img
                      src={item.thumbImage || "/default-dishes.jpg"}
                      alt={item.name || "Món ăn"}
                      loading="lazy"
                    />
                    {selectedCount ? <b>{selectedCount}</b> : null}
                  </div>
                  <div className="table-order-draft__info">
                    <strong>{item.name}</strong>
                    <small>
                      {weighted
                        ? `${variant.name || "Theo kilogram"} · nhập khối lượng`
                        : variant.name || "Phần tiêu chuẩn"}
                    </small>
                  </div>
                  <b className="table-order-draft__price">
                    {formatCurrency(variant.price ?? item.basePrice ?? 0)}
                    {weighted ? <small>/ {variant.sellQty || 1} {variant.sellUnit || "kg"}</small> : null}
                  </b>
                  <div className="table-order-draft__item-actions">
                    <button
                      type="button"
                      onClick={() => openItemConfiguration(item)}
                      aria-label={`Chọn khối lượng, số lượng và cách chế biến cho ${item.name}`}
                    >
                      <Settings2 aria-hidden="true" />
                      {weighted ? "Chọn khối lượng" : "Chọn món"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <aside
            className={`table-order-draft__cart ${cartExpanded ? "is-expanded" : ""}`}
          >
            <button
              className="table-order-draft__cart-toggle"
              type="button"
              onClick={() => setCartExpanded((current) => !current)}
              aria-expanded={cartExpanded}
              aria-controls="table-order-draft-cart-panel"
            >
              <span>
                <ShoppingCart aria-hidden="true" />
                <span>
                  <strong>{count ? `${count} món` : "Giỏ món"}</strong>
                  <small>{count ? "Xem chi tiết" : "Chưa chọn món"}</small>
                </span>
              </span>
              <span>
                <strong>{formatCurrency(total)}</strong>
                {cartExpanded ? (
                  <ChevronDown aria-hidden="true" />
                ) : (
                  <ChevronUp aria-hidden="true" />
                )}
              </span>
            </button>

            <div
              id="table-order-draft-cart-panel"
              className="table-order-draft__cart-panel"
            >
              <div className="table-order-draft__cart-heading">
                <span>
                  <ShoppingCart aria-hidden="true" />
                  <h3>Món đã chọn</h3>
                </span>
                {count ? <b>{count}</b> : null}
              </div>

              <div className="table-order-draft__lines">
                {!cart.length ? (
                  <div className="table-order-draft__empty-cart">
                    <ShoppingBag aria-hidden="true" />
                    <strong>Chưa có món nào</strong>
                    <small>Chọn món rồi nhập số lượng hoặc khối lượng.</small>
                  </div>
                ) : null}
                {cart.map((line) => {
                  const weighted = line.servingVariant?.mode === "BY_WEIGHT";
                  return (
                    <div key={line.localId} className="table-order-draft__line">
                      <span>
                        <strong>{line.name}</strong>
                        <small>
                          {line.servingVariant?.name || "Phần tiêu chuẩn"}
                          {weighted ? ` · ${formatWeight(line.weightGrams)}` : ""}
                        </small>
                        {line.modifierLabels?.length ? (
                          <small>{line.modifierLabels.join(" · ")}</small>
                        ) : null}
                        {line.note ? <small>Ghi chú: {line.note}</small> : null}
                      </span>
                      <strong className="table-order-draft__line-total">
                        {formatCurrency(getLineTotal(line))}
                      </strong>
                      <div>
                        {weighted ? (
                          <span className="table-order-draft__weight-chip">
                            {formatWeight(line.weightGrams)}
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.localId, -1)}
                              aria-label={`Giảm ${line.name}`}
                            >
                              <Minus aria-hidden="true" />
                            </button>
                            <b>{line.quantity}</b>
                            <button
                              type="button"
                              onClick={() => updateQuantity(line.localId, 1)}
                              disabled={line.quantity >= 20}
                              aria-label={`Tăng ${line.name}`}
                            >
                              <Plus aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="table-order-draft__remove"
                          onClick={() => removeLine(line.localId)}
                          aria-label={`Xóa ${line.name}`}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <footer>
                <span>Tổng tạm tính</span>
                <strong>{formatCurrency(total)}</strong>
              </footer>
              {error ? (
                <p className="table-order-draft__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                className="table-order-draft__confirm"
                type="button"
                disabled={!cart.length || submitting}
                onClick={() => {
                  setError("");
                  window.dispatchEvent(
                    new CustomEvent(TABLE_ORDER_ACCESS_REQUIRED_EVENT),
                  );
                }}
              >
                {submitting ? "Đang gửi món…" : "Xác nhận với nhân viên để gửi món"}
              </button>
              <small className="table-order-draft__notice">
                Món chỉ vào bếp sau khi nhân viên xác nhận đúng bàn.
              </small>
            </div>
          </aside>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? `Tùy chọn · ${selectedItem.name}` : "Tùy chọn món"}
        size="md"
        className="table-order-draft-config-modal"
        zIndex={1280}
      >
        {selectedItem && selectedVariant ? (
          <div className="table-order-draft-config">
            <div className="table-order-draft-config__summary">
              <img
                src={selectedItem.thumbImage || "/default-dishes.jpg"}
                alt={selectedItem.name || "Món ăn"}
              />
              <div>
                <strong>{selectedItem.name}</strong>
                <span>{formatCurrency(previewTotal)}</span>
                <small>Tạm tính theo lựa chọn hiện tại</small>
              </div>
            </div>

            <fieldset>
              <legend>Khẩu phần</legend>
              {(selectedItem.servingVariants?.length
                ? selectedItem.servingVariants
                : [selectedVariant]
              ).map((variant) => (
                <label key={variant.key}>
                  <input
                    type="radio"
                    name="draft-serving-variant"
                    value={variant.key}
                    checked={selectedVariantKey === variant.key}
                    onChange={() => selectVariant(variant)}
                  />
                  <span>
                    <strong>{variant.name || "Phần tiêu chuẩn"}</strong>
                    <small>
                      {variant.mode === "BY_WEIGHT"
                        ? `Tính theo ${variant.sellQty || 1} ${variant.sellUnit || "kg"}`
                        : "Tính theo phần"}
                    </small>
                  </span>
                  <b>{formatCurrency(variant.price ?? selectedItem.basePrice ?? 0)}</b>
                </label>
              ))}
            </fieldset>

            {selectedVariant.mode === "BY_WEIGHT" ? (
              <section className="table-order-draft-config__weight">
                <div>
                  <strong>Khối lượng dự kiến</strong>
                  <small>Có thể nhập dấu phẩy, ví dụ 0,5 hoặc 1,25 kg.</small>
                </div>
                <div className="table-order-draft-config__weight-input">
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseWeightKg(weightKg) || 0.1;
                      setWeightKg(String(Math.max(0.1, current - 0.1).toFixed(1)).replace(".", ","));
                    }}
                    aria-label="Giảm 0,1 kilogram"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={weightKg}
                      onChange={(event) =>
                        setWeightKg(
                          event.target.value
                            .replace(/[^\d.,]/g, "")
                            .replace(/([.,].*)[.,]/g, "$1")
                            .slice(0, 7),
                        )
                      }
                      aria-label="Khối lượng dự kiến bằng kilogram"
                    />
                    <span>kg</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseWeightKg(weightKg) || 0;
                      setWeightKg(String(Math.min(100, current + 0.1).toFixed(1)).replace(".", ","));
                    }}
                    aria-label="Tăng 0,1 kilogram"
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
                <div className="table-order-draft-config__weight-presets">
                  {[0.5, 0.75, 1, 1.5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={parsedWeightKg === value ? "is-active" : ""}
                      onClick={() => setWeightKg(String(value).replace(".", ","))}
                    >
                      {String(value).replace(".", ",")} kg
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="table-order-draft-config__quantity">
                <div>
                  <strong>Số lượng</strong>
                  <small>Tối đa 20 phần cho mỗi lựa chọn.</small>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    aria-label="Giảm số lượng"
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => Math.min(20, value + 1))}
                    aria-label="Tăng số lượng"
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {modifierLoading ? (
              <p className="table-order-draft-config__loading">Đang tải cách chế biến…</p>
            ) : null}
            {!modifierLoading && modifierGroups.length ? (
              <section className="table-order-draft-config__modifiers">
                <div className="table-order-draft-config__section-title">
                  <strong>Cách chế biến và tùy chọn</strong>
                  <small>Chọn đúng yêu cầu trước khi thêm món.</small>
                </div>
                {modifierGroups.map((group) => (
                  <fieldset key={group.id}>
                    <legend>
                      {group.name}
                      {group.required ? <span>Bắt buộc</span> : <span>Không bắt buộc</span>}
                    </legend>
                    {(group.options || []).map((option) => {
                      const selected = (selectedModifiers[group.id] || []).includes(
                        option.id,
                      );
                      const amount = Number(option.priceRule?.amount || 0);
                      return (
                        <label key={option.id} className={selected ? "is-selected" : ""}>
                          <input
                            type={
                              normalizeSelectionType(group.selectionType) === "single"
                                ? "radio"
                                : "checkbox"
                            }
                            name={`draft-modifier-${group.id}`}
                            checked={selected}
                            onChange={() => toggleModifier(group, option.id)}
                          />
                          <span>{option.name}</span>
                          <strong>
                            {amount
                              ? `${option.priceRule?.rule === "DELTA" && amount > 0 ? "+" : ""}${formatCurrency(amount)}`
                              : "Không đổi giá"}
                          </strong>
                        </label>
                      );
                    })}
                  </fieldset>
                ))}
              </section>
            ) : null}

            <label className="table-order-draft-config__note">
              <span>Ghi chú riêng cho món</span>
              <textarea
                value={itemNote}
                onChange={(event) => setItemNote(event.target.value.slice(0, 300))}
                placeholder="Ví dụ: ít cay, không hành, hấp kỹ…"
                rows={3}
              />
            </label>

            {itemError ? (
              <p className="table-order-draft-config__error" role="alert">
                {itemError}
              </p>
            ) : null}

            <button
              type="button"
              className="table-order-draft-config__submit"
              onClick={addConfiguredItem}
              disabled={selectedVariant.mode === "BY_WEIGHT" && parsedWeightKg == null}
            >
              Thêm vào giỏ · {formatCurrency(previewTotal)}
            </button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
