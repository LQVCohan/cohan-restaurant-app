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
import { mapCartItemToReservationOrderItemInput } from "@/utils/discountPreviewPayload";
import { loadTableVrImage } from "@/utils/vrStorage";
import {
  getCurrentPageReturnTo,
  openTableVrViewerInNewTab,
} from "@/utils/tableVrNavigation";
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

const CANCEL_RESERVATION = gql`
  mutation CancelReservationAfterAddonFailure($id: ID!) {
    cancelReservation(id: $id) {
      id
      status
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
  const auth = useContext(AuthContext) || {};
  const { user } = auth;
  const lastWatchingFloorRef = useRef(null);
  const rebookAutoOpenRef = useRef(false);
  const rebookAutoPickRef = useRef(false);
  const bookingDraftAutoPickRef = useRef(false);

  const [selectedTable, setSelectedTable] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [bookingNotice, setBookingNotice] = useState(null);
  const { cart, removeRestaurantItems, refetchServerCart } = useCart();
  const searchParams = new URLSearchParams(search);
  const fromMenu = searchParams.get("fromMenu") === "1";
  const rebookReservation = state?.rebookReservation || null;
  const bookingDraft = state?.bookingDraft || null;
  const isRebook = !!searchParams.get("rebook") || !!rebookReservation;
  const rebookPartySize = Number(rebookReservation?.partySize || 0);
  const bookingAuthValue =
    isRebook && rebookReservation
      ? {
          ...auth,
          user: {
            ...(user || {}),
            fullName: rebookReservation.customerName || user?.fullName || user?.name || "",
            name: rebookReservation.customerName || user?.name || user?.fullName || "",
            phone: rebookReservation.customerPhone || user?.phone || user?.phoneNumber || "",
            phoneNumber: rebookReservation.customerPhone || user?.phoneNumber || user?.phone || "",
            email: rebookReservation.customerEmail || user?.email || "",
          },
        }
      : auth;

  const [updateFloorWatching] = useMutation(UPDATE_FLOOR_WATCHING);
  const [acquireTableViewLock] = useMutation(ACQUIRE_TABLE_VIEW_LOCK);
  const [releaseTableViewLock] = useMutation(RELEASE_TABLE_VIEW_LOCK);
  const [createOrderForTable] = useMutation(CREATE_ORDER_FOR_TABLE);
  const [cancelReservation] = useMutation(CANCEL_RESERVATION);
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
    (sum, item) =>
      sum +
      (Number(item.price || 0) + Number(item.modifiersPrice || 0)) *
        Number(item.quantity || 1),
    0,
  );
  const menuDeposit = Math.round(menuSubtotal * 0.5);
  const totalTableCount = tables.length;
  const availableTableCount = tables.filter((table) => table.status === "available").length;
  const bookingStage = selectedTable ? 3 : activeFloorData ? 2 : 1;
  const activeFloorDescription = String(activeFloorData?.description || "").trim()
    || "Khám phá sơ đồ, kéo để di chuyển và chọn bàn phù hợp với nhóm của bạn.";
  const selectedTableVrUrl = (() => {
    const configuredUrl = String(selectedTable?.vrUrl || "").trim();
    const storedImage = selectedTable?.id
      ? loadTableVrImage(selectedTable.id)
      : null;
    const isInternalViewer = configuredUrl.startsWith("/vr/table/");

    if (configuredUrl && (!isInternalViewer || storedImage)) return configuredUrl;
    if (!selectedTable?.id || !storedImage) return "";
    return `/vr/table/${encodeURIComponent(selectedTable.id)}`;
  })();
  const handleViewSelectedTable360 = () => {
    if (!selectedTableVrUrl) return;
    openTableVrViewerInNewTab(selectedTableVrUrl, {
      returnTo: getCurrentPageReturnTo(),
    });
  };

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

  useEffect(() => {
    if (!isRebook) return;
    if (!selectedTable?.id) {
      rebookAutoOpenRef.current = false;
      return;
    }
    if (!showBookingModal && !rebookAutoOpenRef.current) {
      rebookAutoOpenRef.current = true;
      setShowBookingModal(true);
    }
  }, [isRebook, selectedTable?.id, showBookingModal]);

  const handleSelectTable = async (table) => {
    setBookingNotice(null);
    if (!publicRestaurant || !canReserve) return false;
    if (table.status !== "available") {
      setBookingNotice({ type: "error", message: "Bàn này chưa sẵn sàng để đặt. Vui lòng chọn bàn đang trống." });
      return false;
    }

    const lockedByOther =
      table.isViewingLocked &&
      table.viewLockUserId &&
      String(table.viewLockUserId) !== String(user?.id || "");

    if (lockedByOther) {
      setBookingNotice({
        type: "error",
        message: `Bàn đang được ${table.viewLockViewerName || "khách khác"} xem trong 5 phút.`,
      });
      return false;
    }

    if (!user?.id) {
      setSelectedTable(table);
      return true;
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
      return true;
    } catch (err) {
      setBookingNotice({
        type: "error",
        message: getReservationActionErrorMessage(err, err?.message || "Bàn đang được khách khác xem."),
      });
      return false;
    }
  };

  useEffect(() => {
    if (!isRebook || rebookAutoPickRef.current || selectedTable?.id || tablesLoading) return;
    const availableTables = (tables || []).filter((table) => table.status === "available");
    if (!availableTables.length) return;

    const oldTable = rebookReservation?.tableId
      ? availableTables.find((table) => String(table.id) === String(rebookReservation.tableId))
      : null;
    const fitTable = rebookPartySize
      ? availableTables.find((table) => Number(table.capacity || 0) >= rebookPartySize)
      : null;
    const targetTable = oldTable || fitTable || availableTables[0];

    if (targetTable) {
      rebookAutoPickRef.current = true;
      handleSelectTable(targetTable);
    }
  }, [isRebook, rebookPartySize, rebookReservation?.tableId, selectedTable?.id, tables, tablesLoading]);

  useEffect(() => {
    if (
      !bookingDraft?.tableId ||
      bookingDraftAutoPickRef.current ||
      tablesLoading
    ) {
      return;
    }
    if (
      bookingDraft.tableFloor !== null &&
      bookingDraft.tableFloor !== undefined &&
      String(activeLevel) !== String(bookingDraft.tableFloor)
    ) {
      setActiveLevel(bookingDraft.tableFloor);
      return;
    }

    const targetTable = (tables || []).find(
      (table) => String(table.id) === String(bookingDraft.tableId),
    );
    if (!targetTable) {
      bookingDraftAutoPickRef.current = true;
      setBookingNotice({
        type: "error",
        message: "Bàn đã chọn không còn khả dụng. Vui lòng chọn lại bàn.",
      });
      return;
    }

    bookingDraftAutoPickRef.current = true;
    handleSelectTable(targetTable).then((selected) => {
      if (selected) setShowBookingModal(true);
    });
  }, [
    activeLevel,
    bookingDraft,
    setActiveLevel,
    tables,
    tablesLoading,
  ]);

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

    const addonItems = restaurantCartItems.map(mapCartItemToReservationOrderItemInput);
    const tableCode = selectedTable?.label || selectedTable?.code || selectedTable?.id;
    const { data } = await createOrderForTable({
      variables: {
        input: {
          reservationId: reservation.id,
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
    if (!addonOrder) {
      throw new Error("Không nhận được order món đi kèm từ máy chủ.");
    }
    removeRestaurantItems(restaurantId);
    await refetchServerCart?.();
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

    let enrichedReservation = reservation;
    try {
      enrichedReservation = await attachAddonOrderToReservation(reservation);
    } catch (err) {
      let cancelMessage = "";
      try {
        await cancelReservation({ variables: { id: reservation.id } });
      } catch (cancelError) {
        cancelMessage = ` Không thể tự hủy giữ bàn: ${cancelError?.message || "lỗi không xác định"}.`;
      }
      setBookingNotice({
        type: "error",
        message: `Không thể tạo order món đi kèm nên chưa chuyển sang thanh toán. ${err?.message || ""}${cancelMessage}`,
      });
      setShowBookingModal(true);
      return;
    }

    if (selectedTable?.id && user?.id) {
      releaseTableViewLock({
        variables: { input: { tableId: selectedTable.id, userId: user.id } },
      }).catch(() => {});
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
      <div className="booking-loading-premium" role="status" aria-live="polite">
        <LoadingSpinner size="large" className="booking-loading-spinner" />
        <p>Đang chuẩn bị không gian...</p>
      </div>
    );
  }
  if (restaurantLoading) return <div className="booking-loading-premium" role="status" aria-live="polite"><p>Đang tải thông tin nhà hàng...</p></div>;
  if (!publicRestaurant) return <div className="booking-loading-premium" role="alert"><p>Nhà hàng không khả dụng hoặc chưa công khai.</p></div>;

  return (
    <main className="table-booking-premium" aria-labelledby="table-booking-title">
      <header className="premium-header" aria-labelledby="table-booking-title">
        <div className="header-inner">
          <button type="button" className="btn-back-link" onClick={() => navigate(-1)}>
            <ChevronLeft size={20} aria-hidden="true" /> Quay lại
          </button>

          <div className="header-center">
            <span className="sub-heading">Chọn vị trí phù hợp</span>
            <h1 className="main-heading" id="table-booking-title">
              Chọn bàn tại {publicRestaurant.name}
            </h1>
            <p className="header-description">
              Xem từng khu vực, chọn bàn trống và giữ chỗ trước khi hoàn tất thông tin đặt bàn.
            </p>
          </div>

          <div className="header-overview" aria-label="Tổng quan sơ đồ bàn">
            <article><strong>{availableTableCount}</strong><span>Bàn trống</span></article>
            <article><strong>{totalTableCount}</strong><span>Tổng bàn</span></article>
            <article><strong>{floors.length}</strong><span>Khu vực</span></article>
          </div>

          <button
            type="button"
            className="btn-help"
            aria-label="Xem hướng dẫn đặt bàn"
            onClick={() => setBookingNotice({ type: "info", message: "Chọn tầng, chọn bàn trống trên sơ đồ rồi kiểm tra thông tin ở khung bên phải để tiếp tục đặt bàn." })}
          >
            <Info size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isRebook && (
        <div className="booking-alert" role="status">
          🔁 Đang đặt lại bàn từ lịch sử cũ. Hệ thống sẽ ưu tiên chọn bàn cũ hoặc bàn đủ chỗ rồi tự mở form.
        </div>
      )}
      {fromMenu && (
        <div className="booking-alert" role="status">
          🛎️ Đã quay lại từ giỏ món. Hệ thống sẽ tính tiền cọc bàn + 50% cọc món trong bước thanh toán.
        </div>
      )}
      {bookingNotice && (
        <div
          className={`booking-alert booking-alert--${bookingNotice.type}`}
          role={bookingNotice.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {bookingNotice.message}
        </div>
      )}
      {!canReserve && <div className="booking-alert booking-alert--error" role="alert">Nhà hàng hiện không nhận đặt bàn.</div>}

      <ol className="booking-progress-rail" aria-label="Các bước chọn bàn">
        <li className={bookingStage === 1 ? "is-active" : "is-done"}><span>01</span><div><strong>Chọn khu vực</strong><small>Chuyển giữa các tầng</small></div></li>
        <li className={bookingStage === 2 ? "is-active" : bookingStage > 2 ? "is-done" : ""}><span>02</span><div><strong>Chọn bàn</strong><small>Bàn xanh đang sẵn sàng</small></div></li>
        <li className={bookingStage === 3 ? "is-active" : ""}><span>03</span><div><strong>Xác nhận</strong><small>Kiểm tra trước khi đặt</small></div></li>
      </ol>

      <div className="booking-layout-grid">
        <section className="main-visual-area" aria-label="Sơ đồ bàn nhà hàng">
          <div className="floor-control-bar">
            <div className="floor-context">
              <div className="bar-label"><Layers size={18} aria-hidden="true" /> Khu vực đang xem</div>
              <strong>{activeFloorData?.name || "Chưa có khu vực"}</strong>
              <p>{activeFloorDescription}</p>
            </div>
            <div className="floor-availability" aria-label={`${availableTableCount} trên ${totalTableCount} bàn đang trống`}>
              <strong>{availableTableCount}</strong>
              <span>trống / {totalTableCount} bàn</span>
            </div>
            <div className="floor-scroll-container">
              <FloorSelector
                floors={floors}
                selectedFloor={activeFloorData}
                onSelect={(floor) => setActiveLevel(floor.level)}
              />
            </div>
          </div>

          <div className="map-viewport-frame" role="region" aria-label={`Sơ đồ bàn ${activeFloorData?.name || "nhà hàng"}`} aria-busy={tablesLoading}>
            {!canReserve ? (
              <div className="map-state-msg" role="alert"><span>Nhà hàng hiện không nhận đặt bàn.</span></div>
            ) : tablesLoading ? (
              <div className="map-state-msg" role="status" aria-live="polite">
                <LoadingSpinner size="medium" />
                <span>Đang tải dữ liệu bàn...</span>
              </div>
            ) : (
              <>
                <div className="map-context-strip">
                  <span>Chạm để chọn • kéo để di chuyển</span>
                  <strong>{activeFloorData?.name}</strong>
                  <small>{availableTableCount ? `${availableTableCount} bàn đang sẵn sàng` : "Chưa có bàn trống ở khu vực này"}</small>
                </div>
                <div className="floor-name-watermark" aria-hidden="true">{activeFloorData?.name}</div>
                <FloorMap
                  tables={tables}
                  selectedTable={selectedTable}
                  onSelectTable={handleSelectTable}
                  layout={activeFloorData?.layout || []}
                  meta={activeFloorData?.meta || null}
                  floorName={activeFloorData?.name}
                  theme="premium"
                />
                <div className="legend-pill" aria-label="Chú thích trạng thái bàn">
                  <div className="l-item"><span className="dot available" aria-hidden="true" /> Trống</div>
                  <div className="l-item"><span className="dot selected" aria-hidden="true" /> Đang chọn</div>
                  <div className="l-item"><span className="dot occupied" aria-hidden="true" /> Đã đặt</div>
                  <div className="l-item"><span className="dot preparing" aria-hidden="true" /> Đang chuẩn bị</div>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="sidebar-summary-area" aria-label="Tóm tắt đặt bàn">
          <div className="summary-sticky-wrapper">
            <div className="summary-card-premium">
              <div className="card-header"><span>Đặt chỗ của bạn</span><h3>Thông tin bàn</h3></div>
              <div className="card-body-wrapper">
                <BookingSummary
                  selectedTable={selectedTable}
                  selectedFloorName={activeFloorData?.name}
                  menuDeposit={menuDeposit}
                  menuItemsCount={restaurantCartItems.length}
                  onConfirm={() => canReserve && selectedTable && setShowBookingModal(true)}
                  onCancel={() => setSelectedTable(null)}
                  onOrderDishes={() => navigate(`/cus-menu?restaurantId=${encodeURIComponent(restaurantId)}&returnTo=booking`)}
                  onView360={
                    selectedTableVrUrl ? handleViewSelectedTable360 : undefined
                  }
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <AuthContext.Provider value={bookingAuthValue}>
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          restaurantId={restaurantId}
          tableId={selectedTable?.id}
          tableCode={selectedTable?.label || selectedTable?.code}
          tableCapacity={selectedTable?.capacity}
          tableFloor={activeLevel}
          initialDraft={bookingDraft}
          onBookingConfirmed={handleBookingConfirmed}
        />
      </AuthContext.Provider>

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
    </main>
  );
};

export default TableBooking;
