// src/components/Customer/TableBooking/TableBooking.jsx
import React, { useEffect, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useParams, useNavigate } from "react-router-dom"; // Thêm useNavigate
import FloorMap from "./FloorMap/FloorMap";
import FloorSelector from "./FloorSelector/FloorSelector";
import BookingSummary from "./BookingSummary/BookingSummary";
import BookingModal from "../BookingTableModal/BookingModal";
import QRPaymentModal from "../QRPaymentModal/QRPaymentModal";
import SuccessModal from "../SuccessModal/SuccessModal";

import "./TableBooking.scss";

/* ───────────────── GraphQL ───────────────── */
const GET_FLOORS = gql`
  query getFloors($restaurantId: ID!) {
    floors(restaurantId: $restaurantId) {
      id
      name
      level
      isActive
    }
  }
`;

const GET_TABLES = gql`
  query getTables(
    $restaurantId: ID!
    $floorId: ID!
    $status: TableStatus
    $limit: Int
  ) {
    tables(
      restaurantId: $restaurantId
      floorId: $floorId
      status: $status
      limit: $limit
    ) {
      id
      label: code
      capacity
      position {
        x
        y
      }
      status
    }
  }
`;

// Icon Back
const BackIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const TableBooking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const restaurantId = id;

  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [bookingData, setBookingData] = useState(null);

  // Queries
  const { data: floorData, loading: floorsLoading } = useQuery(GET_FLOORS, {
    variables: { restaurantId },
  });

  useEffect(() => {
    if (floorData?.floors?.length > 0 && !selectedFloor) {
      setSelectedFloor(floorData.floors[0]);
    }
  }, [floorData, selectedFloor]);

  const { data: tableData, loading: tablesLoading } = useQuery(GET_TABLES, {
    variables: {
      restaurantId,
      floorId: selectedFloor?.id,

      limit: 200,
    },
    skip: !selectedFloor,
    fetchPolicy: "network-only",
  });

  const handleSelectTable = (table) => setSelectedTable(table);

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
      <div className="booking-loading">
        <div className="spinner"></div>
        <p>Đang tải sơ đồ...</p>
      </div>
    );

  return (
    <div className="table-booking-page">
      {/* Header Section */}
      <header className="booking-header">
        <div className="header-container">
          <button className="btn-back" onClick={() => navigate(-1)}>
            <BackIcon /> Quay lại
          </button>
          <div className="header-content">
            <h1 className="page-title">Chọn vị trí ngồi</h1>
            <p className="page-subtitle">
              Vui lòng chọn tầng và bàn phù hợp với bạn
            </p>
          </div>
          <div className="header-spacer"></div> {/* Để cân bằng layout */}
        </div>
      </header>

      <div className="booking-container">
        {/* LEFT COLUMN: Map & Floor Selector */}
        <div className="booking-main-area">
          {/* Floor Selector (Tabs Style) */}
          <div className="floor-tabs-wrapper">
            <FloorSelector
              floors={floorData?.floors || []}
              selectedFloor={selectedFloor}
              onSelect={setSelectedFloor}
            />
          </div>

          {/* Map Area */}
          <div className="map-viewport">
            {tablesLoading ? (
              <div className="map-loading">Đang tải bàn...</div>
            ) : (
              <>
                <FloorMap
                  tables={tableData?.tables || []}
                  selectedTable={selectedTable}
                  onSelectTable={handleSelectTable}
                />

                {/* Legend (Chú thích) nằm góc bản đồ */}
                <div className="map-legend">
                  <div className="legend-item">
                    <span className="dot available"></span> Trống
                  </div>
                  <div className="legend-item">
                    <span className="dot selected"></span> Đang chọn
                  </div>
                  <div className="legend-item">
                    <span className="dot occupied"></span> Đã đặt
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar Summary */}
        <aside className="booking-sidebar">
          <BookingSummary
            selectedTable={selectedTable}
            selectedFloorName={selectedFloor?.name}
            onConfirm={() => selectedTable && setShowBookingModal(true)}
            onCancel={() => setSelectedTable(null)}
          />
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
        tableFloor={selectedTable?.floor}
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

      {/* Notifications */}
    </div>
  );
};

export default TableBooking;
