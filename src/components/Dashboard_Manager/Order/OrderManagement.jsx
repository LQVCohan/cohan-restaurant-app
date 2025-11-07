// src/pages/OrderManagement/OrderManagement.js
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext, // <-- Import useContext
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
  ChevronDown, // <-- Icon cho Select Box
} from "lucide-react";
// ❗️ SỬA: Thêm useQuery, useLazyQuery
import { gql, useMutation, useQuery, useLazyQuery } from "@apollo/client";

// ---- Import các component con và hook ----
import OrderCard from "./components/OrderCard";

import OrderModal from "./components/OrderModal";
import ItemModal from "./components/ItemModal";
import HistoryModal from "./components/HistoryModal";
// ✅ MỚI: Import modal mới
import NewOrderModal from "./components/NewOrderModal.jsx";
import StatsCard from "./components/StatsCard";
import useOrderManagement from "../../../hooks/useOrderManagement";
import { useNotification } from "@/hooks/useNotification";
import { AuthContext } from "@/context/AuthContext"; // <-- Import AuthContext

// -----------------------------------------------------------------
// 1. CÁC GQL STRING
// -----------------------------------------------------------------

// (Query chính, hook 'useOrderManagement' của bạn phải dùng query này)

// Mutation để cập nhật trạng thái đơn (pending -> confirmed, v.v...)
const MUTATION_UPDATE_STATUS = gql`
  mutation UpdateOrderStatus($input: UpdateOrderStatusInput!) {
    updateOrderStatus(input: $input) {
      id
      currentStatus
    }
  }
`;

// ✅ MỚI: Query để lấy dữ liệu Bàn và Menu cho Modal
// (Giả định cấu trúc GQL, bạn cần điều chỉnh cho phù hợp)

// -----------------------------------------------------------------
// 2. HOOK LẤY DANH SÁCH NHÀ HÀNG (TỪ AUTHCONTEXT)
// -----------------------------------------------------------------
const useRestaurant = () => {
  const { restaurants } = useContext(AuthContext);
  return {
    restaurantList: restaurants || [],
  };
};

