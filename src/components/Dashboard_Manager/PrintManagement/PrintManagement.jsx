import React, { useContext, useEffect, useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { PRINT_STATIONS } from "@/utils/printStations";
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
} from "lucide-react";
import "./PrintManagement.scss";

// --- GRAPHQL (Đã fix lỗi dấu chấm phẩy) ---
const Q_PRINT_SETTINGS = gql`
  query PrintSettings($restaurantId: ID!) {
    printSettings(restaurantId: $restaurantId) {
      id
      restaurantId
      printers
      stations
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
    }
  }
`;

const buildStationDefaults = () =>
  PRINT_STATIONS.reduce((acc, station) => {
    acc[station.id] = [];
    return acc;
  }, {});

const makePrinterId = () => `printer_${Date.now()}_${Math.random()}`;

export default function PrintManagement() {
  const { restaurants } = useContext(AuthContext);
  const restaurantList = restaurants || [];
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [printers, setPrinters] = useState([]);
  const [stationMap, setStationMap] = useState(buildStationDefaults);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});

  const hydrateRef = useRef(false);
  const debounceRef = useRef(null);

  // --- LOGIC GIỮ NGUYÊN ---
  useEffect(() => {
    if (!selectedRestaurantId && restaurantList.length) {
      setSelectedRestaurantId(
        String(restaurantList[0].id ?? restaurantList[0].restaurantId),
      );
    }
  }, [restaurantList, selectedRestaurantId]);

  const { data } = useQuery(Q_PRINT_SETTINGS, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const [upsertPrintSettings] = useMutation(M_UPSERT_PRINT_SETTINGS);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    const settings = data?.printSettings;
    if (!settings) {
      setPrinters([]);
      setStationMap(buildStationDefaults());
      return;
    }
    hydrateRef.current = true;
    setPrinters(Array.isArray(settings?.printers) ? settings.printers : []);
    setStationMap(settings?.stations || buildStationDefaults());
    const fakeStatus = {};
    (settings.printers || []).forEach((p) => (fakeStatus[p.id] = true));
    setConnectionStatus(fakeStatus);
    setTimeout(() => {
      hydrateRef.current = false;
    }, 0);
  }, [data, selectedRestaurantId]);

  useEffect(() => {
    if (!selectedRestaurantId || hydrateRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      upsertPrintSettings({
        variables: {
          input: {
            restaurantId: selectedRestaurantId,
            printers,
            stations: stationMap,
          },
        },
      }).catch(() => {});
    }, 400);
  }, [selectedRestaurantId, printers, stationMap, upsertPrintSettings]);

  const openAddPrinter = () => {
    setEditingPrinter(null);
    setSettingsModalOpen(true);
  };
  const openEditPrinter = (printer) => {
    setEditingPrinter(printer);
    setSettingsModalOpen(true);
  };

  const handleSavePrinter = (payload) => {
    if (!payload?.name || !payload?.ip) return;
    if (editingPrinter?.id) {
      setPrinters((prev) =>
        prev.map((p) =>
          p.id === editingPrinter.id ? { ...p, ...payload } : p,
        ),
      );
    } else {
      const newId = makePrinterId();
      setPrinters((prev) => [...prev, { ...payload, id: newId }]);
      setConnectionStatus((prev) => ({ ...prev, [newId]: true }));
    }
    setSettingsModalOpen(false);
  };

  const handleRemovePrinter = (printerId) => {
    if (!window.confirm("Xóa thiết bị này khỏi hệ thống?")) return;
    setPrinters((prev) => prev.filter((p) => p.id !== printerId));
    setStationMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach(
        (k) => (next[k] = (next[k] || []).filter((id) => id !== printerId)),
      );
      return next;
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

  return (
    <div className="print-ui">
      {/* BACKGROUND DECORATION */}
      <div className="print-ui__bg-circle"></div>

      {/* HEADER */}
      <header className="print-ui__header">
        <div className="header-content">
          <div className="header-title">
            <div className="icon-box">
              <Printer size={28} />
            </div>
            <div>
              <h1>Print Hub</h1>
              <p>Trung tâm kiểm soát thiết bị in</p>
            </div>
          </div>

          <div className="header-controls">
            <div className="select-wrapper">
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
              >
                {restaurantList.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={openAddPrinter}>
              <Plus size={18} strokeWidth={3} />
              <span>Thiết bị mới</span>
            </button>
          </div>
        </div>
      </header>

      <div className="print-ui__grid">
        {/* COLUMN 1: DEVICES */}
        <section className="ui-card devices-section">
          <div className="card-header">
            <h3>
              <Server size={18} /> Thiết bị đã kết nối
            </h3>
            <span className="badge">{printers.length} Active</span>
          </div>

          <div className="device-list">
            {printers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Wifi size={32} />
                </div>
                <p>Chưa có máy in nào</p>
                <button onClick={openAddPrinter}>Thêm ngay</button>
              </div>
            ) : (
              printers.map((printer) => (
                <div key={printer.id} className="device-item">
                  <div
                    className={`status-indicator ${connectionStatus[printer.id] ? "online" : "offline"}`}
                  >
                    <div className="dot"></div>
                    <div className="pulse"></div>
                  </div>

                  <div className="device-info">
                    <h4>{printer.name}</h4>
                    <div className="meta">
                      <span className="tag-ip">{printer.ip}</span>
                      <span className="type">
                        {printer.type === "thermal" ? "Nhiệt" : "Kim"}
                      </span>
                    </div>
                  </div>

                  <div className="device-actions">
                    <button
                      onClick={() => openEditPrinter(printer)}
                      title="Cấu hình"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => handleRemovePrinter(printer.id)}
                      className="danger"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUMN 2: ROUTING MATRIX */}
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
                  <div className="station-icon">{station.label.charAt(0)}</div>
                  <div className="text">
                    <h4>{station.label}</h4>
                    <span>{station.description}</span>
                  </div>
                </div>

                <div className="printer-toggles">
                  {printers.map((printer) => {
                    const isActive = (stationMap[station.id] || []).includes(
                      printer.id,
                    );
                    return (
                      <div
                        key={`${station.id}-${printer.id}`}
                        className={`toggle-pill ${isActive ? "active" : ""}`}
                        onClick={() =>
                          toggleStationPrinter(station.id, printer.id)
                        }
                      >
                        <div className="check-icon">
                          {isActive ? (
                            <Check size={12} strokeWidth={4} />
                          ) : (
                            <Power size={12} />
                          )}
                        </div>
                        <span>{printer.name}</span>
                      </div>
                    );
                  })}
                  {printers.length === 0 && (
                    <span className="no-data">Cần thêm máy in</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <PrinterSettingsModal
        isOpen={settingsModalOpen}
        printer={editingPrinter}
        onSave={handleSavePrinter}
        onClose={() => setSettingsModalOpen(false)}
        onTest={() => {}}
      />
    </div>
  );
}
