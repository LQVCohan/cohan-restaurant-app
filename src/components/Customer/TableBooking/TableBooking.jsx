import React, { useState, useContext, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { gql, useMutation } from "@apollo/client";
import { ChevronLeft, Info, Layers } from "lucide-react"; // Dùng lucide-react cho đồng bộ

import FloorMap from "./FloorMap/FloorMap";
import FloorSelector from "./FloorSelector/FloorSelector";
import BookingSummary from "./BookingSummary/BookingSummary";
import BookingModal from "../BookingTableModal/BookingModal";
import QRPaymentModal from "../QRPaymentModal/QRPaymentModal";
import SuccessModal from "../SuccessModal/SuccessModal";

import useFloorManagement from "../../../hooks/useFloorManagement";
import { useCart } from "../../../context/CartProvider";
import { AuthContext } from "../../../context/AuthContext";
import "./TableBooking.scss";

const UPDATE_FLOOR_WATCHING = gql`
  mutation UpdateFloorWatching($id: ID!, $isWatching: Boolean) {
    updateFloor(input: { id: $id, isWatching: $isWatching }) {
      id
      isWatching
    }
  }
`;

const TableBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const restaurantId = id;
  const { user } = useContext(AuthContext) || {};
  const lastWatchingFloorRef = useRef(null);

  const [selectedTable, setSelectedTable] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const { cart } = useCart();
  const fromMenu = new URLSearchParams(search).get("fromMenu") === "1";

  const [updateFloorWatching] = useMutation(UPDATE_FLOOR_WATCHING);

  const {
    floors,
    floorsLoading,
    activeLevel,
    setActiveLevel,
    activeFloorData,
    tables,
    tablesLoading,
  } = useFloorManagement({
    restaurantId,
    tableLimit: 200,
  });

  const restaurantCartItems = (cart || []).filter(
    (item) => item.restaurantId === restaurantId
  );
  const menuSubtotal = restaurantCartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0
  );
  const menuDeposit = Math.round(menuSubtotal * 0.5);

  const canToggleWatching = (() => {
    const role = (user?.roleName || user?.role || "").toLowerCase();
    return (
      role.includes("customer") ||
      role.includes("staff") ||
      role.includes("nhân viên") ||
      role.includes("nhan vien")
    );
  })();

  useEffect(() => {
    if (!canToggleWatching) return;
    const currentFloorId = activeFloorData?.id;
    if (!currentFloorId) return;
    const prevFloorId = lastWatchingFloorRef.current;
    if (prevFloorId && prevFloorId !== currentFloorId) {
      updateFloorWatching({
        variables: { id: prevFloorId, isWatching: false },
      }).catch(() => {});
    }
    updateFloorWatching({
      variables: { id: currentFloorId, isWatching: true },
    }).catch(() => {});
    lastWatchingFloorRef.current = currentFloorId;
    return () => {
      if (!currentFloorId) return;
      updateFloorWatching({
        variables: { id: currentFloorId, isWatching: false },
      }).catch(() => {});
    };
  }, [activeFloorData?.id, canToggleWatching, updateFloorWatching]);

  const handleSelectTable = (table) => {
    // Chỉ cho chọn bàn trống
    if (table.status === "available") {
      setSelectedTable(table);
    }
  };

  const handleBookingConfirmed = (reservation) => {
    setBookingData(reservation);
    setShowBookingModal(false);
    const needDeposit = Number(reservation?.depositAmount || 0) > 0;
    needDeposit ? setShowPaymentModal(true) : setShowSuccessModal(true);
  };

  const handlePaymentConfirmed = () => {
    setShowPaymentModal(false);
    setShowSuccessModal(true);
  };

  if (floorsLoading)
    return (
      <div className="booking-loading-premium">
        <div className="loader-logo"></div>
        <p>Đang chuẩn bị không gian...</p>
      </div>
    );

  return (
    <div className="table-booking-premium">
      {/* Header Premium */}
      <header className="premium-header">
        <div className="header-inner">
          <button className="btn-back-link" onClick={() => navigate(-1)}>
            <ChevronLeft size={20} /> Quay lại
          </button>
          <div className="header-center">
            <span className="sub-heading">Đặt bàn trực tuyến</span>
            <h1 className="main-heading">Sơ đồ chỗ ngồi</h1>
          </div>
          <div className="header-actions">
            <button className="btn-help">
              <Info size={20} />
            </button>
          </div>
        </div>
      </header>

      {fromMenu && (
        <div className="booking-alert">
          🛎️ Đã quay lại từ giỏ món. Hệ thống sẽ tính tiền cọc bàn + 50% cọc món
          trong bước thanh toán.
        </div>
      )}

      <div className="booking-layout-grid">
        {/* LEFT COLUMN: Main Interaction Area */}
        <main className="main-visual-area">
          {/* Floor Selector Bar */}
          <div className="floor-control-bar">
            <div className="bar-label">
              <Layers size={18} /> Chọn tầng:
            </div>
            <div className="floor-scroll-container">
              <FloorSelector
                floors={floors}
                selectedFloor={activeFloorData}
                onSelect={(floor) => setActiveLevel(floor.level)}
              />
            </div>
          </div>

          {/* Map Viewport */}
          <div className="map-viewport-frame">
            {tablesLoading ? (
              <div className="map-state-msg">Đang tải dữ liệu bàn...</div>
            ) : (
              <>
                <div className="floor-name-watermark">
                  {activeFloorData?.name}
                </div>
                <FloorMap
                  tables={tables}
                  selectedTable={selectedTable}
                  onSelectTable={handleSelectTable}
                  layout={activeFloorData?.layout || []}
                  // Truyền prop để map render style đẹp hơn
                  theme="premium"
                />

                {/* Legend Floating Pill */}
                <div className="legend-pill">
                  <div className="l-item">
                    <span className="dot available"></span> Trống
                  </div>
                  <div className="l-item">
                    <span className="dot selected"></span> Đang chọn
                  </div>
                  <div className="l-item">
                    <span className="dot occupied"></span> Đã đặt
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* RIGHT COLUMN: Sidebar Summary Card */}
        <aside className="sidebar-summary-area">
          <div className="summary-sticky-wrapper">
            <div className="summary-card-premium">
              <div className="card-header">
                <h3>Thông tin đặt bàn</h3>
              </div>
              <div className="card-body-wrapper">
                <BookingSummary
                  selectedTable={selectedTable}
                  selectedFloorName={activeFloorData?.name}
                  menuDeposit={menuDeposit}
                  menuItemsCount={restaurantCartItems.length}
                  // Chúng ta sẽ ẩn nút mặc định của component con và dùng nút custom ở dưới nếu cần,
                  // hoặc style lại nút của component con qua CSS
                  onConfirm={() => selectedTable && setShowBookingModal(true)}
                  onCancel={() => setSelectedTable(null)}
                  onOrderDishes={() =>
                    navigate(
                      `/cus-menu?restaurantId=${encodeURIComponent(
                        restaurantId
                      )}&returnTo=booking`
                    )
                  }
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modals */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        restaurantId={restaurantId}
        tableId={selectedTable?.id}
        tableCode={selectedTable?.label}
        tableCapacity={selectedTable?.capacity}
        tableFloor={activeLevel}
        onBookingConfirmed={handleBookingConfirmed}
      />

      <QRPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        booking={bookingData}
        onPaymentConfirmed={handlePaymentConfirmed}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        booking={bookingData}
        type="reservation"
      />
    </div>
  );
};

export default TableBooking;
