import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { gql, useMutation } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import cls from "./RightPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { useNotification } from "../../../../../hooks/useNotification";
import { formatPrice } from "@/utils/formatters";
import { PRINT_STATIONS } from "@/utils/printStations";

import PaymentModal from "../modals/PaymentModal";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";
import MenuItemModal from "../modals/MenuItemModal";
import OrderConfirmModal from "../modals/OrderConfirmModal";
import { PrintModal } from "../modals/PrintModal";
import { PrintQueueModal } from "../modals/PrintQueueModal";

const IconDraft = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconImage = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ verticalAlign: "middle" }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const IconSettings = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);

const IconTrash = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const IconDashboard = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7"></rect>
    <rect x="14" y="3" width="7" height="7"></rect>
    <rect x="14" y="14" width="7" height="7"></rect>
    <rect x="3" y="14" width="7" height="7"></rect>
  </svg>
);

const IconOrderList = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 6h11"></path>
    <path d="M9 12h11"></path>
    <path d="M9 18h11"></path>
    <path d="M5 6v.01"></path>
    <path d="M5 12v.01"></path>
    <path d="M5 18v.01"></path>
  </svg>
);

const DRAFT_KEY_PREFIX = "pos_draft_items_v1";

const PRIORITY_LABELS = {
  HIGH: "Ưu tiên cao",
  MEDIUM: "Ưu tiên vừa",
  LOW: "Ưu tiên thấp",
};