// -----------------------------------------------------------------
// 3. COMPONENT CHÍNH
// -----------------------------------------------------------------
const OrderManagement = () => {
  // --- State của Trang (Filter, Modal) ---
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  // ✅ MỚI: State cho modal mới
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");

  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  // --- State Quản lý Nhà hàng ---
  const { restaurantList } = useRestaurant();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  // --- Gọi Hook Fetch Dữ liệu (cho List) ---
  const {
    orders,
    ordersLoading,
    ordersError,
    loadOrders,
    updateItemStatus,
    changeOrderItemStatusByCode,
    changeOrderStatusByCode,
  } = useOrderManagement();

  // ✅ MỚI: Hook Fetch Dữ liệu (cho Modal - Bàn & Menu) ---

  // --- Khởi tạo Mutations ---
  const [updateOrderStatusMutation] = useMutation(MUTATION_UPDATE_STATUS);

  // --- 4. Logic Fetch Dữ liệu ---

  // Tự động chọn nhà hàng đầu tiên khi load
  useEffect(() => {
    if (restaurantList.length > 0 && !selectedRestaurantId) {
      setSelectedRestaurantId(restaurantList[0].id);
    }
  }, [restaurantList, selectedRestaurantId]);

  // ❗️ SỬA: Tự động fetch khi 'selectedRestaurantId' thay đổi
  useEffect(() => {
    if (selectedRestaurantId) {
      // 1. Fetch danh sách orders (như cũ)
      if (loadOrders) {
        loadOrders({
          variables: {
            restaurantId: selectedRestaurantId,
            limit: 100,
          },
        });
      }
      // 2. Fetch dữ liệu POS (bàn, menu) cho modal
    }
  }, [loadOrders, selectedRestaurantId]); // Thêm loadPosData

  // ✅ MỚI: Memoize dữ liệu POS

  // --- 5. Các hàm xử lý (useCallback) ---
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

  // ✅ MỚI: Hàm xử lý khi tạo đơn thành công
  const handleNewOrderSuccess = useCallback(() => {
    // Đóng modal
    setShowNewOrderModal(false);

    // Tải lại danh sách đơn hàng
    if (loadOrders && selectedRestaurantId) {
      loadOrders({
        variables: {
          restaurantId: selectedRestaurantId,
          limit: 100,
        },
        fetchPolicy: "network-only", // Đảm bảo lấy dữ liệu mới
      });
    }
  }, [loadOrders, selectedRestaurantId]);

  // --- 6. Filter & Stats (useMemo) ---
  const filteredOrders = useMemo(() => {
    // (Logic filter giữ nguyên)
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
    // (Logic stats giữ nguyên)
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
  const handleChangeItemStatusByCode = useCallback(
    (payload) => {
      return changeOrderItemStatusByCode({
        ...payload,
        afterSuccess: (serverOrder) => {
          // Cập nhật ngay modal nếu đang mở đúng order
          if (serverOrder) {
            setSelectedOrder((prev) => {
              if (!prev || prev.id !== serverOrder.id) return prev;
              // merge để không mất các field mà server không trả (user, restaurantId, ...)
              return { ...prev, ...serverOrder };
            });
          }
          // Làm mới danh sách bên ngoài (nếu muốn bỏ refetch, có thể xóa khối này)
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
          // làm mới list sau khi server nhận
          loadOrders({
            variables: { restaurantId: selectedRestaurantId, limit: 100 },
            fetchPolicy: "network-only",
          });
        },
      });
    },
    [orders, selectedRestaurantId, loadOrders, updateItemStatus]
  );

  // --- 7. RENDER GIAO DIỆN ---
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🍽️ Quản Lý Đơn Hàng
              </h1>
              <p className="text-gray-600">
                Theo dõi và xử lý đơn hàng nhà hàng theo thời gian thực
              </p>
            </div>
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <History size={20} />
              Lịch sử đơn hàng
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* (Stats Card giữ nguyên) */}
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

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              {/* --- ĐÂY LÀ MỤC CHỌN NHÀ HÀNG --- */}
              {/* Sửa: Hiển thị nếu có 1 hoặc nhiều nhà hàng */}
              {restaurantList.length > 0 && (
                <div className="relative min-w-[250px]">
                  <select
                    value={selectedRestaurantId}
                    onChange={(e) => setSelectedRestaurantId(e.target.value)}
                    // Disable nếu chỉ có 1 nhà hàng
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
              {/* --------------------------------- */}

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

              {/* ❗️ SỬA: Nút "Đơn hàng mới" */}
              <button
                onClick={() => setShowNewOrderModal(true)}
                // Disable nếu chưa chọn NH hoặc dữ liệu POS (bàn/menu) chưa tải xong
                disabled={!selectedRestaurantId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Đơn hàng mới
              </button>
            </div>
          </div>
        </div>

        {/* --- KHU VỰC HIỂN THỊ DỮ LIỆU --- */}
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

        {!ordersLoading && !ordersError && filteredOrders.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onViewOrder={handleViewOrder}
                onViewItem={handleViewItem}
                // (Đã xóa prop onShowPayment)
              />
            ))}
          </div>
        )}

        {/* Modals */}

        {/* ✅ MỚI: Render Modal Tạo Đơn */}
        {showNewOrderModal && (
          <NewOrderModal
            isOpen={showNewOrderModal}
            onClose={() => setShowNewOrderModal(false)}
            restaurantId={selectedRestaurantId}
            // Truyền menu
            onSuccess={handleNewOrderSuccess} // Truyền callback
          />
        )}

        {/* (Các modal cũ giữ nguyên) */}
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
            orderHistory={[]}
            onClose={() => setShowHistory(false)}
            onViewOrder={handleViewOrder}
          />
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
