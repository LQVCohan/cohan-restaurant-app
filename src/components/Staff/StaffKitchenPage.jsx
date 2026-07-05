import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useOrderManagement from "@/hooks/useOrderManagement";
import useSocketOrder from "@/hooks/useSocketOrder";
import { useNotification } from "@/hooks/useNotification";
import { getOrderLineDisplay } from "@/utils/orderLineDisplay";
import { resolveUserRoleName } from "@/utils/frontendRoleAccess";

const ITEM_STATUS_LABELS = {
  pending: "Chờ nhận",
  confirmed: "Đã xác nhận",
  customer_attached: "Khách đã gắn món",
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

const KITCHEN_FILTER_OPTIONS = [
  { value: "active", label: "Đang cần xử lý" },
  { value: "pending", label: "Chờ nhận" },
  { value: "preparing", label: "Đang làm" },
  { value: "ready", label: "Sẵn sàng" },
  { value: "all", label: "Tất cả" },
];

const STATION_MODE_OPTIONS = [
  {
    value: "kitchen",
    label: "Chế độ bếp chính",
    description: "Chỉ hiển thị món do bếp chính xử lý",
  },
  {
    value: "bar",
    label: "Chế độ quầy bar",
    description: "Chỉ hiển thị đồ uống và món của quầy bar",
  },
  {
    value: "all",
    label: "Tổng hợp",
    description: "Theo dõi đồng thời bếp chính và quầy bar",
  },
];

const STATION_MODE_META = {
  kitchen: {
    eyebrow: "KITCHEN DISPATCH",
    title: "Chế độ bếp chính",
    description: "Nhận món, cập nhật tiến độ và báo món sẵn sàng tại khu vực bếp chính.",
    shortLabel: "Bếp chính",
    activeButtonClass: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    hoverButtonClass: "hover:border-emerald-300 hover:text-emerald-700",
    summaryClass: "border-emerald-200 bg-emerald-50",
    summaryLabelClass: "text-emerald-700",
    summaryValueClass: "text-emerald-900",
  },
  bar: {
    eyebrow: "BAR DISPATCH",
    title: "Chế độ quầy bar",
    description: "Nhận đồ uống, cập nhật tiến độ và báo thành phẩm sẵn sàng tại quầy bar.",
    shortLabel: "Quầy bar",
    activeButtonClass: "border-sky-600 bg-sky-600 text-white shadow-sm",
    hoverButtonClass: "hover:border-sky-300 hover:text-sky-700",
    summaryClass: "border-sky-200 bg-sky-50",
    summaryLabelClass: "text-sky-700",
    summaryValueClass: "text-sky-900",
  },
  all: {
    eyebrow: "KITCHEN / BAR DISPATCH",
    title: "Bảng điều phối bếp / bar",
    description: "Theo dõi và cập nhật trạng thái chế biến của cả bếp chính và quầy bar.",
    shortLabel: "Bếp / bar",
    activeButtonClass: "border-slate-700 bg-slate-800 text-white shadow-sm",
    hoverButtonClass: "hover:border-slate-400 hover:text-slate-800",
    summaryClass: "border-slate-200 bg-slate-50",
    summaryLabelClass: "text-slate-700",
    summaryValueClass: "text-slate-900",
  },
};

const ROLE_STATION_MODE = {
  bartender: "bar",
  chef: "kitchen",
  cook: "kitchen",
  kitchen_helper: "kitchen",
};

const STATION_LABELS = {
  kitchen: "Bếp chính",
  bar: "Quầy bar",
  unassigned: "Chưa phân khu",
};

const TIME_LEVEL_LABELS = {
  late: "Trễ",
  very_late: "Rất trễ",
};

const PENDING_KITCHEN_ITEM_STATUSES = ["pending", "confirmed", "customer_attached"];
const HIDDEN_KITCHEN_ITEM_STATUSES = ["cancelled", "returned", "served"];

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

const getKitchenItemBucket = (status) => {
  const normalized = normalizeStatus(status);
  if (PENDING_KITCHEN_ITEM_STATUSES.includes(normalized)) return "pending";
  if (normalized === "preparing") return "preparing";
  if (normalized === "ready") return "ready";
  return "other";
};

const isKitchenVisibleItem = (item) => {
  const status = normalizeStatus(item?.status);
  return !HIDDEN_KITCHEN_ITEM_STATUSES.includes(status);
};

const matchesKitchenFilter = (item, filter) => {
  const bucket = getKitchenItemBucket(item?.status);
  if (filter === "all") return isKitchenVisibleItem(item);
  if (filter === "active") return ["pending", "preparing"].includes(bucket);
  return bucket === filter;
};

const getKitchenItemBadgeClassName = (status) => {
  const bucket = getKitchenItemBucket(status);
  if (["pending", "preparing", "ready"].includes(bucket)) {
    return "bg-emerald-50 text-emerald-700";
  }
  return "bg-gray-100 text-gray-700";
};

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

const getNextKitchenStatus = (status, station) => {
  const normalized = normalizeStatus(status);
  const isBar = station === "bar";
  if (["pending", "confirmed", "customer_attached"].includes(normalized)) {
    return {
      value: "preparing",
      label: isBar ? "Nhận món tại quầy bar" : "Nhận món vào bếp",
    };
  }
  if (normalized === "preparing") {
    return {
      value: "ready",
      label: isBar ? "Báo đồ uống đã sẵn sàng" : "Báo món đã sẵn sàng",
    };
  }
  return null;
};

const getStationBadgeClassName = (station) => {
  if (station === "bar") return "bg-sky-50 text-sky-700";
  if (station === "kitchen") return "bg-emerald-50 text-emerald-700";
  return "bg-gray-100 text-gray-700";
};

const getStationActionClassName = (station) =>
  station === "bar"
    ? "bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300"
    : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300";

const formatQuantity = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return value || "0";
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/, "");
};

