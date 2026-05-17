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

export const ACTIVE_RESERVATION_BY_TABLE = gql`
  query ActiveReservationByTable($restaurantId: ID!, $tableId: ID!) {
    activeReservationByTable(
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
      isUnlimitedTime
      paymentMethod
      paymentReference
      changeRequestType
      changeRequestStatus
      changeRequestFee
      requestedTimeTo
      requestedDurationMinutes
      requestedTableId
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
  mutation ChangeReservationTable($input: changeReservationTableInput!) {
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

export const CHECK_IN_RESERVATION = gql`
  mutation CheckInReservation($input: CheckInReservationInput!) {
    checkInReservation(input: $input) {
      id status depositStatus orderCode restaurantId tableId userId customerName customerPhone customerEmail
      partySize note timeTo durationMinutes isUnlimitedTime paymentMethod paymentReference
      changeRequestType changeRequestStatus changeRequestFee requestedTimeTo requestedDurationMinutes requestedTableId
      createdAt updatedAt
    }
  }
`;
export const APPROVE_RESERVATION_CHANGE = gql`
  mutation ApproveReservationChange($input: ApproveReservationChangeInput!) {
    approveReservationChange(input: $input) {
      id status depositStatus orderCode restaurantId tableId userId customerName customerPhone customerEmail
      partySize note timeTo durationMinutes isUnlimitedTime paymentMethod paymentReference
      changeRequestType changeRequestStatus changeRequestFee requestedTimeTo requestedDurationMinutes requestedTableId
      createdAt updatedAt
    }
  }
`;
export const REJECT_RESERVATION_CHANGE = gql`
  mutation RejectReservationChange($input: RejectReservationChangeInput!) {
    rejectReservationChange(input: $input) {
      id status depositStatus orderCode restaurantId tableId userId customerName customerPhone customerEmail
      partySize note timeTo durationMinutes isUnlimitedTime paymentMethod paymentReference
      changeRequestType changeRequestStatus changeRequestFee requestedTimeTo requestedDurationMinutes requestedTableId
      createdAt updatedAt
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
  const [runFindActiveByTable, findConfirmedState] = useLazyQuery(
    ACTIVE_RESERVATION_BY_TABLE,
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
  const [mutCheckInReservation, checkInReservationState] = useMutation(CHECK_IN_RESERVATION);
  const [mutApproveReservationChange, approveChangeState] = useMutation(APPROVE_RESERVATION_CHANGE);
  const [mutRejectReservationChange, rejectChangeState] = useMutation(REJECT_RESERVATION_CHANGE);
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
    durationMinutes = 60,
    note = "",
    restaurantName = "",
    maxCapacity = null,
    depositAmount = 0,
  } = {}) => {
    if (!restaurantId || !tableId) {
      return { success: false, message: "Missing restaurantId/tableId" };
    }

    const fullName = (customer.fullName || customer.name || "").trim();
    const phone = (customer.phone || "").trim();
    const email = (customer.email || "").trim().toLowerCase();

    // --- VALIDATE theo BE ---

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
      customerName: fullName || null,
      customerPhone: trimOrNull(phone),
      customerEmail: trimOrNull(email),
      durationMinutes: safeInt(durationMinutes, 60),
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

      return { success: true, data: resv };
    } catch (err) {
      const raw = err?.message || "";


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
        } catch (tableErr) {
          console.warn("setTableStatus occupied failed", tableErr);
        }
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
      const { data, error } = await runFindActiveByTable({
        variables: { restaurantId, tableId },
      });
      if (error) throw error;
      const resv = data?.activeReservationByTable || null;
      return { success: true, data: resv };
    } catch (err) {
      const msg = err?.message || "";
      if (
        msg.includes("Cannot query field") &&
        msg.includes("activeReservationByTable")
      ) {
        return {
          success: false,
          reason: "not_supported",
          message:
            "Server chưa hỗ trợ activeReservationByTable. Có thể bỏ qua vì BE đã tự gán customer & orderCode từ reservation khi upsert order.",
        };
      }
      return { success: false, message: msg || "Query failed" };
    }
  };
  const findActiveByTable = findConfirmedByTable;

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
      } catch (pollErr) {
        console.warn("reservation status polling failed", pollErr);
      }
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
  const checkInReservation = async (reservationId, note) => {
    try {
      const { data } = await mutCheckInReservation({ variables: { input: { reservationId, note } } });
      return { success: true, data: data?.checkInReservation || null };
    } catch (err) { return { success: false, message: err?.message || "Check in failed" }; }
  };
  const approveReservationChange = async (reservationId, note) => {
    try {
      const { data } = await mutApproveReservationChange({ variables: { input: { reservationId, note } } });
      return { success: true, data: data?.approveReservationChange || null };
    } catch (err) { return { success: false, message: err?.message || "Approve change failed" }; }
  };
  const rejectReservationChange = async (reservationId, reason) => {
    try {
      const { data } = await mutRejectReservationChange({ variables: { input: { reservationId, reason } } });
      return { success: true, data: data?.rejectReservationChange || null };
    } catch (err) { return { success: false, message: err?.message || "Reject change failed" }; }
  };

  return {
    checkReservationStatus,
    createReservationForTable,
    createReservation, // alias
    seatReservation,
    findConfirmedByTable,
    findActiveByTable,
    attachReservationCustomerToOrder,
    hydrateOrderFromTableReservation,
    startStatusPolling,
    moveReservationToAnotherTable,
    cancelReservation,
    checkInReservation,
    approveReservationChange,
    rejectReservationChange,
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
      checkingInReservation: checkInReservationState.loading,
      approvingReservationChange: approveChangeState.loading,
      rejectingReservationChange: rejectChangeState.loading,
      errorSettingTableStatus: setTableStatusState.error,
      errorUpdatingOrderCustomer: updateOrderCustomerState.error,
    },
  };
}
