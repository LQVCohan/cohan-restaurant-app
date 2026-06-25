import React, { useState, useContext, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { ChevronLeft, Info, Layers } from "lucide-react";

import FloorMap from "./components/FloorMap/FloorMap";
import FloorSelector from "./FloorSelector/FloorSelector";
import BookingSummary from "./BookingSummary/BookingSummary";
import BookingModal from "../BookingTableModal/BookingModal";
import QRPaymentModal from "../QRPaymentModal/QRPaymentModal";
import SuccessModal from "../SuccessModal/SuccessModal";

import useFloorManagement from "../../../hooks/useFloorManagement";
import { useCart } from "../../../context/CartProvider";
import { AuthContext } from "../../../context/AuthContext";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { getReservationActionErrorMessage } from "@/utils/commerceActionErrorMessages";
import { mapCartItemToDiscountOrderItemInput } from "@/utils/discountPreviewPayload";
import "./TableBooking.scss";

const ACQUIRE_TABLE_VIEW_LOCK = gql`
  mutation AcquireTableViewLock($input: AcquireTableViewLockInput!) {
    acquireTableViewLock(input: $input) {
      id
      isViewingLocked
      viewLockUserId
      viewLockExpiresAt
      viewLockViewerName
    }
  }
`;

const RELEASE_TABLE_VIEW_LOCK = gql`
  mutation ReleaseTableViewLock($input: ReleaseTableViewLockInput!) {
    releaseTableViewLock(input: $input) {
      id
    }
  }
`;

const UPDATE_FLOOR_WATCHING = gql`
  mutation UpdateFloorWatching($id: ID!, $isWatching: Boolean) {
    updateFloor(input: { id: $id, isWatching: $isWatching }) {
      id
      isWatching
    }
  }
`;

const CREATE_ORDER_FOR_TABLE = gql`
  mutation CreateReservationAddonOrder($input: CreateOrderForTableInput!) {
    createOrderForTable(input: $input) {
      isNewOrder
      order {
        id
        orderCode
        parentOrderCode
        restaurantId
        tableCode
        currentStatus
        note
        totals {
          subtotal
          grandTotal
        }
        items {
          _id
          name
          quantity
          unit
          basePrice
          unitPrice
          lineSubtotal
          servingKey
          note
        }
      }
    }
  }
`;

const PUBLIC_RESTAURANT_CAPABILITY = gql`
  query PublicRestaurantCapability($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      canReserve
      openingStatus
      openingStatusReason
    }
  }
`;

const TableBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { search, state } = useLocation();
  const restaurantId = id;
  const { user } = useContext(AuthContext) || {};
  const lastWatchingFloorRef = useRef(null);

  const [selectedTable, setSelectedTable] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const { cart } = useCart();
  const searchParams = new URLSearchParams(search);
  const fromMenu = searchParams.get("fromMenu") === "1";
  const rebookReservation = state?.rebookReservation || null;
  const isRebook = !!searchParams.get("rebook") || !!rebookReservation;

  const [updateFloorWatching] = useMutation(UPDATE_FLOOR_WATCHING);
  const [acquireTableViewLock] = useMutation(ACQUIRE_TABLE_VIEW_LOCK);
  const [releaseTableViewLock] = useMutation(RELEASE_TABLE_VIEW_LOCK);
  const [createOrderForTable] = useMutation(CREATE_ORDER_FOR_TABLE);
  const { data: restaurantData, loading: restaurantLoading } = useQuery(
    PUBLIC_RESTAURANT_CAPABILITY,
    { variables: { id: restaurantId }, skip: !restaurantId },
  );
  const publicRestaurant = restaurantData?.publicRestaurant || null;
  const canReserve = !!publicRestaurant?.canReserve;
  const canLoadFloorMap = !!publicRestaurant && canReserve;

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
    enabled: canLoadFloorMap,
    publicAccess: true,
  });

  const restaurantCartItems = (cart || []).filter(
    (item) => String(item.restaurantId) === String(restaurantId),
  );
  const menuSubtotal = restaurantCartItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0,
  );
  const menuDeposit = Math.round(menuSubtotal * 0.5);

  const canToggleWatching = (() => {
    const role = (user?.roleName || user?.role || "").toLowerCase();
    return (
      role.includes("staff") ||
      role.includes("manager") ||
      role.includes("admin") ||
      role.includes("nhân viên") ||
      role.includes("nhan vien")
    );
  })();

  useEffect(() => {
    if (!canReserve) return;
    if (!canToggleWatching) return;
    const currentFloorId = activeFloorData?.id;
    if (!currentFloorId) return;
    const prevFloorId = lastWatchingFloorRef.current;
    if (prevFloorId && prevFloorId !== currentFloorId) {
      updateFloorWatching({ variables: { id: prevFloorId, isWatching: false } }).catch(() => {});
    }
    updateFloorWatching({ variables: { id: currentFloorId, isWatching: true } }).catch(() => {});
    lastWatchingFloorRef.current = currentFloorId;
    return () => {
      if (!currentFloorId) return;
      updateFloorWatching({ variables: { id: currentFloorId, isWatching: false } }).catch(() => {});
    };
  }, [activeFloorData?.id, canReserve, canToggleWatching, updateFloorWatching]);

  const handleSelectTable = async (table) => {
    if (!publicRestaurant || !canReserve) return;
    if (table.status !== "available") return;

    const lockedByOther =
      table.isViewingLocked &&
      table.viewLockUserId &&
      String(table.viewLockUserId) !== String(user?.id || "");

    if (lockedByOther) {
      alert(`Bàn đang được ${table.viewLockViewerName || "khách khác"} xem trong 5 phút.`);
      return;
    }

    if (!user?.id) {
      setSelectedTable(table);
      return;
    }

    try {
      await acquireTableViewLock({
        variables: {
          input: {
            tableId: table.id,
            userId: user.id,
            viewerName: user?.fullName || user?.username || "Khách",
          },
        },
      });
      setSelectedTable(table);
    } catch (err) {
      alert(getReservationActionErrorMessage(err, err?.message || "Bàn đang được khách khác xem."));
    }
  };

  useEffect(() => {
    return () => {
      if (selectedTable?.id && user?.id) {
        releaseTableViewLock({
          variables: { input: { tableId: selectedTable.id, userId: user.id } },
        }).catch(() => {});
      }
    };
  }, [selectedTable?.id, user?.id, releaseTableViewLock]);

  const attachAddonOrderToReservation = async (reservation) => {
    if (!reservation?.id || !restaurantCartItems.length || !selectedTable?.id) {
      return {
        ...reservation,
        linkedCartItems: restaurantCartItems,
        linkedMenuSubtotal: menuSubtotal,
        linkedMenuDeposit: menuDeposit,
        linkedOrders: [],
      };
    }

    const addonItems = restaurantCartItems.map(mapCartItemToDiscountOrderItemInput);
    const tableCode = selectedTable?.label || selectedTable?.code || selectedTable?.id;
    const { data } = await createOrderForTable({
      variables: {
        input: {
          restaurantId,
          tableId: selectedTable.id,
          tableCode,
          parentOrderCode: reservation.orderCode || null,
          items: addonItems,
          note: `Order món đi kèm đặt bàn ${reservation.orderCode || reservation.id}`,
          customer: {
            fullName: reservation.customerName || user?.fullName || user?.name || null,
            phone: reservation.customerPhone || user?.phone || null,
            email: reservation.customerEmail || user?.email || null,
          },
          clientMeta: {
            source: "reservation_cart_addon",
            reservationId: reservation.id,
            reservationOrderCode: reservation.orderCode || null,
            linkedMenuSubtotal: menuSubtotal,
            menuDepositPercent: 50,
          },
        },
      },
    });
    const addonOrder = data?.createOrderForTable?.order || null;
    return {
      ...reservation,
      linkedCartItems: restaurantCartItems,
      linkedMenuSubtotal: menuSubtotal,
      linkedMenuDeposit: menuDeposit,
      linkedOrders: addonOrder ? [addonOrder] : [],
    };
  };

  const handleBookingConfirmed = async (reservation) => {
    setShowBookingModal(false);
    if (selectedTable?.id && user?.id) {
      releaseTableViewLock({ variables: { input: { tableId: selectedTable.id, userId: user.id } } }).catch(() => {});
    }

    let enrichedReservation = reservation;
    try {
      enrichedReservation = await attachAddonOrderToReservation(reservation);
    } catch (err) {
      enrichedReservation = {
        ...reservation,
        linkedCartItems: restaurantCartItems,
        linkedMenuSubtotal: menuSubtotal,
        linkedMenuDeposit: menuDeposit,
        linkedOrders: [],
        linkedOrderError: err?.message || "Không thể tạo order món đi kèm.",
      };
    }

    setBookingData(enrichedReservation);
    const needDeposit = Number(enrichedReservation?.depositAmount || 0) > 0;
    needDeposit ? setShowPaymentModal(true) : setShowSuccessModal(true);
  };

  const handlePaymentConfirmed = () => {
    setShowPaymentModal(false);
    setShowSuccessModal(true);
  };

  if (floorsLoading) {
    return (
      <div className="booking-loading-premium">
        <LoadingSpinner size="large" className="booking-loading-spinner" />
        <p>Đang chuẩn bị không gian...</p>
      </div>
    );
  }
  if (restaurantLoading) return <div className="booking-loading-premium"><p>Đang tải thông tin nhà hàng...</p></div>;
  if (!publicRestaurant) return <div className="booking-loading-premium"><p>Nhà hàng không khả dụng hoặc chưa công khai.</p></div>;

  return (
    <div className="table-booking-premium">
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
            <button className="btn-help"><Info size={20} /></button>
          </div>
        </div>
      </header>

      {isRebook && (
        <div className="booking-alert">
          🔁 Đang đặt lại bàn từ lịch sử cũ. Chọn bàn trống rồi xác nhận thông tin mới.
        </div>
      )}
      {fromMenu && (
        <div className="booking-alert">
          🛎️ Đã quay lại từ giỏ món. Hệ thống sẽ tính tiền cọc bàn + 50% cọc món trong bước thanh toán.
        </div>
      )}
      {!canReserve && <div className="booking-alert">Nhà hàng hiện không nhận đặt bàn.</div>}

      <div className="booking-layout-grid">
        <main className="main-visual-area">
          <div className="floor-control-bar">
            <div className="bar-label"><Layers size={18} /> Chọn tầng:</div>
            <div className="floor-scroll-container">
              <FloorSelector
                floors={floors}
                selectedFloor={activeFloorData}
                onSelect={(floor) => setActiveLevel(floor.level)}
              />
            </div>
          </div>

          <div className="map-viewport-frame">
            {!canReserve ? (
              <div className="map-state-msg"><span>Nhà hàng hiện không nhận đặt bàn.</span></div>
            ) : tablesLoading ? (
              <div className="map-state-msg">
                <LoadingSpinner size="medium" />
                <span>Đang tải dữ liệu bàn...</span>
              </div>
            ) : (
              <>
                <div className="floor-name-watermark">{activeFloorData?.name}</div>
                <FloorMap
                  tables={tables}
                  selectedTable={selectedTable}
                  onSelectTable={handleSelectTable}
                  layout={activeFloorData?.layout || []}
                  meta={activeFloorData?.meta || null}
                  theme="premium"
                />
                <div className="legend-pill">
                  <div className="l-item"><span className="dot available"></span> Trống</div>
                  <div className="l-item"><span className="dot selected"></span> Đang chọn</div>
                  <div className="l-item"><span className="dot occupied"></span> Đã đặt</div>
                </div>
              </>
            )}
          </div>
        </main>

        <aside className="sidebar-summary-area">
          <div className="summary-sticky-wrapper">
            <div className="summary-card-premium">
              <div className="card-header"><h3>Thông tin đặt bàn</h3></div>
              <div className="card-body-wrapper">
                <BookingSummary
                  selectedTable={selectedTable}
                  selectedFloorName={activeFloorData?.name}
                  menuDeposit={menuDeposit}
                  menuItemsCount={restaurantCartItems.length}
                  onConfirm={() => canReserve && selectedTable && setShowBookingModal(true)}
                  onCancel={() => setSelectedTable(null)}
                  onOrderDishes={() => navigate(`/cus-menu?restaurantId=${encodeURIComponent(restaurantId)}&returnTo=booking`)}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        restaurantId={restaurantId}
        tableId={selectedTable?.id}
        tableCode={selectedTable?.label || selectedTable?.code}
        tableCapacity={selectedTable?.capacity}
        tableFloor={activeLevel}
        prefillReservation={rebookReservation}
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
