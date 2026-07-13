import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Search,
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

const draftLine = (item) => {
  const variant = variantOf(item);
  const price = Number(variant.price ?? item.basePrice ?? 0);
  return {
    localId: createKey(),
    dishId: item.id,
    menuId: item.menuId,
    categoryId: item.categoryId,
    name: item.name,
    unit: variant.sellUnit || "portion",
    image: item.thumbImage || null,
    basePrice: price,
    servingKey: variant.key || item.defaultServingKey || "portion",
    servingVariant: {
      key: variant.key || "portion",
      name: variant.name || "Phần tiêu chuẩn",
      mode: variant.mode || "PORTION",
      price,
      sellQty: Number(variant.sellQty || 1),
      sellUnit: variant.sellUnit || "portion",
    },
    quantity: 1,
    selectedModifiers: [],
    note: null,
    priority: "MEDIUM",
    status: "pending",
  };
};

const isSameLine = (line, item) => {
  const variant = variantOf(item);
  return (
    line.dishId === item.id &&
    line.servingKey === (variant.key || item.defaultServingKey || "portion")
  );
};

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
      const variant = variantOf(item);
      return `${item.name || ""} ${variant.name || ""}`
        .toLocaleLowerCase("vi")
        .includes(keyword);
    });
  }, [items, searchTerm]);
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
            items: cart.map(({ localId, ...line }) => line),
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

  if (!draftMode) {
    return message ? (
      <div className="table-order-draft-toast" role="status">
        {message}
      </div>
    ) : null;
  }

  const count = cart.reduce(
    (sum, line) => sum + Number(line.quantity || 1),
    0,
  );
  const total = cart.reduce(
    (sum, line) =>
      sum + Number(line.basePrice || 0) * Number(line.quantity || 1),
    0,
  );

  const addItem = (item) => {
    const nextLine = draftLine(item);
    setCart((current) => {
      const existingIndex = current.findIndex((line) => isSameLine(line, item));
      if (existingIndex < 0) return [...current, nextLine];
      return current.map((line, index) =>
        index === existingIndex
          ? {
              ...line,
              quantity: Math.min(20, Number(line.quantity || 1) + 1),
            }
          : line,
      );
    });
    setMessage("");
    setError("");
  };

  const changeItemQuantity = (item, delta) => {
    setCart((current) => {
      const existingIndex = current.findIndex((line) => isSameLine(line, item));
      if (existingIndex < 0) {
        return delta > 0 ? [...current, draftLine(item)] : current;
      }
      const currentLine = current[existingIndex];
      const nextQuantity = Number(currentLine.quantity || 1) + delta;
      if (nextQuantity <= 0) {
        return current.filter((_, index) => index !== existingIndex);
      }
      return current.map((line, index) =>
        index === existingIndex
          ? { ...line, quantity: Math.min(20, nextQuantity) }
          : line,
      );
    });
    setMessage("");
    setError("");
  };

  const updateQuantity = (localId, delta) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.localId !== localId) return [line];
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
          <small>Chọn trước, xác nhận với nhân viên khi gửi</small>
        </span>
        {count ? <b aria-label={`${count} món đã chọn`}>{count}</b> : null}
      </button>

      <Modal
        isOpen={open}
        onClose={() => !submitting && setOpen(false)}
        title={`Chọn món · Bàn ${context?.tableCode || "--"}`}
        size="xl"
        className="table-order-draft-modal"
        zIndex={1200}
      >
        <div className="table-order-draft">
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
              const cartLine = cart.find((line) => isSameLine(line, item));
              const itemQuantity = Number(cartLine?.quantity || 0);
              return (
                <article key={item.id} className={itemQuantity ? "is-selected" : ""}>
                  <div className="table-order-draft__image">
                    <img
                      src={item.thumbImage || "/default-dishes.jpg"}
                      alt={item.name || "Món ăn"}
                    />
                    {itemQuantity ? <b>{itemQuantity}</b> : null}
                  </div>
                  <div className="table-order-draft__info">
                    <strong>{item.name}</strong>
                    <small>{variant.name || "Phần tiêu chuẩn"}</small>
                  </div>
                  <b className="table-order-draft__price">
                    {formatCurrency(variant.price ?? item.basePrice ?? 0)}
                  </b>
                  <div className="table-order-draft__item-actions">
                    {itemQuantity ? (
                      <div className="table-order-draft__stepper">
                        <button
                          type="button"
                          onClick={() => changeItemQuantity(item, -1)}
                          aria-label={`Giảm ${item.name}`}
                        >
                          <Minus aria-hidden="true" />
                        </button>
                        <strong aria-live="polite">{itemQuantity}</strong>
                        <button
                          type="button"
                          onClick={() => changeItemQuantity(item, 1)}
                          disabled={itemQuantity >= 20}
                          aria-label={`Tăng ${item.name}`}
                        >
                          <Plus aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => addItem(item)}>
                        <Plus aria-hidden="true" />
                        Thêm món
                      </button>
                    )}
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
                  <strong>{count ? `${count} món đã chọn` : "Giỏ món đang trống"}</strong>
                  <small>{count ? "Chạm để xem và gửi món" : "Chọn món từ thực đơn"}</small>
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
                    <small>Chọn “Thêm món” để bắt đầu.</small>
                  </div>
                ) : null}
                {cart.map((line) => (
                  <div key={line.localId} className="table-order-draft__line">
                    <span>
                      <strong>{line.name}</strong>
                      <small>
                        {line.servingVariant?.name || "Phần tiêu chuẩn"} ·{" "}
                        {formatCurrency(line.basePrice)}
                      </small>
                    </span>
                    <div>
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
                ))}
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
    </>
  );
}
