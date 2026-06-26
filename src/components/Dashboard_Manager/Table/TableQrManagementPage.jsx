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

const formatDateTime = (value) => {
  if (!value) return "Chưa tạo";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  if (state === "ready") return "Đang dùng được";
  if (state === "expired") return "Đã hết hạn";
  return "Chưa sinh QR";
};

export default function TableQrManagementPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const restaurantList = useMemo(() => restaurants || [], [restaurants]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [busyTableId, setBusyTableId] = useState("");

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

  const handleGenerate = async (table) => {
    if (!table?.id || busyTableId) return;
    setBusyTableId(table.id);
    try {
      await generateTableQr({
        variables: {
          input: {
            tableId: table.id,
            baseUrl: window.location.origin,
          },
        },
      });
      await refetch?.();
      showNotification("Đã sinh QR truy cập bàn.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể sinh QR bàn.", "error");
    } finally {
      setBusyTableId("");
    }
  };

  const handleRevoke = async (table) => {
    if (!table?.id || busyTableId) return;
    setBusyTableId(table.id);
    try {
      await revokeTableQr({ variables: { tableId: table.id } });
      await refetch?.();
      showNotification("Đã thu hồi QR bàn.", "success");
    } catch (err) {
      showNotification(err?.message || "Không thể thu hồi QR bàn.", "error");
    } finally {
      setBusyTableId("");
    }
  };

  const handleCopy = async (table) => {
    if (!table?.tableAccessUrl) return;
    try {
      await navigator.clipboard.writeText(table.tableAccessUrl);
      showNotification("Đã sao chép link bàn.", "success");
    } catch {
      showNotification("Không thể sao chép tự động, vui lòng copy thủ công.", "warning");
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
      showNotification("Trình duyệt đã chặn cửa sổ in QR.", "warning");
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>QR bàn ${table.code || ""}</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:28px;color:#1f2937}img{width:320px;height:320px}p{color:#4b5563;word-break:break-word}.card{border:1px solid #ddd;border-radius:20px;padding:24px;display:inline-block}</style></head><body><div class="card"><h1>Bàn ${table.code || "--"}</h1><p>Quét QR để xem món đã gọi, gọi nhân viên và gọi thanh toán.</p><img src="${table.tableQrCodeDataUrl}" alt="QR bàn ${table.code || ""}"/><p>${table.tableAccessUrl || ""}</p></div><script>window.onload=()=>window.print()</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="table-qr-page">
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="QR BÀN KHÁCH"
        title="QR truy cập bàn"
        subtitle="Sinh QR để khách quét tại bàn, xem order hiện tại, gọi nhân viên và yêu cầu thanh toán."
        icon="📱"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantList.map((restaurant) => ({ id: String(restaurant.id || restaurant.restaurantId), name: restaurant.name }))}
        stats={[
          { id: "tables", icon: "🪑", label: "Tổng bàn", value: tables.length },
          { id: "ready", icon: "✅", label: "QR đang dùng", value: readyCount },
          { id: "expired", icon: "⏳", label: "QR hết hạn", value: expiredCount },
        ]}
        loading={loading}
        primaryAction={{ label: "Làm mới", icon: "↻", onClick: () => refetch?.(), disabled: !selectedRestaurantId }}
      />

      <section className="table-qr-flow-card" aria-label="Luồng quét QR tại bàn">
        <strong>Luồng sử dụng</strong>
        <span>1. Quản lý sinh QR cho bàn</span>
        <span>2. In/dán QR tại bàn</span>
        <span>3. Khách quét QR mở trang bàn public</span>
        <span>4. Khách xem món, gọi nhân viên hoặc gọi thanh toán</span>
      </section>

      {error ? (
        <section className="table-qr-state" role="alert">Không thể tải danh sách bàn. Vui lòng thử lại.</section>
      ) : loading && !tables.length ? (
        <section className="table-qr-state">Đang tải danh sách bàn...</section>
      ) : !tables.length ? (
        <section className="table-qr-state">Chưa có bàn để sinh QR.</section>
      ) : (
        <section className="table-qr-grid" aria-label="Danh sách QR theo bàn">
          {tables.map((table) => {
            const qrState = getTableQrState(table);
            const isBusy = busyTableId === table.id;
            return (
              <article className={`table-qr-card table-qr-card--${qrState}`} key={table.id}>
                <div className="table-qr-card__head">
                  <div>
                    <p>Tầng {table.floorLevel || "?"}</p>
                    <h3>Bàn {table.code || "--"}</h3>
                  </div>
                  <span>{getTableQrLabel(qrState)}</span>
                </div>

                <div className="table-qr-card__body">
                  {table.tableQrCodeDataUrl ? (
                    <img src={table.tableQrCodeDataUrl} alt={`QR truy cập bàn ${table.code || ""}`} />
                  ) : (
                    <div className="table-qr-card__placeholder">QR</div>
                  )}
                  <div className="table-qr-card__meta">
                    <p><strong>Tạo lúc:</strong> {formatDateTime(table.tableQrGeneratedAt)}</p>
                    <p><strong>Hết hạn:</strong> {formatDateTime(table.tableQrExpiresAt)}</p>
                    {table.tableAccessUrl && <code>{table.tableAccessUrl}</code>}
                  </div>
                </div>

                <div className="table-qr-card__actions">
                  <button type="button" onClick={() => handleGenerate(table)} disabled={isBusy}>
                    {isBusy ? "Đang xử lý..." : qrState === "ready" ? "Sinh lại QR" : "Sinh QR"}
                  </button>
                  <button type="button" onClick={() => handleOpen(table)} disabled={!table.tableAccessUrl}>Mở link</button>
                  <button type="button" onClick={() => handleCopy(table)} disabled={!table.tableAccessUrl}>Copy link</button>
                  <button type="button" onClick={() => handlePrint(table)} disabled={!table.tableQrCodeDataUrl}>In QR</button>
                  <button type="button" className="danger" onClick={() => handleRevoke(table)} disabled={isBusy || !table.tableAccessUrl}>Thu hồi</button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
