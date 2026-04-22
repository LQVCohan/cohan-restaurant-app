import React, { useMemo, useState, useEffect } from "react";
import Modal from "../../common/Modal";
import useUserManagement from "../../../hooks/useUserManagement";
import { useVnAddressLazy } from "../../../hooks/useVnAddressLazy";
import { useNotification } from "../../../hooks/useNotification";
import "./AddCustomerModal.scss";

/* ===== Map VN label -> enum BE ===== */
const VN_TO_ENUM = (v) => {
  if (v === "VIP") return "VIP";
  if (v === "Thường xuyên") return "OFTEN";
  return "NEW";
};

/* ===== Validators ===== */
const isEmail = (v) =>
  !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
const normalizePhoneVN = (v) => {
  if (!v) return "";
  let s = String(v).replace(/\s+/g, "");
  s = s.replace(/^\+84/, "0");
  if (/^84/.test(s)) s = "0" + s.slice(2);
  return s;
};
const isPhoneVN = (v) =>
  /^(0|\+?84)(\d{9,10})$/.test((v || "").replace(/\s+/g, ""));
const strongPassword = (v) =>
  typeof v === "string" && v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

const safeStr = (v) => (v || "").toString().trim();
const normalizePart = (v) => safeStr(v).replace(/\s+/g, " ");
const dedupeParts = (parts) => {
  const seen = new Set();
  const out = [];
  for (const p of (parts || []).map(normalizePart).filter(Boolean)) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
};

