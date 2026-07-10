import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";

import Modal from "@/components/common/Modal";
import {
  getOrCreateTableOrderDeviceId,
  parsePublicTableRoute,
} from "@/utils/tableOrderAccessSession";

import "./TableOrderAccessGate.scss";

const TABLE_ORDER_ACCESS_CONTEXT = gql`
  query PublicTableOrderAccessGate(
    $restaurantId: ID!
    $tableId: ID!
    $token: String!
  ) {
    publicActiveTableSessionOrders(
      restaurantId: $restaurantId
      tableId: $tableId
      token: $token
    ) {
      tableId
      tableCode
      canRequestOrderAccess
      orderAccessConfirmed
      orderAccessBlockedReason
      session { id }
    }
  }
`;

const REQUEST_TABLE_ORDER_ACCESS = gql`
  mutation RequestPublicTableOrderAccess(
    $input: PublicTableOrderAccessRequestInput!
  ) {
    publicRequestTableOrderAccess(input: $input) {
      ok
      message
      requestToken
      requestId
      requestLabel
      expiresAt
    }
  }
`;

const CONFIRM_TABLE_ORDER_ACCESS = gql`
  mutation ConfirmPublicTableOrderAccess(
    $input: PublicTableOrderAccessConfirmInput!
  ) {
    publicConfirmTableOrderAccess(input: $input) {
      ok
      message
      sessionId
      expiresAt
    }
  }
`;

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

