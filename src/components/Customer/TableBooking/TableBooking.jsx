// src/components/Customer/TableBooking/TableBooking.jsx
import React, { useEffect, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import FloorMap from "./FloorMap/FloorMap";
import FloorSelector from "./FloorSelector/FloorSelector";
import BookingSummary from "./BookingSummary/BookingSummary";

import "./TableBooking.scss";
import { useParams } from "react-router-dom";
import BookingModal from "../BookingTableModal/BookingModal";
import QRPaymentModal from "../QRPaymentModal/QRPaymentModal";
import SuccessModal from "../SuccessModal/SuccessModal";
import { useNotification } from "../../../hooks/useNotification";

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
      # optional floor if your schema returns it
      # floor
    }
  }
`;

const TableBooking = () => {
  const { id } = useParams();
  const restaurantId = id;
  const { notifications } = useNotification();

  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [bookingData, setBookingData] = useState(null);

  // Floors
  const {
    data: floorData,
    loading: floorsLoading,
    error: floorsError,
  } = useQuery(GET_FLOORS, {
    variables: { restaurantId },
  });

  useEffect(() => {
    if (floorData?.floors?.length > 0) {
      setSelectedFloor(floorData.floors[0]);
    }
  }, [floorData]);

  // Tables
  const {
    data: tableData,
    loading: tablesLoading,
    error: tablesError,
  } = useQuery(GET_TABLES, {
    variables: {
      restaurantId,
      floorId: selectedFloor?.id,
      status: "available",
      limit: 200,
    },
    skip: !selectedFloor,
    fetchPolicy: "network-only",
  });

  const handleSelectTable = (table) => setSelectedTable(table);

  // ✅ nhận reservation và quyết định mở QR hay Success
  const handleBookingConfirmed = (reservation) => {
    setBookingData(reservation);
    setShowBookingModal(false);

    const needDeposit = Number(reservation?.depositAmount || 0) > 0;
    if (needDeposit) {
      setShowPaymentModal(true);
    } else {
      setShowSuccessModal(true);
    }
  };

  const handlePaymentConfirmed = () => {
    setShowPaymentModal(false);
    setShowSuccessModal(true);
  };

  const handleConfirmBooking = () => {
    if (selectedTable) {
      setShowBookingModal(true);
    }
  };

  if (floorsLoading || tablesLoading) return <p>Loading...</p>;
  if (floorsError || tablesError)
    return <p>Error: {floorsError?.message || tablesError?.message}</p>;

  return (
    <div className="table-booking-customer">
      <header className="table-booking-customer__header">
        <h1 className="table-booking-customer__title">Đặt bàn nhà hàng</h1>
        <p className="table-booking-customer__subtitle">
          Chọn tầng, chọn bàn và xác nhận đặt chỗ
        </p>
      </header>

      <div className="table-booking-customer__content">
        <div className="table-booking-customer__map-section">
          <FloorSelector
            floors={floorData?.floors || []}
            selectedFloor={selectedFloor}
            onSelect={setSelectedFloor}
          />
          <FloorMap
            tables={tableData?.tables || []}
            selectedTable={selectedTable}
            onSelectTable={handleSelectTable}
          />
        </div>

        <div className="table-booking-customer__sidebar">
          <BookingSummary
            selectedTable={selectedTable}
            onConfirm={handleConfirmBooking}
            onCancel={() => setSelectedTable(null)}
          />
        </div>
      </div>

      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        restaurantId={restaurantId}
        tableId={selectedTable?.id}
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

      <div className="notifications">
        {notifications.map((n) => (
          <div key={n.id} className={`notification notification--${n.type}`}>
            {n.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TableBooking;
