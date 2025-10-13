import { useState, useCallback } from "react";

export const useReservation = () => {
  const [reservationData, setReservationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const createReservation = useCallback(async (reservationInfo) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock validation
      if (!reservationInfo.customerName || !reservationInfo.customerPhone) {
        throw new Error("Thiếu thông tin bắt buộc");
      }

      // Create reservation object
      const reservation = {
        id: Date.now(),
        ...reservationInfo,
        status: "confirmed",
        createdAt: new Date().toISOString(),
        confirmationCode: `RES${Date.now().toString().slice(-6)}`,
      };

      setReservationData(reservation);

      // Store in localStorage for demo
      const existingReservations = JSON.parse(
        localStorage.getItem("reservations") || "[]"
      );
      existingReservations.push(reservation);
      localStorage.setItem(
        "reservations",
        JSON.stringify(existingReservations)
      );

      return reservation;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelReservation = useCallback(async (reservationId) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update localStorage
      const existingReservations = JSON.parse(
        localStorage.getItem("reservations") || "[]"
      );
      const updatedReservations = existingReservations.map((res) =>
        res.id === reservationId ? { ...res, status: "cancelled" } : res
      );
      localStorage.setItem("reservations", JSON.stringify(updatedReservations));

      setReservationData(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getReservations = useCallback(() => {
    return JSON.parse(localStorage.getItem("reservations") || "[]");
  }, []);

  return {
    reservationData,
    isLoading,
    error,
    createReservation,
    cancelReservation,
    getReservations,
  };
};