export default function TableOrderAccessGate() {
  const location = useLocation();
  const client = useApolloClient();
  const route = useMemo(
    () => parsePublicTableRoute(location.pathname),
    [location.pathname],
  );
  const restaurantId = route?.restaurantId || "";
  const tableId = route?.tableId || "";
  const tableToken = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search],
  );
  const deviceId = useMemo(
    () => getOrCreateTableOrderDeviceId(restaurantId, tableId),
    [restaurantId, tableId],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [requestToken, setRequestToken] = useState("");
  const [requestLabel, setRequestLabel] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const openedOnceRef = useRef(false);

  const { data, loading, refetch } = useQuery(TABLE_ORDER_ACCESS_CONTEXT, {
    variables: { restaurantId, tableId, token: tableToken },
    skip: !restaurantId || !tableId || !tableToken,
    fetchPolicy: "cache-and-network",
    pollInterval: 12000,
  });
  const [requestAccess, { loading: requesting }] = useMutation(
    REQUEST_TABLE_ORDER_ACCESS,
  );
  const [confirmAccess, { loading: confirming }] = useMutation(
    CONFIRM_TABLE_ORDER_ACCESS,
  );

  const access = data?.publicActiveTableSessionOrders;
  const confirmed = Boolean(access?.orderAccessConfirmed);
  const canRequest = Boolean(access?.canRequestOrderAccess);
  const busy = requesting || confirming;

  useEffect(() => {
    if (confirmed) {
      setIsOpen(false);
      setRequestToken("");
      setRequestLabel("");
      setConfirmationCode("");
      setError("");
      return;
    }
    if (!loading && canRequest && !openedOnceRef.current) {
      openedOnceRef.current = true;
      setIsOpen(true);
    }
  }, [canRequest, confirmed, loading]);

  const handleRequestAccess = async () => {
    if (!restaurantId || !tableId || !tableToken || !deviceId || busy) return;
    setError("");
    try {
      const result = await requestAccess({
        variables: {
          input: {
            restaurantId,
            tableId,
            token: tableToken,
            deviceId,
          },
        },
      });
      const payload = result?.data?.publicRequestTableOrderAccess;
      setRequestToken(payload?.requestToken || "");
      setRequestLabel(payload?.requestLabel || "");
      setConfirmationCode("");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Không thể tạo yêu cầu xác nhận. Vui lòng nhờ nhân viên hỗ trợ.",
        ),
      );
    }
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (!requestToken || confirmationCode.length !== 6 || busy) return;
    setError("");
    try {
      const result = await confirmAccess({
        variables: {
          input: {
            requestToken,
            deviceId,
            confirmationCode,
          },
        },
      });
      if (!result?.data?.publicConfirmTableOrderAccess?.ok) {
        throw new Error("Không thể xác nhận thiết bị tại bàn.");
      }
      await refetch();
      await client.refetchQueries({
        include: [
          "PublicTableOrderContext",
          "PublicActiveTableSessionOrders",
          "PublicTableProofUpdates",
        ],
      });
      setIsOpen(false);
    } catch (confirmError) {
      setError(
        getErrorMessage(
          confirmError,
          "Mã xác nhận không đúng hoặc đã hết hạn.",
        ),
      );
    }
  };

  if (!restaurantId || !tableId || !tableToken || confirmed || !canRequest) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="table-order-access-launcher"
        onClick={() => setIsOpen(true)}
        aria-label={`Xác nhận tại ${access?.tableCode ? `bàn ${access.tableCode}` : "bàn này"} để gọi món`}
      >
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>Xác nhận tại bàn</strong>
          <small>Nhân viên kiểm tra một lần trước khi gọi món</small>
        </span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => !busy && setIsOpen(false)}
        title="Xác nhận thiết bị tại bàn"
        size="sm"
        className="table-order-access-modal"
        zIndex={1210}
      >
        <div className="table-order-access-gate">
          <div className="table-order-access-gate__icon" aria-hidden="true">
            <ShieldCheck />
          </div>
          <p className="table-order-access-gate__lead">
            Để người ngoài không thể quét QR rồi gọi món cho bàn của bạn, nhân viên cần xác nhận thiết bị này một lần trong phiên phục vụ.
          </p>

          {!requestToken ? (
            <>
              <ol className="table-order-access-gate__steps">
                <li>Nhấn yêu cầu mã xác nhận.</li>
                <li>Nhân viên tới đúng bàn và đối chiếu mã yêu cầu.</li>
                <li>Nhập 6 số nhân viên đọc để mở quyền gọi món.</li>
              </ol>
              {access?.orderAccessBlockedReason ? (
                <p className="table-order-access-gate__hint">
                  {access.orderAccessBlockedReason}
                </p>
              ) : null}
              <button
                type="button"
                className="table-order-access-gate__primary"
                onClick={handleRequestAccess}
                disabled={busy}
              >
                <KeyRound aria-hidden="true" />
                {requesting ? "Đang tạo yêu cầu…" : "Yêu cầu mã từ nhân viên"}
              </button>
            </>
          ) : (
            <form onSubmit={handleConfirm} className="table-order-access-gate__form">
              <div className="table-order-access-gate__request">
                <span>Mã yêu cầu của thiết bị</span>
                <strong>#{requestLabel}</strong>
              </div>
              <p className="table-order-access-gate__hint">
                Hãy cho nhân viên xem mã yêu cầu này. Nhân viên chỉ đọc mã 6 số khi đang đứng tại đúng bàn.
              </p>
              <label htmlFor="table-order-confirmation-code">
                Mã xác nhận gồm 6 số
              </label>
              <input
                id="table-order-confirmation-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={confirmationCode}
                onChange={(event) =>
                  setConfirmationCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                placeholder="000000"
                disabled={busy}
                required
                autoFocus
              />
              <div className="table-order-access-gate__actions">
                <button
                  type="submit"
                  className="table-order-access-gate__primary"
                  disabled={busy || confirmationCode.length !== 6}
                >
                  {confirming ? "Đang xác nhận…" : "Xác nhận và mở gọi món"}
                </button>
                <button
                  type="button"
                  className="table-order-access-gate__secondary"
                  onClick={() => {
                    setRequestToken("");
                    setRequestLabel("");
                    setConfirmationCode("");
                    setError("");
                  }}
                  disabled={busy}
                >
                  Yêu cầu mã mới
                </button>
              </div>
            </form>
          )}

          {error ? (
            <p className="table-order-access-gate__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
