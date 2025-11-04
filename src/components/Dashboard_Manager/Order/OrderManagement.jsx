import React, { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import OrderCard from "./components/OrderCard";
import OrderModal from "./components/OrderModal";
import ItemModal from "./components/ItemModal";
import HistoryModal from "./components/HistoryModal";
import StatsCard from "./components/StatsCard";
import useOrderManagement from "../../../hooks/useOrderManagement";

// ID nhà hàng (Bạn cần lấy ID này từ context, props, hoặc .env)
const RESTAURANT_ID = "YOUR_RESTAURANT_ID_GOES_HERE";

// HÀM CHUYỂN ĐỔI (ADAPTER)
const mapGqlOrderToUiOrder = (gqlOrder) => {
  if (!gqlOrder) return null;

  let orderType = "table";
  if (gqlOrder.tableCode.toLowerCase().includes("takeaway")) {
    orderType = "takeaway";
  } else if (gqlOrder.tableCode.toLowerCase().includes("delivery")) {
    orderType = "delivery";
  }

  return {
    id: gqlOrder.id,
    customerName: gqlOrder.user?.fullName || "Khách lẻ",
    tableNumber: gqlOrder.tableCode,
    orderTime: new Date(gqlOrder.createdAt),
    status: gqlOrder.currentStatus,
    type: orderType,
    items: (gqlOrder.items || []).map((item) => ({
      id: item.dishId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      status: gqlOrder.currentStatus === "pending" ? "pending" : "confirmed",
    })),
    total: gqlOrder.totals?.grandTotal || 0,
    _rawGql: gqlOrder,
  };
};

const OrderManagement = () => {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [orders, setOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const {
    orders: gqlOrders,
    ordersLoading,
    ordersError,
    loadOrders,
  } = useOrderManagement();

  // 1. GỌI API KHI COMPONENT MOUNT
  useEffect(() => {
    if (RESTAURANT_ID !== "YOUR_RESTAURANT_ID_GOES_HERE") {
      loadOrders({ variables: { restaurantId: RESTAURANT_ID, limit: 100 } });
    } else {
      console.warn("RESTAURANT_ID is not set. Please set it to fetch orders.");
    }
  }, [loadOrders]);

  // 2. CHUYỂN ĐỔI DỮ LIỆU KHI API TRẢ VỀ
  useEffect(() => {
    if (gqlOrders && gqlOrders.length > 0) {
      const mappedOrders = gqlOrders.map(mapGqlOrderToUiOrder).filter(Boolean);
      setOrders(mappedOrders);
    } else {
      setOrders([]);
    }
  }, [gqlOrders]);

  // 3. LỌC VÀ SẮP XẾP
  useEffect(() => {
    let filtered = orders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tableNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !statusFilter || order.status === statusFilter;
      const matchesTable = !tableFilter || order.type === tableFilter;
      return matchesSearch && matchesStatus && matchesTable;
    });

    const getOrderAlertPriority = (orderTime) => {
      if (!orderTime) return 0;
      const now = new Date();
      const time = new Date(orderTime);
      const timeDiff = Math.floor((now - time) / (1000 * 60));
      if (timeDiff >= 30) return 3; // Critical
      if (timeDiff >= 20) return 2; // Danger
      if (timeDiff >= 10) return 1; // Warning
      return 0; // Normal
    };

    filtered.sort((a, b) => {
      const alertA = getOrderAlertPriority(a.orderTime);
      const alertB = getOrderAlertPriority(b.orderTime);
      return alertB - alertA;
    });
    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, tableFilter]);

  // 4. HÀM CẬP NHẬT
  // TODO: Bạn cần gọi mutation từ hook để cập nhật server
  const updateOrderStatus = (orderId, newStatus) => {
    setOrders((prevOrders) => {
      const updatedOrders = prevOrders
        .map((order) => {
          if (order.id === orderId) {
            const updatedOrder = { ...order, status: newStatus };
            if (newStatus === "confirmed") {
              updatedOrder.items = order.items.map((item) => ({
                ...item,
                status: item.status === "pending" ? "confirmed" : item.status,
              }));
            }
            if (newStatus === "completed") {
              updatedOrder.completedTime = new Date();
              setOrderHistory((prev) => [updatedOrder, ...prev]);
              return null;
            }
            return updatedOrder;
          }
          return order;
        })
        .filter(Boolean);
      return updatedOrders;
    });
  };

  const updateItemStatus = (orderId, itemIndex, newStatus) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id === orderId) {
          const updatedItems = [...order.items];
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            status: newStatus,
          };
          return { ...order, items: updatedItems };
        }
        return order;
      })
    );
  };

  const stats = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      completed: orderHistory.length,
    }),
    [orders, orderHistory]
  );

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
          <StatsCard
            icon={<CheckCircle className="text-blue-600" />}
            title="Tổng đơn hàng"
            value={stats.total}
            bgColor="bg-blue-50"
          />
          <StatsCard
            icon={<Clock className="text-orange-600" />}
            title="Chờ xác nhận"
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
                <option value="">Tất cả bàn</option>
                <option value="table">Tại bàn</option>
                <option value="takeaway">Mang về</option>
                <option value="delivery">Giao hàng</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                <Download size={16} />
                Xuất báo cáo
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus size={16} />
                Đơn hàng mới
              </button>
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        {ordersLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader size={32} className="text-blue-600 animate-spin" />
            <p className="ml-2 text-gray-600">Đang tải đơn hàng...</p>
          </div>
        )}
        {ordersError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg text-center">
            <AlertTriangle size={48} className="mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Đã xảy ra lỗi</h3>
            <p>Không thể tải dữ liệu đơn hàng. Vui lòng thử lại.</p>
            <pre className="text-xs text-left mt-4 bg-red-100 p-2 rounded">
              {ordersError.message}
            </pre>
          </div>
        )}
        {!ordersLoading && !ordersError && filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              Không có đơn hàng nào
            </h3>
            <p className="text-gray-500">
              {orders.length > 0
                ? "Không tìm thấy kết quả phù hợp"
                : "Chưa có đơn hàng nào để hiển thị"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={updateOrderStatus}
                onViewOrder={setSelectedOrder}
                onViewItem={setSelectedItem}
              />
            ))}
          </div>
        )}

        {/* Modals */}
        {selectedOrder && (
          <OrderModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onUpdateItemStatus={updateItemStatus}
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
            orderHistory={orderHistory}
            onClose={() => setShowHistory(false)}
            onViewOrder={setSelectedOrder}
          />
        )}
      </div>
    </div>
  );
};

export default OrderManagement;
