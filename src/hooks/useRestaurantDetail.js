import { useState } from "react";

export const useReservation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);

  const generateTimeSlots = () => {
    const slots = [];
    const times = [
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "17:00",
      "17:30",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
      "20:30",
    ];

    times.forEach((time) => {
      // Simulate some slots being unavailable
      const available = Math.random() > 0.3;
      slots.push({
        time,
        available,
      });
    });

    return slots;
  };

  const checkAvailability = async (restaurantId, date) => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const slots = generateTimeSlots();
      setAvailableSlots(slots);
    } catch (err) {
      setError("Không thể kiểm tra lịch trống. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const submitReservation = async (reservationData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate required fields
      if (
        !reservationData.name ||
        !reservationData.phone ||
        !reservationData.date ||
        !reservationData.time
      ) {
        throw new Error("Vui lòng điền đầy đủ thông tin bắt buộc.");
      }

      // Validate phone number
      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(reservationData.phone.replace(/\s/g, ""))) {
        throw new Error("Số điện thoại không hợp lệ.");
      }

      // Validate email if provided
      if (reservationData.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(reservationData.email)) {
          throw new Error("Email không hợp lệ.");
        }
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate random success/failure
      if (Math.random() > 0.1) {
        setSuccess(true);

        // Store reservation in localStorage for demo
        const reservations = JSON.parse(
          localStorage.getItem("reservations") || "[]"
        );
        const newReservation = {
          id: Date.now(),
          ...reservationData,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        };
        reservations.push(newReservation);
        localStorage.setItem("reservations", JSON.stringify(reservations));

        return { success: true, reservation: newReservation };
      } else {
        throw new Error("Khung giờ này đã được đặt. Vui lòng chọn giờ khác.");
      }
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const getReservations = () => {
    return JSON.parse(localStorage.getItem("reservations") || "[]");
  };

  const cancelReservation = async (reservationId) => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const reservations = JSON.parse(
        localStorage.getItem("reservations") || "[]"
      );
      const updatedReservations = reservations.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, status: "cancelled" }
          : reservation
      );
      localStorage.setItem("reservations", JSON.stringify(updatedReservations));

      return { success: true };
    } catch (err) {
      setError("Không thể hủy đặt bàn. Vui lòng thử lại.");
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    success,
    availableSlots,
    checkAvailability,
    submitReservation,
    getReservations,
    cancelReservation,
  };
};
