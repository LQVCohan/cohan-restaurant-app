import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useOrderManagement from "@/hooks/useOrderManagement";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";

const ITEM_STATUS_LABELS = {
  pending: "Chờ bếp nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  cancelled: "Đã hủy",
  returned: "Đã trả lại",
};

const ORDER_STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

const getRestaurantForStaffId = (restaurantForStaff) => {
  if (!restaurantForStaff) return null;
  if (typeof restaurantForStaff === "string") return restaurantForStaff;
  if (typeof restaurantForStaff === "object") {
    return restaurantForStaff.id || restaurantForStaff._id || null;
  }
  return null;
};

const getRestaurantForStaffName = (restaurantForStaff) => {
  if (!restaurantForStaff || typeof restaurantForStaff !== "object") return null;
  return restaurantForStaff.name || restaurantForStaff.restaurantName || null;
};

const normalizeStatus = (status) => String(status || "pending").toLowerCase();

const isRemoteStaffPendingOrder = (order) => {
  if (!order) return false;
  const typeOk = ["delivery", "takeaway"].includes(order.orderType);
  const statusOk = order.currentStatus === "pending";
  const meta = order.clientMeta || {};
  const source = String(meta.source || meta.clientSource || "").toLowerCase();
  const channel = String(meta.channel || "").toLowerCase();
  const clientType = String(meta.clientType || "").toLowerCase();
  return typeOk && statusOk && [source, channel, clientType].includes("staff_remote");
};

const getNextKitchenStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (["pending", "confirmed", "customer_attached"].includes(normalized)) {
    return { value: "preparing", label: "Nhận món" };
  }
  if (normalized === "preparing") {
    return { value: "ready", label: "Báo xong" };
  }
  return null;
};

const formatQuantity = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return value || "0";
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/, "");
};

const getOrderAgeMinutes = (createdAt) => {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000));
};

const StaffKitchenPage = () => {
  const { user } = useContext(AuthContext) || {};
  const restaurantForStaff = user?.restaurantForStaff;
  const restaurantId = getRestaurantForStaffId(restaurantForStaff);
  const restaurantName = getRestaurantForStaffName(restaurantForStaff);
  const [savingKey, setSavingKey] = useState(null);
  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };

  const {
    ordersNow,
    ordersNowLoading,
    ordersNowError,
    loadOrdersNow,
    updateItemStatus,
  } = useOrderManagement();

  const reloadOrders = useCallback(
    (fetchPolicy = "network-only") => {
      if (!restaurantId || !loadOrdersNow) return;
      loadOrdersNow({
        variables: { restaurantId, limit: 100 },
        fetchPolicy,
      });
    },
    [loadOrdersNow, restaurantId],
  );

  useEffect(() => {
    reloadOrders();
  }, [reloadOrders]);

  useSocketOrder(restaurantId, {
    onAny: () => reloadOrders("network-only"),
  });

  const activeKitchenOrders = useMemo(() => {
    return (ordersNow || [])
      .filter((order) => {
        const status = normalizeStatus(order?.currentStatus);
        return (
          !["served", "completed", "cancelled"].includes(status) &&
          !isRemoteStaffPendingOrder(order)
        );
      })
      .sort((a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [ordersNow]);

  const handleUpdateItemStatus = useCallback(
    async (order, item, index, nextStatus) => {
      if (!restaurantId || !order?.id || !nextStatus) return;
      const itemKey = item?._lineId || item?._id || index;
      const saveKey = `${order.id}:${itemKey}`;
      setSavingKey(saveKey);
      try {
        await updateItemStatus({
          orderId: order.id,
          itemKey,
          status: nextStatus,
          restaurantId,
          tableCode: order?.tableCode,
          itemsSnapshot: order?.items,
          afterSuccess: () => reloadOrders("network-only"),
        });
      } catch (error) {
        showNotification(error?.message || "Không thể cập nhật trạng thái món.", "error");
      } finally {
        setSavingKey(null);
      }
    },
    [restaurantId, reloadOrders, showNotification, updateItemStatus],
  );

  if (!restaurantId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
          <h1 className="text-lg font-semibold">Tài khoản chưa được gán nhà hàng.</h1>
          <p className="mt-1 text-sm">
            Vui lòng liên hệ quản lý để gán nhà hàng trước khi mở khu vực bếp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Temporary staff kitchen wrapper: reuse the existing order-management hook only,
          without rendering the manager OrderManagement screen or its admin/cashier actions. */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">KITCHEN DISPLAY</p>
          <h1 className="text-2xl font-semibold text-gray-900">Khu vực bếp</h1>
          <p className="mt-1 text-sm text-gray-600">
            Xem món cần chuẩn bị và cập nhật trạng thái chế biến cho nhà hàng được gán.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
          <span className="font-medium">Nhà hàng:</span>{" "}
          {restaurantName || restaurantId}
        </div>
      </div>

      {ordersNowLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Đang tải danh sách món cần chuẩn bị...
        </div>
      ) : ordersNowError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {ordersNowError.message || "Không thể tải danh sách đơn bếp."}
        </div>
      ) : activeKitchenOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Hiện chưa có món nào cần chuẩn bị.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {activeKitchenOrders.map((order) => {
            const ageMinutes = getOrderAgeMinutes(order.createdAt);
            return (
              <article key={order.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {order.tableCode ? `Bàn ${order.tableCode}` : order.orderCode || `Đơn ${String(order.id).slice(-4)}`}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.orderCode || order.id} · {ORDER_STATUS_LABELS[normalizeStatus(order.currentStatus)] || order.currentStatus || "Không rõ"} · {ageMinutes > 0 ? `${ageMinutes} phút` : "Mới"}
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {order.orderType === "delivery" ? "Giao hàng" : order.orderType === "takeaway" ? "Mang về" : "Tại bàn"}
                  </span>
                </div>

                {order.note ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Ghi chú: {order.note}
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {(order.items || []).filter((item) => normalizeStatus(item?.status) !== "cancelled").map((item, index) => {
                    const status = normalizeStatus(item.status);
                    const next = getNextKitchenStatus(status);
                    const itemKey = item?._lineId || item?._id || index;
                    const saveKey = `${order.id}:${itemKey}`;
                    return (
                      <div key={itemKey} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              x{formatQuantity(item.quantity)} {item.name || "Món"}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {ITEM_STATUS_LABELS[status] || status}
                              {item.unit ? ` · ${item.unit}` : ""}
                            </div>
                          </div>
                          {next ? (
                            <button
                              type="button"
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                              disabled={savingKey === saveKey}
                              onClick={() => handleUpdateItemStatus(order, item, index, next.value)}
                            >
                              {savingKey === saveKey ? "Đang lưu..." : next.label}
                            </button>
                          ) : (
                            <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                              Sẵn sàng
                            </span>
                          )}
                        </div>
                        {item.note ? (
                          <div className="mt-2 text-xs text-gray-600">Ghi chú món: {item.note}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffKitchenPage;
