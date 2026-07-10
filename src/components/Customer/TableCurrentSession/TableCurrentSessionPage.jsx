import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { formatPrice } from "@/utils/formatters";

import "./TableCurrentSessionPage.scss";

const INVALID_TABLE_LINK_MESSAGE = "Link bàn không hợp lệ hoặc đã hết hạn.";
const TABLE_SESSION_POLL_MS = 12000;
const ACTIVE_REQUEST_STATUSES = new Set(["PENDING", "ACKNOWLEDGED"]);
const isTablePageVisible = () =>
  typeof document === "undefined" || document.visibilityState !== "hidden";

const PUBLIC_ACTIVE_TABLE_SESSION_ORDERS = gql`
  query PublicActiveTableSessionOrders($restaurantId: ID!, $tableId: ID!, $token: String!) {
    publicActiveTableSessionOrders(
      restaurantId: $restaurantId
      tableId: $tableId
      token: $token
    ) {
      tableId
      tableCode
      session {
        id
        payment {
          status
          requestedAt
        }
      }
      customerRequests {
        requestId
        type
        status
        createdAt
      }
      orders {
        id
        currentStatus
        createdAt
        totals {
          grandTotal
        }
        payment {
          status
          requestedAt
        }
        items {
          id
          name
          quantity
          unitPrice
          modifiersPrice
          lineSubtotal
          note
          status
        }
      }
    }
  }
`;

const PUBLIC_REQUEST_TABLE_PAYMENT = gql`
  mutation PublicRequestTablePayment($input: PublicRequestTablePaymentInput!) {
    publicRequestTablePayment(input: $input) {
      ok
      warning
      readyForPayment
      message
      pendingOrderCodes
      requestedAt
      session {
        id
        payment {
          status
          requestedAt
        }
      }
      orders {
        id
        payment {
          status
          requestedAt
        }
      }
    }
  }
`;

const PUBLIC_CALL_STAFF_FOR_TABLE = gql`
  mutation PublicCallStaffForTable($input: PublicRequestTablePaymentInput!) {
    publicCallStaffForTable(input: $input) {
      ok
      message
      requestId
      status
      requestedAt
    }
  }
`;

const HIDDEN_ORDER_STATUSES = new Set(["completed", "cancelled", "failed"]);

const formatStatusLabel = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  const labels = {
    pending: "Chờ nhà hàng xác nhận",
    confirmed: "Nhà hàng đã xác nhận",
    customer_attached: "Đã ghi nhận",
    preparing: "Đang chuẩn bị",
    ready: "Sẵn sàng phục vụ",
    served: "Đã phục vụ",
    completed: "Đã hoàn tất",
    cancelled: "Đã hủy",
    failed: "Không thể phục vụ",
  };

  return labels[normalized] || "Đang được xử lý";
};

const getStatusTone = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (["served", "completed"].includes(normalized)) return "success";
  if (normalized === "ready") return "ready";
  if (["preparing", "confirmed"].includes(normalized)) return "progress";
  if (["cancelled", "failed"].includes(normalized)) return "danger";
  return "pending";
};

const getRequestTypeLabel = (type) => {
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === "STAFF_CALL") return "Hỗ trợ tại bàn";
  if (normalized === "PAYMENT_REQUEST") return "Thanh toán";
  return "Yêu cầu hỗ trợ";
};

const getRequestStatusLabel = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "ACKNOWLEDGED") return "Nhân viên đã nhận yêu cầu";
  if (normalized === "RESOLVED") return "Đã hỗ trợ xong";
  return "Đã gửi, vui lòng chờ trong giây lát";
};

const isActiveCustomerRequest = (request) =>
  ACTIVE_REQUEST_STATUSES.has(String(request?.status || "").toUpperCase());

const isStaffCallRequest = (request) =>
  String(request?.type || "").toUpperCase() === "STAFF_CALL";

const getPublicTableErrorText = (inputError) => {
  const message = String(inputError?.message || "").trim();

  if (
    !message ||
    /invalid table access token|invalid restaurantid|invalid tableid|table not found/i.test(
      message,
    )
  ) {
    return INVALID_TABLE_LINK_MESSAGE;
  }

  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Kết nối chưa ổn định. Vui lòng thử lại.";
  }

  return message;
};

