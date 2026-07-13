import React, { useEffect, useMemo, useRef, useState } from "react";
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
    publicActiveTableSessionOrders(restaurantId: $restaurantId, tableId: $tableId, token: $token) {
      tableCode
      canRequestOrderAccess
      orderAccessConfirmed
    }
  }
`;

const MENU = gql`
  query TableOrderDraftMenu($filter: MenuItemFilter!, $limit: Int) {
    menuItemsConnection(filter: $filter, limit: $limit) {
      edges { node { id menuId categoryId name basePrice thumbImage status defaultServingKey servingVariants { key name mode price sellQty sellUnit isDefault } } }
    }
  }
`;

const SUBMIT = gql`
  mutation SubmitTableOrderDraft($input: PublicSubmitTableOrderInput!) {
    publicSubmitTableOrder(input: $input) { ok message order { id orderCode } }
  }
`;

const key = () => `table-draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const variantOf = (item) => item.servingVariants?.find((x) => x.isDefault) || item.servingVariants?.[0] || {
  key: item.defaultServingKey || "portion", name: "Phần tiêu chuẩn", mode: "PORTION",
  price: Number(item.basePrice || 0), sellQty: 1, sellUnit: "portion",
};

export default function TableOrderDraftLauncher() {
  const location = useLocation();
  const match = location.pathname.match(ROUTE);
  const restaurantId = match?.[1] || "";
  const tableId = match?.[2] || "";
  const token = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const waitingRef = useRef(false);

  const { data, refetch } = useQuery(CONTEXT, {
    variables: { restaurantId, tableId, token }, skip: !restaurantId || !tableId || !token,
    fetchPolicy: "cache-and-network", pollInterval: 8000,
  });
  const context = data?.publicActiveTableSessionOrders;
  const draftMode = context?.canRequestOrderAccess && !context?.orderAccessConfirmed;
  const { data: menuData, loading } = useQuery(MENU, {
    variables: { filter: { restaurantId, sort: "default" }, limit: 60 },
    skip: !restaurantId || !open || !draftMode, fetchPolicy: "cache-and-network",
  });
  const items = (menuData?.menuItemsConnection?.edges || []).map((edge) => edge.node).filter((item) => item?.status !== "inactive");
  const [submit, { loading: submitting }] = useMutation(SUBMIT);

  const sendDraft = async () => {
    if (!cart.length) return;
    const result = await submit({ variables: { input: {
      restaurantId, tableId, token, identityToken: null,
      items: cart.map(({ localId, price, ...line }) => line),
      note: "Khách chọn món sau khi quét QR tại bàn.", idempotencyKey: key(),
    } } });
    setMessage(result.data?.publicSubmitTableOrder?.message || "Đã gửi món cho nhà hàng.");
    setCart([]); setOpen(false); waitingRef.current = false;
  };

  useEffect(() => {
    const confirmed = async () => { waitingRef.current = true; await refetch(); };
    window.addEventListener("cohan:table-order-access-confirmed", confirmed);
    return () => window.removeEventListener("cohan:table-order-access-confirmed", confirmed);
  }, [refetch]);

  useEffect(() => {
    if (context?.orderAccessConfirmed && waitingRef.current && cart.length) void sendDraft();
  }, [context?.orderAccessConfirmed]);

  if (!draftMode) return message ? <div className="table-order-draft-toast">{message}</div> : null;
  const total = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const add = (item) => {
    const variant = variantOf(item);
    setCart((current) => [...current, {
      localId: key(), dishId: item.id, menuId: item.menuId, categoryId: item.categoryId,
      name: item.name, unit: variant.sellUnit || "portion", image: item.thumbImage || null,
      servingKey: variant.key, servingVariant: { ...variant, price: Number(variant.price ?? item.basePrice ?? 0) },
      quantity: 1, selectedModifiers: [], note: null, priority: "MEDIUM", status: "pending",
      price: Number(variant.price ?? item.basePrice ?? 0),
    }]);
    window.dispatchEvent(new CustomEvent(TABLE_ORDER_ACCESS_REQUIRED_EVENT));
  };

  return <>
    <button className="table-order-draft-launcher" type="button" onClick={() => setOpen(true)}>
      <ShoppingBag /><span><strong>Chọn món tại bàn</strong><small>Chọn trước, xác nhận với nhân viên khi gửi</small></span>
      {cart.length ? <b>{cart.length}</b> : null}
    </button>
    <Modal isOpen={open} onClose={() => !submitting && setOpen(false)} title={`Chọn món · Bàn ${context?.tableCode || "--"}`} size="xl">
      <div className="table-order-draft">
        <section className="table-order-draft__menu">
          {loading ? <p>Đang tải thực đơn…</p> : items.map((item) => {
            const variant = variantOf(item);
            return <article key={item.id}><img src={item.thumbImage || "/default-dishes.jpg"} alt="" /><div><strong>{item.name}</strong><small>{variant.name}</small></div><b>{formatCurrency(variant.price ?? item.basePrice)}</b><button type="button" onClick={() => add(item)}>Thêm</button></article>;
          })}
        </section>
        <aside className="table-order-draft__cart">
          <h3>Món đã chọn</h3>
          {!cart.length ? <p>Chưa có món nào.</p> : cart.map((line) => <div key={line.localId} className="table-order-draft__line"><span><strong>{line.name}</strong><small>{formatCurrency(line.price)}</small></span><div><button onClick={() => setCart((c) => c.map((x) => x.localId === line.localId ? {...x, quantity: Math.max(1, x.quantity - 1)} : x))}><Minus /></button><b>{line.quantity}</b><button onClick={() => setCart((c) => c.map((x) => x.localId === line.localId ? {...x, quantity: x.quantity + 1} : x))}><Plus /></button><button onClick={() => setCart((c) => c.filter((x) => x.localId !== line.localId))}><Trash2 /></button></div></div>)}
          <footer><span>Tổng tạm tính</span><strong>{formatCurrency(total)}</strong></footer>
          <button className="table-order-draft__confirm" type="button" disabled={!cart.length} onClick={() => window.dispatchEvent(new CustomEvent(TABLE_ORDER_ACCESS_REQUIRED_EVENT))}>Nhờ nhân viên xác nhận để gửi món</button>
        </aside>
      </div>
    </Modal>
  </>;
}
