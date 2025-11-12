// src/pages/OrderManagement/OrderManagement.js
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react";
import {
  Clock,
  User,
  ChefHat,
  CheckCircle,
  AlertTriangle,
  Eye,
  Check,
  X,
  Plus,
  Download,
  History,
  Loader,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { gql, useMutation, useQuery, useLazyQuery } from "@apollo/client";

import OrderCard from "./components/OrderCard";
import OrderModal from "./components/OrderModal";
import ItemModal from "./components/ItemModal";
import HistoryModal from "./components/HistoryModal";
import NewOrderModal from "./components/NewOrderModal.jsx";
import StatsCard from "./components/StatsCard";
import useOrderManagement from "../../../hooks/useOrderManagement";
import { useNotification } from "@/hooks/useNotification";
import { AuthContext } from "@/context/AuthContext";

// ---------------- GQL ----------------
const MUTATION_UPDATE_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
    }
  }
`;

// ---------------- Auth/Restaurant ----------------
const useRestaurant = () => {
  const { restaurants } = useContext(AuthContext);
  return {
    restaurantList: restaurants || [],
  };
};

// ---------------- Component ----------------
const OrderManagement = () => {
  // Modal & filter state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");

  // NEW: focus mode (Kitchen view)
  const [focusMode, setFocusMode] = useState(false);

  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  // Restaurant
  const { restaurantList } = useRestaurant();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  // Orders data
  const {
    orders = [],
    ordersLoading,
    ordersError,
    loadOrders,
    updateItemStatus,
    changeOrderItemStatusByCode,
    changeOrderStatusByCode,
  } = useOrderManagement();

  // Mutations
  const [updateOrderStatusMutation] = useMutation(MUTATION_UPDATE_STATUS);

  // Auto-pick first restaurant
  useEffect(() => {
    if (restaurantList.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurantList[0].id);
    }
  }, [restaurantList, selectedRestaurantId]);

  // Fetch orders on restaurant change
  useEffect(() => {
    if (selectedRestaurantId && loadOrders) {
      loadOrders({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 100,
        },
      });
    }
  }, [loadOrders, selectedRestaurantId]);

  // Toggle focus with keyboard "f"
  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === "f") setFocusMode((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Handlers
  const handleUpdateStatus = useCallback(
    (orderId, newStatus) => {
      updateOrderStatusMutation({
        variables: {
          input: { id: orderId, status: newStatus },
        },
      });
    },
    [updateOrderStatusMutation]
  );

  const handleViewOrder = useCallback((order) => {
    setSelectedOrder(order);
  }, []);

  const handleViewItem = useCallback((itemData) => {
    setSelectedItem(itemData);
  }, []);

  const handleNewOrderSuccess = useCallback(() => {
    setShowNewOrderModal(false);
    if (loadOrders && selectedRestaurantId) {
      loadOrders({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 100,
        },
        fetchPolicy: "network-only",
      });
    }
  }, [loadOrders, selectedRestaurantId]);

  const handleChangeItemStatusByCode = useCallback(
    (payload) => {
      return changeOrderItemStatusByCode({
        ...payload,
        afterSuccess: (serverOrder) => {
          if (serverOrder) {
            setSelectedOrder((prev) => {
              if (!prev || prev.id !== serverOrder.id) return prev;
              return { ...prev, ...serverOrder };
            });
          }
          loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
        },
      });
    },
    [changeOrderItemStatusByCode, loadOrders, selectedRestaurantId]
  );

  const handleUpdateItemStatus = useCallback(
    (orderId, itemKey, nextStatus) => {
      const ord = orders.find((o) => o.id === orderId);

      return updateItemStatus({
        orderId,
        itemKey,
        status: nextStatus,
        restaurantId: selectedRestaurantId,
        tableCode: ord?.tableCode,
        itemsSnapshot: ord?.items,
        afterSuccess: (updatedServerOrder) => {
          if (updatedServerOrder) {
            setSelectedOrder(updatedServerOrder);
          }
          loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
        },
      });
    },
    [orders, selectedRestaurantId, loadOrders, updateItemStatus]
  );

  // Filters & stats
  const filteredOrders = useMemo(() => {
    return (orders || []).filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.user?.fullName || "Khách lẻ")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        order.tableCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        !statusFilter || order.currentStatus === statusFilter;
      const matchesTable = !tableFilter || order.orderType === tableFilter;
      return matchesSearch && matchesStatus && matchesTable;
    });
  }, [orders, searchTerm, statusFilter, tableFilter]);

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(
        (o) =>
          o.currentStatus !== "completed" && o.currentStatus !== "cancelled"
      ).length,
      preparing: orders.filter((o) => o.currentStatus === "preparing").length,
      completed: 0,
    };
  }, [orders]);

  // Classes for layout
  const rootPadding = focusMode ? "p-3 md:p-4" : "p-6";
  const containerWidth = focusMode ? "max-w-[100%]" : "max-w-7xl";
  const ordersGridCols = focusMode
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
    : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3";
  const ordersGridGap = focusMode ? "gap-3 md:gap-4" : "gap-6";

  return (
    <div className={`min-h-screen bg-gray-50 ${rootPadding}`}>
      <div className={`${containerWidth} mx-auto`}>
        {/* Header */}
        <div
          className={`bg-white rounded-lg shadow-sm border border-gray-200 ${
            focusMode ? "p-3 md:p-4" : "p-8"
          } mb-6 ${focusMode ? "sticky top-0 z-40" : ""}`}
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🍽️ Quản Lý Đơn Hàng
              </h1>
              <p className="text-gray-600">
                Theo dõi và xử lý đơn hàng nhà hàng theo thời gian thực
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!focusMode && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <History size={20} />
                  Lịch sử đơn hàng
                </button>
              )}

              {/* Toggle Focus Mode */}
              <button
                onClick={() => setFocusMode((s) => !s)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  focusMode
                    ? "bg-amber-600 text-white hover:bg-amber-700"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title="Nhấn F để bật/tắt nhanh"
              >
                {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                {focusMode ? "Thoát chế độ Bếp" : "Chế độ Bếp (Focus)"}
              </button>
            </div>
          </div>

          {/* Quick controls for Focus mode */}
          {focusMode && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm nhanh (ID, tên KH, mã bàn)…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Eye size={16} />
                </div>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xác nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="preparing">Đang chuẩn bị</option>
                <option value="ready">Sẵn sàng</option>
              </select>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNewOrderModal(true)}
                  disabled={!selectedRestaurantId}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Tạo đơn nhanh
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats (hide in focus) */}
        {!focusMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              icon={<CheckCircle className="text-blue-600" />}
              title="Tổng đơn hàng"
              value={stats.total}
              bgColor="bg-blue-50"
            />
            <StatsCard
              icon={<Clock className="text-orange-600" />}
              title="Chưa hoàn thành"
              value={stats.pending}
              bgColor="bg-orange-50"
            />
            <StatsCard
              icon={<ChefHat className="text-purple-600" />}
              title="Đang chuẩn bị"
              value={stats.preparing}
              bgColor="bg-purple-50"
            />
            <StatsCard
              icon={<CheckCircle className="text-green-600" />}
              title="Hoàn thành"
              value={stats.completed}
              bgColor="bg-green-50"
            />
          </div>
        )}

        {/* Controls (hide in focus) */}
        {!focusMode && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                {restaurantList.length > 0 && (
                  <div className="relative min-w-[250px]">
                    <select
                      value={selectedRestaurantId}
                      onChange={(e) => setSelectedRestaurantId(e.target.value)}
                      disabled={restaurantList.length === 1}
                      className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      {restaurantList.map((res) => (
                        <option key={res.id} value={res.id}>
                          {res.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                )}

                <div className="relative min-w-[300px]">
                  <input
                    type="text"
                    placeholder="Tìm kiếm đơn hàng..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Eye size={16} />
                  </div>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ xác nhận</option>
                  <option value="confirmed">Đã xác nhận</option>
                  <option value="preparing">Đang chuẩn bị</option>
                  <option value="ready">Sẵn sàng</option>
                </select>

                <select
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Tất cả loại</option>
                  <option value="dine_in">Tại bàn</option>
                  <option value="takeaway">Mang về</option>
                  <option value="delivery">Giao hàng</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  <Download size={16} />
                  Xuất báo cáo
                </button>

                <button
                  onClick={() => setShowNewOrderModal(true)}
                  disabled={!selectedRestaurantId}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Đơn hàng mới
                </button>
              </div>
            </div>
          </div>
        )}

        {/* States */}
        {ordersLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader size={32} className="text-blue-600 animate-spin" />
            <p className="ml-2 text-gray-600">
              Đang tải đơn hàng cho nhà hàng...
            </p>
          </div>
        )}

        {ordersError && (
          <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
            <AlertTriangle size={48} className="mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Đã xảy ra lỗi</h3>
            <p>{ordersError.message}</p>
          </div>
        )}

        {!ordersLoading && !ordersError && filteredOrders.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              Không có đơn hàng nào
            </h3>
            <p className="text-gray-500">
              {orders.length > 0
                ? "Không tìm thấy kết quả phù hợp"
                : "Chọn nhà hàng để bắt đầu"}
            </p>
          </div>
        )}

        {/* Orders Grid */}
        {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
          <div className={`grid ${ordersGridCols} ${ordersGridGap}`}>
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onViewOrder={handleViewOrder}
                onViewItem={handleViewItem}
                // Pass hint to card if you want it to adjust UI in focus
                isFocusMode={focusMode}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        {showNewOrderModal && (
          <NewOrderModal
            isOpen={showNewOrderModal}
            onClose={() => setShowNewOrderModal(false)}
            restaurantId={selectedRestaurantId}
            onSuccess={handleNewOrderSuccess}
          />
        )}

        {selectedOrder && (
          <OrderModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateItemStatus={handleUpdateItemStatus}
            onChangeItemStatusByCode={handleChangeItemStatusByCode}
          />
        )}

        {selectedItem && (
          <ItemModal
            item={selectedItem.item}
            orderInfo={selectedItem.orderInfo}
            onClose={() => setSelectedItem(null)}
          />
        )}
        {showHistory && (
          <HistoryModal
            restaurantId={selectedRestaurantId}
            onClose={() => setShowHistory(false)}
            onViewOrder={handleViewOrder}
          />
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
