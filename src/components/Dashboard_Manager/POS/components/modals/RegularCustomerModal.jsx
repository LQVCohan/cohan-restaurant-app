// src/components/Dashboard_Manager/POS/components/modals/RegularCustomerModal.jsx
import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import s from "./RegularCustomerModal.module.scss";
import { useVnAddressLazy } from "@/hooks/useVnAddressLazy";
import Map, { Marker } from "react-map-gl/maplibre";

/* ───────────── HELPERS: Chuẩn hoá tên hành chính ───────────── */
function stripAccents(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeAdminName(str = "") {
  const noAcc = stripAccents(str).toLowerCase().trim();

  // Bỏ tiền tố hành chính thường gặp
  return noAcc
    .replace(
      /^(thanh pho|tp\.?|quan|q\.?|huyen|h\.?|thi xa|tx\.?|phuong|p\.?|xa|thi tran)\s+/g,
      ""
    )
    .replace(/\s+/g, " ");
}

// Tự map tỉnh + quận từ address (OSM / Nominatim) sang vn-address.json
function autoMapProvinceDistrictFromOsm(address = {}, provinces = []) {
  const rawProvince =
    address.state || address.city || address.region || address.county || "";
  const rawDistrict =
    address.city_district || address.district || address.county || "";

  const normProv = normalizeAdminName(rawProvince);
  const normDist = normalizeAdminName(rawDistrict);

  let matchedProvince = null;
  let matchedDistrict = null;

  if (normProv) {
    matchedProvince =
      provinces.find((p) => {
        const nName = normalizeAdminName(p.name);
        return (
          nName === normProv ||
          nName.includes(normProv) ||
          normProv.includes(nName)
        );
      }) || null;
  }

  if (matchedProvince && normDist && Array.isArray(matchedProvince.districts)) {
    matchedDistrict =
      matchedProvince.districts.find((d) => {
        const nName = normalizeAdminName(d.name);
        return (
          nName === normDist ||
          nName.includes(normDist) ||
          normDist.includes(nName)
        );
      }) || null;
  }

  return { matchedProvince, matchedDistrict };
}

/* ───────────── ICONS ───────────── */
const IconSearch = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const IconX = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
const IconMapPin = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);
const IconHeart = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);
const IconPhone = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

// Mini map xem trước vị trí giao hàng
const LocationPreviewMap = ({ lat, lng }) => {
  const latNum = Number(lat);
  const lngNum = Number(lng);

  const isValid =
    Number.isFinite(latNum) &&
    Number.isFinite(lngNum) &&
    lat !== "" &&
    lng !== "";

  if (!isValid) {
    return (
      <div className={s.locationMap}>
        <div className={s.locationPlaceholder}>Chưa có vị trí hợp lệ</div>
      </div>
    );
  }

  const mapKey = `${latNum}_${lngNum}`;

  return (
    <div className={s.locationMap}>
      <Map
        key={mapKey}
        mapLib={import("maplibre-gl")}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        initialViewState={{
          latitude: latNum,
          longitude: lngNum,
          zoom: 16,
        }}
        dragRotate={false}
      >
        <Marker longitude={lngNum} latitude={latNum} anchor="bottom">
          <div className={s.locationMarker}>📍</div>
        </Marker>
      </Map>
    </div>
  );
};

/* ───────────── MOCK DATA (demo) ───────────── */
const MOCK_CUSTOMERS = [
  {
    id: 1,
    name: "Nguyễn Văn A",
    phone: "0901234567",
    level: "VIP Gold",
    preferences: ["Ít đá", "50% Đường", "Không hành"],
    addresses: [
      { label: "Nhà riêng", text: "123 Nguyễn Huệ, Quận 1, TP.HCM" },
      { label: "Công ty", text: "Tòa nhà Bitexco, Tầng 3" },
    ],
    lastOrder: "2023-10-25",
  },
  {
    id: 2,
    name: "Trần Thị B",
    phone: "0987654321",
    level: "Thân thiết",
    preferences: ["Nhiều đá", "Cay cấp độ 3", "Nước mắm riêng"],
    addresses: [{ label: "Nhà riêng", text: "456 Lê Lợi, Quận 1, TP.HCM" }],
    lastOrder: "2023-10-20",
  },
  {
    id: 3,
    name: "Phạm Hoàng C",
    phone: "0911223344",
    level: "Mới",
    preferences: ["Không đường", "Dị ứng đậu phộng"],
    addresses: [
      { label: "Văn phòng", text: "Khu Công Nghệ Cao, Quận 9" },
      { label: "Nhà bố mẹ", text: "789 Võ Văn Ngân, Thủ Đức" },
    ],
    lastOrder: "2023-10-26",
  },
];

