import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import "./TableQrManagementPage.scss";

const TABLE_QR_FIELDS = gql`
  fragment TableQrFields on Table {
    id
    restaurantId
    floorId
    floorLevel
    code
    status
    capacity
    tableAccessUrl
    tableQrCodeDataUrl
    tableQrGeneratedAt
    tableQrExpiresAt
  }
`;

const TABLE_QR_LIST = gql`
  query TableQrList($restaurantId: ID!) {
    tableQrAccessList(restaurantId: $restaurantId) {
      ...TableQrFields
    }
  }
  ${TABLE_QR_FIELDS}
`;

const GENERATE_TABLE_QR = gql`
  mutation GenerateTableAccessQr($input: GenerateTableAccessQrInput!) {
    generateTableAccessQr(input: $input) {
      ...TableQrFields
    }
  }
  ${TABLE_QR_FIELDS}
`;

const REVOKE_TABLE_QR = gql`
  mutation RevokeTableAccessQr($tableId: ID!) {
    revokeTableAccessQr(tableId: $tableId) {
      ...TableQrFields
    }
  }
  ${TABLE_QR_FIELDS}
`;

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDateTime = (value) => {
  if (!value) return "Chưa tạo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return dateTimeFormatter.format(date);
};

const isQrExpired = (table) => {
  if (!table?.tableQrExpiresAt) return false;
  return new Date(table.tableQrExpiresAt).getTime() <= Date.now();
};

const getTableQrState = (table) => {
  if (!table?.tableAccessUrl || !table?.tableQrCodeDataUrl) return "missing";
  if (isQrExpired(table)) return "expired";
  return "ready";
};

const getTableQrLabel = (state) => {
  if (state === "ready") return "Đang hoạt động";
  if (state === "expired") return "Hết hạn";
  return "Chưa tạo";
};

const getPublicTableBaseUrl = () =>
  import.meta.env.VITE_PUBLIC_TABLE_BASE_URL ||
  import.meta.env.VITE_PUBLIC_APP_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");

