import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
      order { id orderCode }
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
        .filter((item) => !["inactive", "archived"].includes(String(item.status || "").toLowerCase())),
    [menuData?.menuItemsConnection?.edges],
  );
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

  const count = cart.reduce((sum, line) => sum + Number(line.quantity || 1), 0);
  const total = cart.reduce(
    (sum, line) => sum + Number(line.basePrice || 0) * Number(line.quantity || 1),
    0,
  );

  const addItem = (item) => {
    setCart((current) => [...current, draftLine(item)]);
    setMessage("");
    setError("");
    window.dispatchEvent(new CustomEvent(TABLE_ORDER_ACCESS_REQUIRED_EVENT));
  };

  const updateQuantity = (localId, delta) => {
    setCart((current) =>
      current.map((line) =>
        line.localId === localId
          ? {
              ...line,
              quantity: Math.max(1, Math.min(20, line.quantity + delta)),
            }
          : line,
      ),
    );
  };

  return (
    <>
      <button
        className="table-order-draft-launcher"
        type="button"
        onClick={() => setOpen(true)}
      >
        <ShoppingBag aria-hidden="true" />
        <span>
          <strong>Chọn món tại bàn</strong>
          <small>Chọn trước, xác nhận với nhân viên khi gửi</small>
        </span>
        {count ? <b>{count}</b> : null}
      </button>

      <Modal
        isOpen={open}
        onClose={() => !submitting && setOpen(false)}
        title={`Chọn món · Bàn ${context?.tableCode || "--"}`}
        size="xl"
      >
        <div className="table-order-draft">
          <section className="table-order-draft__menu">
            {loading ? <p>Đang tải thực đơn…</p> : null}
            {!loading && !items.length ? <p>Chưa có món đang bán.</p> : null}
            {items.map((item) => {
              const variant = variantOf(item);
              return (
                <article key={item.id}>
                  <img src={item.thumbImage || "/default-dishes.jpg"} alt="" />
                  <div>
                    <strong>{item.name}</strong>
                    <small>{variant.name || "Phần tiêu chuẩn"}</small>
                  </div>
                  <b>{formatCurrency(variant.price ?? item.basePrice ?? 0)}</b>
                  <button type="button" onClick={() => addItem(item)}>
                    Thêm món
                  </button>
                </article>
              );
            })}
          </section>

          <aside className="table-order-draft__cart">
            <h3>Món đã chọn</h3>
            {!cart.length ? <p>Chưa có món nào.</p> : null}
            {cart.map((line) => (
              <div key={line.localId} className="table-order-draft__line">
                <span>
                  <strong>{line.name}</strong>
                  <small>{formatCurrency(line.basePrice)}</small>
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.localId, -1)}
                    aria-label={`Giảm ${line.name}`}
                  >
                    <Minus />
                  </button>
                  <b>{line.quantity}</b>
                  <button
                    type="button"
                    onClick={() => updateQuantity(line.localId, 1)}
                    aria-label={`Tăng ${line.name}`}
                  >
                    <Plus />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCart((current) =>
                        current.filter((entry) => entry.localId !== line.localId),
                      )
                    }
                    aria-label={`Xóa ${line.name}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            ))}
            <footer>
              <span>Tổng tạm tính</span>
              <strong>{formatCurrency(total)}</strong>
            </footer>
            {error ? <p className="table-order-draft__error" role="alert">{error}</p> : null}
            <button
              className="table-order-draft__confirm"
              type="button"
              disabled={!cart.length || submitting}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent(TABLE_ORDER_ACCESS_REQUIRED_EVENT),
                )
              }
            >
              Nhờ nhân viên xác nhận để gửi món
            </button>
            <small>Món chỉ vào bếp sau khi nhân viên xác nhận đúng bàn.</small>
          </aside>
        </div>
      </Modal>
    </>
  );
}
