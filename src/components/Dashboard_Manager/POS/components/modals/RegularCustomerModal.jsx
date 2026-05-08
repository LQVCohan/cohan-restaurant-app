import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useLazyQuery, useMutation } from "@apollo/client";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";
import cls from "./RegularCustomerModal.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { useVnAddressLazy } from "../../../../../hooks/useVnAddressLazy";
import useModalDraft from "../../../../../hooks/useModalDraft";
import { useNotification } from "../../../../../hooks/useNotification";
import {
  deriveCandidateMatches,
  detectIdentityConflict,
  normalizeEmail,
  normalizePhone,
} from "../../../../../utils/posCustomerIdentity";

const Q_POS_CUSTOMERS = gql`
  query PosCustomerCandidates(
    $restaurantId: ID!
    $keyword: String
    $email: String
    $phone: String
  ) {
    posCustomerCandidates(
      restaurantId: $restaurantId
      keyword: $keyword
      email: $email
      phone: $phone
    ) {
      id
      fullName
      phone
      email
      address
      note
      source
    }
  }
`;

const M_UPSERT_POS_CUSTOMER = gql`
  mutation UpsertPosCustomer($input: UpsertPosCustomerInput!) {
    upsertPosCustomer(input: $input) {
      id
      restaurantId
      fullName
      phone
      email
      defaultAddress
      note
      source
      orderCount
      lastOrderAt
      isActive
    }
  }
`;

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  note: "",
  detail: "",
  provinceKey: "",
  districtKey: "",
  wardKey: "",
};

function safeStr(v) {
  return (v || "").toString().trim();
}
function normalizePart(s) {
  return (s || "")
    .toString()
    .replace(/\s+/g, " ")
    .replace(/^,\s*|,\s*$/g, "")
    .trim();
}