const getElapsedMinutes = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
};

const getOrderAgeMinutes = (createdAt) => getElapsedMinutes(createdAt);

const normalizeStation = (station) => {
  const normalized = String(station || "").toLowerCase();
  if (["kitchen", "bar"].includes(normalized)) return normalized;
  return "unassigned";
};

const getItemStation = (item) => normalizeStation(item?.station || item?.workItemStation);

const matchesStationFilter = (item, stationFilter) => {
  if (stationFilter === "all") return true;
  return getItemStation(item) === stationFilter;
};

const matchesKitchenAndStationFilters = (item, statusFilter, stationFilter) =>
  matchesKitchenFilter(item, statusFilter) && matchesStationFilter(item, stationFilter);

const hasLateOrUnacceptedSignal = (item) => {
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  return item?.unaccepted === true || ["late", "very_late"].includes(timeLevel);
};

const getTimingBadges = (item) => {
  const badges = [];
  const timeLevel = String(item?.timeLevel || "").toLowerCase();
  if (item?.unaccepted === true) {
    badges.push({
      key: "unaccepted",
      label: "Chưa nhận quá hạn",
      className: "bg-red-50 text-red-700",
    });
  }
  if (TIME_LEVEL_LABELS[timeLevel]) {
    badges.push({
      key: `time-${timeLevel}`,
      label: TIME_LEVEL_LABELS[timeLevel],
      className:
        timeLevel === "very_late" ? "bg-red-100 text-red-800" : "bg-amber-50 text-amber-700",
    });
  }
  return badges;
};

const formatItemWaitTime = (item, order) => {
  const explicitActual = Number(item?.actualPrepMinutes);
  if (Number.isFinite(explicitActual) && explicitActual >= 0) {
    return `Thời gian chuẩn bị: ${explicitActual} phút`;
  }

  const startedAt = item?.preparingAt || item?.kitchenEnteredAt || order?.createdAt;
  const minutes = getElapsedMinutes(startedAt);
  return minutes > 0 ? `Đã chờ ${minutes} phút` : "Mới vào khu chế biến";
};

