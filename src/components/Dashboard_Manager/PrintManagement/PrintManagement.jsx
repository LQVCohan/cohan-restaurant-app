import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { hasPermission } from "@/utils/frontendPermissionAccess";
import { PRINT_STATIONS } from "@/utils/printStations";
import { getPrintSettingActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import { PrinterSettingsModal } from "@/components/Dashboard_Manager/POS/components/modals/PrinterSettingsModal";
import {
  Printer,
  Settings,
  Wifi,
  Activity,
  Trash2,
  Server,
  Check,
  Power,
  RotateCcw,
  FileText,
  Send,
} from "lucide-react";
import "./PrintManagement.scss";
import "./PrintManagementPolish.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";

const DEFAULT_TEMPLATES = [
  {
    key: "kitchen",
    name: "Phiếu bếp",
    enabled: true,
    content: "[KITCHEN] {{orderCode}}",
  },
  {
    key: "bar",
    name: "Phiếu bar",
    enabled: true,
    content: "[BAR] {{orderCode}}",
  },
  {
    key: "receipt",
    name: "Hóa đơn",
    enabled: true,
    content: "[RECEIPT] {{orderCode}}",
  },
];

const PRINT_OPERATION_STEPS = [
  "Thêm máy in",
  "Kiểm tra cấu hình mô phỏng",
  "Gán trạm bếp/bar/thu ngân",
  "Theo dõi và gửi lại lệnh lỗi",
];

const Q_PRINT_SETTINGS = gql`
  query PrintSettings($restaurantId: ID!) {
    printSettings(restaurantId: $restaurantId) {
      id
      restaurantId
      printers
      stations
      templates {
        key
        name
        enabled
        content
        updatedAt
      }
      jobs {
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
        updatedAt
      }
      updatedAt
    }
  }
`;

const M_UPSERT_PRINT_SETTINGS = gql`
  mutation UpsertPrintSettings($input: UpsertPrintSettingInput!) {
    upsertPrintSettings(input: $input) {
      id
      restaurantId
      printers
      stations
      templates {
        key
        name
        enabled
        content
        updatedAt
      }
      updatedAt
    }
  }
`;

const M_TEST_PRINT = gql`
  mutation TestPrint($input: TestPrintInput!) {
    testPrint(input: $input) {
      id
      printerId
      status
      error
      payload
      createdAt
    }
  }
`;

const M_RETRY_PRINT_JOB = gql`
  mutation RetryPrintJob($input: RetryPrintJobInput!) {
    retryPrintJob(input: $input) {
      id
      status
      retryCount
      updatedAt
      error
    }
  }
`;

const M_ENQUEUE_PRINT_JOB = gql`
  mutation EnqueuePrintJob($input: EnqueuePrintJobInput!) {
    enqueuePrintJob(input: $input) {
      id
      printerId
      printerName
      printType
      templateKey
      status
      error
      createdAt
    }
  }
`;

const buildStationDefaults = () =>
  PRINT_STATIONS.reduce((acc, station) => {
    acc[station.id] = [];
    return acc;
  }, {});

const makePrinterId = () =>
  `printer_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

const normalizeTemplates = (templates) => {
  const list = Array.isArray(templates) ? templates : [];
  const byKey = new Map(list.map((template) => [template.key, template]));
  return DEFAULT_TEMPLATES.map((template) => ({
    ...template,
    ...(byKey.get(template.key) || {}),
  }));
};

const sanitizeStationsByPrinters = (stations, printers) => {
  const printerIds = new Set(
    (Array.isArray(printers) ? printers : [])
      .map((printer) => printer?.id)
      .filter(Boolean),
  );
  const next = { ...buildStationDefaults() };
  Object.entries(stations || {}).forEach(([stationId, ids]) => {
    next[stationId] = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : []).filter((id) => printerIds.has(id)),
      ),
    );
  });
  return next;
};

export const printerStatusLabel = (status) => {
  if (status === "online") return "Đã kết nối";
  if (status === "configured") return "Đã kiểm tra cấu hình";
  return "Chưa sẵn sàng";
};

export const printTypeLabel = (type) => {
  if (type === "test" || type === "manual_test") return "Lệnh kiểm tra";
  if (type === "receipt" || type === "temporary_bill") return "Hóa đơn";
  if (type === "order_confirmed") return "Phiếu chế biến";
  if (type === "kitchen") return "Phiếu bếp";
  if (type === "bar") return "Phiếu bar";
  return type || "Lệnh in";
};

const READ_ONLY_NOTICE = {
  type: "warning",
  message: "Bạn đang ở chế độ chỉ xem. Cần quyền quản lý cấu hình in để thay đổi hoặc gửi lệnh.",
};

export default function PrintManagement() {
  const { user } = useContext(AuthContext) || {};
  const restaurantScope = useManagerRestaurantSelection();
  const restaurantList = restaurantScope.restaurantOptions || [];
  const selectedRestaurantId = restaurantScope.selectedRestaurantId || "";
  const setSelectedRestaurantId = restaurantScope.setSelectedRestaurantId;
  const canWrite = hasPermission(user, "print.write");
  const [printers, setPrinters] = useState([]);
  const [stationMap, setStationMap] = useState(buildStationDefaults);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pendingDeletePrinterId, setPendingDeletePrinterId] = useState("");
  const hydrateRef = useRef(false);
  const debounceRef = useRef(null);

  const headerRestaurantList = useMemo(
    () =>
      restaurantList
        .map((restaurant) => ({
          id: String(
            restaurant?.id ?? restaurant?.restaurantId ?? restaurant?._id ?? "",
          ),
          name:
            restaurant?.name ||
            restaurant?.restaurantName ||
            "Nhà hàng chưa đặt tên",
        }))
        .filter((restaurant) => restaurant.id),
    [restaurantList],
  );

  const hasRestaurantSelection = Boolean(selectedRestaurantId);
  const hasPrinters = printers.length > 0;

  useEffect(() => {
    hydrateRef.current = true;
    setEditingPrinter(null);
    setSettingsModalOpen(false);
    setPendingDeletePrinterId("");
    setNotice(null);
    setSaveError("");
  }, [selectedRestaurantId]);

  const { data, loading, error, refetch } = useQuery(Q_PRINT_SETTINGS, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const [upsertPrintSettings, { loading: saving }] = useMutation(
    M_UPSERT_PRINT_SETTINGS,
  );
  const [testPrint] = useMutation(M_TEST_PRINT);
  const [retryPrintJob] = useMutation(M_RETRY_PRINT_JOB);
  const [enqueuePrintJob] = useMutation(M_ENQUEUE_PRINT_JOB);

  const jobs = useMemo(() => {
    const list = data?.printSettings?.jobs || [];
    return [...list].sort(
      (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
    );
  }, [data]);

  useEffect(() => {
    if (!selectedRestaurantId || loading || !data) return;
    const settings = data?.printSettings;
    if (!settings) {
      setPrinters([]);
      setStationMap(buildStationDefaults());
      setTemplates(DEFAULT_TEMPLATES);
      hydrateRef.current = false;
      return;
    }

    const safePrinters = Array.isArray(settings.printers)
      ? settings.printers
      : [];
    setPrinters(safePrinters);
    setStationMap(
      sanitizeStationsByPrinters(settings.stations || {}, safePrinters),
    );
    setTemplates(normalizeTemplates(settings.templates));
    window.setTimeout(() => {
      hydrateRef.current = false;
    }, 0);
  }, [data, loading, selectedRestaurantId]);

  useEffect(() => {
    if (
      !canWrite ||
      !selectedRestaurantId ||
      loading ||
      error ||
      hydrateRef.current
    ) {
      return undefined;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      upsertPrintSettings({
        variables: {
          input: {
            restaurantId: selectedRestaurantId,
            printers,
            stations: sanitizeStationsByPrinters(stationMap, printers),
            templates,
          },
        },
      })
        .then(() => setSaveError(""))
        .catch((mutationError) =>
          setSaveError(
            getPrintSettingActionErrorMessage(
              mutationError,
              "Không thể lưu cấu hình in. Vui lòng kiểm tra kết nối và thử lại.",
            ),
          ),
        );
    }, 400);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [
    canWrite,
    error,
    loading,
    selectedRestaurantId,
    printers,
    stationMap,
    templates,
    upsertPrintSettings,
  ]);

  const requireWrite = useCallback(() => {
    if (canWrite) return true;
    setNotice(READ_ONLY_NOTICE);
    return false;
  }, [canWrite]);

  const openAddPrinter = () => {
    if (!requireWrite()) return;
    setEditingPrinter(null);
    setSettingsModalOpen(true);
  };

  const openEditPrinter = (printer) => {
    if (!requireWrite()) return;
    setEditingPrinter(printer);
    setSettingsModalOpen(true);
  };

  const handleTestConfig = useCallback(
    async (formPrinter) => {
      if (!canWrite) {
        setNotice(READ_ONLY_NOTICE);
        return {
          ok: false,
          mode: "permission",
          message: READ_ONLY_NOTICE.message,
        };
      }
      if (!selectedRestaurantId) {
        return {
          ok: false,
          mode: "validation",
          message: "Vui lòng chọn nhà hàng trước khi kiểm tra cấu hình.",
        };
      }

      const draft = { ...(editingPrinter || {}), ...(formPrinter || {}) };
      if (!draft.name?.trim() || !draft.ip?.trim()) {
        return {
          ok: false,
          mode: "validation",
          message: "Thiếu tên máy in hoặc địa chỉ IP.",
        };
      }

      if (!draft.id) {
        return {
          ok: true,
          mode: "mô phỏng",
          message: "Thông số hợp lệ. Lưu máy in trước khi kiểm tra cấu hình đã lưu.",
        };
      }

      let result;
      try {
        result = await testPrint({
          variables: {
            input: {
              restaurantId: selectedRestaurantId,
              printerId: draft.id,
              draftName: draft.name,
              draftIp: draft.ip,
              draftType: draft.type,
              draftLocation: draft.location,
            },
          },
        });
      } catch (mutationError) {
        return {
          ok: false,
          mode: "mô phỏng",
          message: getPrintSettingActionErrorMessage(
            mutationError,
            "Không thể kiểm tra cấu hình máy in.",
          ),
        };
      }
      await refetch();
      const job = result?.data?.testPrint;
      return {
        ok: job?.status === "completed",
        mode: "mô phỏng",
        message:
          job?.status === "completed"
            ? "Thông số cấu hình hợp lệ. Chưa thực hiện kết nối phần cứng thật."
            : `Kiểm tra cấu hình thất bại: ${job?.error || "chưa xác định nguyên nhân"}`,
      };
    },
    [canWrite, editingPrinter, refetch, selectedRestaurantId, testPrint],
  );

  const handleSavePrinter = (payload) => {
    if (!requireWrite() || !payload?.name || !payload?.ip) return;
    if (editingPrinter?.id) {
      setPrinters((current) =>
        current.map((printer) =>
          printer.id === editingPrinter.id
            ? {
                ...printer,
                ...payload,
                status: printer.status || "offline",
                updatedAt: new Date().toISOString(),
              }
            : printer,
        ),
      );
    } else {
      const newId = makePrinterId();
      setPrinters((current) => [
        ...current,
        {
          ...payload,
          id: newId,
          status: "offline",
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
    setSettingsModalOpen(false);
  };

  const handleRemovePrinter = (printerId) => {
    if (!requireWrite()) return;
    setPrinters((current) => current.filter((printer) => printer.id !== printerId));
    setStationMap((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        next[key] = (next[key] || []).filter((id) => id !== printerId);
      });
      return next;
    });
    setPendingDeletePrinterId("");
    setNotice({
      type: "success",
      message: "Đã xóa máy in khỏi cấu hình. Hệ thống sẽ tự lưu thay đổi.",
    });
  };

  const toggleStationPrinter = (stationId, printerId) => {
    if (!requireWrite()) return;
    setStationMap((current) => {
      const assigned = new Set(current[stationId] || []);
      if (assigned.has(printerId)) assigned.delete(printerId);
      else assigned.add(printerId);
      return { ...current, [stationId]: Array.from(assigned) };
    });
  };

  const handleRetryJob = async (jobId) => {
    if (!requireWrite() || !selectedRestaurantId) return;
    try {
      await retryPrintJob({
        variables: {
          input: {
            restaurantId: selectedRestaurantId,
            jobId,
          },
        },
      });
      await refetch();
      setNotice({
        type: "success",
        message: "Đã gửi lại lệnh in vào hàng đợi xử lý.",
      });
    } catch (mutationError) {
      setNotice({
        type: "error",
        message: getPrintSettingActionErrorMessage(
          mutationError,
          "Không thể gửi lại lệnh in. Vui lòng thử lại.",
        ),
      });
    }
  };

  const handleTemplateToggle = (key) => {
    if (!requireWrite()) return;
    setTemplates((current) =>
      current.map((template) =>
        template.key === key
          ? {
              ...template,
              enabled: !template.enabled,
              updatedAt: new Date().toISOString(),
            }
          : template,
      ),
    );
  };

  const handleTemplateContent = (key, content) => {
    if (!canWrite) return;
    setTemplates((current) =>
      current.map((template) =>
        template.key === key
          ? { ...template, content, updatedAt: new Date().toISOString() }
          : template,
      ),
    );
  };

  const handleSendTemplateTest = async (templateKey) => {
    if (!requireWrite()) return;
    const template = templates.find((item) => item.key === templateKey);
    if (template && !template.enabled) {
      setNotice({
        type: "warning",
        message: "Bật mẫu phiếu trước khi gửi lệnh kiểm tra.",
      });
      return;
    }

    const targetPrinter =
      printers.find((printer) => ["configured", "online"].includes(printer.status))
      || printers[0];
    if (!targetPrinter || !selectedRestaurantId) {
      setNotice({
        type: "warning",
        message: "Cần chọn nhà hàng và có ít nhất một máy in trước khi gửi lệnh kiểm tra.",
      });
      return;
    }
    try {
      await enqueuePrintJob({
        variables: {
          input: {
            restaurantId: selectedRestaurantId,
            printerId: targetPrinter.id,
            stationId: targetPrinter.location,
            printType: "manual_test",
            templateKey,
            payload: { source: "print_management", simulated: true },
          },
        },
      });
      await refetch();
      setNotice({
        type: "success",
        message: "Đã đưa lệnh kiểm tra mô phỏng vào hàng đợi in.",
      });
    } catch (mutationError) {
      setNotice({
        type: "error",
        message: getPrintSettingActionErrorMessage(
          mutationError,
          "Không thể gửi lệnh kiểm tra. Vui lòng thử lại.",
        ),
      });
    }
  };

  const printerStats = useMemo(
    () => ({
      total: printers.length,
      configured: printers.filter((printer) =>
        ["configured", "online"].includes(printer.status),
      ).length,
      failed: jobs.filter((job) => job.status === "failed").length,
      pending: jobs.filter(
        (job) => !["completed", "failed", "cancelled"].includes(job.status),
      ).length,
      completed: jobs.filter((job) => job.status === "completed").length,
    }),
    [jobs, printers],
  );

  const receiptTemplate = useMemo(
    () => templates.find((template) => template.key === "receipt"),
    [templates],
  );

  const statusText = (status) => {
    if (status === "completed") return "Hoàn tất";
    if (status === "failed") return "Thất bại";
    if (status === "printing") return "Đang in";
    if (status === "cancelled") return "Đã hủy";
    return "Đang chờ";
  };

  return (
    <main className="print-ui print-ui--polished">
      <div className="print-ui__bg-circle" aria-hidden="true" />

      <ManagementPageHeader
        eyebrow="In ấn & vận hành"
        title="Quản lý in ấn"
        subtitle="Cấu hình máy in, phân luồng phiếu bếp/bar, quản lý mẫu in và theo dõi hàng đợi lệnh in."
        icon="🖨️"
        density="compact"
        stats={[
          {
            id: "printers",
            icon: "🧩",
            label: "Máy in",
            value: printerStats.total,
          },
          {
            id: "configured",
            icon: "📡",
            label: "Đã cấu hình",
            value: printerStats.configured,
          },
          {
            id: "failed",
            icon: "⚠️",
            label: "Lệnh lỗi",
            value: printerStats.failed,
          },
        ]}
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={headerRestaurantList}
        primaryAction={{
          icon: "➕",
          label: "Thêm máy in",
          onClick: openAddPrinter,
          disabled: !hasRestaurantSelection || !canWrite,
          title: !hasRestaurantSelection
            ? "Chọn nhà hàng để thêm máy in"
            : canWrite
              ? "Thêm máy in"
              : READ_ONLY_NOTICE.message,
        }}
      />

      <section className="print-ui__demo-flow" aria-label="Quy trình vận hành in ấn">
        <div className="demo-flow__intro">
          <strong>Quy trình vận hành</strong>
          <span>Theo dõi từ cấu hình máy in đến lệnh in lỗi cần xử lý.</span>
        </div>
        <ol className="demo-flow__steps">
          {PRINT_OPERATION_STEPS.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {!canWrite && hasRestaurantSelection ? (
        <section className="print-ui__notice is-warning" role="status">
          <span>{READ_ONLY_NOTICE.message}</span>
        </section>
      ) : null}

      {notice ? (
        <section
          className={`print-ui__notice is-${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Đóng thông báo"
          >
            Đóng
          </button>
        </section>
      ) : null}

      {!hasRestaurantSelection ? (
        <section className="ui-card print-ui__empty-panel" role="status">
          <div className="empty-icon">
            <Printer size={34} />
          </div>
          <h3>Chọn nhà hàng để tải cấu hình in ấn.</h3>
          <p>
            Danh sách máy in, phân luồng trạm in, mẫu phiếu và hàng đợi lệnh in sẽ hiển thị sau khi chọn nhà hàng.
          </p>
        </section>
      ) : null}

      {hasRestaurantSelection && loading && (
        <div className="ui-card print-ui__skeleton" role="status">
          Đang tải cấu hình in...
        </div>
      )}

      {hasRestaurantSelection && error && (
        <section className="ui-card print-ui__notice is-error" role="alert">
          <span>Không thể tải cấu hình in ấn. Kiểm tra kết nối hoặc thử tải lại dữ liệu.</span>
          <button
            type="button"
            onClick={() => refetch?.()}
            aria-label="Tải lại cấu hình in ấn"
          >
            Tải lại
          </button>
        </section>
      )}

      {hasRestaurantSelection && !loading && !error && (
        <>
          <div className="print-ui__grid">
            <section
              className="ui-card devices-section"
              aria-label="Máy in đã cấu hình"
            >
              <div className="card-header">
                <h3>
                  <Server size={18} /> Máy in đã cấu hình
                </h3>
                <span className="badge">{printers.length} máy in</span>
              </div>

              <div className="device-list">
                {!hasPrinters ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Wifi size={32} />
                    </div>
                    <h4>Chưa có máy in</h4>
                    <p>Thêm máy in để gán trạm và gửi lệnh kiểm tra.</p>
                    <button type="button" onClick={openAddPrinter} disabled={!canWrite}>
                      Thêm máy in
                    </button>
                  </div>
                ) : (
                  printers.map((printer) => (
                    <div key={printer.id} className="device-item">
                      <div
                        className={`status-indicator ${printer.status === "online" ? "online" : "offline"}`}
                      >
                        <div className="dot" />
                        <div className="pulse" />
                      </div>

                      <div className="device-info">
                        <h4>{printer.name}</h4>
                        <div className="meta">
                          <span className="tag-ip">{printer.ip}</span>
                          <span className="type">
                            {printer.type === "thermal" ? "Máy in nhiệt" : "Máy in khác"}
                          </span>
                          <span className={`type status-${printer.status || "offline"}`}>
                            {printerStatusLabel(printer.status)}
                          </span>
                        </div>
                      </div>

                      <div className="device-actions">
                        <button
                          type="button"
                          onClick={async () => {
                            const result = await handleTestConfig(printer);
                            setNotice({
                              type: result.ok ? "success" : "error",
                              message: result.message,
                            });
                          }}
                          disabled={!canWrite}
                          aria-label={`Kiểm tra cấu hình ${printer.name}`}
                          title={canWrite ? "Kiểm tra cấu hình mô phỏng" : READ_ONLY_NOTICE.message}
                        >
                          <Send size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditPrinter(printer)}
                          disabled={!canWrite}
                          aria-label={`Cấu hình ${printer.name}`}
                          title={canWrite ? "Cấu hình" : READ_ONLY_NOTICE.message}
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeletePrinterId(printer.id)}
                          disabled={!canWrite}
                          className="danger"
                          aria-label={`Xóa ${printer.name}`}
                          title={canWrite ? "Xóa" : READ_ONLY_NOTICE.message}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {pendingDeletePrinterId === printer.id ? (
                        <div className="device-confirm" role="alert">
                          <span>Xóa máy in này?</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePrinter(printer.id)}
                          >
                            Xác nhận
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeletePrinterId("")}
                          >
                            Hủy
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="ui-card routing-section">
              <div className="card-header">
                <h3>
                  <Activity size={18} /> Phân luồng in
                </h3>
                <p>Chọn máy in nhận phiếu theo từng khu vực.</p>
              </div>

              {!hasPrinters && (
                <div className="routing-empty-hint">
                  Cần thêm ít nhất một máy in để gán luồng.
                </div>
              )}

              <div className="routing-matrix">
                {PRINT_STATIONS.map((station) => (
                  <div key={station.id} className="routing-row">
                    <div className="station-info">
                      <div className="station-icon">
                        {station.label.charAt(0)}
                      </div>
                      <div className="text">
                        <h4>{station.label}</h4>
                        <span>{station.description}</span>
                      </div>
                    </div>

                    <div className="printer-toggles">
                      {hasPrinters && !(stationMap[station.id] || []).length && (
                        <span className="station-unassigned">Chưa gán</span>
                      )}
                      {printers.map((printer) => {
                        const isActive = (stationMap[station.id] || []).includes(printer.id);
                        return (
                          <button
                            type="button"
                            key={`${station.id}-${printer.id}`}
                            className={`toggle-pill ${isActive ? "active" : ""}`}
                            onClick={() => toggleStationPrinter(station.id, printer.id)}
                            disabled={!canWrite}
                            aria-pressed={isActive}
                            title={canWrite ? undefined : READ_ONLY_NOTICE.message}
                          >
                            <div className="check-icon">
                              {isActive ? (
                                <Check size={12} strokeWidth={4} />
                              ) : (
                                <Power size={12} />
                              )}
                            </div>
                            <span>{printer.name}</span>
                          </button>
                        );
                      })}
                      {!hasPrinters && (
                        <span className="station-unassigned station-unassigned--waiting">
                          Chờ máy in
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="print-ui__stack">
            <section className="ui-card template-section">
              <div className="card-header">
                <h3>
                  <FileText size={18} /> Loại phiếu / mẫu in
                </h3>
                <span className="badge">{templates.length} mẫu</span>
              </div>
              <div className="template-grid">
                {templates.map((template) => (
                  <div
                    key={template.key}
                    className={`template-card ${template.enabled ? "active" : ""}`}
                  >
                    <div className="template-head">
                      <div>
                        <strong>{template.name}</strong>
                        <span className={`template-status ${template.enabled ? "is-on" : "is-off"}`}>
                          {template.enabled ? "Đang bật" : "Đang tắt"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="template-toggle"
                        onClick={() => handleTemplateToggle(template.key)}
                        disabled={!canWrite}
                        title={canWrite ? undefined : READ_ONLY_NOTICE.message}
                      >
                        {template.enabled ? "Tắt mẫu" : "Bật mẫu"}
                      </button>
                    </div>
                    <textarea
                      aria-label={`Nội dung mẫu ${template.name}`}
                      value={template.content || ""}
                      onChange={(event) =>
                        handleTemplateContent(template.key, event.target.value)
                      }
                      disabled={!canWrite}
                    />
                    <button
                      type="button"
                      className="template-test"
                      onClick={() => handleSendTemplateTest(template.key)}
                      disabled={
                        !canWrite ||
                        !hasRestaurantSelection ||
                        !hasPrinters ||
                        !template.enabled
                      }
                      title={
                        !canWrite
                          ? READ_ONLY_NOTICE.message
                          : !hasPrinters
                            ? "Thêm máy in trước khi gửi lệnh kiểm tra"
                            : !template.enabled
                              ? "Bật mẫu trước khi gửi lệnh kiểm tra"
                              : "Gửi lệnh kiểm tra mô phỏng"
                      }
                    >
                      Gửi lệnh kiểm tra
                    </button>
                    {!hasPrinters && (
                      <small className="template-card__hint">
                        Thêm máy in trước khi gửi lệnh kiểm tra.
                      </small>
                    )}
                    {hasPrinters && !template.enabled && (
                      <small className="template-card__hint">
                        Bật mẫu trước khi gửi lệnh kiểm tra.
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="ui-card jobs-section">
              <div className="card-header">
                <h3>
                  <Printer size={18} /> Hàng đợi lệnh in
                </h3>
                <div className="job-header-actions">
                  <button type="button" onClick={() => refetch?.()}>
                    Tải lại hàng đợi
                  </button>
                  <span className="badge">{jobs.length} lệnh</span>
                </div>
              </div>

              {jobs.length === 0 ? (
                <div className="no-data no-data--job">
                  <h4>Chưa có lệnh in</h4>
                  <p>Gửi lệnh kiểm tra từ mẫu phiếu để kiểm tra hàng đợi.</p>
                  {hasPrinters && (
                    <button
                      type="button"
                      onClick={() => handleSendTemplateTest("receipt")}
                      disabled={!canWrite || !receiptTemplate?.enabled}
                      title={
                        !canWrite
                          ? READ_ONLY_NOTICE.message
                          : receiptTemplate?.enabled
                            ? "Gửi lệnh từ mẫu hóa đơn"
                            : "Bật mẫu hóa đơn trước khi gửi lệnh"
                      }
                    >
                      Gửi lệnh từ mẫu hóa đơn
                    </button>
                  )}
                </div>
              ) : (
                <div className="jobs-list">
                  {jobs.slice(0, 20).map((job) => (
                    <div key={job.id} className={`job-item job-${job.status}`}>
                      <div>
                        <strong>{printTypeLabel(job.printType)}</strong>
                        {" • "}
                        {job.printerName || job.printerId || "Chưa xác định"}
                        <div className="job-meta">
                          <span className={`job-status job-status--${job.status || "pending"}`}>
                            {statusText(job.status)}
                          </span>
                          <span>
                            {new Date(job.createdAt).toLocaleString("vi-VN")}
                          </span>
                          <span>Đã gửi lại: {job.retryCount || 0}</span>
                        </div>
                        {job.error && (
                          <div className="job-error">Lỗi: {job.error}</div>
                        )}
                      </div>
                      {job.status === "failed" && (
                        <button
                          type="button"
                          className="retry-btn"
                          onClick={() => handleRetryJob(job.id)}
                          disabled={!canWrite}
                          title={canWrite ? "Gửi lại lệnh lỗi" : READ_ONLY_NOTICE.message}
                        >
                          <RotateCcw size={14} /> Gửi lại lệnh lỗi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {canWrite && saving && <div className="save-hint">Đang lưu cấu hình...</div>}
          {saveError && (
            <div className="save-hint save-hint--error">{saveError}</div>
          )}
        </>
      )}

      <PrinterSettingsModal
        isOpen={canWrite && settingsModalOpen}
        printer={editingPrinter}
        onSave={handleSavePrinter}
        onClose={() => setSettingsModalOpen(false)}
        onTest={handleTestConfig}
      />
    </main>
  );
}