function dedupeParts(parts) {
  const seen = new Set();
  const out = [];
  for (const p of parts.map(normalizePart).filter(Boolean)) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

// Reverse geocode FE (tạm thời). BE làm sau thì thay bằng API nội bộ.
async function reverseGeocodeOSM(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&` +
    `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(
      lng,
    )}&accept-language=vi`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      // Nominatim khuyến nghị có User-Agent/Referer, browser sẽ tự set, đây best-effort
    },
  });
  if (!res.ok) throw new Error("reverse_geocode_failed");
  const data = await res.json();
  return data;
}

export default function RegularCustomerModal({
  isOpen,
  onClose,
  onSelectCustomer,
}) {
  const { restaurantId } = usePos();
  const { showNotification } = useNotification();

  const [tab, setTab] = useState("select"); // select | create
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [loadCustomers, { data: customersData, loading: customersLoading }] =
    useLazyQuery(Q_POS_CUSTOMERS, { fetchPolicy: "network-only" });
  const [upsertPosCustomer, { loading: upsertingCustomer }] = useMutation(
    M_UPSERT_POS_CUSTOMER,
  );
  const [searchDebounced, setSearchDebounced] = useState("");
  const [identityDebounced, setIdentityDebounced] = useState({
    email: "",
    phone: "",
  });

  const [form, setForm] = useState(emptyForm);
  const firstOpenRef = useRef(false);

  const {
    loading,
    error,
    provinces,
    districts,
    wards,
    provinceKey,
    districtKey,
    wardKey,
    setProvince,
    setDistrict,
    setWard,
    selectedProvince,
    selectedDistrict,
  } = useVnAddressLazy({
    enabled: !!isOpen,
    initial: {
      city: form.provinceKey || "",
      district: form.districtKey || "",
      ward: form.wardKey || "",
    },
  });

  const selectedWard = useMemo(() => {
    return (
      (wards || []).find((w) => String(w.code) === String(wardKey)) || null
    );
  }, [wards, wardKey]);

  useEffect(() => {
    if (!isOpen) return;
    if (!firstOpenRef.current) firstOpenRef.current = true;
    setTab("select");
    setSearch("");
    setIdentityDebounced({
      email: normalizeEmail(form.email),
      phone: normalizePhone(form.phone),
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setForm((prev) => ({
      ...prev,
      provinceKey: provinceKey || "",
      districtKey: districtKey || "",
      wardKey: wardKey || "",
    }));
  }, [provinceKey, districtKey, wardKey, isOpen]);

  const fullAddress = useMemo(() => {
    const detail = normalizePart(form.detail);

    const wardName = normalizePart(selectedWard?.name);
    const distName = normalizePart(selectedDistrict?.name);
    const provName = normalizePart(selectedProvince?.name);

    // Nếu user lỡ paste nguyên chuỗi dài (có cả tỉnh/quận/phường) vào detail
    // thì loại bỏ các phần trùng với select để UI không bị lặp.
    const cleanedDetail = dedupeParts(
      detail
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => {
          const lx = x.toLowerCase();
          if (wardName && lx === wardName.toLowerCase()) return false;
          if (distName && lx === distName.toLowerCase()) return false;
          if (provName && lx === provName.toLowerCase()) return false;
          return true;
        }),
    ).join(", ");

    const parts = dedupeParts([cleanedDetail, wardName, distName, provName]);
    return parts.join(", ");
  }, [
    form.detail,
    selectedWard?.name,
    selectedDistrict?.name,
    selectedProvince?.name,
  ]);

  const hasDirtyForm = useMemo(() => {
    const f = form || {};
    return (
      safeStr(f.name) ||
      safeStr(f.phone) ||
      safeStr(f.email) ||
      safeStr(f.note) ||
      safeStr(f.detail) ||
      safeStr(f.provinceKey) ||
      safeStr(f.districtKey) ||
      safeStr(f.wardKey)
    );
  }, [form]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      setIdentityDebounced({
        email: normalizeEmail(form.email),
        phone: normalizePhone(form.phone),
      });
    }, 400);
    return () => clearTimeout(t);
  }, [isOpen, form.email, form.phone]);

  useEffect(() => {
    if (!isOpen || !restaurantId) return;
    const email = identityDebounced.email;
    const phone = identityDebounced.phone;
    loadCustomers({
      variables: {
        restaurantId,
        keyword: safeStr(searchDebounced),
        email: email || null,
        phone: phone || null,
      },
    }).catch(() => {});
  }, [
    isOpen,
    restaurantId,
    searchDebounced,
    identityDebounced.email,
    identityDebounced.phone,
    loadCustomers,
  ]);

  const filteredCustomers = useMemo(
    () =>
      (customersData?.posCustomerCandidates || []).map((c) => ({
        ...c,
        name: safeStr(c.fullName),
        address: safeStr(c.address),
        source: safeStr(c.source),
      })),
    [customersData],
  );

  const closeWithConfirm = () => {
    requestCloseWithDraft(() => onClose?.());
    setForm(emptyForm);
  };

  const {
    clearDraft,
    requestCloseWithDraft,
    pendingRestore,
    restorePendingDraft,
    discardPendingDraft,
  } = useModalDraft({
    enabled: isOpen && tab === "create",
    draftIdentity: {
      module: "pos",
      modal: "regular-customer-modal",
      route:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      mode: "create",
      entityType: "customer",
      recordId: null,
      context: String(restaurantId || "default"),
      schemaVersion: "1",
    },
    formValue: form,
    isDirty: hasDirtyForm,
    sanitize: (v) => ({
      name: safeStr(v?.name),
      phone: safeStr(v?.phone),
      email: safeStr(v?.email),
      note: safeStr(v?.note),
      detail: safeStr(v?.detail),
      provinceKey: v?.provinceKey || "",
      districtKey: v?.districtKey || "",
      wardKey: v?.wardKey || "",
    }),
    onRestore: (draft) => {
      setForm((prev) => ({ ...prev, ...draft }));
      showNotification("Đã khôi phục dữ liệu khách nhập dở.", "info", 2400);
    },
    notify: showNotification,
  });

  const setField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handlePickCustomer = (c) => {
    if (!c) return;

    const addressText = safeStr(
      c?.shippingInfo?.address || c?.address || c?.defaultAddress,
    );

    const displayName = safeStr(c.fullName || c.name);

    onSelectCustomer?.({
      id: c.id || c._id || null,
      customerIdentityMode: "profile",
      source: c.source || null,
      name: displayName,
      phone: safeStr(c.phone),
      email: safeStr(c.email),
      note: safeStr(c?.shippingInfo?.note || c?.note),
      isNew: false,
      addressText,
      shippingInfo: {
        fullName: displayName,
        phone: safeStr(c.phone),
        email: safeStr(c.email),
        address: addressText,
        note: safeStr(c?.shippingInfo?.note || c?.note),
        deliveryMethod: "ship_now",
        deliveryTime: "",
        scheduleDate: "",
        scheduleTime: "",
      },
    });

    clearDraft();
    onClose?.();
    setForm(emptyForm);
  };

  const handleProvinceChange = (code) => {
    setProvince?.(code);
    setForm((prev) => ({
      ...prev,
      provinceKey: code,
      districtKey: "",
      wardKey: "",
    }));
  };

  const handleDistrictChange = async (code) => {
    await setDistrict?.(code);
    setForm((prev) => ({
      ...prev,
      districtKey: code,
      wardKey: "",
    }));
  };

  const handleWardChange = (code) => {
    setWard?.(code);
    setForm((prev) => ({ ...prev, wardKey: code }));
  };

  function isValidEmail(value) {
    const email = normalizeEmail(value);
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidVietnamPhone(value) {
    const phone = normalizePhone(value);
    if (!phone) return false;
    if (!/^\d{9,11}$/.test(phone)) return false;
    if (/^0+$/.test(phone)) return false;
    if (phone === "0123456789" || phone === "123456789") return false;
    return true;
  }

  const validateSnapshotForCurrentOrder = () => {
    const name = safeStr(form.name);
    const phone = normalizePhone(form.phone);
    const email = normalizeEmail(form.email);
    const address = safeStr(fullAddress);

    if (!name) return "Vui lòng nhập tên khách.";
    if (!phone) return "Vui lòng nhập SĐT.";
    if (!isValidVietnamPhone(phone)) return "SĐT không hợp lệ.";
    if (email && !isValidEmail(email)) return "Email không hợp lệ.";
    if (!address) return "Vui lòng nhập địa chỉ đầy đủ.";

    return null;
  };

  const validateCreate = () => {
    const name = safeStr(form.name);
    const phone = normalizePhone(form.phone);
    const email = normalizeEmail(form.email);
    const address = safeStr(fullAddress);

    if (!restaurantId) return "Thiếu nhà hàng. Vui lòng chọn nhà hàng trước.";
    if (!name) return "Vui lòng nhập tên khách.";
    if (!phone) return "Vui lòng nhập SĐT.";
    if (!isValidVietnamPhone(phone)) return "SĐT không hợp lệ.";
    if (email && !isValidEmail(email)) return "Email không hợp lệ.";
    if (!address) return "Vui lòng nhập địa chỉ đầy đủ.";

    if (identityConflict) {
      return "Email và SĐT thuộc hai hồ sơ khác nhau. Không thể lưu khách quen để tránh cập nhật sai hồ sơ. Hãy chọn một hồ sơ có sẵn hoặc dùng thông tin này cho đơn hiện tại.";
    }

    return null;
  };

  const handleGetCurrentAddress = async () => {
    if (!navigator.geolocation) {
      alert("Trình duyệt không hỗ trợ định vị.");
      return;
    }

    setLocating(true);
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const lat = pos?.coords?.latitude;
      const lng = pos?.coords?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("invalid_coords");
      }

      let displayName = "";
      let addr = null;

      try {
        const r = await reverseGeocodeOSM(lat, lng);
        displayName = safeStr(r?.display_name);
        addr = r?.address || null;
      } catch {
        displayName = "";
        addr = null;
      }

      // Ưu tiên: hiển thị địa chỉ text dễ hiểu
      if (addr) {
        // Ưu tiên line địa chỉ dễ hiểu cho textarea: số nhà + đường + khu vực gần
        const house = normalizePart(addr.house_number);
        const road = normalizePart(addr.road);
        const neighbourhood = normalizePart(
          addr.neighbourhood || addr.suburb || addr.quarter,
        );

        const detailLine = dedupeParts([house, road, neighbourhood]).join(" ");
        setField("detail", detailLine || displayName || "");
      } else if (displayName) {
        // fallback nếu không có structured address
        setField("detail", displayName);
      } else {
        setField("detail", "");
      }

      // Best-effort: tự map tỉnh/quận/phường theo tên (không bắt buộc)
      // Nếu bạn không muốn map tự động thì comment block này.
      if (addr && Array.isArray(provinces) && provinces.length > 0) {
        const provName = safeStr(
          addr.state || addr.city || addr.county || addr.province,
        ).toLowerCase();

        const foundProv =
          provinces.find((p) => safeStr(p.name).toLowerCase() === provName) ||
          provinces.find((p) =>
            safeStr(p.name).toLowerCase().includes(provName),
          );

        if (foundProv?.code) {
          handleProvinceChange(String(foundProv.code));

          // district có sau setProvince
          // đợi 1 tick để districts cập nhật
          setTimeout(async () => {
            const distName = safeStr(
              addr.county || addr.city_district || addr.district || "",
            ).toLowerCase();

            const ds = (foundProv.districts || []).map((d) => d);
            const foundDist =
              ds.find((d) => safeStr(d.name).toLowerCase() === distName) ||
              ds.find((d) => safeStr(d.name).toLowerCase().includes(distName));

            if (foundDist?.code) {
              await handleDistrictChange(String(foundDist.code));

              setTimeout(() => {
                const wardName = safeStr(
                  addr.suburb ||
                    addr.village ||
                    addr.town ||
                    addr.quarter ||
                    "",
                ).toLowerCase();

                const ws = wards || [];
                const foundWard =
                  ws.find((w) => safeStr(w.name).toLowerCase() === wardName) ||
                  ws.find((w) =>
                    safeStr(w.name).toLowerCase().includes(wardName),
                  );

                if (foundWard?.code) handleWardChange(String(foundWard.code));
              }, 150);
            }
          }, 150);
        }
      }
    } catch (e) {
      console.warn(e);
      alert("Không lấy được địa chỉ hiện tại. Vui lòng thử lại hoặc nhập tay.");
    } finally {
      setLocating(false);
    }
  };

  const candidateCheck = useMemo(
    () =>
      deriveCandidateMatches(filteredCustomers, {
        email: form.email,
        phone: form.phone,
      }),
    [filteredCustomers, form.email, form.phone],
  );
  const identityConflict = useMemo(() => {
    const ec = candidateCheck.byEmail?.[0] || null;
    const pc = candidateCheck.byPhone?.[0] || null;
    return detectIdentityConflict(ec, pc);
  }, [candidateCheck]);

  const handleUseSnapshotForCurrentOrder = () => {
    const errMsg = validateSnapshotForCurrentOrder();
    if (errMsg) {
      showNotification?.(errMsg, "error");
      return;
    }

    const selected = {
      id: null,
      customerIdentityMode: "snapshot_only",
      conflict: !!identityConflict,
      name: safeStr(form.name),
      phone: normalizePhone(form.phone),
      email: normalizeEmail(form.email),
      note: safeStr(form.note),
      isNew: false,
      addressText: safeStr(fullAddress),
      shippingInfo: {
        fullName: safeStr(form.name),
        phone: normalizePhone(form.phone),
        email: normalizeEmail(form.email),
        address: safeStr(fullAddress),
        note: safeStr(form.note),
        deliveryMethod: "ship_now",
        deliveryTime: "",
        scheduleDate: "",
        scheduleTime: "",
      },
    };

    onSelectCustomer?.(selected);
    clearDraft();
    setForm(emptyForm);
    showNotification?.("Đã dùng thông tin khách cho đơn hiện tại.", "success");
    onClose?.();
  };

  const handleSaveCustomer = async () => {
    const errMsg = validateCreate();
    if (errMsg) {
      showNotification?.(errMsg, "error");
      return;
    }

    setSaving(true);
    try {
      const input = {
        restaurantId,
        fullName: safeStr(form.name),
        phone: normalizePhone(form.phone),
        email: normalizeEmail(form.email) || null,
        defaultAddress: safeStr(fullAddress),
        note: safeStr(form.note),
        source: "POS",
      };

      const res = await upsertPosCustomer({
        variables: { input },
      });

      const saved = res?.data?.upsertPosCustomer;
      if (!saved?.id) {
        throw new Error("Không lưu được khách quen.");
      }

      const selected = {
        id: saved.id,
        name: safeStr(saved.fullName),
        phone: safeStr(saved.phone),
        email: safeStr(saved.email),
        note: safeStr(saved.note),
        isNew: false,
        addressText: safeStr(saved.defaultAddress),
        shippingInfo: {
          fullName: safeStr(saved.fullName),
          phone: safeStr(saved.phone),
          email: safeStr(saved.email),
          address: safeStr(saved.defaultAddress),
          note: safeStr(saved.note),
          deliveryMethod: "ship_now",
          deliveryTime: "",
          scheduleDate: "",
          scheduleTime: "",
        },
      };

      onSelectCustomer?.(selected);
      clearDraft();
      setForm(emptyForm);
      showNotification?.("Đã lưu khách quen.", "success");
      onClose?.();

      loadCustomers?.({
        variables: {
          restaurantId,
          keyword: "",
          email: null,
          phone: null,
        },
      }).catch(() => {});
    } catch (e) {
      console.error(e);
      showNotification?.(
        e?.message || "Lưu khách thất bại, vui lòng thử lại.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeWithConfirm}
      title="Khách quen"
      width={560}
    >
      <div className={cls.wrapper}>
        <div className={cls.tabs}>
          <button
            className={`${cls.tab} ${tab === "select" ? cls.active : ""}`}
            onClick={() => setTab("select")}
          >
            Chọn khách
          </button>
          <button
            className={`${cls.tab} ${tab === "create" ? cls.active : ""}`}
            onClick={() => setTab("create")}
          >
            Thêm mới
          </button>
        </div>

        {tab === "select" && (
          <div className={cls.selectTab}>
            <div className={cls.searchRow}>
              <input
                className={cls.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên / sđt / email..."
              />

              <Button onClick={() => setTab("create")} variant="ghost">
                + Thêm
              </Button>
            </div>

            <div className={cls.list}>
              {(filteredCustomers || []).map((c) => (
                <button
                  key={c.id || c._id}
                  className={cls.customerRow}
                  onClick={() => handlePickCustomer(c)}
                >
                  <div className={cls.customerMain}>
                    <div className={cls.customerName}>
                      {c.name}
                      {c.source ? (
                        <span
                          style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}
                        >
                          [{safeStr(c.source).toUpperCase()}]
                        </span>
                      ) : null}
                    </div>
                    <div className={cls.customerSub}>
                      {safeStr(c.phone)}
                      {c.email ? ` · ${c.email}` : ""}
                    </div>
                  </div>
                  <div className={cls.customerAddr}>
                    {safeStr(c?.shippingInfo?.address || c?.address) ||
                      "Chưa có địa chỉ"}
                  </div>
                </button>
              ))}

              {customersLoading && (
                <div className={cls.empty}>Đang tìm khách...</div>
              )}
              {filteredCustomers.length === 0 && (
                <div className={cls.empty}>Chưa có khách nào.</div>
              )}
            </div>
          </div>
        )}

        {tab === "create" && pendingRestore && !hasDirtyForm && (
          <div className={cls.restoreBanner}>
            <span>Có dữ liệu khách nhập dở. Khôi phục?</span>
            <button type="button" onClick={restorePendingDraft}>
              Khôi phục
            </button>
            <button type="button" onClick={discardPendingDraft}>
              Bỏ qua
            </button>
          </div>
        )}

        {tab === "create" && (
          <div className={cls.createTab}>
            <div className={cls.formGrid}>
              <div className={cls.field}>
                <label>Tên khách *</label>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>

              <div className={cls.field}>
                <label>SĐT *</label>
                <input
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="VD: 09xxxx"
                />
              </div>

              <div className={cls.field}>
                <label>Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="VD: abc@gmail.com"
                />
              </div>

              <div className={cls.field}>
                <div className={cls.labelRow}>
                  <label>Địa chỉ *</label>
                  <button
                    type="button"
                    className={cls.btnLocate}
                    onClick={handleGetCurrentAddress}
                    disabled={!!loading || locating}
                    title="Lấy địa chỉ hiện tại"
                  >
                    {locating ? "Đang lấy..." : "Lấy địa chỉ hiện tại"}
                  </button>
                </div>

                <div className={cls.addressSelects}>
                  <select
                    value={provinceKey || ""}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    disabled={!!loading}
                  >
                    <option value="">Tỉnh/TP</option>
                    {(provinces || []).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={districtKey || ""}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    disabled={!provinceKey || !!loading}
                  >
                    <option value="">Quận/Huyện</option>
                    {(districts || []).map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={wardKey || ""}
                    onChange={(e) => handleWardChange(e.target.value)}
                    disabled={!districtKey || !!loading}
                  >
                    <option value="">Phường/Xã</option>
                    {(wards || []).map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  className={cls.addrDetail}
                  value={form.detail}
                  onChange={(e) => setField("detail", e.target.value)}
                  placeholder="Số nhà, tên đường, ghi chú vị trí dễ tìm..."
                  rows={2}
                />

                <div className={cls.addrPreview}>
                  <span>Địa chỉ hiển thị:</span>
                  <strong>{safeStr(fullAddress) || "—"}</strong>
                </div>

                {!!error && <div className={cls.errorText}>{error}</div>}
              </div>

              <div className={cls.field}>
                <label>Ghi chú</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setField("note", e.target.value)}
                  placeholder="Ghi chú thêm..."
                  rows={3}
                />
              </div>
            </div>

            {identityConflict && (
              <div className={cls.empty} style={{ color: "#b91c1c" }}>
                Email và SĐT thuộc hai hồ sơ khác nhau. Không thể lưu khách quen
                để tránh cập nhật sai hồ sơ. Hãy chọn một hồ sơ có sẵn hoặc dùng
                thông tin này cho đơn hiện tại.
              </div>
            )}

            {!identityConflict && candidateCheck.byPhone?.length > 0 && (
              <div className={cls.empty}>
                SĐT đã tồn tại. Nếu lưu, hệ thống sẽ cập nhật hồ sơ khách này.
              </div>
            )}

            {!identityConflict &&
              candidateCheck.byPhone?.length === 0 &&
              candidateCheck.byEmail?.length > 0 && (
                <div className={cls.empty}>
                  Tìm thấy khách trùng thông tin. Bạn có thể chọn khách có sẵn
                  hoặc lưu khách mới.
                </div>
              )}

            {(candidateCheck.byPhone?.length > 0 ||
              candidateCheck.byEmail?.length > 0) && (
              <div>
                {candidateCheck.byPhone?.length > 0 && (
                  <>
                    <div className={cls.empty}>Khớp theo SĐT</div>
                    <div className={cls.list}>
                      {candidateCheck.byPhone.map((c) => (
                        <div
                          key={`phone_${c.id || c._id}`}
                          className={cls.customerRow}
                          style={{ cursor: "default" }}
                        >
                          <div className={cls.customerMain}>
                            <div className={cls.customerName}>
                              {safeStr(c.fullName || c.name)}
                              {c.source ? (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 11,
                                    opacity: 0.7,
                                  }}
                                >
                                  [{safeStr(c.source).toUpperCase()}]
                                </span>
                              ) : null}
                            </div>
                            <div className={cls.customerSub}>
                              {safeStr(c.phone)}
                              {c.email ? ` · ${c.email}` : ""}
                            </div>
                          </div>
                          <div className={cls.customerAddr}>
                            {safeStr(
                              c?.shippingInfo?.address ||
                                c?.address ||
                                c?.defaultAddress,
                            ) || "Chưa có địa chỉ"}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <Button
                              variant="ghost"
                              onClick={() => handlePickCustomer(c)}
                            >
                              Chọn khách này
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {candidateCheck.byEmail?.length > 0 && (
                  <>
                    <div className={cls.empty}>Khớp theo email</div>
                    <div className={cls.list}>
                      {candidateCheck.byEmail
                        .filter(
                          (c) =>
                            candidateCheck.byPhone.findIndex(
                              (p) => String(p.id) === String(c.id),
                            ) === -1,
                        )
                        .map((c) => (
                          <div
                            key={`email_${c.id || c._id}`}
                            className={cls.customerRow}
                            style={{ cursor: "default" }}
                          >
                            <div className={cls.customerMain}>
                              <div className={cls.customerName}>
                                {safeStr(c.fullName || c.name)}
                                {c.source ? (
                                  <span
                                    style={{
                                      marginLeft: 8,
                                      fontSize: 11,
                                      opacity: 0.7,
                                    }}
                                  >
                                    [{safeStr(c.source).toUpperCase()}]
                                  </span>
                                ) : null}
                              </div>
                              <div className={cls.customerSub}>
                                {safeStr(c.phone)}
                                {c.email ? ` · ${c.email}` : ""}
                              </div>
                            </div>
                            <div className={cls.customerAddr}>
                              {safeStr(
                                c?.shippingInfo?.address ||
                                  c?.address ||
                                  c?.defaultAddress,
                              ) || "Chưa có địa chỉ"}
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <Button
                                variant="ghost"
                                onClick={() => handlePickCustomer(c)}
                              >
                                Chọn khách này
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={cls.actions}>
              <Button
                onClick={closeWithConfirm}
                variant="ghost"
                disabled={saving || upsertingCustomer || locating}
              >
                Thoát
              </Button>
              <Button
                onClick={handleUseSnapshotForCurrentOrder}
                variant="ghost"
                disabled={saving || upsertingCustomer || locating}
              >
                Dùng cho đơn hiện tại
              </Button>
              <Button
                onClick={handleSaveCustomer}
                variant="primary"
                disabled={
                  saving || upsertingCustomer || locating || identityConflict
                }
                title={
                  identityConflict
                    ? "Email và SĐT thuộc hai hồ sơ khác nhau. Không thể lưu khách quen."
                    : undefined
                }
              >
                {saving || upsertingCustomer ? "Đang lưu..." : "Lưu khách"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