const StaffKitchenPage = () => {
  const { user } = useContext(AuthContext) || {};
  const role = resolveUserRoleName(user);
  const lockedStationMode = ROLE_STATION_MODE[role] || null;
  const restaurantForStaff = user?.restaurantForStaff;
  const restaurantId = getRestaurantForStaffId(restaurantForStaff);
  const restaurantName = getRestaurantForStaffName(restaurantForStaff);
  const [savingKey, setSavingKey] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [stationFilter, setStationFilter] = useState(() => lockedStationMode || "all");
  const { showNotification } = useNotification?.() || {
    showNotification: () => {},
  };

  const stationModeOptions = useMemo(
    () =>
      lockedStationMode
        ? STATION_MODE_OPTIONS.filter((option) => option.value === lockedStationMode)
        : STATION_MODE_OPTIONS,
    [lockedStationMode],
  );
  const activeMode = STATION_MODE_META[stationFilter] || STATION_MODE_META.all;

  useEffect(() => {
    if (lockedStationMode && stationFilter !== lockedStationMode) {
      setStationFilter(lockedStationMode);
    }
  }, [lockedStationMode, stationFilter]);

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
          !["draft", "served", "completed", "cancelled", "failed"].includes(status) &&
          !isRemoteStaffPendingOrder(order)
        );
      })
      .sort((a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [ordersNow]);

  const kitchenSummary = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    let totalActive = 0;

    for (const order of activeKitchenOrders) {
      for (const item of order.items || []) {
        if (!isKitchenVisibleItem(item) || !matchesStationFilter(item, stationFilter)) continue;
        const bucket = getKitchenItemBucket(item.status);
        if (bucket === "pending") pending += 1;
        if (bucket === "preparing") preparing += 1;
        if (bucket === "ready") ready += 1;
        if (["pending", "preparing"].includes(bucket)) totalActive += 1;
      }
    }

    const late = activeKitchenOrders.reduce((count, order) => {
      return (
        count +
        (order.items || []).filter(
          (item) =>
            isKitchenVisibleItem(item) &&
            matchesStationFilter(item, stationFilter) &&
            hasLateOrUnacceptedSignal(item),
        ).length
      );
    }, 0);

    return { pending, preparing, ready, totalActive, late };
  }, [activeKitchenOrders, stationFilter]);

  const kitchenOrderRows = useMemo(() => {
    return activeKitchenOrders
      .map((order) => {
        const visibleItems = (order.items || [])
          .map((item, index) => ({ item, index }))
          .filter(
            ({ item }) =>
              isKitchenVisibleItem(item) && matchesStationFilter(item, stationFilter),
          );
        const filteredItems = visibleItems.filter(({ item }) =>
          matchesKitchenFilter(item, statusFilter),
        );

        return { order, visibleItems, filteredItems };
      })
      .filter((row) => row.filteredItems.length > 0);
  }, [activeKitchenOrders, statusFilter, stationFilter]);

  const handleUpdateItemStatus = useCallback(
    async (order, item, index, nextStatus) => {
      if (!restaurantId || !order?.id || !nextStatus) return;
      const itemKey = item?._lineId || item?._id || index;
      const saveKey = `${order.id}:${itemKey}`;
      setSavingKey(saveKey);
      try {
        const result = await updateItemStatus({
          orderId: order.id,
          itemKey,
          status: nextStatus,
          restaurantId,
          tableCode: order?.tableCode,
          itemsSnapshot: order?.items,
          afterSuccess: () => reloadOrders("network-only"),
        });

        if (!result?.success) {
          throw new Error(result?.message || "Không thể cập nhật trạng thái món.");
        }
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
            Vui lòng liên hệ quản lý để gán nhà hàng trước khi mở bảng điều phối bếp / bar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-sm font-medium uppercase tracking-wide ${activeMode.summaryLabelClass}`}>
              {activeMode.eyebrow}
            </p>
            <h1 className="text-2xl font-semibold text-gray-900">{activeMode.title}</h1>
            <p className="mt-1 text-sm text-gray-600">{activeMode.description}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
            <span className="font-medium">Nhà hàng:</span> {restaurantName || restaurantId}
          </div>
        </div>

        <div
          className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:grid-cols-3"
          role="group"
          aria-label="Chế độ điều phối bếp và quầy bar"
        >
          {stationModeOptions.map((option) => {
            const isActive = stationFilter === option.value;
            const optionMeta = STATION_MODE_META[option.value];
            return (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={isActive}
                className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  isActive
                    ? optionMeta.activeButtonClass
                    : `border-gray-200 bg-white text-gray-800 ${optionMeta.hoverButtonClass}`
                }`}
                onClick={() => setStationFilter(option.value)}
              >
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className={`mt-1 block text-xs ${isActive ? "text-white/80" : "text-gray-500"}`}>
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className={`rounded-xl border p-4 shadow-sm ${activeMode.summaryClass}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${activeMode.summaryLabelClass}`}>
              Cần xử lý · {activeMode.shortLabel}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${activeMode.summaryValueClass}`}>
              {kitchenSummary.totalActive}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Chờ nhận</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.pending}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Đang làm</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.preparing}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Sẵn sàng</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.ready}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-red-700">
              Trễ / quá thời gian
            </p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{kitchenSummary.late}</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Trạng thái · {activeMode.shortLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {KITCHEN_FILTER_OPTIONS.map((option) => {
              const isActive = statusFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? activeMode.activeButtonClass
                      : `border-gray-200 bg-white text-gray-700 ${activeMode.hoverButtonClass}`
                  }`}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {ordersNowLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Đang tải danh sách món cần chuẩn bị...
        </div>
      ) : ordersNowError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
          {ordersNowError.message || "Không thể tải danh sách điều phối."}
        </div>
      ) : activeKitchenOrders.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Hiện chưa có món nào cần chuẩn bị.
        </div>
      ) : kitchenOrderRows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Không có món nào trong chế độ và bộ lọc trạng thái hiện tại.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {kitchenOrderRows.map(({ order, filteredItems, visibleItems }) => {
            const ageMinutes = getOrderAgeMinutes(order.createdAt);
            return (
              <article key={order.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {order.tableCode
                        ? `Bàn ${order.tableCode}`
                        : order.orderCode || `Đơn ${String(order.id).slice(-4)}`}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {order.orderCode || order.id} ·{" "}
                      {ORDER_STATUS_LABELS[normalizeStatus(order.currentStatus)] ||
                        order.currentStatus ||
                        "Không rõ"}{" "}
                      · {ageMinutes > 0 ? `${ageMinutes} phút` : "Mới"}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {order.orderType === "delivery"
                      ? "Giao hàng"
                      : order.orderType === "takeaway"
                        ? "Mang về"
                        : "Tại bàn"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                  <span>{filteredItems.length} món</span>
                  {visibleItems.length > filteredItems.length ? (
                    <span>{visibleItems.length} món trong khu vực</span>
                  ) : null}
                </div>

                {order.note ? (
                  <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Ghi chú: {order.note}
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  {filteredItems.map(({ item, index }) => {
                    const status = normalizeStatus(item.status);
                    const itemKey = item?._lineId || item?._id || index;
                    const saveKey = `${order.id}:${itemKey}`;
                    const station = getItemStation(item);
                    const next = getNextKitchenStatus(status, station);
                    const timingBadges = getTimingBadges(item);
                    const lineDisplay = getOrderLineDisplay(item, { mode: "kitchen" });
                    return (
                      <div key={itemKey} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {lineDisplay.isComboLine ? "Combo: " : ""}x
                              {formatQuantity(lineDisplay.quantity)} {lineDisplay.displayName}
                            </div>
                            {lineDisplay.isComboLine && lineDisplay.childItems.length > 0 ? (
                              <ul
                                className={`mt-2 space-y-1 border-l-2 pl-3 text-xs text-gray-700 ${
                                  station === "bar" ? "border-sky-200" : "border-emerald-200"
                                }`}
                                aria-label="Món con trong combo"
                              >
                                {lineDisplay.childItems.map((child) => (
                                  <li key={child.key}>
                                    {child.qty}× {child.name}
                                    {child.note ? ` · ${child.note}` : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`rounded-full px-2.5 py-1 font-medium ${getKitchenItemBadgeClassName(
                                  status,
                                )}`}
                              >
                                {ITEM_STATUS_LABELS[status] || status}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 font-medium ${getStationBadgeClassName(
                                  station,
                                )}`}
                              >
                                {STATION_LABELS[station] || STATION_LABELS.unassigned}
                              </span>
                              {timingBadges.map((badge) => (
                                <span
                                  key={badge.key}
                                  className={`rounded-full px-2.5 py-1 font-medium ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                              {item.unit ? <span className="text-gray-500">{item.unit}</span> : null}
                            </div>
                          </div>
                          {next ? (
                            <button
                              type="button"
                              className={`rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed ${getStationActionClassName(
                                station,
                              )}`}
                              disabled={savingKey === saveKey}
                              onClick={() =>
                                handleUpdateItemStatus(order, item, index, next.value)
                              }
                            >
                              {savingKey === saveKey ? "Đang lưu..." : next.label}
                            </button>
                          ) : (
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-medium ${getStationBadgeClassName(
                                station,
                              )}`}
                            >
                              Sẵn sàng
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {formatItemWaitTime(item, order)}
                          {Number(item?.targetPrepMinutes) > 0
                            ? ` · Mục tiêu ${item.targetPrepMinutes} phút`
                            : ""}
                        </div>
                        {item?.unacceptedReason ? (
                          <div className="mt-1 text-xs text-red-700">{item.unacceptedReason}</div>
                        ) : null}
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
