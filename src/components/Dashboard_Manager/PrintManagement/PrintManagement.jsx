import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { PRINT_STATIONS } from "@/utils/printStations";
import { PrinterSettingsModal } from "@/components/Dashboard_Manager/POS/components/modals/PrinterSettingsModal";
import "./PrintManagement.scss";

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
  const hydrateRef = useRef(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantList.length) {
      setSelectedRestaurantId(
        String(restaurantList[0].id ?? restaurantList[0].restaurantId)
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
        prev.map((p) => (p.id === editingPrinter.id ? { ...p, ...payload } : p))
      );
    } else {
      setPrinters((prev) => [...prev, { ...payload, id: makePrinterId() }]);
    }
    setSettingsModalOpen(false);
  };

  const handleRemovePrinter = (printerId) => {
    setPrinters((prev) => prev.filter((p) => p.id !== printerId));
    setStationMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((stationId) => {
        next[stationId] = (next[stationId] || []).filter(
          (id) => id !== printerId
        );
      });
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
    <div className="print-management">
      <div className="print-management__header">
        <div>
          <h2>Quản lý in ấn</h2>
          <p>Thiết lập máy in và luồng in theo quầy.</p>
        </div>
        <div className="print-management__restaurant">
          <label>Nhà hàng</label>
          <select
            value={selectedRestaurantId}
            onChange={(e) => setSelectedRestaurantId(e.target.value)}
          >
            {restaurantList.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name || `Nhà hàng ${r.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="print-management__grid">
        <section className="print-card">
          <div className="print-card__header">
            <h3>Danh sách máy in</h3>
            <button type="button" onClick={openAddPrinter}>
              + Thêm máy in
            </button>
          </div>
          {printers.length === 0 ? (
            <div className="print-empty">
              Chưa có máy in nào. Hãy thêm máy in để bắt đầu.
            </div>
          ) : (
            <div className="print-card__list">
              {printers.map((printer) => (
                <div key={printer.id} className="printer-item">
                  <div>
                    <div className="printer-item__name">{printer.name}</div>
                    <div className="printer-item__meta">
                      IP: {printer.ip} · {printer.type} ·{" "}
                      {PRINT_STATIONS.find((s) => s.id === printer.location)
                        ?.label || printer.location}
                    </div>
                  </div>
                  <div className="printer-item__actions">
                    <button type="button" onClick={() => openEditPrinter(printer)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleRemovePrinter(printer.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="print-card">
          <div className="print-card__header">
            <h3>Luồng in theo quầy</h3>
          </div>
          <div className="print-stations">
            {PRINT_STATIONS.map((station) => (
              <div key={station.id} className="print-station">
                <div>
                  <div className="print-station__title">{station.label}</div>
                  <div className="print-station__desc">
                    {station.description}
                  </div>
                </div>
                <div className="print-station__printers">
                  {printers.length === 0 ? (
                    <span>Chưa có máy in</span>
                  ) : (
                    printers.map((printer) => (
                      <label key={printer.id}>
                        <input
                          type="checkbox"
                          checked={(stationMap[station.id] || []).includes(
                            printer.id
                          )}
                          onChange={() =>
                            toggleStationPrinter(station.id, printer.id)
                          }
                        />
                        {printer.name}
                      </label>
                    ))
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
        onTest={() => null}
      />
    </div>
  );
}
