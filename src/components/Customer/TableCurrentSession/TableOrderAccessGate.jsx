import React, { useEffect, useMemo, useState } from "react";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";

import Modal from "@/components/common/Modal";
import {
  getOrCreateTableOrderDeviceId,
  parsePublicTableRoute,
} from "@/utils/tableOrderAccessSession";

import "./TableOrderAccessGate.scss";

export const TABLE_ORDER_ACCESS_REQUIRED_EVENT =
  "cohan:table-order-access-required";

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

const getErrorMessage = (error, fallback) => {
  const code = error?.graphQLErrors?.[0]?.extensions?.code;
  if (code === "TABLE_CONFIRMATION_RATE_LIMITED") {
    return "Bạn đã nhập sai nhiều lần. Hãy tạo mã xác nhận mới và nhờ nhân viên hỗ trợ.";
  }
  if (code === "FORBIDDEN") {
    return "Yêu cầu chưa được nhân viên xác nhận. Vui lòng gọi nhân viên tại bàn.";
  }
  return fallback;
};

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

  const { data, refetch } = useQuery(TABLE_ORDER_ACCESS_CONTEXT, {
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
    if (!confirmed) return;
    setIsOpen(false);
    setRequestToken("");
    setRequestLabel("");
    setConfirmationCode("");
    setError("");
  }, [confirmed]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const openFromCustomerAction = () => {
      if (!confirmed && canRequest) {
        setError("");
        setIsOpen(true);
      }
    };
    window.addEventListener(
      TABLE_ORDER_ACCESS_REQUIRED_EVENT,
      openFromCustomerAction,
    );
    return () => {
      window.removeEventListener(
        TABLE_ORDER_ACCESS_REQUIRED_EVENT,
        openFromCustomerAction,
      );
    };
  }, [canRequest, confirmed]);

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
          "Không thể gửi yêu cầu xác nhận. Vui lòng gọi nhân viên tại bàn.",
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
        throw new Error("confirmation_failed");
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
      window.dispatchEvent(
        new CustomEvent("cohan:table-order-access-confirmed"),
      );
    } catch (confirmError) {
      setError(
        getErrorMessage(
          confirmError,
          "Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại với nhân viên.",
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
        aria-label={`Nhờ nhân viên xác nhận tại ${access?.tableCode ? `bàn ${access.tableCode}` : "bàn này"}`}
      >
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>Nhờ nhân viên xác nhận</strong>
          <small>Chỉ cần làm khi bạn chuẩn bị gửi món</small>
        </span>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => !busy && setIsOpen(false)}
        title="Xác nhận gọi món tại bàn"
        size="sm"
        className="table-order-access-modal"
        zIndex={1210}
      >
        <div className="table-order-access-gate">
          <div className="table-order-access-gate__icon" aria-hidden="true">
            <ShieldCheck />
          </div>
          <p className="table-order-access-gate__lead">
            Bạn đã chọn món. Nhân viên cần xác nhận thiết bị này một lần trước
            khi món được gửi vào hệ thống của nhà hàng.
          </p>

          {!requestToken ? (
            <>
              <ol className="table-order-access-gate__steps">
                <li>Gửi yêu cầu xác nhận cho nhân viên.</li>
                <li>Cho nhân viên xem mã yêu cầu tại đúng bàn.</li>
                <li>Nhập 6 số nhân viên đọc để tiếp tục gửi món.</li>
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
                {requesting ? "Đang gửi yêu cầu…" : "Gửi yêu cầu cho nhân viên"}
              </button>
            </>
          ) : (
            <form onSubmit={handleConfirm} className="table-order-access-gate__form">
              <div className="table-order-access-gate__request">
                <span>Mã yêu cầu của bàn</span>
                <strong>#{requestLabel}</strong>
              </div>
              <p className="table-order-access-gate__hint">
                Cho nhân viên xem mã này. Sau khi đối chiếu đúng bàn, nhân viên
                sẽ đọc mã xác nhận gồm 6 số.
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
                  {confirming ? "Đang xác nhận…" : "Xác nhận và gửi món"}
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
                  Tạo yêu cầu mới
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
