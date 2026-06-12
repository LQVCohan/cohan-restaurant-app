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
import { PRINT_STATIONS } from "@/utils/printStations";
import { getPrintSettingActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import { PrinterSettingsModal } from "@/components/Dashboard_Manager/POS/components/modals/PrinterSettingsModal";
import {
  Printer,
  Settings,
  Wifi,
  Activity,
  Trash2,
  Plus,
  Server,
  Check,
  Power,
  RotateCcw,
  FileText,
  Send,
} from "lucide-react";
import "./PrintManagement.scss";
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
  const byKey = new Map(list.map((t) => [t.key, t]));
  return DEFAULT_TEMPLATES.map((t) => ({ ...t, ...(byKey.get(t.key) || {}) }));
};

const sanitizeStationsByPrinters = (stations, printers) => {
  const printerIds = new Set(
    (Array.isArray(printers) ? printers : []).map((p) => p?.id).filter(Boolean),
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

export default function PrintManagement() {
  const { restaurants } = useContext(AuthContext);
  const restaurantList = useMemo(
    () => (Array.isArray(restaurants) ? restaurants : []),
    [restaurants],
  );
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
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
    if (!selectedRestaurantId && headerRestaurantList.length) {
      setSelectedRestaurantId(headerRestaurantList[0].id);
    }
  }, [headerRestaurantList, selectedRestaurantId]);

  useEffect(() => {
    setEditingPrinter(null);
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
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [data]);

  useEffect(() => {
    if (!selectedRestaurantId || loading || !data) return;
    const settings = data?.printSettings;
    if (!settings) {
      setPrinters([]);
      setStationMap(buildStationDefaults());
      setTemplates(DEFAULT_TEMPLATES);
      return;
    }

    hydrateRef.current = true;
    const safePrinters = Array.isArray(settings?.printers)
      ? settings.printers
      : [];
    setPrinters(safePrinters);
    setStationMap(
      sanitizeStationsByPrinters(settings?.stations || {}, safePrinters),
    );
    setTemplates(normalizeTemplates(settings?.templates));
    setTimeout(() => {
      hydrateRef.current = false;
    }, 0);
  }, [data, loading, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId || loading || error || hydrateRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
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
        .catch((err) =>
          setSaveError(
            getPrintSettingActionErrorMessage(
              err,
              "Lưu cấu hình thất bại. Vui lòng kiểm tra kết nối và thử lại.",
            ),
          ),
        );
    }, 400);
  }, [
    error,
    loading,
    selectedRestaurantId,
    printers,
    stationMap,
    templates,
    upsertPrintSettings,
  ]);

  const openAddPrinter = () => {
    setEditingPrinter(null);
    setSettingsModalOpen(true);
  };

  const openEditPrinter = (printer) => {
    setEditingPrinter(printer);
    setSettingsModalOpen(true);
  };

  const handleTestConfig = useCallback(
    async (formPrinter) => {
      if (!selectedRestaurantId) {
        return {
          ok: false,
          mode: "validation",
          message: "Vui lòng chọn nhà hàng trước khi test.",
        };
      }

      const draft = { ...(editingPrinter || {}), ...(formPrinter || {}) };
      if (!draft.name?.trim() || !draft.ip?.trim()) {
        return {
          ok: false,
          mode: "validation",
          message:
            "Thiếu tên hoặc IP. Đây là bước validate cấu hình, chưa test thiết bị thật.",
        };
      }

      if (!draft.id) {
        return {
          ok: true,
          mode: "validation",
          message:
            "Máy in chưa lưu DB. Đã validate cấu hình form thành công (simulated), chưa có kiểm tra phần cứng.",
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
      } catch (err) {
        return {
          ok: false,
          mode: "db_simulation",
          message: getPrintSettingActionErrorMessage(
            err,
            `Test job thất bại: ${err?.message || "unknown error"}`,
          ),
        };
      }
      await refetch();
      const job = result?.data?.testPrint;
      return {
        ok: job?.status === "completed",
        mode: "db_simulation",
        message:
          job?.status === "completed"
            ? "Đã tạo test job mô phỏng và cập nhật trạng thái từ DB; chưa handshake phần cứng thật."
            : `Test job thất bại: ${job?.error || "unknown error"}`,
      };
    },
    [editingPrinter, refetch, selectedRestaurantId, testPrint],
  );

  const handleSavePrinter = (payload) => {
    if (!payload?.name || !payload?.ip) return;
    if (editingPrinter?.id) {
      setPrinters((prev) =>
        prev.map((p) =>
          p.id === editingPrinter.id
            ? {
                ...p,
                ...payload,
                status: p.status || "offline",
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
    } else {
      const newId = makePrinterId();
      setPrinters((prev) => [
        ...prev,
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
    setPrinters((prev) => prev.filter((p) => p.id !== printerId));
    setStationMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach(
        (k) => (next[k] = (next[k] || []).filter((id) => id !== printerId)),
      );
      return next;
    });
    setPendingDeletePrinterId("");
    setNotice({
      type: "success",
      message:
        "Đã xóa thiết bị khỏi cấu hình cục bộ. Hệ thống sẽ tự lưu thay đổi.",
    });
  };

  const toggleStationPrinter = (stationId, printerId) => {
    setStationMap((prev) => {
      const current = new Set(prev[stationId] || []);
      if (current.has(printerId)) current.delete(printerId);
      else current.add(printerId);
      return { ...prev, [stationId]: Array.from(current) };
    });
  };

  const handleRetryJob = async (jobId) => {
    if (!selectedRestaurantId) return;
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
        message: "Đã gửi lại print job vào hàng đợi xử lý.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: getPrintSettingActionErrorMessage(
          err,
          `Không thể retry print job: ${err?.message || "Lỗi không xác định"}`,
        ),
      });
    }
  };

  const handleTemplateToggle = (key) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.key === key
          ? { ...t, enabled: !t.enabled, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  };

  const handleTemplateContent = (key, content) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.key === key
          ? { ...t, content, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  };

  const handleSendTemplateTest = async (templateKey) => {
    const targetPrinter =
      printers.find((p) => p.status === "online") || printers[0];
    if (!targetPrinter || !selectedRestaurantId) {
      setNotice({
        type: "warning",
        message:
          "Cần chọn nhà hàng và có ít nhất một máy in trước khi gửi test print.",
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
            payload: { source: "print_management" },
          },
        },
      });
      await refetch();
      setNotice({
        type: "success",
        message: "Đã tạo test job mô phỏng và đưa vào hàng đợi print job.",
      });
    } catch (err) {
      setNotice({
        type: "error",
        message: getPrintSettingActionErrorMessage(
          err,
          `Không thể gửi test print: ${err?.message || "Lỗi không xác định"}`,
        ),
      });
    }
  };

  const printerStats = useMemo(
    () => ({
      total: printers.length,
      online: printers.filter((printer) => printer.status === "online").length,
      offline: printers.filter((printer) => printer.status !== "online").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      pending: jobs.filter(
        (job) => !["completed", "failed"].includes(job.status),
      ).length,
      completed: jobs.filter((job) => job.status === "completed").length,
    }),
    [jobs, printers],
  );

  const statusText = (status) => {
    if (status === "completed") return "Hoàn tất";
    if (status === "failed") return "Thất bại";
    if (status === "printing") return "Đang in";
    return "Đang chờ";
  };

  return (
    <main className="print-ui">
      <div className="print-ui__bg-circle" aria-hidden="true"></div>

      <ManagementPageHeader
        eyebrow="PRINT OPERATIONS"
        title="Bảng điều phối in ấn"
        subtitle="Điều phối thiết bị, ma trận luồng in, mẫu phiếu và hàng đợi print job."
        icon="🖨️"
        stats={[
          {
            id: "printers",
            icon: "🧩",
            label: "Thiết bị",
            value: printerStats.total,
          },
          {
            id: "online",
            icon: "📡",
            label: "Online",
            value: printerStats.online,
          },
          {
            id: "failed",
            icon: "⚠️",
            label: "Jobs lỗi",
            value: printerStats.failed,
          },
        ]}
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={headerRestaurantList}
        primaryAction={{
          icon: "➕",
          label: "Thiết bị mới",
          onClick: openAddPrinter,
          disabled: !hasRestaurantSelection,
          title: hasRestaurantSelection
            ? "Thêm thiết bị"
            : "Chọn nhà hàng để thêm thiết bị",
        }}
      />

      <section className="print-ui__hero" aria-label="Tổng quan vận hành in">
        {[
          [
            "Thiết bị",
            printerStats.total,
            `${printerStats.online} online / ${printerStats.offline} offline`,
          ],
          ["Jobs đang chờ", printerStats.pending, "Cần theo dõi trong ca"],
          ["Jobs lỗi", printerStats.failed, "Có thể retry thủ công"],
          ["Hoàn tất", printerStats.completed, "Đã xử lý thành công"],
        ].map(([label, value, hint]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </section>

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
            Danh sách thiết bị, phân luồng trạm in, mẫu phiếu và hàng đợi print
            job sẽ hiển thị sau khi chọn nhà hàng.
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
          <span>
            Không thể tải cấu hình in ấn. Kiểm tra kết nối hoặc thử tải lại dữ
            liệu.
          </span>
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
              aria-label="Thiết bị đã kết nối"
            >
              <div className="card-header">
                <h3>
                  <Server size={18} /> Thiết bị đã kết nối
                </h3>
                <span className="badge">{printers.length} thiết bị</span>
              </div>

              <div className="device-list">
                {!hasPrinters ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Wifi size={32} />
                    </div>
                    <h4>Chưa có máy in nào</h4>
                    <p>
                      Thêm thiết bị demo để gán luồng bếp/bar/thu ngân và gửi
                      test print mô phỏng.
                    </p>
                    <button type="button" onClick={openAddPrinter}>
                      Thêm thiết bị
                    </button>
                  </div>
                ) : (
                  printers.map((printer) => (
                    <div key={printer.id} className="device-item">
                      <div
                        className={`status-indicator ${printer.status === "online" ? "online" : "offline"}`}
                      >
                        <div className="dot"></div>
                        <div className="pulse"></div>
                      </div>

                      <div className="device-info">
                        <h4>{printer.name}</h4>
                        <div className="meta">
                          <span className="tag-ip">{printer.ip}</span>
                          <span className="type">
                            {printer.type === "thermal" ? "Nhiệt" : "Khác"}
                          </span>
                          <span
                            className={`type status-${printer.status || "offline"}`}
                          >
                            {printer.status || "offline"}
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
                          aria-label={`Test cấu hình ${printer.name}`}
                          title="Test cấu hình mô phỏng"
                        >
                          <Send size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditPrinter(printer)}
                          aria-label={`Cấu hình ${printer.name}`}
                          title="Cấu hình"
                        >
                          <Settings size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeletePrinterId(printer.id)}
                          className="danger"
                          aria-label={`Xóa ${printer.name}`}
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      {pendingDeletePrinterId === printer.id ? (
                        <div className="device-confirm" role="alert">
                          <span>Xóa thiết bị này?</span>
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
                  <Activity size={18} /> Phân luồng in bếp
                </h3>
                <p>Điều hướng lệnh in tự động</p>
              </div>

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
                      {printers.map((printer) => {
                        const isActive = (
                          stationMap[station.id] || []
                        ).includes(printer.id);
                        return (
                          <button
                            type="button"
                            key={`${station.id}-${printer.id}`}
                            className={`toggle-pill ${isActive ? "active" : ""}`}
                            onClick={() =>
                              toggleStationPrinter(station.id, printer.id)
                            }
                            aria-pressed={isActive}
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
                        <span className="no-data no-data--compact">
                          Chưa có máy in để gán luồng
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="print-ui__stack">
            <section className="ui-card">
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
                      <strong>{template.name}</strong>
                      <button
                        type="button"
                        className="template-toggle"
                        onClick={() => handleTemplateToggle(template.key)}
                      >
                        {template.enabled ? "Bật" : "Tắt"}
                      </button>
                    </div>
                    <textarea
                      aria-label={`Nội dung mẫu ${template.name}`}
                      value={template.content || ""}
                      onChange={(e) =>
                        handleTemplateContent(template.key, e.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="template-test"
                      onClick={() => handleSendTemplateTest(template.key)}
                      disabled={!hasRestaurantSelection || !hasPrinters}
                      title={
                        !hasPrinters
                          ? "Cần thêm máy in trước khi gửi test print mô phỏng"
                          : "Tạo test job mô phỏng"
                      }
                    >
                      Test cấu hình (mô phỏng)
                    </button>
                    {!hasPrinters && (
                      <small className="template-card__hint">
                        Cần có máy in để tạo test job mô phỏng.
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="ui-card">
              <div className="card-header">
                <h3>
                  <Printer size={18} /> Hàng đợi print job
                </h3>
                <span className="badge">{jobs.length} jobs</span>
              </div>

              {jobs.length === 0 ? (
                <div className="no-data">
                  Chưa có print job. Gửi test cấu hình mô phỏng để tạo job demo.
                </div>
              ) : (
                <div className="jobs-list">
                  {jobs.slice(0, 20).map((job) => (
                    <div key={job.id} className={`job-item job-${job.status}`}>
                      <div>
                        <strong>{job.printType}</strong> •{" "}
                        {job.printerName || job.printerId || "N/A"}
                        <div className="job-meta">
                          <span>{statusText(job.status)}</span>
                          <span>
                            {new Date(job.createdAt).toLocaleString("vi-VN")}
                          </span>
                          <span>Retry: {job.retryCount || 0}</span>
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
                        >
                          <RotateCcw size={14} /> Retry job lỗi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {saving && <div className="save-hint">Đang lưu cấu hình...</div>}
          {saveError && (
            <div className="save-hint save-hint--error">{saveError}</div>
          )}
        </>
      )}

      <PrinterSettingsModal
        isOpen={settingsModalOpen}
        printer={editingPrinter}
        onSave={handleSavePrinter}
        onClose={() => setSettingsModalOpen(false)}
        onTest={handleTestConfig}
      />
    </main>
  );
}
