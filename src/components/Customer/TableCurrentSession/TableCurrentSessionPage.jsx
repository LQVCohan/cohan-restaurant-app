import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { useParams, useSearchParams } from "react-router-dom";

import { formatPrice } from "@/utils/formatters";

import "./TableCurrentSessionPage.scss";

const INVALID_TABLE_LINK_MESSAGE = "Link bàn không hợp lệ hoặc đã hết hạn.";
const TABLE_SESSION_POLL_MS = 12000;

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
        orderCode
        orderKind
        currentStatus
        payment {
          status
          requestedAt
        }
      }
      orders {
        id
        orderCode
        orderKind
        currentStatus
        createdAt
        note
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
          unit
          servingKey
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
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    customer_attached: "Đã gắn khách",
    preparing: "Đang chuẩn bị",
    ready: "Sẵn sàng phục vụ",
    served: "Đã phục vụ",
    completed: "Đã hoàn tất",
    cancelled: "Đã hủy",
    failed: "Thất bại",
  };

  return labels[normalized] || (normalized ? normalized.replace(/_/g, " ") : "Đang xử lý");
};

const getStatusTone = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (["served", "completed"].includes(normalized)) return "success";
  if (["ready"].includes(normalized)) return "ready";
  if (["preparing", "confirmed"].includes(normalized)) return "progress";
  if (["cancelled", "failed"].includes(normalized)) return "danger";
  return "pending";
};