async function reverseGeocodeOSM(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&` +
    `lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(
      lng,
    )}&accept-language=vi`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse_geocode_failed");
  return res.json();
}

/* ===== UI atoms ===== */
const Input = ({ label, required = false, error, children, hint, icon }) => (
  <label className={`acm-field ${error ? "acm-field--error" : ""}`}>
    <div className="acm-field__top">
      <span className="acm-field__label">
        {icon ? <span className="acm-field__icon">{icon}</span> : null}
        {label}
        {required && <span className="acm-field__required">*</span>}
      </span>
      {hint ? <span className="acm-field__hint">{hint}</span> : null}
    </div>
    <div className="acm-field__input">{children}</div>
    {error ? <div className="acm-field__error">{error}</div> : null}
  </label>
);

const Section = ({ title, children, badge }) => (
  <div className="acm-section">
    <div className="acm-section__header">
      <h4 className="acm-section__title">{title}</h4>
      {badge ? <span className="acm-section__badge">{badge}</span> : null}
    </div>
    <div className="acm-section__content">{children}</div>
  </div>
);

const AddCustomerModal = ({ onClose, onCreated }) => {
  const { roleList, createUser, createGuest, creating, creatingGuest } =
    useUserManagement(); // dùng đúng flags để disable nút
  const { showNotification } = useNotification();
  const submitting = creating || creatingGuest;

  // role "customer" mặc định
  const defaultCustomerRoleId = useMemo(() => {
    const found =
      (roleList || []).find(
        (r) => (r.slug || "").toLowerCase() === "customer",
      ) || (roleList || [])[0];
    return found?.id || "";
  }, [roleList]);

  const [asGuest, setAsGuest] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    customerTypeVN: "Mới",
    addressDetail: "",
    provinceKey: "",
    districtKey: "",
    wardKey: "",
  });
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  const {
    loading: addressLoading,
    error: addressError,
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
    enabled: !asGuest,
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
    if (asGuest) return;
    setForm((prev) => ({
      ...prev,
      provinceKey: provinceKey || "",
      districtKey: districtKey || "",
      wardKey: wardKey || "",
    }));
  }, [asGuest, provinceKey, districtKey, wardKey]);

  const previewAddress = useMemo(() => {
    if (asGuest) return "";
    const detail = normalizePart(form.addressDetail);
    const wardName = normalizePart(selectedWard?.name);
    const districtName = normalizePart(selectedDistrict?.name);
    const cityName = normalizePart(selectedProvince?.name);
    return dedupeParts([detail, wardName, districtName, cityName]).join(", ");
  }, [
    asGuest,
    form.addressDetail,
    selectedWard?.name,
    selectedDistrict?.name,
    selectedProvince?.name,
  ]);

  const onChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
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
    setForm((prev) => ({ ...prev, districtKey: code, wardKey: "" }));
  };
  const handleWardChange = (code) => {
    setWard?.(code);
    setForm((prev) => ({ ...prev, wardKey: code }));
  };

  const handleGetCurrentAddress = async () => {
    if (asGuest || locating) return;
    if (!navigator.geolocation) {
      showNotification("Trình duyệt không hỗ trợ định vị.", "warning");
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

      if (addr) {
        const house = normalizePart(addr.house_number);
        const road = normalizePart(addr.road);
        const neighbourhood = normalizePart(
          addr.neighbourhood || addr.suburb || addr.quarter,
        );
        const detailLine = dedupeParts([house, road, neighbourhood]).join(" ");
        onChange("addressDetail", detailLine || displayName || "");
      } else {
        onChange("addressDetail", displayName || "");
      }

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
          setTimeout(async () => {
            const distName = safeStr(
              addr.county || addr.city_district || addr.district || "",
            ).toLowerCase();
            const foundDist =
              (foundProv.districts || []).find(
                (d) => safeStr(d.name).toLowerCase() === distName,
              ) ||
              (foundProv.districts || []).find((d) =>
                safeStr(d.name).toLowerCase().includes(distName),
              );
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
                const foundWard =
                  (wards || []).find(
                    (w) => safeStr(w.name).toLowerCase() === wardName,
                  ) ||
                  (wards || []).find((w) =>
                    safeStr(w.name).toLowerCase().includes(wardName),
                  );
                if (foundWard?.code) handleWardChange(String(foundWard.code));
              }, 160);
            }
          }, 160);
        }
      }
    } catch (err) {
      console.warn(err);
      showNotification(
        "Không lấy được địa chỉ hiện tại. Vui lòng chọn tay hoặc nhập chi tiết.",
        "warning",
      );
    } finally {
      setLocating(false);
    }
  };

  const validate = () => {
    const e = {};
    setSubmitError("");

    const fullName = (form.fullName || "").trim();
    const email = (form.email || "").trim();
    const phone = normalizePhoneVN(form.phone || "");
    const pwd = form.password || "";
    const confirm = form.confirmPassword || "";

    if (!fullName) e.fullName = "Vui lòng nhập họ tên";

    if (asGuest) {
      if (!phone) e.phone = "Vui lòng nhập số điện thoại";
      else if (!isPhoneVN(phone)) e.phone = "Số điện thoại không hợp lệ";
    } else {
      if (!email && !phone)
        e.contact = "Vui lòng nhập ít nhất Email hoặc Số điện thoại";
      if (email && !isEmail(email)) e.email = "Email không hợp lệ";
      if (phone && !isPhoneVN(phone)) e.phone = "Số điện thoại không hợp lệ";

      if (!strongPassword(pwd))
        e.password = "Mật khẩu tối thiểu 8 ký tự, gồm chữ và số";
      if (pwd !== confirm) e.confirmPassword = "Mật khẩu nhập lại không khớp";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!validate()) {
      // vừa giữ alert inline, vừa bắn toast
      const msg = "Vui lòng kiểm tra lại các trường bôi đỏ.";
      setSubmitError(msg);
      showNotification(msg, "warning");
      return;
    }

    try {
      if (asGuest) {
        await createGuest({
          fullName: form.fullName.trim(),
          phone: normalizePhoneVN(form.phone),
          expiresInDays: 30,
        });
        let syncResult = null;
        if (typeof onCreated === "function") {
          syncResult = await onCreated();
        }
        if (syncResult?.visibleInCurrentList === false) {
          showNotification(
            "Tạo khách vãng lai thành công. Bản ghi mới không thuộc bộ lọc/tìm kiếm hiện tại.",
            "success",
          );
        } else {
          showNotification("Tạo khách vãng lai thành công.", "success");
        }
        onClose?.();
        return;
      }

      const created = await createUser({
        fullName: form.fullName.trim(),
        username: form.username.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: normalizePhoneVN(form.phone) || undefined,
        password: form.password,
        customerType: VN_TO_ENUM(form.customerTypeVN),
        roleSlug: "customer",
        roleId: defaultCustomerRoleId || undefined,
        provider: "local",
        status: "active",
        address: {
          line1: safeStr(form.addressDetail),
          line2: safeStr(previewAddress),
          ward: safeStr(selectedWard?.name),
          district: safeStr(selectedDistrict?.name),
          city: safeStr(selectedProvince?.name),
          country: "Vietnam",
        },
        captchaToken:
          typeof window !== "undefined" && window.__recaptchaToken
            ? window.__recaptchaToken
            : undefined,
      });
      const createdUser = created?.data?.createUser?.user || null;
      let syncResult = null;
      if (typeof onCreated === "function") {
        syncResult = await onCreated(createdUser);
      }

      if (syncResult?.visibleInCurrentList === false) {
        showNotification(
          "Tạo khách hàng thành công. Khách hàng mới không nằm trong bộ lọc/tìm kiếm hiện tại.",
          "success",
        );
      } else {
        showNotification("Tạo khách hàng thành công.", "success");
      }
      onClose?.();
    } catch (err) {
      // Ưu tiên thông điệp BE
      const gErr = err?.graphQLErrors?.[0];
      let msg =
        gErr?.message ||
        err?.message ||
        "Không thể tạo khách hàng. Thử lại sau.";

      // Chuẩn hóa 1 số tình huống thường gặp
      const lower = (msg || "").toLowerCase();
      if (
        lower.includes("already in use") ||
        lower.includes("duplicate") ||
        lower.includes("exists")
      ) {
        msg = "Email/Phone/Username already in use";
      }

      setSubmitError(msg); // hiển thị trong modal
      showNotification(msg, "error"); // bắn toast
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="➕ Thêm khách hàng"
      size="lg"
      closeOnOverlayClick
      closeOnEscape
    >
      <div className="add-customer-modal">
        {/* Toggle kiểu tạo */}
        <div className="acm-toggle">
          <button
            type="button"
            onClick={() => setAsGuest(false)}
            className={`acm-toggle__btn ${!asGuest ? "is-active" : ""}`}
          >
            📇 Tài khoản đầy đủ
          </button>
          <button
            type="button"
            onClick={() => setAsGuest(true)}
            className={`acm-toggle__btn ${asGuest ? "is-active" : ""}`}
          >
            🟡 Guest nhanh
          </button>
        </div>

        {/* Error summary */}
        {submitError && (
          <div className="acm-alert acm-alert--error">
            <span>⚠️ {submitError}</span>
          </div>
        )}

        {/* Form */}
        {!asGuest ? (
          <>
            <Section title="Thông tin cơ bản" badge="Bắt buộc">
              <div className="acm-grid">
                <Input
                  label="Họ và tên"
                  required
                  error={errors.fullName}
                  icon="👤"
                >
                  <input
                    className="acm-input"
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    onChange={(e) => onChange("fullName", e.target.value)}
                  />
                </Input>

                <Input label="Tên đăng nhập" icon="🏷️">
                  <input
                    className="acm-input"
                    placeholder="an.nguyen"
                    value={form.username}
                    onChange={(e) => onChange("username", e.target.value)}
                  />
                </Input>

                <Input label="Email" error={errors.email} icon="📧">
                  <input
                    className="acm-input"
                    type="email"
                    placeholder="an.nguyen@email.com"
                    value={form.email}
                    onChange={(e) => onChange("email", e.target.value)}
                  />
                </Input>

                <Input label="Số điện thoại" error={errors.phone} icon="📱">
                  <input
                    className="acm-input"
                    placeholder="0901234567"
                    value={form.phone}
                    onChange={(e) => onChange("phone", e.target.value)}
                  />
                </Input>

                <Input
                  label="Mật khẩu"
                  required
                  error={errors.password}
                  icon="🔒"
                  hint="Tối thiểu 8 ký tự, gồm chữ và số"
                >
                  <input
                    className="acm-input"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => onChange("password", e.target.value)}
                  />
                </Input>

                <Input
                  label="Nhập lại mật khẩu"
                  required
                  error={errors.confirmPassword}
                  icon="✅"
                >
                  <input
                    className="acm-input"
                    type="password"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      onChange("confirmPassword", e.target.value)
                    }
                  />
                </Input>

                {errors.contact && (
                  <div className="acm-col-2">
                    <div className="acm-field__error acm-field__error--block">
                      {errors.contact}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Phân loại khách hàng">
              <div className="acm-grid">
                <Input label="Loại khách hàng" icon="🎯">
                  <select
                    className="acm-input"
                    value={form.customerTypeVN}
                    onChange={(e) => onChange("customerTypeVN", e.target.value)}
                  >
                    <option value="Mới">🆕 Mới</option>
                    <option value="Thường xuyên">🔥 Thường xuyên</option>
                    <option value="VIP">⭐ VIP</option>
                  </select>
                </Input>
              </div>
            </Section>

            <Section title="Địa chỉ">
              <div className="acm-grid">
                <div className="acm-col-2">
                  <div className="acm-address-head">
                    <span className="acm-address-title">Địa chỉ nhận diện</span>
                    <button
                      type="button"
                      className="acm-btn-locate"
                      onClick={handleGetCurrentAddress}
                      disabled={addressLoading || locating}
                    >
                      {locating ? "Đang lấy..." : "Lấy địa chỉ hiện tại"}
                    </button>
                  </div>
                </div>

                <Input label="Tỉnh/Thành phố" icon="🏙️">
                  <select
                    className="acm-input"
                    value={provinceKey || ""}
                    onChange={(e) => handleProvinceChange(e.target.value)}
                    disabled={addressLoading}
                  >
                    <option value="">Chọn tỉnh/thành</option>
                    {(provinces || []).map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Input>

                <Input label="Quận/Huyện" icon="🏘️">
                  <select
                    className="acm-input"
                    value={districtKey || ""}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    disabled={!provinceKey || addressLoading}
                  >
                    <option value="">Chọn quận/huyện</option>
                    {(districts || []).map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Input>

                <Input label="Phường/Xã" icon="🧭">
                  <select
                    className="acm-input"
                    value={wardKey || ""}
                    onChange={(e) => handleWardChange(e.target.value)}
                    disabled={!districtKey || addressLoading}
                  >
                    <option value="">Chọn phường/xã</option>
                    {(wards || []).map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Input>

                <div className="acm-col-2">
                  <Input label="Chi tiết địa chỉ" icon="📍">
                    <input
                      className="acm-input"
                      placeholder="Số nhà, tên đường, tòa nhà..."
                      value={form.addressDetail}
                      onChange={(e) =>
                        onChange("addressDetail", e.target.value)
                      }
                    />
                  </Input>
                  <div className="acm-address-preview">
                    <span>Địa chỉ hiển thị:</span>
                    <strong>{previewAddress || "—"}</strong>
                  </div>
                  {addressError ? (
                    <div className="acm-field__error acm-field__error--block">
                      {addressError}
                    </div>
                  ) : null}
                </div>
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section title="Guest nhanh" badge="Tối giản">
              <div className="acm-grid">
                <Input
                  label="Họ và tên"
                  required
                  error={errors.fullName}
                  icon="👤"
                >
                  <input
                    className="acm-input"
                    placeholder="Khách vãng lai"
                    value={form.fullName}
                    onChange={(e) => onChange("fullName", e.target.value)}
                  />
                </Input>

                <Input
                  label="Số điện thoại"
                  required
                  error={errors.phone}
                  icon="📱"
                >
                  <input
                    className="acm-input"
                    placeholder="090..."
                    value={form.phone}
                    onChange={(e) => onChange("phone", e.target.value)}
                  />
                </Input>

                <div className="acm-col-2">
                  <div className="acm-note">
                    Tạo nhanh <b>Guest</b> chỉ cần họ tên &amp; SĐT. Tài khoản
                    tự hết hạn sau 30 ngày (thiết lập tại BE).
                  </div>
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      <Modal.Footer>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Hủy
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {asGuest ? "🟡 Tạo khách vãng lai" : "💾 Lưu khách hàng"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddCustomerModal;
