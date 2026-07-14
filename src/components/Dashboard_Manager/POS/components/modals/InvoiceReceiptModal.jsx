import React, { memo, useMemo, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import s from "./InvoiceReceiptModal.module.scss";
import { formatPrice } from "@/utils/formatters";

const ENQUEUE_INVOICE_PRINT_JOB = gql`
  mutation EnqueueInvoicePrintJob($input: EnqueuePrintJobInput!) {
    enqueuePrintJob(input: $input) {
      id
      printerId
      printerName
      stationId
      printType
      templateKey
      status
      error
      retryCount
      payload
      createdAt
    }
  }
`;

const toNumber = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const lineName = (line) =>
  line?.name || line?.itemName || line?.dishName || line?.menuItemName || "Món";

const lineQuantity = (line) =>
  toNumber(line?.quantity ?? line?.qty ?? line?.count ?? 1) || 1;

const lineSubtotal = (line) => {
  const explicit = line?.subtotal ?? line?.lineSubtotal ?? line?.total;
  if (explicit != null) return toNumber(explicit);

  return (
    (toNumber(line?.unitPrice ?? line?.price ?? line?.basePrice) +
      toNumber(line?.modifiersPrice)) *
    lineQuantity(line)
  );
};

function InvoiceReceiptModal({
  isOpen,
  receiptData,
  restaurantId,
  table,
  fallbackItems = [],
  onFinish,
  onClose,
}) {
  const [enqueueInvoicePrintJob] = useMutation(ENQUEUE_INVOICE_PRINT_JOB);
  const [printing, setPrinting] = useState(false);
  const [printMessage, setPrintMessage] = useState("");

  const invoice = receiptData?.server?.invoice || receiptData?.invoice || null;
  const transaction =
    receiptData?.server?.transaction || receiptData?.transaction || null;
  const cashflow = receiptData?.server?.cashflow || receiptData?.cashflow || null;
  const totals = invoice?.totals || {};

  const receiptLines = useMemo(() => {
    if (Array.isArray(invoice?.lines) && invoice.lines.length) {
      return invoice.lines;
    }

    return (fallbackItems || []).map((item) => ({
      name: item?.name,
      quantity: item?.quantity,
      unitPrice: item?.unitPrice ?? item?.price ?? item?.basePrice,
      modifiersPrice: item?.modifiersPrice,
      subtotal: item?.lineSubtotal,
    }));
  }, [fallbackItems, invoice?.lines]);

  if (!isOpen || !receiptData) return null;

  const invoiceNumber = invoice?.number || invoice?.id || "—";
  const issuedAt = invoice?.issuedAt
    ? new Date(invoice.issuedAt).toLocaleString("vi-VN")
    : new Date().toLocaleString("vi-VN");
  const grandTotal = toNumber(
    totals?.grandTotal ?? receiptData?.payableTotalVnd ?? receiptData?.total,
  );
  const paidAmount = toNumber(
    invoice?.paid ?? transaction?.paidAmount ?? receiptData?.paidAmount,
  );
  const discount = toNumber(totals?.discount);
  const method = transaction?.method || receiptData?.method || "cash";
  const displayTable = table?.code || invoice?.tableCode || "—";

  const openBrowserPrint = () => {
    window.setTimeout(() => window.print?.(), 0);
  };

  const handlePrint = async () => {
    if (!restaurantId) {
      openBrowserPrint();
      return;
    }

    setPrinting(true);
    setPrintMessage("");

    try {
      const result = await enqueueInvoicePrintJob({
        variables: {
          input: {
            restaurantId,
            printerId: null,
            stationId: "cashier",
            printType: "invoice_print_now",
            templateKey: "receipt",
            payload: {
              invoice,
              transaction,
              cashflow,
              table,
              payment: receiptData,
            },
          },
        },
      });

      const job = result?.data?.enqueuePrintJob || null;
      if (String(job?.status || "").toLowerCase() === "failed") {
        setPrintMessage(
          job?.error || "Máy in chưa sẵn sàng. Đã mở bản in trình duyệt.",
        );
        openBrowserPrint();
        return;
      }

      setPrintMessage(
        job?.id ? `Đã tạo lệnh in #${job.id}.` : "Đã tạo lệnh in hóa đơn.",
      );
    } catch (error) {
      setPrintMessage(
        error?.message || "Không tạo được lệnh in. Đã mở in trình duyệt.",
      );
      openBrowserPrint();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={s.modal} onClick={(event) => event.stopPropagation()}>
        <button type="button" className={s.closeButton} onClick={onClose}>
          &times;
        </button>

        <div className={s.header}>
          <div>
            <p className={s.kicker}>Thanh toán thành công</p>
            <h3>Hóa đơn {invoiceNumber}</h3>
          </div>
          <span className={s.status}>PAID</span>
        </div>

        <div className={s.metaGrid}>
          <div>
            <span>Bàn</span>
            <strong>{displayTable}</strong>
          </div>
          <div>
            <span>Thời gian</span>
            <strong>{issuedAt}</strong>
          </div>
          <div>
            <span>Phương thức</span>
            <strong>{String(method).toUpperCase()}</strong>
          </div>
        </div>

        <div className={s.lines}>
          {receiptLines.length ? (
            receiptLines.map((line, index) => (
              <div key={`${lineName(line)}_${index}`} className={s.lineRow}>
                <div>
                  <strong>{lineName(line)}</strong>
                  <span>x{lineQuantity(line)}</span>
                </div>
                <b>{formatPrice(lineSubtotal(line))}</b>
              </div>
            ))
          ) : (
            <div className={s.empty}>Không có dòng hóa đơn.</div>
          )}
        </div>

        <div className={s.summary}>
          {discount > 0 && (
            <div>
              <span>Giảm giá</span>
              <b>-{formatPrice(discount)}</b>
            </div>
          )}

          <div className={s.totalRow}>
            <span>Tổng thanh toán</span>
            <b>{formatPrice(grandTotal)}</b>
          </div>

          <div>
            <span>Đã thu</span>
            <b>{formatPrice(paidAmount || grandTotal)}</b>
          </div>

          {receiptData?.change > 0 && (
            <div>
              <span>Tiền thối</span>
              <b>{formatPrice(receiptData.change, { currency: receiptData.currency })}</b>
            </div>
          )}
        </div>

        {printMessage && <div className={s.printMessage}>{printMessage}</div>}

        <div className={s.actions}>
          <button
            type="button"
            className={s.secondary}
            onClick={handlePrint}
            disabled={printing}
          >
            {printing ? "Đang tạo lệnh in..." : "In hóa đơn"}
          </button>

          <button type="button" className={s.primary} onClick={onFinish}>
            Hoàn tất & đóng bàn
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(InvoiceReceiptModal);