const getPublicTableErrorText = (inputError) => {
  const message = String(inputError?.message || "").trim();

  if (!message || message.includes("Invalid table access token")) {
    return INVALID_TABLE_LINK_MESSAGE;
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

const normalizeBatchOrders = (orders = []) => {
  return [...orders]
    .filter((order) => {
      const currentStatus = String(order?.currentStatus || "").trim().toLowerCase();
      const paymentStatus = String(order?.payment?.status || "").trim().toLowerCase();

      return (
        order?.orderKind !== "table_session" &&
        !HIDDEN_ORDER_STATUSES.has(currentStatus) &&
        paymentStatus !== "paid"
      );
    })
    .sort((left, right) => {
      const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return String(left?.orderCode || left?.id || "").localeCompare(
        String(right?.orderCode || right?.id || ""),
      );
    });
};

const formatLastUpdated = (value) => {
  if (!value) return "Chưa cập nhật";
  return value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const TableCurrentSessionPage = () => {
  const { restaurantId, tableId } = useParams();
  const [searchParams] = useSearchParams();
  const [feedback, setFeedback] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const tableAccessToken = useMemo(
    () => String(searchParams.get("token") || "").trim(),
    [searchParams],
  );
  const hasRouteParams = Boolean(restaurantId && tableId);
  const hasTableAccessToken = Boolean(tableAccessToken);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery(PUBLIC_ACTIVE_TABLE_SESSION_ORDERS, {
    variables: { restaurantId, tableId, token: tableAccessToken },
    skip: !hasRouteParams || !hasTableAccessToken,
    fetchPolicy: "cache-and-network",
    pollInterval: TABLE_SESSION_POLL_MS,
    notifyOnNetworkStatusChange: true,
  });

  const [requestTablePayment, { loading: requestingPayment }] = useMutation(
    PUBLIC_REQUEST_TABLE_PAYMENT,
  );
  const [callStaffForTable, { loading: callingStaff }] = useMutation(
    PUBLIC_CALL_STAFF_FOR_TABLE,
  );

  const tableSessionData = data?.publicActiveTableSessionOrders || null;
  const isRefreshingTable = loading && Boolean(tableSessionData);

  useEffect(() => {
    if (tableSessionData) {
      setLastUpdatedAt(new Date());
    }
  }, [tableSessionData]);

  const batchOrders = useMemo(
    () => normalizeBatchOrders(tableSessionData?.orders || []),
    [tableSessionData?.orders],
  );

  const temporaryTotal = useMemo(
    () => batchOrders.reduce((sum, order) => sum + Number(order?.totals?.grandTotal || 0), 0),
    [batchOrders],
  );

  const paymentRequested = useMemo(() => {
    const sessionRequested =
      tableSessionData?.session?.payment?.status === "payment_requested" ||
      Boolean(tableSessionData?.session?.payment?.requestedAt);

    if (sessionRequested) {
      return true;
    }

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
      setFeedback({
        type: "error",
        text: INVALID_TABLE_LINK_MESSAGE,
      });
      return;
    }

    setManualRefreshing(true);

    try {
      await refetch();
      setFeedback(null);
    } catch (refreshError) {
      setFeedback({
        type: "error",
        text: getPublicTableErrorText(refreshError),
      });
    } finally {
      setManualRefreshing(false);
    }
  };

  const handleRequestPayment = async () => {
    if (!hasTableAccessToken) {
      setFeedback({
        type: "error",
        text: INVALID_TABLE_LINK_MESSAGE,
      });
      return;
    }

    setFeedback(null);

    try {
      const { data: mutationData } = await requestTablePayment({
        variables: {
          input: buildRequestInput(),
        },
      });

      const result = mutationData?.publicRequestTablePayment;

      if (!result?.ok) {
        setFeedback({
          type: "error",
          text: result?.message || "Không thể gửi yêu cầu thanh toán.",
        });
        return;
      }

      if (result.warning === true || (result.pendingOrderCodes || []).length > 0) {
        setFeedback({
          type: "warning",
          text: "Còn món chưa phục vụ xong, nhân viên sẽ kiểm tra lại.",
        });
      } else {
        setFeedback({
          type: "success",
          text: "Đã gửi yêu cầu thanh toán. Nhân viên sẽ đến hỗ trợ.",
        });
      }

      await refetch();
    } catch (mutationError) {
      setFeedback({
        type: "error",
        text: getPublicTableErrorText(mutationError),
      });
    }
  };

  const handleCallStaff = async () => {
    if (!hasTableAccessToken) {
      setFeedback({
        type: "error",
        text: INVALID_TABLE_LINK_MESSAGE,
      });
      return;
    }

    setFeedback(null);

    try {
      const { data: mutationData } = await callStaffForTable({
        variables: {
          input: buildRequestInput("Khách cần hỗ trợ tại bàn."),
        },
      });
      const result = mutationData?.publicCallStaffForTable;

      setFeedback({
        type: result?.ok ? "success" : "error",
        text: result?.message || "Không thể gọi nhân viên lúc này.",
      });

      await refetch();
    } catch (mutationError) {
      setFeedback({
        type: "error",
        text: getPublicTableErrorText(mutationError),
      });
    }
  };

  if (!hasRouteParams || !hasTableAccessToken) {
    return (
      <div className="customer-table-session-page">
        <div className="customer-table-session-page__container customer-table-session-page__container--state">
          <h1>Không tải được thông tin bàn</h1>
          <p>{INVALID_TABLE_LINK_MESSAGE}</p>
        </div>
      </div>
    );
  }

  if (loading && !tableSessionData) {
    return (
      <div className="customer-table-session-page">
        <div className="customer-table-session-page__container customer-table-session-page__container--state">
          <h1>Đang tải thông tin bàn...</h1>
          <p>Vui lòng chờ trong giây lát.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-table-session-page">
        <div className="customer-table-session-page__container customer-table-session-page__container--state">
          <h1>Không tải được thông tin bàn</h1>
          <p>{getPublicTableErrorText(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-table-session-page">
      <div className="customer-table-session-page__container">
        <header className="customer-table-session-page__header">
          <div>
            <p className="customer-table-session-page__eyebrow">Thông tin bàn hiện tại</p>
            <h1>
              {tableSessionData?.tableCode
                ? `Bàn ${tableSessionData.tableCode}`
                : `Bàn ${tableId}`}
            </h1>
            <p className="customer-table-session-page__live-note">
              Tự động cập nhật trạng thái món mỗi 12 giây. Cập nhật gần nhất: {formatLastUpdated(lastUpdatedAt)}.
            </p>
          </div>
          <div className="customer-table-session-page__header-actions">
            <span className={`customer-table-session-page__live-pill ${isRefreshingTable ? "is-refreshing" : ""}`}>
              {isRefreshingTable ? "Đang cập nhật" : "Live"}
            </span>
            {paymentRequested && (
              <span className="customer-table-session-page__badge">
                Đã gọi thanh toán
              </span>
            )}
            <button
              type="button"
              className="customer-table-session-page__refresh-btn"
              onClick={handleManualRefresh}
              disabled={manualRefreshing || requestingPayment || callingStaff}
            >
              {manualRefreshing ? "Đang làm mới..." : "Làm mới"}
            </button>
          </div>
        </header>

        {feedback && (
          <div
            className={`customer-table-session-page__feedback customer-table-session-page__feedback--${feedback.type}`}
          >
            {feedback.text}
          </div>
        )}

        {!batchOrders.length ? (
          <div className="customer-table-session-page__empty">
            <h2>Bàn hiện chưa có món đang phục vụ.</h2>
            <p>Khi có món mới được ghi nhận, danh sách sẽ hiện tại đây.</p>
          </div>
        ) : (
          <div className="customer-table-session-page__body">
            <section className="customer-table-session-page__batches">
              {batchOrders.map((order, index) => (
                <article key={order.id} className="customer-table-session-page__batch-card">
                  <div className="customer-table-session-page__batch-header">
                    <div>
                      <h2>{`Đợt ${index + 1}`}</h2>
                      <p>{order.orderCode || `BATCH-${index + 1}`}</p>
                    </div>
                    <span className={`customer-table-session-page__status-pill customer-table-session-page__status-pill--${getStatusTone(order.currentStatus)}`}>
                      {formatStatusLabel(order.currentStatus)}
                    </span>
                  </div>

                  <ul className="customer-table-session-page__item-list">
                    {(order.items || []).map((item) => (
                      <li key={item.id || `${order.id}-${item.name}`} className="customer-table-session-page__item">
                        <div className="customer-table-session-page__item-main">
                          <div className="customer-table-session-page__item-row">
                            <strong>{item.name}</strong>
                            <span>{formatPrice(getItemSubtotal(item))}</span>
                          </div>
                          <div className="customer-table-session-page__item-meta">
                            <span>Số lượng: {item.quantity}</span>
                            {item.unit && <span>Đơn vị: {item.unit}</span>}
                            {item.servingKey && <span>Phần: {item.servingKey}</span>}
                            {item.status && (
                              <span className={`customer-table-session-page__item-status customer-table-session-page__item-status--${getStatusTone(item.status)}`}>
                                Trạng thái: {formatStatusLabel(item.status)}
                              </span>
                            )}
                          </div>
                          {item.note && (
                            <p className="customer-table-session-page__item-note">
                              Ghi chú: {item.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="customer-table-session-page__batch-total">
                    <span>Tạm tính đợt</span>
                    <strong>{formatPrice(order?.totals?.grandTotal || 0)}</strong>
                  </div>
                </article>
              ))}
            </section>

            <aside className="customer-table-session-page__summary-card">
              <div className="customer-table-session-page__summary-row customer-table-session-page__summary-row--muted">
                <span>Đợt đang phục vụ</span>
                <strong>{batchOrders.length}</strong>
              </div>
              <div className="customer-table-session-page__summary-row customer-table-session-page__summary-row--total">
                <span>Tạm tính</span>
                <strong>{formatPrice(temporaryTotal)}</strong>
              </div>
              <div className="customer-table-session-page__actions">
                <button
                  type="button"
                  className="customer-table-session-page__cta"
                  disabled={paymentRequested || requestingPayment || callingStaff || !batchOrders.length}
                  onClick={handleRequestPayment}
                >
                  {requestingPayment ? "Đang gửi yêu cầu..." : "Gọi thanh toán"}
                </button>
                <button
                  type="button"
                  className="customer-table-session-page__cta customer-table-session-page__cta--secondary"
                  disabled={requestingPayment || callingStaff}
                  onClick={handleCallStaff}
                >
                  {callingStaff ? "Đang gọi nhân viên..." : "Gọi nhân viên"}
                </button>
              </div>
              <p className="customer-table-session-page__hint">
                Đây là tạm tính của các đợt gọi món đang phục vụ, không phải hóa đơn đã thanh toán.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableCurrentSessionPage;
