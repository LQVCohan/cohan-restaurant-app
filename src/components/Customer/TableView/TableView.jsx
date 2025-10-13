import React, { useState, useEffect } from "react";
import { useTableManagement } from "./hooks/useTableManagement";
import { useReservation } from "./hooks/useReservation";

import TableGrid from "./components/TableGrid/TableGrid";
import TableFilters from "./components/TableFilters/TableFilters";
import ReservationModal from "./components/ReservationModal/ReservationModal";
import TableDetailsModal from "./components/TableDetailsModal/TableDetailsModal";
import ReservationSummary from "./components/ReservationSummary/ReservationSummary";
import "./TableView.scss";

const TableView = ({ restaurant }) => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showTableDetails, setShowTableDetails] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);

  const {
    tables,
    filteredTables,
    tableFilters,
    updateFilters,
    getTableAvailability,
    refreshTables,
  } = useTableManagement(restaurant?.id, selectedDate, selectedTimeSlot);

  const {
    reservationData,
    createReservation,
    isLoading: reservationLoading,
  } = useReservation();

  useEffect(() => {
    if (restaurant?.id) {
      refreshTables();
    }
  }, [restaurant?.id, selectedDate, selectedTimeSlot, refreshTables]);

  const handleTableSelect = (table) => {
    const availability = getTableAvailability(
      table.id,
      selectedDate,
      selectedTimeSlot
    );

    if (availability.isAvailable) {
      setSelectedTable(table);
      setShowReservationModal(true);
    } else {
      setSelectedTable(table);
      setShowTableDetails(true);
    }
  };

  const handleReservationSubmit = async (reservationInfo) => {
    try {
      await createReservation({
        ...reservationInfo,
        tableId: selectedTable.id,
        restaurantId: restaurant.id,
        date: selectedDate,
        timeSlot: selectedTimeSlot,
        guestCount,
      });

      setShowReservationModal(false);
      setSelectedTable(null);
      refreshTables();

      // Show success message
      alert(
        "🎉 Đặt bàn thành công! Chúng tôi sẽ liên hệ xác nhận trong thời gian sớm nhất."
      );
    } catch (error) {
      alert("❌ Có lỗi xảy ra khi đặt bàn. Vui lòng thử lại.");
    }
  };

  const getAvailableTablesCount = () => {
    return filteredTables.filter((table) => {
      const availability = getTableAvailability(
        table.id,
        selectedDate,
        selectedTimeSlot
      );
      return availability.isAvailable && table.capacity >= guestCount;
    }).length;
  };

  return (
    <div className="table-view">
      {/* Header */}
      <div className="table-view__header">
        <div className="header-content">
          <div className="restaurant-info">
            <h1 className="restaurant-name">🏪 {restaurant?.name}</h1>
            <p className="restaurant-address">📍 {restaurant?.address}</p>
          </div>

          <div className="booking-summary">
            <div className="summary-item">
              <span className="summary-label">Ngày:</span>
              <span className="summary-value">
                {new Date(selectedDate).toLocaleDateString("vi-VN")}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Giờ:</span>
              <span className="summary-value">
                {selectedTimeSlot || "Chưa chọn"}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Số khách:</span>
              <span className="summary-value">{guestCount} người</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <TableFilters
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedTimeSlot={selectedTimeSlot}
        onTimeSlotChange={setSelectedTimeSlot}
        guestCount={guestCount}
        onGuestCountChange={setGuestCount}
        tableFilters={tableFilters}
        onFiltersChange={updateFilters}
        availableTablesCount={getAvailableTablesCount()}
      />

      {/* Table Grid */}
      <div className="table-view__content">
        <div className="content-header">
          <h2 className="section-title">🪑 Sơ đồ bàn ăn</h2>
          <div className="legend">
            <div className="legend-item">
              <div className="legend-color legend-color--available"></div>
              <span>Có sẵn</span>
            </div>
            <div className="legend-item">
              <div className="legend-color legend-color--occupied"></div>
              <span>Đã có khách</span>
            </div>
            <div className="legend-item">
              <div className="legend-color legend-color--reserved"></div>
              <span>Đã đặt trước</span>
            </div>
            <div className="legend-item">
              <div className="legend-color legend-color--maintenance"></div>
              <span>Bảo trì</span>
            </div>
          </div>
        </div>

        <TableGrid
          tables={filteredTables}
          selectedDate={selectedDate}
          selectedTimeSlot={selectedTimeSlot}
          guestCount={guestCount}
          onTableSelect={handleTableSelect}
          getTableAvailability={getTableAvailability}
        />
      </div>

      {/* Reservation Summary */}
      {selectedDate && selectedTimeSlot && (
        <ReservationSummary
          restaurant={restaurant}
          selectedDate={selectedDate}
          selectedTimeSlot={selectedTimeSlot}
          guestCount={guestCount}
          availableTablesCount={getAvailableTablesCount()}
        />
      )}

      {/* Modals */}
      <ReservationModal
        isOpen={showReservationModal}
        onClose={() => {
          setShowReservationModal(false);
          setSelectedTable(null);
        }}
        table={selectedTable}
        restaurant={restaurant}
        selectedDate={selectedDate}
        selectedTimeSlot={selectedTimeSlot}
        guestCount={guestCount}
        onSubmit={handleReservationSubmit}
        isLoading={reservationLoading}
      />

      <TableDetailsModal
        isOpen={showTableDetails}
        onClose={() => {
          setShowTableDetails(false);
          setSelectedTable(null);
        }}
        table={selectedTable}
        selectedDate={selectedDate}
        selectedTimeSlot={selectedTimeSlot}
        availability={
          selectedTable
            ? getTableAvailability(
                selectedTable.id,
                selectedDate,
                selectedTimeSlot
              )
            : null
        }
      />
    </div>
  );
};

export default TableView;
