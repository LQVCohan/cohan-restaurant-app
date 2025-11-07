// src/hooks/useReservation.js
import { gql, useLazyQuery, useMutation } from "@apollo/client";

/* ============================ GraphQL ============================ */

export const GET_RESERVATION_STATUS = gql`
  query GetReservationStatus($id: ID!) {
    reservation(id: $id) {
      id
      status
      depositStatus
      pendingPaymentExpiresAt
      orderCode
      restaurantId
      tableId
      userId
      customerName
      customerPhone
      customerEmail
      partySize
      note
      timeTo
      durationMinutes
      createdAt
      updatedAt
    }
  }
`;

export const CONFIRMED_RESERVATION_BY_TABLE = gql`
  query ConfirmedReservationByTable($restaurantId: ID!, $tableId: ID!) {
    confirmedReservationByTable(
      restaurantId: $restaurantId
      tableId: $tableId
    ) {
      id
      status
      depositStatus
      orderCode
      restaurantId
      tableId
      userId
      customerName
      customerPhone
      customerEmail
      partySize
      note
      timeTo
      durationMinutes
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_RESERVATION = gql`
  mutation CreateReservation($input: CreateReservationInput!) {
    createReservation(input: $input) {
      id
      status
      depositStatus
      orderCode
      restaurantId
      tableId
      userId
      customerName
      customerPhone
      customerEmail
      partySize
      note
      timeTo
      durationMinutes
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_RESERVATION_STATUS = gql`
  mutation UpdateReservationStatus($input: UpdateReservationStatusInput!) {
    updateReservationStatus(input: $input) {
      id
      status
      depositStatus
      restaurantId
      tableId
      updatedAt
    }
  }
`;

export const CHANGE_RESERVATION_TABLE = gql`
  mutation ChangeReservationTable($input: ChangeReservationTableInput!) {
    changeReservationTable(input: $input) {
      id
      status
      restaurantId
      tableId
      updatedAt
    }
  }
`;

export const CANCEL_RESERVATION = gql`
  mutation CancelReservation($id: ID!) {
    cancelReservation(id: $id) {
      id
      status
      updatedAt
    }
  }
`;

export const SET_TABLE_STATUS = gql`
  mutation SetTableStatus($input: SetTableStatusInput!) {
    setTableStatus(input: $input) {
      id
      status
      __typename
    }
  }
`;

export const UPDATE_ORDER_CUSTOMER_BY_CODE = gql`
  mutation UpdateOrderCustomerByCode($input: UpdateOrderCustomerByCodeInput!) {
    updateOrderCustomerByCode(input: $input) {
      order {
        id
        orderCode
        restaurantId
        tableCode
        user {
          id
          fullName
        }
        updatedAt
      }
    }
  }
`;

/* ============================ Utils ============================ */

const toIsoFromDatetimeLocal = (value) => {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

const isEmail = (s) =>
  !!String(s || "")
    .toLowerCase()
    .match(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);

const isPhoneVN = (s) => !!String(s || "").match(/^(0|\+84)(\d){9,10}$/);

const safeInt = (n, def = 0) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
};

const trimOrNull = (v) => {
  const s = (v ?? "").toString().trim();
  return s ? s : null;
};

/* ============================ Hook ============================ */

export function useReservation() {
  const [runGetStatus, getStatusState] = useLazyQuery(GET_RESERVATION_STATUS, {
    fetchPolicy: "network-only",
  });
  const [runFindConfirmedByTable, findConfirmedState] = useLazyQuery(
    CONFIRMED_RESERVATION_BY_TABLE,
    { fetchPolicy: "network-only" }
  );

  const [mutCreate, createState] = useMutation(CREATE_RESERVATION);
  const [mutUpdateStatus, updateStatusState] = useMutation(
    UPDATE_RESERVATION_STATUS
  );
  const [mutChangeTable, changeTableState] = useMutation(
    CHANGE_RESERVATION_TABLE
  );
  const [mutCancel, cancelState] = useMutation(CANCEL_RESERVATION);
  const [mutSetTableStatus, setTableStatusState] =
    useMutation(SET_TABLE_STATUS);

  const [mutUpdateOrderCustomerByCode, updateOrderCustomerState] = useMutation(
    UPDATE_ORDER_CUSTOMER_BY_CODE,
    { onError: () => {} }
  );

  /* ------------------------- Core helpers ------------------------- */

  const checkReservationStatus = async (reservationId) => {
    if (!reservationId) {
      return { success: false, message: "Missing reservationId" };
    }
    try {
      const { data } = await runGetStatus({ variables: { id: reservationId } });
      return { success: true, data: data?.reservation || null };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Failed to load reservation status",
      };
    }
  };

  /**
   * Tạo reservation mới cho 1 bàn.
   * - KHÔNG đổi trạng thái bàn trước khi tạo (tránh BE báo TABLE_UNAVAILABLE).
   * - Nếu BE trả về TABLE_UNAVAILABLE do bàn lỡ bị set "reserved" trước đó,
   *   sẽ tự động khôi phục bàn về "available" rồi retry duy nhất 1 lần.
   */
  const createReservationForTable = async ({
    restaurantId,
    tableId,
    customer = {},
    partySize = 2,
    timeTo = null,
    durationMinutes = 90,
    note = "",
    restaurantName = "",
    maxCapacity = null,
    depositAmount = 0,
    autoRecoverIfTableUnavailable = true, // ✅ sửa lỗi người dùng gặp
  } = {}) => {
    if (!restaurantId || !tableId) {
      return { success: false, message: "Missing restaurantId/tableId" };
    }

    const fullName = (customer.fullName || customer.name || "").trim();
    const phone = (customer.phone || "").trim();
    const email = (customer.email || "").trim().toLowerCase();

    // --- VALIDATE theo BE ---
    if (!fullName) {
      return { success: false, message: "Cần tên khách hàng." };
    }
    if (!phone && !email) {
      return {
        success: false,
        message: "Cần ít nhất SĐT hoặc Email của khách.",
      };
    }
    if (phone && !isPhoneVN(phone)) {
      return { success: false, message: "Số điện thoại không hợp lệ." };
    }
    if (email && !isEmail(email)) {
      return { success: false, message: "Email không hợp lệ." };
    }

    const size = safeInt(partySize, 2);
    if (!(size > 0)) {
      return { success: false, message: "Số khách phải lớn hơn 0." };
    }
    if (Number.isFinite(maxCapacity) && size > Number(maxCapacity)) {
      return {
        success: false,
        message: `Số khách (${size}) vượt quá sức chứa tối đa của bàn (${maxCapacity}).`,
      };
    }

    const input = {
      restaurantId,
      tableId,
      timeTo: toIsoFromDatetimeLocal(timeTo),
      partySize: size,
      note: note || "",
      restaurantName: restaurantName || "",
      customerName: fullName,
      customerPhone: trimOrNull(phone),
      customerEmail: trimOrNull(email),
      durationMinutes: safeInt(durationMinutes, 90),
      depositAmount: safeInt(depositAmount, 0),
    };

    const tryCreate = async () => {
      const { data } = await mutCreate({ variables: { input } });
      const resv = data?.createReservation || null;
      if (!resv) throw new Error("Create reservation failed.");
      return resv;
    };

    try {
      // 1) Gọi BE tạo reservation (không đụng trạng thái bàn trước)
      const resv = await tryCreate();

      // 2) Sau khi tạo thành công mới set trạng thái bàn -> reserved (best-effort)
      try {
        await mutSetTableStatus({
          variables: { input: { id: resv.tableId, status: "reserved" } },
        });
      } catch {
        // bỏ qua
      }

      return { success: true, data: resv };
    } catch (err) {
      const raw = err?.message || "";

      // Trường hợp bàn đang không "available" (thường do bị set reserved sớm)
      if (
        autoRecoverIfTableUnavailable &&
        /Table is not available|TABLE_UNAVAILABLE/i.test(raw)
      ) {
        try {
          // Khôi phục về available rồi retry 1 lần
          await mutSetTableStatus({
            variables: { input: { id: tableId, status: "available" } },
          });

          const resv = await tryCreate();

          // Sau khi tạo xong -> reserved (best-effort)
          try {
            await mutSetTableStatus({
              variables: { input: { id: resv.tableId, status: "reserved" } },
            });
          } catch {}

          return { success: true, data: resv };
        } catch (retryErr) {
          const msg = retryErr?.message || raw;
          if (/TIME_CONFLICT/i.test(msg)) {
            return {
              success: false,
              message: "Khung giờ này bàn đã có khách đặt.",
            };
          }
          return { success: false, message: msg || "Create failed" };
        }
      }

      if (/Customer name/i.test(raw) && /required/i.test(raw)) {
        return {
          success: false,
          message: "Tên khách và (SĐT hoặc Email) là bắt buộc.",
        };
      }
      if (/TIME_CONFLICT/i.test(raw)) {
        return {
          success: false,
          message: "Khung giờ này bàn đã có khách đặt.",
        };
      }
      if (/Arrival time exceeds/i.test(raw)) {
        return {
          success: false,
          message:
            "Giờ đến vượt quá giờ đóng cửa của nhà hàng. Vui lòng chọn giờ khác.",
        };
      }

      return { success: false, message: raw || "Create failed" };
    }
  };

  // Alias back-compat
  const createReservation = createReservationForTable;

  const seatReservation = async ({
    reservationId,
    setTableOccupied = true,
  }) => {
    if (!reservationId) {
      return { success: false, message: "Missing reservationId" };
    }
    try {
      const { data } = await mutUpdateStatus({
        variables: { input: { id: reservationId, status: "seated" } },
      });
      const resv = data?.updateReservationStatus || null;

      if (resv?.tableId && setTableOccupied) {
        try {
          await mutSetTableStatus({
            variables: { input: { id: resv.tableId, status: "occupied" } },
          });
        } catch {}
      }

      return { success: true, data: resv };
    } catch (err) {
      return {
        success: false,
        message: err?.message || "Seat reservation failed",
      };
    }
  };

  const findConfirmedByTable = async ({ restaurantId, tableId }) => {
    if (!restaurantId || !tableId) {
      return { success: false, message: "Missing restaurantId/tableId" };
    }
    try {
      const { data, error } = await runFindConfirmedByTable({
        variables: { restaurantId, tableId },
      });
      if (error) throw error;
      const resv = data?.confirmedReservationByTable || null;
      return { success: true, data: resv };
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.includes("Cannot query field") &&
        msg.includes("confirmedReservationByTable")
      ) {
        return {
          success: false,
          reason: "not_supported",
          message:
            "Server chưa hỗ trợ confirmedReservationByTable. Có thể bỏ qua vì BE đã tự gán customer & orderCode từ reservation khi upsert order.",
        };
      }
      return { success: false, message: msg || "Query failed" };
    }
  };

  const attachReservationCustomerToOrder = async ({
    reservation,
    restaurantId,
    orderCode,
  }) => {
    if (!reservation) return { success: false, message: "Missing reservation" };
    if (!restaurantId || !orderCode) {
      return {
        success: false,
        message: "Missing restaurantId/orderCode to update order customer",
      };
    }
    const customer = {
      fullName: (reservation.customerName || "").trim(),
      phone: (reservation.customerPhone || "").trim(),
      email: (reservation.customerEmail || "").trim().toLowerCase(),
    };

    try {
      const { data } = await mutUpdateOrderCustomerByCode({
        variables: { input: { restaurantId, orderCode, customer } },
      });
      return { success: true, data: data?.updateOrderCustomerByCode?.order };
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.includes("Cannot query field") &&
        msg.includes("updateOrderCustomerByCode")
      ) {
        return {
          success: false,
          reason: "not_supported",
          message:
            "Server chưa hỗ trợ updateOrderCustomerByCode. Bạn có thể bỏ qua vì BE đã tự gán từ reservation khi upsert order.",
        };
      }
      return { success: false, message: msg || "Attach customer failed" };
    }
  };

  const hydrateOrderFromTableReservation = async ({
    restaurantId,
    tableId,
    orderCode,
  }) => {
    const found = await findConfirmedByTable({ restaurantId, tableId });
    if (!found.success || !found.data) {
      return {
        success: !!found.success,
        data: null,
        message:
          found.message ||
          "Không có reservation đã confirm cho bàn này (hoặc server chưa hỗ trợ).",
      };
    }
    const resv = found.data;
    return {
      success: true,
      data: {
        reservation: resv,
        orderCode: resv.orderCode || orderCode || null,
        customer: {
          fullName: (resv.customerName || "").trim(),
          phone: (resv.customerPhone || "").trim(),
          email: (resv.customerEmail || "").trim().toLowerCase(),
        },
      },
    };
  };

  const startStatusPolling = (reservationId, onPaid, intervalMs = 5000) => {
    if (!reservationId) return () => {};
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        const res = await checkReservationStatus(reservationId);
        const r = res?.data;
        const paid =
          r?.depositStatus === "paid" ||
          ["confirmed", "seated", "completed"].includes(r?.status);
        if (paid) {
          onPaid?.(r);
          return;
        }
      } catch {}
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    let timer = setTimeout(tick, intervalMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  };

  const moveReservationToAnotherTable = async ({
    id,
    newRestaurantId = null,
    newTableId = null,
    acceptPenalty = false,
    note = "",
  }) => {
    if (!id) return { success: false, message: "Missing reservation id" };
    try {
      const { data } = await mutChangeTable({
        variables: {
          input: { id, newRestaurantId, newTableId, acceptPenalty, note },
        },
      });
      return { success: true, data: data?.changeReservationTable || null };
    } catch (err) {
      return { success: false, message: err?.message || "Change table failed" };
    }
  };

  const cancelReservation = async (reservationId) => {
    if (!reservationId)
      return { success: false, message: "Missing reservationId" };
    try {
      const { data } = await mutCancel({ variables: { id: reservationId } });
      return { success: true, data: data?.cancelReservation || null };
    } catch (err) {
      return { success: false, message: err?.message || "Cancel failed" };
    }
  };

  return {
    checkReservationStatus,
    createReservationForTable,
    createReservation, // alias
    seatReservation,
    findConfirmedByTable,
    attachReservationCustomerToOrder,
    hydrateOrderFromTableReservation,
    startStatusPolling,
    moveReservationToAnotherTable,
    cancelReservation,
    // states cho UI
    states: {
      gettingStatus: getStatusState.loading,
      creating: createState.loading,
      seating: updateStatusState.loading,
      findingConfirmed: findConfirmedState.loading,
      moving: changeTableState.loading,
      canceling: cancelState.loading,
      settingTableStatus: setTableStatusState.loading,
      updatingOrderCustomer: updateOrderCustomerState.loading,
      errorGettingStatus: getStatusState.error,
      errorCreating: createState.error,
      errorSeating: updateStatusState.error,
      errorFindingConfirmed: findConfirmedState.error,
      errorMoving: changeTableState.error,
      errorCanceling: cancelState.error,
      errorSettingTableStatus: setTableStatusState.error,
      errorUpdatingOrderCustomer: updateOrderCustomerState.error,
    },
  };
}