export default function TableQrManagementPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const restaurantList = useMemo(() => restaurants || [], [restaurants]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [busyTableId, setBusyTableId] = useState("");
  const [copiedTableId, setCopiedTableId] = useState("");

  useEffect(() => {
    if (!selectedRestaurantId && restaurantList.length > 0) {
      setSelectedRestaurantId(String(restaurantList[0].id || restaurantList[0].restaurantId));
    }
  }, [restaurantList, selectedRestaurantId]);

  const { data, loading, error, refetch } = useQuery(TABLE_QR_LIST, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const [generateTableQr] = useMutation(GENERATE_TABLE_QR);
  const [revokeTableQr] = useMutation(REVOKE_TABLE_QR);

  const tables = useMemo(
    () => [...(data?.tableQrAccessList || [])].sort((a, b) => Number(a.floorLevel || 0) - Number(b.floorLevel || 0) || String(a.code || "").localeCompare(String(b.code || ""))),
    [data?.tableQrAccessList],
  );
  const readyCount = tables.filter((table) => getTableQrState(table) === "ready").length;
  const expiredCount = tables.filter((table) => getTableQrState(table) === "expired").length;
  const missingTables = useMemo(
    () => tables.filter((table) => ["missing", "expired"].includes(getTableQrState(table))),
    [tables],
  );
  const isMutating = Boolean(busyTableId);

  const handleGenerate = async (table) => {
    if (!table?.id || busyTableId) return;
    setBusyTableId(table.id);
    try {
      await generateTableQr({
        variables: {
          input: {
            tableId: table.id,
            baseUrl: getPublicTableBaseUrl(),
          },
        },
      });
      await refetch?.();
      showNotification("Đã tạo mã QR cho bàn.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể tạo mã QR cho bàn.", "error");
    } finally {
      setBusyTableId("");
    }
  };

  const handleGenerateMissing = async () => {
    if (busyTableId || !missingTables.length) return;
    if (!window.confirm(`Tạo mới hoặc thay thế mã QR cho ${missingTables.length} bàn cần xử lý?`)) return;

    setBusyTableId("__bulk__");
    let successCount = 0;
    let failedCount = 0;

    try {
      for (const table of missingTables) {
        try {
          await generateTableQr({
            variables: {
              input: {
                tableId: table.id,
                baseUrl: getPublicTableBaseUrl(),
              },
            },
          });
          successCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      await refetch?.();
      showNotification(
        failedCount
          ? `Đã tạo ${successCount} mã QR; ${failedCount} bàn chưa xử lý được.`
          : `Đã tạo mã QR cho ${successCount} bàn.`,
        failedCount ? "warning" : "success",
      );
    } finally {
      setBusyTableId("");
    }
  };

  const handleRevoke = async (table) => {
    if (!table?.id || busyTableId) return;
    if (!window.confirm(`Thu hồi mã QR của bàn ${table.code || "--"}? Mã đang dán tại bàn sẽ ngừng hoạt động.`)) return;

    setBusyTableId(table.id);
    try {
      await revokeTableQr({ variables: { tableId: table.id } });
      await refetch?.();
      showNotification("Đã thu hồi mã QR của bàn.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể thu hồi mã QR của bàn.", "error");
    } finally {
      setBusyTableId("");
    }
  };

  const handleCopy = async (table) => {
    if (!table?.tableAccessUrl) return;
    try {
      await navigator.clipboard.writeText(table.tableAccessUrl);
      setCopiedTableId(table.id);
      window.setTimeout(() => setCopiedTableId(""), 1500);
      showNotification("Đã sao chép địa chỉ truy cập.", "success");
    } catch {
      showNotification("Trình duyệt không cho phép sao chép. Hãy sao chép địa chỉ thủ công.", "warning");
    }
  };

  const handleOpen = (table) => {
    if (!table?.tableAccessUrl) return;
    window.open(table.tableAccessUrl, "_blank", "noopener,noreferrer");
  };

  const handlePrint = (table) => {
    if (!table?.tableQrCodeDataUrl) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=520,height=720");
    if (!printWindow) {
      showNotification("Trình duyệt đã chặn cửa sổ in mã QR.", "warning");
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>Mã QR bàn ${table.code || ""}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:28px;color:#1f2937}img{width:320px;height:320px}p{color:#4b5563;word-break:break-word}.card{border:1px solid #ddd;border-radius:20px;padding:24px;display:inline-block}</style></head><body><div class="card"><h1>Bàn ${table.code || "--"}</h1><p>Quét mã để xem món đã gọi, gọi nhân viên hoặc yêu cầu thanh toán.</p><img src="${table.tableQrCodeDataUrl}" alt="Mã QR bàn ${table.code || ""}"/><p>${table.tableAccessUrl || ""}</p></div><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="table-qr-page" aria-busy={loading}>
      <ManagementPageHeader
        className="table-qr-page-header"
        density="compact"
        statsPlacement="none"
        showTimeWidget={false}
        eyebrow="QUẢN LÝ MÃ QR"
        title="Mã QR tại bàn"
        subtitle="Tạo mã để khách xem đơn, gọi phục vụ và yêu cầu thanh toán ngay tại bàn."
        icon="📱"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantList.map((restaurant) => ({ id: String(restaurant.id || restaurant.restaurantId), name: restaurant.name }))}
        primaryAction={{ label: "Tải lại", icon: "↻", onClick: () => refetch?.(), disabled: !selectedRestaurantId || loading }}
      />

      <section className="table-qr-overview" aria-label="Tình trạng mã QR tại bàn">
        <div className="table-qr-overview__top">
          <div className="table-qr-summary" role="list" aria-label="Số lượng mã QR">
            <span className="table-qr-summary__item" role="listitem">
              <strong>{tables.length}</strong>
              <span>Tổng bàn</span>
            </span>
            <span className="table-qr-summary__item table-qr-summary__item--ready" role="listitem">
              <strong>{readyCount}</strong>
              <span>Đang hoạt động</span>
            </span>
            <span className="table-qr-summary__item table-qr-summary__item--attention" role="listitem">
              <strong>{missingTables.length}</strong>
              <span>Cần tạo hoặc tạo lại</span>
            </span>
            <span className="table-qr-summary__item table-qr-summary__item--expired" role="listitem">
              <strong>{expiredCount}</strong>
              <span>Hết hạn</span>
            </span>
          </div>

          <button
            className="table-qr-bulk-action"
            type="button"
            onClick={handleGenerateMissing}
            disabled={isMutating || !missingTables.length}
          >
            {busyTableId === "__bulk__"
              ? "Đang tạo mã QR…"
              : missingTables.length
                ? `Tạo mã cho ${missingTables.length} bàn`
                : "Không có mã cần tạo"}
          </button>
        </div>

        <details className="table-qr-guide">
          <summary>Quy trình triển khai mã QR</summary>
          <ol>
            <li>Tạo mã QR cho từng bàn.</li>
            <li>In và đặt mã tại đúng bàn.</li>
            <li>Khách quét mã để mở trang của bàn.</li>
            <li>Khách xem đơn, gọi phục vụ hoặc yêu cầu thanh toán.</li>
          </ol>
          <p>
            Trang khách được mở từ <code translate="no">{getPublicTableBaseUrl()}</code>
          </p>
        </details>
      </section>

      {error ? (
        <section className="table-qr-state" role="alert">Không thể tải danh sách bàn. Hãy tải lại trang.</section>
      ) : loading && !tables.length ? (
        <section className="table-qr-state" role="status" aria-live="polite">Đang tải danh sách bàn…</section>
      ) : !tables.length ? (
        <section className="table-qr-state" role="status">Nhà hàng chưa có bàn để tạo mã QR.</section>
      ) : (
        <section className="table-qr-grid" aria-label="Danh sách mã QR theo bàn">
          {tables.map((table) => {
            const qrState = getTableQrState(table);
            const isBusy = busyTableId === table.id;
            const tableLabel = `bàn ${table.code || "--"}`;

            return (
              <article className={`table-qr-card table-qr-card--${qrState}`} key={table.id}>
                <div className="table-qr-card__head">
                  <div>
                    <p>Tầng {table.floorLevel || "?"}</p>
                    <h2>Bàn {table.code || "--"}</h2>
                  </div>
                  <span>{getTableQrLabel(qrState)}</span>
                </div>

                <div className="table-qr-card__body">
                  {table.tableQrCodeDataUrl ? (
                    <img
                      src={table.tableQrCodeDataUrl}
                      alt={`Mã QR truy cập bàn ${table.code || ""}`}
                      width="128"
                      height="128"
                      loading="lazy"
                    />
                  ) : (
                    <div className="table-qr-card__placeholder" aria-hidden="true">QR</div>
                  )}
                  <div className="table-qr-card__meta">
                    <p><strong>Ngày tạo</strong><span>{formatDateTime(table.tableQrGeneratedAt)}</span></p>
                    <p><strong>Hết hạn</strong><span>{formatDateTime(table.tableQrExpiresAt)}</span></p>
                    {table.tableAccessUrl && (
                      <code title={table.tableAccessUrl} translate="no">{table.tableAccessUrl}</code>
                    )}
                  </div>
                </div>

                <div className="table-qr-card__actions">
                  <button
                    type="button"
                    onClick={() => handleGenerate(table)}
                    disabled={isMutating}
                    aria-label={`${qrState === "ready" ? "Tạo lại" : "Tạo"} mã QR cho ${tableLabel}`}
                  >
                    {isBusy ? "Đang xử lý…" : qrState === "ready" ? "Tạo lại" : "Tạo mã"}
                  </button>
                  <button type="button" onClick={() => handleOpen(table)} disabled={!table.tableAccessUrl} aria-label={`Mở trang khách của ${tableLabel}`}>Mở trang</button>
                  <button type="button" onClick={() => handleCopy(table)} disabled={!table.tableAccessUrl} aria-label={`Sao chép địa chỉ của ${tableLabel}`}>
                    {copiedTableId === table.id ? "Đã sao chép" : "Sao chép"}
                  </button>
                  <button type="button" onClick={() => handlePrint(table)} disabled={!table.tableQrCodeDataUrl} aria-label={`In mã QR của ${tableLabel}`}>In mã</button>
                  <button type="button" className="danger" onClick={() => handleRevoke(table)} disabled={isMutating || !table.tableAccessUrl} aria-label={`Thu hồi mã QR của ${tableLabel}`}>Thu hồi</button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