const M_ENQUEUE_PRINT_JOB = gql`
  mutation EnqueuePrintJob($input: EnqueuePrintJobInput!) {
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

export default function RightPanel() {
  const navigate = useNavigate();
  const {
    restaurantId,
    currentTable,
    currentOrder,
    currentOrderType,
    currentOrderCode,

    shippingInfo,
    deliveryCustomer,

    updateItemQty,
    removeItem,
    finalTotals,
    clearOrder,
    saveOrder,
    setTableStatus,
    setCurrentTable,
    preparePayment,
    printers,
    printStations,
    setPrintQueue,
    printQueue,
    selectedPrinter,
    setSelectedPrinter,
    menuItems,
  } = usePos();

  const { showNotification } = useNotification?.() || {
    showNotification: (msg, type) => console.log(type || "info", msg),
  };

  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);

  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isClearModalOpen, setClearModalOpen] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPrintModalOpen, setPrintModalOpen] = useState(false);
  const [isPrintQueueOpen, setPrintQueueOpen] = useState(false);
  const [printMode, setPrintMode] = useState("temp");
  const [enqueuePrintJob] = useMutation(M_ENQUEUE_PRINT_JOB);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const hasItems = Array.isArray(currentOrder) && currentOrder.length > 0;
  const printerList = useMemo(
    () => Object.values(printers || {}),
    [printers]
  );

  useEffect(() => {
    if (!selectedPrinter && printerList.length) {
      setSelectedPrinter(printerList[0]);
    }
  }, [printerList, selectedPrinter, setSelectedPrinter]);

  const { existingItems, newItems } = useMemo(() => {
    const ex = [];
    const nw = [];
    (currentOrder || []).forEach((it) => {
      if (it?.isNew) nw.push(it); // ✅ chỉ isNew mới là món nháp
      else if (it?.isExisting)
        ex.push(it); // ✅ còn lại, nếu isExisting thì là đã lưu
      else nw.push(it);
    });
    return { existingItems: ex, newItems: nw };
  }, [currentOrder]);

  const isOffPremise =
    currentOrderType === "delivery" || currentOrderType === "takeaway";

  const offPremiseKind = currentOrderType === "delivery" ? "SHIP" : "TAKE";

  const draftKey = useMemo(() => {
    const code = currentOrderCode || "";
    if (!code) return null;
    return `${DRAFT_KEY_PREFIX}:${restaurantId || "na"}:${code}`;
  }, [restaurantId, currentOrderCode]);

  useEffect(() => {
    if (!draftKey) return;
    try {
      const payload = JSON.parse(localStorage.getItem(draftKey) || "null");
      const saved = Array.isArray(payload?.items) ? payload.items : [];
      if (!saved.length) return;

      const currentHasNew = (newItems || []).length > 0;
      if (currentHasNew) return;

      const safe = saved
        .filter((x) => x && (x.isNew || (!x.isExisting && x.isNew !== false)))
        .map((x) => ({
          ...x,
          isNew: true,
          isExisting: false,
        }));

      if (!safe.length) return;

      showNotification("Đã khôi phục món nháp (draft).", "info", 2500);

      // NOTE: autosave/restore chuẩn nhất nên thực hiện trong PosContext
      // vì RightPanel không có quyền setCurrentOrder ở phiên bản này.
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    try {
      const toSave = (newItems || []).map((x) => ({
        ...x,
        isNew: true,
        isExisting: false,
      }));
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          at: Date.now(),
          items: toSave,
        })
      );
    } catch {}
  }, [draftKey, newItems]);

  const clearDraft = useCallback(() => {
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey]);

  const getItemPrice = (item) => formatPrice(Number(item.price || 0));
  const getItemTotal = (item) => {
    const t =
      item.total != null
        ? Number(item.total)
        : Number(item.price || 0) * Number(item.quantity || 1);
    return formatPrice(t);
  };

  const formatTime = (dateInput) => {
    if (!dateInput) return "";
    let dateObj;
    if (typeof dateInput === "string" && /^\d+$/.test(dateInput)) {
      dateObj = new Date(parseInt(dateInput, 10));
    } else {
      dateObj = new Date(dateInput);
    }
    if (isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const headerTitle = useMemo(() => {
    if (currentOrderType === "dine_in") {
      if (currentTable?.code) return `Bàn ${currentTable.code}`;
      return "Chọn bàn";
    }

    if (currentOrderCode) return currentOrderCode;

    return currentOrderType === "delivery"
      ? "Đơn giao hàng"
      : currentOrderType === "takeaway"
      ? "Đơn mang về"
      : "Đơn hàng";
  }, [currentOrderCode, currentOrderType, currentTable?.code]);

  const headerMeta = useMemo(() => {
    if (isOffPremise) {
      const name = (
        shippingInfo?.fullName ||
        deliveryCustomer?.name ||
        ""
      ).trim();
      const phone = (
        shippingInfo?.phone ||
        deliveryCustomer?.phone ||
        ""
      ).trim();
      const addr = (shippingInfo?.address || "").trim();

      return {
        line1:
          name || phone
            ? `${name || "Khách"}${phone ? ` · ${phone}` : ""}`
            : "",
        line2: addr || "Chưa có địa chỉ",
      };
    }

    if (currentTable) {
      return {
        line1: `${currentTable.capacity || 0} chỗ`,
        line2: currentTable.status || "available",
      };
    }

    return {
      line1: "Chưa chọn bàn",
      line2: "",
    };
  }, [isOffPremise, shippingInfo, deliveryCustomer, currentTable]);

  const totals = finalTotals || {};
  const breakdownConfig = [
    { key: "subtotal", label: "Tạm tính", cls: "" },
    { key: "discount", label: "Giảm giá", cls: "neg" },
    { key: "service", label: "Phí phục vụ", cls: "" },
    { key: "tax", label: "Thuế", cls: "" },
  ];

  const breakdownRows = breakdownConfig
    .filter(({ key }) => totals[key] !== undefined && totals[key] !== null)
    .map(({ key, label, cls: c }) => ({
      label,
      value: totals[key],
      clsName: c,
    }));

  const closePaymentModal = useCallback(() => setPaymentModalOpen(false), []);

  const openPaymentModal = useCallback(async () => {
    if (!hasItems) return;

    if (!currentTable?.restaurantId) {
      showNotification("Thiếu restaurantId.", "error");
      return;
    }

    const res = await preparePayment?.({
      restaurantId: currentTable.restaurantId,
    });

    if (!res?.success) {
      showNotification(
        res?.message || "Chuẩn bị thanh toán thất bại.",
        "error"
      );
      return;
    }

    setPaymentModalOpen(true);
  }, [hasItems, currentTable, preparePayment, showNotification]);

  const handlePaymentComplete = useCallback(
    (payload) => {
      showNotification("Thanh toán thành công.", "success");
      const inv =
        payload?.server?.invoice?.number || payload?.server?.invoice?.id;
      if (inv) showNotification(`Hóa đơn: ${inv}`, "info");

      clearDraft();

      clearOrder();
      if (currentTable?.id && setTableStatus) {
        setTableStatus({ id: currentTable.id, status: "available" });
      }
      if (setCurrentTable) setCurrentTable(null);

      setPaymentModalOpen(false);
    },
    [
      clearOrder,
      currentTable,
      setTableStatus,
      setCurrentTable,
      showNotification,
      clearDraft,
    ]
  );

  const handleQtyChange = (e, item, change) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) return;

    const next = Math.max(1, Number(item.quantity || 1) + change);
    updateItemQty(item._lineId || item.dishId || item.id, next);
  };

  const handleQtyInput = (e, item) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) return;

    const v = Math.max(1, Number(e.target.value) || 1);
    updateItemQty(item._lineId || item.dishId || item.id, v);
  };

  const handleDeleteClick = (e, item) => {
    e.stopPropagation();
    if (item.isExisting && !item.isNew) {
      showNotification(
        "Không thể xóa món đã lưu. Chỉ xóa món nháp (draft).",
        "warning"
      );
      return;
    }
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleDeleteItem = (_action, _selectedReason) => {
    if (!itemToDelete) return;
    if (itemToDelete.isExisting && !itemToDelete.isNew) {
      showNotification("Không thể xóa món đã lưu.", "warning");
      setDeleteModalOpen(false);
      setItemToDelete(null);
      return;
    }
    removeItem(itemToDelete._lineId || itemToDelete.dishId || itemToDelete.id);
    setDeleteModalOpen(false);
    setItemToDelete(null);
    showNotification("Đã xóa món", "info");
  };

  const handleClearConfirm = (action) => {
    if (action === "clear_table") {
      clearDraft();
      clearOrder();
      if (currentTable?.id && setTableStatus) {
        setTableStatus({ id: currentTable.id, status: "available" });
      }
      if (setCurrentTable) setCurrentTable(null);
      showNotification(
        currentTable?.code
          ? `Đã xóa thông tin bàn ${currentTable.code}`
          : "Đã xóa đơn"
      );
    } else {
      clearDraft();
      clearOrder();
      showNotification("Đã xóa tất cả món (giữ thông tin bàn/đơn)");
    }
    setClearModalOpen(false);
  };

  const resolveStationId = useCallback(
    (item) => {
      const itemId =
        item?.menuItem?.id || item?.dishId || item?.id || item?.menuItemId;
      const matched = (menuItems || []).find(
        (m) => String(m.id) === String(itemId)
      );
      return matched?.printStationId || "kitchen";
    },
    [menuItems]
  );

  const buildPreview = useCallback((items, title) => {
    const lines = [];
    if (title) lines.push(title);
    items.forEach((item) => {
      const qty = Number(item.quantity || 0);
      const name = item.name || item.menuItem?.name || "Món";
      const note = item.note ? ` (${item.note})` : "";
      lines.push(`${qty} x ${name}${note}`);
    });
    return lines.join("\n");
  }, []);

  const tempPreview = useMemo(() => {
    if (!hasItems) return "Không có món để in.";
    return buildPreview(currentOrder, "Tạm tính");
  }, [buildPreview, currentOrder, hasItems]);

  const stationPreviews = useMemo(() => {
    const groups = {};
    (currentOrder || []).forEach((item) => {
      const stationId = resolveStationId(item);
      if (!groups[stationId]) groups[stationId] = [];
      groups[stationId].push(item);
    });
    return PRINT_STATIONS.map((station) => {
      const items = groups[station.id] || [];
      const mappedPrinters = (printStations?.[station.id] || [])
        .map((pid) => printers?.[pid])
        .filter(Boolean);
      const fallbackPrinters = mappedPrinters;
      return {
        id: station.id,
        label: station.label,
        preview: items.length
          ? buildPreview(items, station.label)
          : "",
        printers: fallbackPrinters,
        items,
      };
    });
  }, [
    buildPreview,
    currentOrder,
    printers,
    printStations,
    resolveStationId,
  ]);

  const toLocalQueueJob = useCallback(
    ({ source, statusOverride }) => ({
      id: source.id,
      label: source.stationId
        ? PRINT_STATIONS.find((s) => s.id === source.stationId)?.label || source.printType
        : source.printType,
      printerId: source.printerId || null,
      printerName: source.printerName || null,
      count: Number(source?.payload?.count || 0),
      items: source?.payload?.items || [],
      table: source?.payload?.table || currentTable?.code || "Đơn",
      status: statusOverride || source.status || "pending",
      type: source.printType,
    }),
    [currentTable?.code]
  );

  const persistPrintJobs = useCallback(
    async ({ mode, status }) => {
      if (!restaurantId) {
        showNotification("Thiếu restaurantId để tạo print job.", "error");
        return [];
      }

      const requests = [];
      if (mode === "temp") {
        if (!selectedPrinter) {
          showNotification("Vui lòng chọn máy in tạm tính.", "warning");
          return [];
        }
        requests.push({
          printer: selectedPrinter,
          stationId: "cashier",
          printType: status === "printing" ? "temp_print_now" : "temp_queue",
          templateKey: "receipt",
          payload: { table: currentTable?.code || "Đơn", count: (currentOrder || []).length, items: currentOrder || [] },
        });
      } else {
        stationPreviews.forEach((station) => {
          if (!station.items.length) return;
          if (!station.printers.length) {
            showNotification(`Chưa gán máy in cho ${station.label}.`, "warning");
            return;
          }
          station.printers.forEach((printer) => {
            requests.push({
              printer,
              stationId: station.id,
              printType: status === "printing" ? "station_print_now" : "station_queue",
              templateKey: station.id,
              payload: { table: currentTable?.code || "Đơn", count: station.items.length, items: station.items },
            });
          });
        });
      }

      if (!requests.length) {
        showNotification("Không có món để in.", "warning");
        return [];
      }

      const results = await Promise.all(
        requests.map(async (req) => {
          const res = await enqueuePrintJob({
            variables: {
              input: {
                restaurantId,
                printerId: req.printer?.id || null,
                stationId: req.stationId,
                printType: req.printType,
                templateKey: req.templateKey,
                payload: req.payload,
              },
            },
          });
          return toLocalQueueJob({ source: res?.data?.enqueuePrintJob || {}, statusOverride: status });
        })
      );

      setPrintQueue((prev) => [...prev, ...results]);
      return results;
    },
    [
      currentOrder,
      currentTable?.code,
      enqueuePrintJob,
      restaurantId,
      selectedPrinter,
      setPrintQueue,
      showNotification,
      stationPreviews,
      toLocalQueueJob,
    ]
  );

  const handleAddToQueue = useCallback(
    async (mode) => {
      if (!hasItems) return;
      try {
        const jobs = await persistPrintJobs({ mode, status: "pending" });
        if (jobs.length) showNotification("Đã thêm vào hàng đợi in (đã lưu DB).", "success");
      } catch (err) {
        showNotification(err?.message || "Không thể enqueue print job vào DB.", "error");
      }
    },
    [hasItems, persistPrintJobs, showNotification]
  );

  const handlePrintNow = useCallback(
    async (mode) => {
      if (!hasItems) return;
      try {
        const jobs = await persistPrintJobs({ mode, status: "printing" });
        if (jobs.length) {
          showNotification(
            mode === "temp" ? "Đang in tạm tính (DB job simulated)..." : "Đang in theo quầy (DB job simulated)...",
            "info"
          );
        }
      } catch (err) {
        showNotification(err?.message || "Không thể tạo print job để in ngay.", "error");
      }
    },
    [hasItems, persistPrintJobs, showNotification]
  );

  const handleItemClick = (item) => {
    const modalItemData = {
      ...item,
      id: item.dishId || item.id,
      thumbImage: item.image,
    };
    setSelectedDetailItem(modalItemData);
    setDetailModalOpen(true);
  };

  const validateBeforeConfirm = useCallback(() => {
    if (!hasItems) {
      showNotification("Đơn đang trống.", "warning");
      return { ok: false };
    }

    if (newItems.length === 0) {
      showNotification("Không có món mới (draft) để lưu.", "warning");
      return { ok: false };
    }

    if (currentOrderType === "dine_in") {
      if (!currentTable?.code) {
        showNotification("Vui lòng chọn bàn trước khi lưu.", "error");
        return { ok: false };
      }
      return { ok: true };
    }

    const name = (
      shippingInfo?.fullName ||
      deliveryCustomer?.name ||
      ""
    ).trim();
    const phone = (shippingInfo?.phone || deliveryCustomer?.phone || "").trim();
    const addr = (shippingInfo?.address || "").trim();

    if (!name && !phone) {
      showNotification(
        "Vui lòng chọn/nhập thông tin khách hàng trước khi lưu.",
        "error"
      );
      return { ok: false };
    }

    if (currentOrderType === "delivery") {
      if (!addr) {
        showNotification("Đơn giao hàng bắt buộc phải có địa chỉ.", "error");
        return { ok: false };
      }
    }

    if (!currentOrderCode) {
      showNotification(
        "Thiếu currentOrderCode. Vui lòng tạo đơn mới.",
        "error"
      );
      return { ok: false };
    }

    return { ok: true };
  }, [
    hasItems,
    newItems.length,
    currentOrderType,
    currentTable?.code,
    shippingInfo,
    deliveryCustomer,
    currentOrderCode,
    showNotification,
  ]);

  const handleOpenConfirm = useCallback(() => {
    const v = validateBeforeConfirm();
    if (!v.ok) return;
    setConfirmOpen(true);
  }, [validateBeforeConfirm]);

  const handleConfirmSave = useCallback(async () => {
    if (saving) return;

    const v = validateBeforeConfirm();
    if (!v.ok) return;

    setSaving(true);
    try {
      const res = await saveOrder?.({ persist: true });

      if (res?.success) {
        setPulse(true);
        setTimeout(() => setPulse(false), 650);

        clearDraft();

        if (currentOrderType === "dine_in" && currentTable?.code) {
          showNotification(
            `Đã lưu vào bàn ${currentTable.code}`,
            "success",
            2500
          );
        } else if (currentOrderType === "delivery") {
          showNotification(
            `Đã lưu đơn giao hàng (${currentOrderCode})`,
            "success",
            2500
          );
        } else if (currentOrderType === "takeaway") {
          showNotification(
            `Đã lưu đơn mang về (${currentOrderCode})`,
            "success",
            2500
          );
        } else {
          showNotification("Đã lưu đơn.", "success", 2500);
        }

        setConfirmOpen(false);
      } else {
        if (Array.isArray(res?.errors) && res.errors.length > 0) {
          res.errors.forEach((msg) =>
            showNotification(String(msg), "error")
          );
          console.error("POS save errors:", res.errors);
        }
        showNotification(res?.message || "Lưu đơn thất bại.", "error");
      }
    } catch (e) {
      console.error("POS save exception:", e);
      showNotification(e?.message || "Lưu đơn thất bại.", "error");
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    validateBeforeConfirm,
    saveOrder,
    clearDraft,
    currentOrderType,
    currentTable?.code,
    currentOrderCode,
    showNotification,
  ]);

  const saveDisabled =
    saving ||
    !hasItems ||
    newItems.length === 0 ||
    (isOffPremise && !currentOrderCode);

  return (
    <div
      className={`${cls.wrapper} ${pulse ? cls.pulse : ""}`}
      data-pos-order-panel
      data-kind={isOffPremise ? offPremiseKind : "DINE"}
    >
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={closePaymentModal}
        totalAmount={finalTotals?.total || 0}
        order={currentOrder}
        table={currentTable}
        onConfirm={() => {}}
        onComplete={handlePaymentComplete}
      />

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteItem}
        requireReason={false}
      />

      <ConfirmDeleteModal
        isOpen={isClearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearConfirm}
        showScopeChoice={true}
      />

      <MenuItemModal
        isOpen={detailModalOpen}
        item={selectedDetailItem}
        onClose={() => setDetailModalOpen(false)}
        isReviewMode={true}
      />

      <OrderConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        isSaving={saving}
        orderType={currentOrderType}
        orderCode={currentOrderCode}
        tableCode={currentTable?.code || null}
        totals={finalTotals}
        newItems={newItems}
        customer={{
          name: (shippingInfo?.fullName || deliveryCustomer?.name || "").trim(),
          phone: (shippingInfo?.phone || deliveryCustomer?.phone || "").trim(),
          email: (shippingInfo?.email || deliveryCustomer?.email || "").trim(),
        }}
        address={(shippingInfo?.address || "").trim()}
      />

      <div className={cls.header}>
        <div className={cls.headerLeft}>
          <div className={cls.tableName}>{headerTitle}</div>

          <div className={cls.tableMeta}>
            {headerMeta.line1}
            {headerMeta.line1 && headerMeta.line2 ? " · " : ""}
            <span className={cls.statusBadge}>{headerMeta.line2}</span>
          </div>

          {newItems.length > 0 && (
            <div className={cls.draftLegend}>
              <span className={cls.legendIcon}>
                <IconDraft />
              </span>
              <span className={cls.legendText}>Món mới (chưa lưu)</span>
            </div>
          )}
        </div>

        <div className={cls.headerRight}>
          <div className={cls.menuWrapper} ref={menuRef}>
            <button
              className={`${cls.manageBtn} ${isMenuOpen ? cls.active : ""}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              title="Tùy chọn quản lý"
            >
              <IconSettings /> Quản lý
            </button>
            {isMenuOpen && (
              <div className={cls.dropdownMenu}>
                <div
                  className={cls.dropdownItem}
                  onClick={() => handleMenuNavigate("/manager")}
                >
                  <IconDashboard /> Dashboard
                </div>
                <div
                  className={cls.dropdownItem}
                  onClick={() => handleMenuNavigate("/manager#orders")}
                >
                  <IconOrderList /> Order
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cls.body}>
        {newItems.length > 0 && (
          <div className={cls.sectionNew}>
            <div className={cls.groupHeader}>Món mới ({newItems.length})</div>
            <div className={cls.itemsList}>
              {newItems.map((item) => (
                <div
                  key={item._lineId || item.dishId || item.id}
                  className={`${cls.cardNew} ${cls.cardNewAnim}`}
                  onClick={() => handleItemClick(item)}
                >
                  {item.isNew && (
                    <span className={cls.draftBadge} title="Món mới – chưa lưu">
                      <IconDraft />
                    </span>
                  )}

                  <div className={cls.rowTop}>
                    <div className={cls.cardName}>
                      {item.name}
                      {item.proofImages && item.proofImages.length > 0 && (
                        <span className={cls.iconProof} title="Có ảnh xác nhận">
                          <IconImage />
                        </span>
                      )}
                    </div>

                    <button
                      className={cls.btnDelete}
                      onClick={(e) => handleDeleteClick(e, item)}
                      title="Xóa"
                    >
                      <IconTrash />
                    </button>
                  </div>

                  {(item.method || item.cookingOption || item.note || item.priority) && (
                    <div className={cls.rowNote}>
                      {item.method || item.cookingOption ? (
                        <span className={cls.tagMethod}>
                          {item.method || item.cookingOption}
                        </span>
                      ) : null}
                      {item.priority && (
                        <span className={cls.tagMethod}>
                          {PRIORITY_LABELS[String(item.priority).toUpperCase()] || item.priority}
                        </span>
                      )}
                      {item.note && (
                        <span className={cls.textNote}>{item.note}</span>
                      )}
                    </div>
                  )}

                  <div className={cls.rowBottom}>
                    <div className={cls.priceSingle}>{getItemPrice(item)}</div>

                    <div
                      className={cls.qtyWrapper}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={cls.qtyBtn}
                        onClick={(e) => handleQtyChange(e, item, -1)}
                      >
                        −
                      </button>
                      <input
                        className={cls.qtyInput}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQtyInput(e, item)}
                      />
                      <button
                        className={cls.qtyBtn}
                        onClick={(e) => handleQtyChange(e, item, +1)}
                      >
                        +
                      </button>
                    </div>

                    <div className={cls.cardTotal}>{getItemTotal(item)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {existingItems.length > 0 && (
          <div className={cls.sectionExisting}>
            <div className={cls.dividerLabel}>
              Đã gửi bếp ({existingItems.length})
            </div>
            <div className={cls.itemsList}>
              {existingItems.map((item) => (
                <div
                  key={item._lineId || item.dishId || item.id}
                  className={cls.cardExisting}
                  onClick={() => handleItemClick(item)}
                >
                  <div className={cls.rowTop}>
                    <div className={cls.cardName}>
                      {item.name}
                      {item.proofImages && item.proofImages.length > 0 && (
                        <span className={cls.iconProof} title="Có ảnh xác nhận">
                          <IconImage />
                        </span>
                      )}
                    </div>
                    {item.createdAt && (
                      <span className={cls.timeTag}>
                        {formatTime(item.createdAt)}
                      </span>
                    )}
                  </div>

                  {(item.note || item.method || item.cookingOption || item.priority) && (
                    <div className={cls.rowNote}>
                      {(item.method || item.cookingOption) && (
                        <span className={cls.tagMethod}>
                          {item.method || item.cookingOption}
                        </span>
                      )}
                      {item.priority && (
                        <span className={cls.tagMethod}>
                          {PRIORITY_LABELS[String(item.priority).toUpperCase()] || item.priority}
                        </span>
                      )}
                      {item.note && (
                        <span className={cls.textNoteSaved}>{item.note}</span>
                      )}
                    </div>
                  )}

                  <div className={cls.rowBottom}>
                    <div className={cls.priceSingle}>{getItemPrice(item)}</div>
                    <div className={cls.qtyStatic}>x{item.quantity}</div>
                    <div className={cls.cardTotal}>{getItemTotal(item)}</div>

                    <button
                      className={cls.btnDeleteSavedDisabled}
                      onClick={(e) => handleDeleteClick(e, item)}
                      title="Không thể xóa món đã lưu"
                      disabled
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasItems && (
          <div className={cls.emptyState}>
            <p>Trống</p>
          </div>
        )}
      </div>

      <div className={cls.footer}>
        <div className={cls.summary}>
          <div className={cls.row}>
            <span>Tạm tính:</span>
            <strong>{formatPrice(finalTotals?.subtotal || 0)}</strong>
          </div>

          <button
            type="button"
            className={cls.breakdownToggle}
            onClick={() => setShowBreakdown((v) => !v)}
          >
            {showBreakdown ? "Thu gọn ▲" : "Chi tiết ▼"}
          </button>

          {showBreakdown && (
            <div id="totals-breakdown" className={cls.breakdown}>
              {breakdownRows.map((r) => (
                <div
                  key={r.label}
                  className={`${cls.breakdownRow} ${cls[r.clsName] || ""}`}
                >
                  <span>{r.label}</span>
                  <span>{formatPrice(Number(r.value) || 0)}</span>
                </div>
              ))}
              <div className={cls.hr} />
            </div>
          )}

          <div className={`${cls.row} ${cls.grand}`}>
            <span>Tổng cộng:</span>
            <strong>{formatPrice(finalTotals?.total || 0)}</strong>
          </div>
        </div>

        <div className={cls.actionsGrid}>
          <button
            className={`${cls.btn} ${cls.secondary}`}
            onClick={() => setClearModalOpen(true)}
            disabled={!hasItems || saving}
          >
            Xóa
          </button>

          <button
            className={`${cls.btn} ${cls.primary}`}
            onClick={handleOpenConfirm}
            disabled={saveDisabled}
            aria-busy={saving}
            title={
              !hasItems
                ? "Đơn trống"
                : newItems.length === 0
                ? "Không có món nháp để lưu"
                : saving
                ? "Đang lưu..."
                : ""
            }
          >
            {saving ? (
              <span className={cls.btnLoading}>
                <span className={cls.spinner} />
                Đang lưu...
              </span>
            ) : (
              "Lưu"
            )}
          </button>

          <button
            className={`${cls.btn} ${cls.success}`}
            disabled={!hasItems || saving}
            onClick={openPaymentModal}
          >
            Thanh toán
          </button>

          <button
            className={`${cls.btn} ${cls.warning}`}
            onClick={() => setPrintModalOpen(true)}
            disabled={!hasItems || saving}
          >
            In
          </button>
        </div>
      </div>

      <PrintModal
        isOpen={isPrintModalOpen}
        mode={printMode}
        printers={printerList}
        selectedPrinter={selectedPrinter}
        tempPreview={tempPreview}
        stationPreviews={stationPreviews}
        onChangeMode={setPrintMode}
        onPickPrinter={setSelectedPrinter}
        onAddQueue={() => handleAddToQueue(printMode)}
        onPrintNow={() => handlePrintNow(printMode)}
        onOpenQueue={() => setPrintQueueOpen(true)}
        onClose={() => setPrintModalOpen(false)}
      />

      <PrintQueueModal
        isOpen={isPrintQueueOpen}
        queue={printQueue}
        onClearAll={() => setPrintQueue([])}
        onPrintAll={() => handlePrintNow("stations")}
        onClose={() => setPrintQueueOpen(false)}
      />
    </div>
  );
}