export default function RegularCustomerModal({
  isOpen,
  onClose,
  onSelectCustomer,
}) {
  const [activeTab, setActiveTab] = useState("existing"); // "existing" | "new"
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");

  // ───────────── STATE: Khách quen ─────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return MOCK_CUSTOMERS;
    const lower = searchTerm.toLowerCase();
    return MOCK_CUSTOMERS.filter(
      (c) => c.name.toLowerCase().includes(lower) || c.phone.includes(lower)
    );
  }, [searchTerm]);

  // ───────────── STATE: Khách mới ─────────────
  const [newForm, setNewForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    street: "",
    wardCode: "",
    wardName: "",
    districtCode: "",
    districtName: "",
    cityCode: "",
    cityName: "",
    building: "",
    floor: "",
    shippingNote: "",
    lat: "",
    lng: "",
  });
  const [formErrors, setFormErrors] = useState({});

  // Địa chỉ VN lazy
  const {
    provinces,
    districts,
    wards,
    provinceKey,
    districtKey,
    wardKey,
    setProvince,
    setDistrict,
    setWard,
  } = useVnAddressLazy({
    enabled: isOpen && activeTab === "new",
  });

  // Địa chỉ hiển thị
  const displayAddress = useMemo(() => {
    const parts = [
      newForm.street,
      newForm.wardName,
      newForm.districtName,
      newForm.cityName,
    ].filter(Boolean);
    return parts.join(", ");
  }, [
    newForm.street,
    newForm.wardName,
    newForm.districtName,
    newForm.cityName,
  ]);

  const updateField = (field) => (e) => {
    const value = e.target.value;
    setNewForm((prev) => ({ ...prev, [field]: value }));
  };

  /* ───────────── GEO + REVERSE + MAP VÀO SELECT ───────────── */
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Trình duyệt không hỗ trợ xác định vị trí.");
      return;
    }

    setGeoError("");
    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          const latStr = latitude.toFixed(6);
          const lngStr = longitude.toFixed(6);

          // Cập nhật lat/lng
          setNewForm((prev) => ({
            ...prev,
            lat: latStr,
            lng: lngStr,
          }));

          // Gọi reverse (GIỮ NGUYÊN CÁCH BẠN ĐANG DÙNG – chỉ là ví dụ endpoint)
          const reverseUrl = `/api/maps/reverse-vn?lat=${latStr}&lng=${lngStr}`;
          const res = await fetch(reverseUrl, {
            headers: {
              "Accept-Language": "vi",
            },
          });
          if (!res.ok) {
            throw new Error("Không đọc được địa chỉ từ server.");
          }
          const data = await res.json();

          // Tuỳ BE: data.address hoặc data
          const addr = data.address || data || {};

          // Auto map Tỉnh / Thành phố & Quận / Huyện nếu tìm thấy
          if (Array.isArray(provinces) && provinces.length) {
            const { matchedProvince, matchedDistrict } =
              autoMapProvinceDistrictFromOsm(addr, provinces);

            if (matchedProvince) {
              // setProvince để select hiển thị đúng & load districts
              setProvince(matchedProvince.code);
              setNewForm((prev) => ({
                ...prev,
                cityCode: matchedProvince.code,
                cityName: matchedProvince.name,
              }));

              if (matchedDistrict) {
                // setDistrict để select hiển thị đúng & load wards
                setDistrict(matchedDistrict.code);
                setNewForm((prev) => ({
                  ...prev,
                  districtCode: matchedDistrict.code,
                  districtName: matchedDistrict.name,
                  // ward vẫn để user chọn tay
                  wardCode: "",
                  wardName: "",
                }));
              }
            }
          }

          // Đường / số nhà, toà nhà… để user nhập tay như yêu cầu,
          // nên ở đây KHÔNG tự động ghi đè vào newForm.street / building.

          setGeoLoading(false);
        } catch (err) {
          console.error("Geo / reverse error", err);
          setGeoError(
            err.message || "Không lấy được địa chỉ. Vui lòng thử lại."
          );
          setGeoLoading(false);
        }
      },
      (err) => {
        console.error("Geo error", err);
        setGeoError("Không lấy được vị trí hiện tại. Vui lòng thử lại.");
        setGeoLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  /* ───────────── VALIDATION & SAVE ───────────── */
  const validateNewCustomer = () => {
    const errs = {};
    if (!newForm.fullName.trim()) errs.fullName = "Vui lòng nhập họ tên";
    if (!newForm.phone.trim()) errs.phone = "Vui lòng nhập số điện thoại";
    if (!provinceKey) errs.city = "Chọn Tỉnh / Thành phố";
    if (!districtKey) errs.district = "Chọn Quận / Huyện";
    if (!wardKey) errs.ward = "Chọn Phường / Xã";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveNewCustomer = () => {
    if (!validateNewCustomer()) return;

    const payload = {
      id: null,
      fullName: newForm.fullName.trim(),
      phone: newForm.phone.trim(),
      email: newForm.email.trim() || null,
      address: {
        full: displayAddress,
        street: newForm.street.trim(),
        wardCode: newForm.wardCode,
        wardName: newForm.wardName,
        districtCode: newForm.districtCode,
        districtName: newForm.districtName,
        cityCode: newForm.cityCode,
        cityName: newForm.cityName,
        building: newForm.building.trim(),
        floor: newForm.floor.trim(),
      },
      shippingNote: newForm.shippingNote.trim(),
      lat: newForm.lat ? Number(newForm.lat) : null,
      lng: newForm.lng ? Number(newForm.lng) : null,
    };

    onSelectCustomer?.(payload);
    onClose?.();
  };

  const handleSelectExisting = (customer) => {
    setSelectedId(customer.id);
    const primaryAddr =
      (customer.address && customer.address.text) ||
      (Array.isArray(customer.addresses) && customer.addresses[0]?.text) ||
      "";

    const payload = {
      id: customer.id,
      fullName: customer.fullName || customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: {
        full: primaryAddr,
      },
    };

    setTimeout(() => {
      onSelectCustomer?.(payload);
      onClose?.();
    }, 150);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={s.header}>
          <h3 className={s.title}>Khách hàng giao hàng</h3>
          <button className={s.closeBtn} onClick={onClose}>
            <IconX />
          </button>
        </div>

        {/* TABS */}
        <div className={s.tabBar}>
          <button
            className={`${s.tab} ${
              activeTab === "existing" ? s.tabActive : ""
            }`}
            onClick={() => setActiveTab("existing")}
          >
            Khách quen
          </button>
          <button
            className={`${s.tab} ${activeTab === "new" ? s.tabActive : ""}`}
            onClick={() => setActiveTab("new")}
          >
            Khách mới
          </button>
        </div>

        {/* TAB: KHÁCH QUEN */}
        {activeTab === "existing" && (
          <>
            <div className={s.searchSection}>
              <div className={s.searchWrapper}>
                <IconSearch />
                <input
                  className={s.searchInput}
                  placeholder="Tìm theo tên hoặc số điện thoại..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className={s.listContainer}>
              {filteredList.length > 0 ? (
                filteredList.map((cust) => (
                  <div
                    key={cust.id}
                    className={`${s.card} ${
                      selectedId === cust.id ? s.selected : ""
                    }`}
                    onClick={() => handleSelectExisting(cust)}
                  >
                    <div className={s.cardHeader}>
                      <div className={s.info}>
                        <div className={s.nameRow}>
                          <span className={s.name}>{cust.name}</span>
                          <span
                            className={`${s.badge} ${
                              s[cust.level === "VIP Gold" ? "gold" : "standard"]
                            }`}
                          >
                            {cust.level}
                          </span>
                        </div>
                        <div className={s.phoneRow}>
                          <IconPhone /> {cust.phone}
                        </div>
                      </div>
                      <button className={s.selectBtn}>Chọn</button>
                    </div>

                    {cust.preferences.length > 0 && (
                      <div className={s.prefSection}>
                        <div className={s.sectionTitle}>
                          <IconHeart /> Sở thích / Modifier riêng:
                        </div>
                        <div className={s.chipGrid}>
                          {cust.preferences.map((pref, i) => (
                            <span key={i} className={s.prefChip}>
                              {pref}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {cust.addresses.length > 0 && (
                      <div className={s.addrSection}>
                        <div className={s.sectionTitle}>
                          <IconMapPin /> Địa chỉ giao hàng:
                        </div>
                        <div className={s.addrList}>
                          {cust.addresses.map((addr, i) => (
                            <div key={i} className={s.addrItem}>
                              <span className={s.addrLabel}>{addr.label}:</span>
                              <span className={s.addrText}>{addr.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className={s.emptyState}>
                  Không tìm thấy khách hàng nào phù hợp.
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB: KHÁCH MỚI */}
        {activeTab === "new" && (
          <div className={s.newCustomerForm}>
            <div className={s.formBody}>
              {/* Họ tên + SĐT */}
              <div className={s.fieldRow}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>
                    Họ và tên<span className={s.required}>*</span>
                  </label>
                  <input
                    className={`${s.input} ${
                      formErrors.fullName ? s.inputError : ""
                    }`}
                    placeholder="VD: Lê Quốc Việt"
                    value={newForm.fullName}
                    onChange={updateField("fullName")}
                  />
                  {formErrors.fullName && (
                    <div className={s.errorText}>{formErrors.fullName}</div>
                  )}
                </div>

                <div className={s.fieldGroup}>
                  <label className={s.label}>
                    Số điện thoại<span className={s.required}>*</span>
                  </label>
                  <input
                    className={`${s.input} ${
                      formErrors.phone ? s.inputError : ""
                    }`}
                    placeholder="VD: 0909 888 999"
                    value={newForm.phone}
                    onChange={updateField("phone")}
                  />
                  {formErrors.phone && (
                    <div className={s.errorText}>{formErrors.phone}</div>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className={s.fieldGroup}>
                <label className={s.label}>Email (tuỳ chọn)</label>
                <input
                  className={s.input}
                  placeholder="viet@example.com"
                  value={newForm.email}
                  onChange={updateField("email")}
                />
              </div>

              {/* Địa chỉ hiển thị */}
              <div className={s.fieldGroup}>
                <label className={s.label}>Địa chỉ hiển thị</label>
                <textarea
                  className={s.textarea}
                  rows={2}
                  placeholder="VD: 12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh"
                  value={displayAddress}
                  readOnly
                />
              </div>

              {/* Đường / Số nhà */}
              <div className={s.fieldGroup}>
                <label className={s.label}>Đường / Số nhà</label>
                <input
                  className={s.input}
                  placeholder="VD: 12 Nguyễn Huệ"
                  value={newForm.street}
                  onChange={updateField("street")}
                />
              </div>

              {/* Quận + Tỉnh */}
              <div className={s.fieldRow}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>
                    Quận / Huyện<span className={s.required}>*</span>
                  </label>
                  <select
                    className={`${s.input} ${
                      formErrors.district ? s.inputError : ""
                    }`}
                    value={districtKey}
                    onChange={(e) => {
                      const code = e.target.value;
                      setDistrict(code);
                      const found =
                        districts.find(
                          (d) => String(d.code) === String(code)
                        ) || null;
                      setNewForm((prev) => ({
                        ...prev,
                        districtCode: code,
                        districtName: found?.name || "",
                        wardCode: "",
                        wardName: "",
                      }));
                    }}
                    disabled={!provinceKey}
                  >
                    <option value="">Chọn Quận / Huyện</option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.district && (
                    <div className={s.errorText}>{formErrors.district}</div>
                  )}
                </div>

                <div className={s.fieldGroup}>
                  <label className={s.label}>
                    Tỉnh / Thành phố<span className={s.required}>*</span>
                  </label>
                  <select
                    className={`${s.input} ${
                      formErrors.city ? s.inputError : ""
                    }`}
                    value={provinceKey}
                    onChange={(e) => {
                      const code = e.target.value;
                      setProvince(code);
                      const found =
                        provinces.find(
                          (p) => String(p.code) === String(code)
                        ) || null;
                      setNewForm((prev) => ({
                        ...prev,
                        cityCode: code,
                        cityName: found?.name || "",
                        districtCode: "",
                        districtName: "",
                        wardCode: "",
                        wardName: "",
                      }));
                    }}
                  >
                    <option value="">Chọn Tỉnh / Thành phố</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.city && (
                    <div className={s.errorText}>{formErrors.city}</div>
                  )}
                </div>
              </div>

              {/* Phường + Toà nhà */}
              <div className={s.fieldRow}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>
                    Phường / Xã<span className={s.required}>*</span>
                  </label>
                  <select
                    className={`${s.input} ${
                      formErrors.ward ? s.inputError : ""
                    }`}
                    value={wardKey}
                    onChange={(e) => {
                      const code = e.target.value;
                      setWard(code);
                      const found =
                        wards.find((w) => String(w.code) === String(code)) ||
                        null;
                      setNewForm((prev) => ({
                        ...prev,
                        wardCode: code,
                        wardName: found?.name || "",
                      }));
                    }}
                    disabled={!districtKey}
                  >
                    <option value="">Chọn Phường / Xã</option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.ward && (
                    <div className={s.errorText}>{formErrors.ward}</div>
                  )}
                </div>

                <div className={s.fieldGroup}>
                  <label className={s.label}>Toà nhà / Khu</label>
                  <input
                    className={s.input}
                    placeholder="VD: Chung cư ABC, Block B"
                    value={newForm.building}
                    onChange={updateField("building")}
                  />
                </div>
              </div>

              {/* Tầng / Căn + Ghi chú */}
              <div className={s.fieldRow}>
                <div className={s.fieldGroup}>
                  <label className={s.label}>Tầng / Căn</label>
                  <input
                    className={s.input}
                    placeholder="VD: Tầng 10, Căn 10-03"
                    value={newForm.floor}
                    onChange={updateField("floor")}
                  />
                </div>

                <div className={s.fieldGroup}>
                  <label className={s.label}>Ghi chú giao hàng</label>
                  <textarea
                    className={s.textarea}
                    rows={2}
                    placeholder="VD: Giao giờ hành chính, gọi trước khi tới..."
                    value={newForm.shippingNote}
                    onChange={updateField("shippingNote")}
                  />
                </div>
              </div>

              {/* Vị trí GPS (tự động) */}
              <div className={s.fieldGroup}>
                <label className={s.label}>Vị trí (tuỳ chọn)</label>

                <div className={s.locationRow}>
                  <div className={s.locationInfo}>
                    {newForm.lat && newForm.lng ? (
                      <div>
                        <div className={s.locationTitle}>
                          Đã định vị vị trí giao hàng
                        </div>
                        <div className={s.locationCoords}>
                          Lat: <span>{newForm.lat}</span>, Lng:{" "}
                          <span>{newForm.lng}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={s.locationTitle}>
                        Chưa có vị trí. Nhấn &quot;Lấy vị trí hiện tại&quot; để
                        tự động điền.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={s.locationBtn}
                    onClick={handleUseCurrentLocation}
                    disabled={geoLoading}
                  >
                    {geoLoading ? "Đang lấy..." : "Lấy vị trí hiện tại"}
                  </button>
                </div>

                {geoError && <div className={s.errorText}>{geoError}</div>}

                <LocationPreviewMap lat={newForm.lat} lng={newForm.lng} />
              </div>
            </div>

            {/* FOOTER */}
            <div className={s.formFooter}>
              <button className={s.cancelBtn} onClick={onClose}>
                Hủy
              </button>
              <button className={s.saveBtn} onClick={handleSaveNewCustomer}>
                Lưu & sử dụng địa chỉ này
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
