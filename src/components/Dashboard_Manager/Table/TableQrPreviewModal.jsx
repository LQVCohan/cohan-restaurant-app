import React from "react";
import Modal from "../../common/Modal";
import "./TableQrPreviewModal.scss";

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
  return Number.isNaN(date.getTime()) ? "Không xác định" : dateTimeFormatter.format(date);
};

const getQrState = (table) => {
  if (!table?.tableAccessUrl || !table?.tableQrCodeDataUrl) return "missing";
  if (table.tableQrExpiresAt && new Date(table.tableQrExpiresAt).getTime() <= Date.now()) return "expired";
  return "ready";
};

const getQrLabel = (state) =>
  state === "ready" ? "Đang hoạt động" : state === "expired" ? "Hết hạn" : "Chưa tạo";

export default function TableQrPreviewModal({
  table,
  copied = false,
  onClose,
  onCopy,
  onOpen,
  onPrint,
}) {
  if (!table?.tableQrCodeDataUrl) return null;

  const qrState = getQrState(table);
  const tableCode = table.code || "--";

  return (
    <Modal
      isOpen={Boolean(table)}
      onClose={onClose}
      title={`Mã QR bàn ${tableCode}`}
      size="md"
      className="table-qr-preview-modal"
    >
      <div className="table-qr-preview">
        <div className="table-qr-preview__identity">
          <div>
            <span>Tầng {table.floorLevel || "?"}</span>
            <strong>Bàn {tableCode}</strong>
            <small>{table.capacity || 0} chỗ</small>
          </div>
          <span className={`table-qr-preview__status table-qr-preview__status--${qrState}`}>
            {getQrLabel(qrState)}
          </span>
        </div>

        <div className="table-qr-preview__canvas">
          <img
            src={table.tableQrCodeDataUrl}
            alt={`Mã QR phóng to để truy cập bàn ${tableCode}`}
            width="420"
            height="420"
          />
          <p>Đưa camera điện thoại vào mã để kiểm tra khả năng quét trước khi in.</p>
        </div>

        <dl className="table-qr-preview__details">
          <div>
            <dt>Ngày tạo</dt>
            <dd>{formatDateTime(table.tableQrGeneratedAt)}</dd>
          </div>
          <div>
            <dt>Hết hạn</dt>
            <dd>{formatDateTime(table.tableQrExpiresAt)}</dd>
          </div>
          {table.tableAccessUrl && (
            <div className="table-qr-preview__url">
              <dt>Địa chỉ truy cập</dt>
              <dd><code>{table.tableAccessUrl}</code></dd>
            </div>
          )}
        </dl>

        <div className="table-qr-preview__actions">
          <button type="button" onClick={() => onCopy?.(table)} disabled={!table.tableAccessUrl}>
            {copied ? "Đã sao chép" : "Sao chép liên kết"}
          </button>
          <button type="button" onClick={() => onOpen?.(table)} disabled={!table.tableAccessUrl}>
            Mở trang bàn
          </button>
          <button type="button" className="primary" onClick={() => onPrint?.(table)}>
            In mã QR
          </button>
        </div>
      </div>
    </Modal>
  );
}