const getItemSubtotal = (item) => {
  if (item?.lineSubtotal != null) {
    return Number(item.lineSubtotal) || 0;
  }

  const unitPrice = Number(item?.unitPrice || 0);
  const modifiersPrice = Number(item?.modifiersPrice || 0);
  const quantity = Number(item?.quantity || 0);
  return (unitPrice + modifiersPrice) * quantity;
};

const normalizeBatchOrders = (orders = []) =>
  [...orders]
    .filter((order) => {
      const currentStatus = String(order?.currentStatus || "").trim().toLowerCase();
      const paymentStatus = String(order?.payment?.status || "").trim().toLowerCase();
      return !HIDDEN_ORDER_STATUSES.has(currentStatus) && paymentStatus !== "paid";
    })
    .sort((left, right) => {
      const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });

const buildItemStatusStats = (orders = []) => {
  const stats = { total: 0, working: 0, ready: 0, served: 0 };

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const quantity = Math.max(Number(item?.quantity || 1), 1);
      const tone = getStatusTone(item?.status);

      stats.total += quantity;
      if (tone === "success") stats.served += quantity;
      else if (tone === "ready") stats.ready += quantity;
      else stats.working += quantity;
    });
  });

  return stats;
};

const formatLastUpdated = (value) => {
  if (!value) return "đang tải";
  return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const formatOrderTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const TableSessionState = ({ title, message, role = "status" }) => (
  <main className="customer-table-session-page" aria-labelledby="table-session-state-title">
    <div
      className="customer-table-session-page__container customer-table-session-page__container--state"
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
    >
      <h1 id="table-session-state-title">{title}</h1>
      <p>{message}</p>
      {role === "alert" && (
        <Link className="customer-table-session-page__state-link" to="/scan-table">
          Quét mã QR khác
        </Link>
      )}
    </div>
  </main>
);

const TableCurrentSessionPage = () => {
  const { restaurantId, tableId } = useParams();
  const [searchParams] = useSearchParams();
  const [feedback, setFeedback] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(isTablePageVisible);

  const tableAccessToken = useMemo(
    () => String(searchParams.get("token") || "").trim(),
    [searchParams],
  );
  const hasRouteParams = Boolean(restaurantId && tableId);
  const hasTableAccessToken = Boolean(tableAccessToken);

  const { data, previousData, loading, error, refetch } = useQuery(
    PUBLIC_ACTIVE_TABLE_SESSION_ORDERS,
    {
      variables: { restaurantId, tableId, token: tableAccessToken },
      skip: !hasRouteParams || !hasTableAccessToken,
      fetchPolicy: "cache-and-network",
      pollInterval: isPageVisible ? TABLE_SESSION_POLL_MS : 0,
      notifyOnNetworkStatusChange: true,
    },
  );

  const [requestTablePayment, { loading: requestingPayment }] = useMutation(
    PUBLIC_REQUEST_TABLE_PAYMENT,
  );
  const [callStaffForTable, { loading: callingStaff }] = useMutation(
    PUBLIC_CALL_STAFF_FOR_TABLE,
  );

  const tableSessionData =
    data?.publicActiveTableSessionOrders ||
    previousData?.publicActiveTableSessionOrders ||
    null;
  const isRefreshingTable = loading && Boolean(tableSessionData);

  useEffect(() => {
    if (tableSessionData) setLastUpdatedAt(new Date());
  }, [tableSessionData]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const handleVisibilityChange = () => {
      const visible = isTablePageVisible();
      setIsPageVisible(visible);
      if (visible && hasRouteParams && hasTableAccessToken) {
        refetch?.().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [hasRouteParams, hasTableAccessToken, refetch]);

  const batchOrders = useMemo(
    () => normalizeBatchOrders(tableSessionData?.orders || []),
    [tableSessionData?.orders],
  );
  const activeCustomerRequests = useMemo(
    () => (tableSessionData?.customerRequests || []).filter(isActiveCustomerRequest),
    [tableSessionData?.customerRequests],
  );
  const activeStaffCallRequest = activeCustomerRequests.find(isStaffCallRequest);
  const itemStatusStats = useMemo(() => buildItemStatusStats(batchOrders), [batchOrders]);
  const temporaryTotal = useMemo(
    () => batchOrders.reduce((sum, order) => sum + Number(order?.totals?.grandTotal || 0), 0),
    [batchOrders],
  );

  const paymentRequested = useMemo(() => {
    const sessionRequested =
      tableSessionData?.session?.payment?.status === "payment_requested" ||
      Boolean(tableSessionData?.session?.payment?.requestedAt);
    if (sessionRequested) return true;

    return batchOrders.some(
      (order) =>
        order?.payment?.status === "payment_requested" ||
        Boolean(order?.payment?.requestedAt),
    );
  }, [batchOrders, tableSessionData?.session]);

  const buildRequestInput = (note = null) => ({
    restaurantId,
    tableId,
    tableCode: tableSessionData?.tableCode || null,
    token: tableAccessToken,
    note,
  });

  const handleManualRefresh = async () => {
    if (!hasTableAccessToken) {
      setFeedback({ type: "error", text: INVALID_TABLE_LINK_MESSAGE });
      return;
    }

    setManualRefreshing(true);
    try {
      await refetch();
      setFeedback(null);
    } catch (refreshError) {
      setFeedback({ type: "error", text: getPublicTableErrorText(refreshError) });
    } finally {
      setManualRefreshing(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!hasTableAccessToken) {
      setFeedback({ type: "error", text: INVALID_TABLE_LINK_MESSAGE });
      return;
    }

    setFeedback(null);
    try {
      const { data: mutationData } = await requestTablePayment({
        variables: { input: buildRequestInput() },
      });
      const result = mutationData?.publicRequestTablePayment;

      if (!result?.ok) {
        setFeedback({
          type: "error",
          text: result?.message || "Không thể gửi yêu cầu thanh toán.",
        });
        return;
      }

      setFeedback({
        type:
          result.warning === true || (result.pendingOrderCodes || []).length > 0
            ? "warning"
            : "success",
        text:
          result.warning === true || (result.pendingOrderCodes || []).length > 0
            ? "Một số món vẫn đang được chuẩn bị. Nhân viên sẽ kiểm tra trước khi thanh toán."
            : "Đã gửi yêu cầu thanh toán. Nhân viên sẽ đến hỗ trợ bạn.",
      });
      await refetch();
    } catch (mutationError) {
      setFeedback({ type: "error", text: getPublicTableErrorText(mutationError) });
    }
  };

  const handleCallStaff = async () => {
    if (!hasTableAccessToken) {
      setFeedback({ type: "error", text: INVALID_TABLE_LINK_MESSAGE });
      return;
    }

    setFeedback(null);
    try {
      const { data: mutationData } = await callStaffForTable({
        variables: { input: buildRequestInput("Khách cần hỗ trợ tại bàn.") },
      });
      const result = mutationData?.publicCallStaffForTable;
      setFeedback({
        type: result?.ok ? "success" : "error",
        text: result?.ok
          ? "Đã gọi nhân viên. Vui lòng chờ trong giây lát."
          : result?.message || "Không thể gọi nhân viên lúc này.",
      });
      await refetch();
    } catch (mutationError) {
      setFeedback({ type: "error", text: getPublicTableErrorText(mutationError) });
    }
  };

  if (!hasRouteParams || !hasTableAccessToken) {
    return (
      <TableSessionState
        title="Không tải được thông tin bàn"
        message={INVALID_TABLE_LINK_MESSAGE}
        role="alert"
      />
    );
  }

  if (loading && !tableSessionData) {
    return (
      <TableSessionState
        title="Đang tải thông tin bàn…"
        message="Vui lòng chờ trong giây lát."
      />
    );
  }

  if (error && !tableSessionData) {
    return (
      <TableSessionState
        title="Không tải được thông tin bàn"
        message={getPublicTableErrorText(error)}
        role="alert"
      />
    );
  }

  return (
    <main className="customer-table-session-page" aria-labelledby="table-session-title">
      <div className="customer-table-session-page__container">
        <header className="customer-table-session-page__header">
          <div className="customer-table-session-page__intro">
            <p className="customer-table-session-page__eyebrow">Bàn của bạn</p>
            <h1 id="table-session-title">
              {tableSessionData?.tableCode
                ? `Bàn ${tableSessionData.tableCode}`
                : `Bàn ${tableId}`}
            </h1>
            <p className="customer-table-session-page__live-note" role="status" aria-live="polite">
              Thông tin món được cập nhật tự động
              <span aria-hidden="true">•</span>
              Cập nhật lúc {formatLastUpdated(lastUpdatedAt)}
            </p>
          </div>
          <div className="customer-table-session-page__header-actions">
            <span
              className={`customer-table-session-page__live-pill ${isRefreshingTable ? "is-refreshing" : ""}`}
              role="status"
            >
              {isRefreshingTable ? "Đang cập nhật" : "Đã cập nhật"}
            </span>
            {paymentRequested && (
              <span className="customer-table-session-page__badge" role="status">
                Đã yêu cầu thanh toán
              </span>
            )}
            <button
              type="button"
              className="customer-table-session-page__refresh-btn"
              onClick={handleManualRefresh}
              disabled={manualRefreshing || requestingPayment || callingStaff}
            >
              {manualRefreshing ? "Đang cập nhật…" : "Cập nhật ngay"}
            </button>
          </div>
        </header>

        {feedback && (
          <div
            className={`customer-table-session-page__feedback customer-table-session-page__feedback--${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {feedback.text}
          </div>
        )}

        {error && tableSessionData && (
          <div
            className="customer-table-session-page__feedback customer-table-session-page__feedback--warning"
            role="status"
            aria-live="polite"
          >
            Kết nối chưa ổn định. Bạn đang xem thông tin cập nhật gần nhất.
          </div>
        )}

        {activeCustomerRequests.length > 0 && (
          <section
            className="customer-table-session-page__request-card"
            aria-label="Nhân viên đang hỗ trợ"
          >
            <div className="customer-table-session-page__request-heading">
              <strong>Nhân viên đang hỗ trợ</strong>
              <span>{activeCustomerRequests.length} yêu cầu</span>
            </div>
            <div className="customer-table-session-page__request-list" role="list">
              {activeCustomerRequests.map((request) => (
                <div
                  className="customer-table-session-page__request-item"
                  key={request.requestId || `${request.type}-${request.createdAt}`}
                  role="listitem"
                >
                  <span>{getRequestTypeLabel(request.type)}</span>
                  <p>{getRequestStatusLabel(request.status)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {batchOrders.length > 0 && (
          <section
            className="customer-table-session-page__status-summary"
            aria-labelledby="table-session-progress-title"
          >
            <div className="customer-table-session-page__status-summary-heading">
              <p>Tiến độ món</p>
              <strong id="table-session-progress-title">
                {itemStatusStats.served}/{itemStatusStats.total} món đã phục vụ
              </strong>
            </div>
            <div className="customer-table-session-page__status-grid" role="list">
              <div className="customer-table-session-page__status-stat" role="listitem">
                <span>Tổng món</span>
                <strong>{itemStatusStats.total}</strong>
              </div>
              <div
                className="customer-table-session-page__status-stat customer-table-session-page__status-stat--working"
                role="listitem"
              >
                <span>Đang chuẩn bị</span>
                <strong>{itemStatusStats.working}</strong>
              </div>
              <div
                className="customer-table-session-page__status-stat customer-table-session-page__status-stat--ready"
                role="listitem"
              >
                <span>Sẵn sàng</span>
                <strong>{itemStatusStats.ready}</strong>
              </div>
              <div
                className="customer-table-session-page__status-stat customer-table-session-page__status-stat--served"
                role="listitem"
              >
                <span>Đã phục vụ</span>
                <strong>{itemStatusStats.served}</strong>
              </div>
            </div>
          </section>
        )}

        {!batchOrders.length ? (
          <section className="customer-table-session-page__empty" role="status" aria-live="polite">
            <h2>Chưa có món nào tại bàn</h2>
            <p>Nhấn “Gọi món tại bàn” để chọn món. Món đã gửi sẽ xuất hiện tại đây.</p>
            {tableSessionData?.session && (
              <button
                type="button"
                className="customer-table-session-page__cta customer-table-session-page__empty-cta"
                disabled={Boolean(activeStaffCallRequest) || requestingPayment || callingStaff}
                onClick={handleCallStaff}
              >
                {callingStaff
                  ? "Đang gọi nhân viên…"
                  : activeStaffCallRequest
                    ? "Đã gọi nhân viên"
                    : "Gọi nhân viên"}
              </button>
            )}
          </section>
        ) : (
          <div className="customer-table-session-page__body">
            <section
              className="customer-table-session-page__batches"
              aria-labelledby="table-session-orders-title"
            >
              <div className="customer-table-session-page__section-heading">
                <div>
                  <p>Món đã gọi</p>
                  <h2 id="table-session-orders-title">Danh sách tại bàn</h2>
                </div>
                <span>{batchOrders.length} lần gọi món</span>
              </div>

              {batchOrders.map((order, index) => {
                const orderedAt = formatOrderTime(order.createdAt);
                return (
                  <article key={order.id} className="customer-table-session-page__batch-card">
                    <div className="customer-table-session-page__batch-header">
                      <div>
                        <h3>{`Lần gọi món ${index + 1}`}</h3>
                        {orderedAt && <p>Gọi lúc {orderedAt}</p>}
                      </div>
                      <span
                        className={`customer-table-session-page__status-pill customer-table-session-page__status-pill--${getStatusTone(order.currentStatus)}`}
                      >
                        {formatStatusLabel(order.currentStatus)}
                      </span>
                    </div>

                    <ul className="customer-table-session-page__item-list">
                      {(order.items || []).map((item) => (
                        <li
                          key={item.id || `${order.id}-${item.name}`}
                          className="customer-table-session-page__item"
                        >
                          <div className="customer-table-session-page__item-row">
                            <strong>{item.name}</strong>
                            <span>{formatPrice(getItemSubtotal(item))}</span>
                          </div>
                          <div className="customer-table-session-page__item-meta">
                            <span>Số lượng {item.quantity}</span>
                            {item.status && (
                              <span
                                className={`customer-table-session-page__item-status customer-table-session-page__item-status--${getStatusTone(item.status)}`}
                              >
                                {formatStatusLabel(item.status)}
                              </span>
                            )}
                          </div>
                          {item.note && (
                            <p className="customer-table-session-page__item-note">
                              Ghi chú của bạn: {item.note}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>

                    <div className="customer-table-session-page__batch-total">
                      <span>Tạm tính lần này</span>
                      <strong>{formatPrice(order?.totals?.grandTotal || 0)}</strong>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside
              className="customer-table-session-page__summary-card"
              aria-labelledby="table-session-payment-title"
            >
              <div className="customer-table-session-page__summary-heading">
                <p>Thanh toán</p>
                <h2 id="table-session-payment-title">Tạm tính tại bàn</h2>
              </div>
              <div className="customer-table-session-page__summary-row customer-table-session-page__summary-row--muted">
                <span>Số lần gọi món</span>
                <strong>{batchOrders.length}</strong>
              </div>
              <div className="customer-table-session-page__summary-row customer-table-session-page__summary-row--total">
                <span>Tổng tạm tính</span>
                <strong>{formatPrice(temporaryTotal)}</strong>
              </div>
              <div className="customer-table-session-page__actions">
                <button
                  type="button"
                  className="customer-table-session-page__cta"
                  disabled={paymentRequested || requestingPayment || callingStaff || !batchOrders.length}
                  onClick={handleRequestPayment}
                >
                  {requestingPayment
                    ? "Đang gửi yêu cầu…"
                    : paymentRequested
                      ? "Đã yêu cầu thanh toán"
                      : "Yêu cầu thanh toán"}
                </button>
                <button
                  type="button"
                  className="customer-table-session-page__cta customer-table-session-page__cta--secondary"
                  disabled={Boolean(activeStaffCallRequest) || requestingPayment || callingStaff}
                  onClick={handleCallStaff}
                >
                  {callingStaff
                    ? "Đang gọi nhân viên…"
                    : activeStaffCallRequest
                      ? "Đã gọi nhân viên"
                      : "Gọi nhân viên"}
                </button>
              </div>
              <p className="customer-table-session-page__hint">
                Nhân viên sẽ kiểm tra và xác nhận số tiền khi bạn thanh toán.
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
};

export default TableCurrentSessionPage;
