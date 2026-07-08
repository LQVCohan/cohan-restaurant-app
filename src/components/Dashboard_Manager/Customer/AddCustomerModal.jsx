import React, { useEffect, useMemo, useState } from "react";
import {
  LocateFixed,
  ShieldCheck,
  UserPlus,
  Zap,
} from "lucide-react";
import Modal from "../../common/Modal";
import useUserManagement from "../../../hooks/useUserManagement";
import { useVnAddressLazy } from "../../../hooks/useVnAddressLazy";
import { useNotification } from "../../../hooks/useNotification";
import "./AddCustomerModal.scss";

const CUSTOMER_FORM_ID = "add-customer-form";
const NO_AUTOFILL_PROPS = {
  autoComplete: "off",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
};
const NEW_PASSWORD_PROPS = {
  autoComplete: "new-password",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
};

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
  if (/^84/.test(s)) s = `0${s.slice(2)}`;
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
const Input = ({ label, required = false, error, children, hint }) => (
  <label className={`acm-field ${error ? "acm-field--error" : ""}`}>
    <div className="acm-field__top">
      <span className="acm-field__label">
        {label}
        {required && <span className="acm-field__required">*</span>}
      </span>
      {hint ? <span className="acm-field__hint">{hint}</span> : null}
    </div>
    <div className="acm-field__input">{children}</div>
    {error ? (
      <div className="acm-field__error" role="alert">
        {error}
      </div>
    ) : null}
  </label>
);

const Section = ({ title, children, badge }) => (
  <section className="acm-section">
    <div className="acm-section__header">
      <h3 className="acm-section__title">{title}</h3>
      {badge ? <span className="acm-section__badge">{badge}</span> : null}
    </div>
    <div className="acm-section__content">{children}</div>
  </section>
);

const AddCustomerModal = ({ onClose, onCreated }) => {
  const { roleList, createUser, createGuest, creating, creatingGuest } =
    useUserManagement();
  const { showNotification } = useNotification();
  const submitting = creating || creatingGuest;

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

  const selectedWard = useMemo(
    () =>
      (wards || []).find((w) => String(w.code) === String(wardKey)) || null,
    [wards, wardKey],
  );

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

  const onChange = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleModeChange = (nextAsGuest) => {
    setAsGuest(nextAsGuest);
    setErrors({});
    setSubmitError("");
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
        const result = await reverseGeocodeOSM(lat, lng);
        displayName = safeStr(result?.display_name);
        addr = result?.address || null;
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
                if (foundWard?.code) {
                  handleWardChange(String(foundWard.code));
                }
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
    const nextErrors = {};
    setSubmitError("");

    const fullName = (form.fullName || "").trim();
    const email = (form.email || "").trim();
    const phone = normalizePhoneVN(form.phone || "");
    const pwd = form.password || "";
    const confirm = form.confirmPassword || "";

    if (!fullName) nextErrors.fullName = "Vui lòng nhập họ tên";

    if (asGuest) {
      if (!phone) nextErrors.phone = "Vui lòng nhập số điện thoại";
      else if (!isPhoneVN(phone)) {
        nextErrors.phone = "Số điện thoại không hợp lệ";
      }
    } else {
      if (!email && !phone) {
        nextErrors.contact = "Vui lòng nhập ít nhất email hoặc số điện thoại";
      }
      if (email && !isEmail(email)) nextErrors.email = "Email không hợp lệ";
      if (phone && !isPhoneVN(phone)) {
        nextErrors.phone = "Số điện thoại không hợp lệ";
      }
      if (!strongPassword(pwd)) {
        nextErrors.password = "Mật khẩu tối thiểu 8 ký tự, gồm chữ và số";
      }
      if (pwd !== confirm) {
        nextErrors.confirmPassword = "Mật khẩu nhập lại không khớp";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!validate()) {
      const msg = "Vui lòng kiểm tra lại các trường được đánh dấu.";
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
        const syncResult =
          typeof onCreated === "function" ? await onCreated() : null;
        showNotification(
          syncResult?.visibleInCurrentList === false
            ? "Tạo khách vãng lai thành công. Bản ghi mới không thuộc bộ lọc hiện tại."
            : "Tạo khách vãng lai thành công.",
          "success",
        );
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
      const syncResult =
        typeof onCreated === "function" ? await onCreated(createdUser) : null;

      showNotification(
        syncResult?.visibleInCurrentList === false
          ? "Tạo khách hàng thành công. Khách hàng mới không nằm trong bộ lọc hiện tại."
          : "Tạo khách hàng thành công.",
        "success",
      );
      onClose?.();
    } catch (err) {
      const graphError = err?.graphQLErrors?.[0];
      let msg =
        graphError?.message ||
        err?.message ||
        "Không thể tạo khách hàng. Vui lòng thử lại.";
      const lower = msg.toLowerCase();
      if (
        lower.includes("already in use") ||
        lower.includes("duplicate") ||
        lower.includes("exists")
      ) {
        msg = "Email, số điện thoại hoặc tên đăng nhập đã được sử dụng.";
      }
      setSubmitError(msg);
      showNotification(msg, "error");
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Thêm khách hàng"
      size="lg"
      closeOnOverlayClick
      closeOnEscape
    >
      <form
        id={CUSTOMER_FORM_ID}
        className="add-customer-modal"
        autoComplete="off"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <div className="acm-intro">
          <span className="acm-intro__icon" aria-hidden="true">
            <UserPlus size={21} strokeWidth={2.1} />
          </span>
          <div className="acm-intro__copy">
            <strong>Tạo hồ sơ khách hàng mới</strong>
            <span>
              Biểu mẫu luôn bắt đầu trống và không dùng lại thông tin tài khoản
              quản trị đang đăng nhập.
            </span>
          </div>
          <span className="acm-intro__status">
            <ShieldCheck size={15} aria-hidden="true" />
            Không tự điền
          </span>
        </div>

        <div className="acm-toggle" role="group" aria-label="Kiểu khách hàng">
          <button
            type="button"
            onClick={() => handleModeChange(false)}
            className={`acm-toggle__btn ${!asGuest ? "is-active" : ""}`}
            aria-pressed={!asGuest}
          >
            <UserPlus size={17} aria-hidden="true" />
            <span>
              <strong>Tài khoản khách hàng</strong>
              <small>Đầy đủ thông tin đăng nhập</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange(true)}
            className={`acm-toggle__btn ${asGuest ? "is-active" : ""}`}
            aria-pressed={asGuest}
          >
            <Zap size={17} aria-hidden="true" />
            <span>
              <strong>Khách vãng lai</strong>
              <small>Tạo nhanh bằng họ tên và SĐT</small>
            </span>
          </button>
        </div>

        {submitError ? (
          <div className="acm-alert acm-alert--error" role="alert">
            {submitError}
          </div>
        ) : null}

        {!asGuest ? (
          <>
            <Section title="Thông tin cơ bản" badge="Bắt buộc">
              <div className="acm-grid">
                <Input label="Họ và tên" required error={errors.fullName}>
                  <input
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-full-name"
                    placeholder="Nguyễn Văn A"
                    value={form.fullName}
                    required
                    aria-invalid={Boolean(errors.fullName)}
                    onChange={(event) =>
                      onChange("fullName", event.target.value)
                    }
                  />
                </Input>

                <Input label="Tên đăng nhập">
                  <input
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-username"
                    placeholder="an.nguyen"
                    value={form.username}
                    spellCheck={false}
                    onChange={(event) =>
                      onChange("username", event.target.value)
                    }
                  />
                </Input>

                <Input label="Email" error={errors.email}>
                  <input
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-email"
                    type="email"
                    inputMode="email"
                    placeholder="an.nguyen@email.com"
                    value={form.email}
                    spellCheck={false}
                    aria-invalid={Boolean(errors.email)}
                    onChange={(event) => onChange("email", event.target.value)}
                  />
                </Input>

                <Input label="Số điện thoại" error={errors.phone}>
                  <input
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="0901234567"
                    value={form.phone}
                    aria-invalid={Boolean(errors.phone)}
                    onChange={(event) => onChange("phone", event.target.value)}
                  />
                </Input>

                <Input
                  label="Mật khẩu"
                  required
                  error={errors.password}
                  hint="Tối thiểu 8 ký tự, gồm chữ và số"
                >
                  <input
                    {...NEW_PASSWORD_PROPS}
                    className="acm-input"
                    name="new-customer-password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    required
                    spellCheck={false}
                    aria-invalid={Boolean(errors.password)}
                    onChange={(event) =>
                      onChange("password", event.target.value)
                    }
                  />
                </Input>

                <Input
                  label="Nhập lại mật khẩu"
                  required
                  error={errors.confirmPassword}
                >
                  <input
                    {...NEW_PASSWORD_PROPS}
                    className="acm-input"
                    name="new-customer-password-confirmation"
                    type="password"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    required
                    spellCheck={false}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    onChange={(event) =>
                      onChange("confirmPassword", event.target.value)
                    }
                  />
                </Input>

                {errors.contact ? (
                  <div className="acm-col-2">
                    <div
                      className="acm-field__error acm-field__error--block"
                      role="alert"
                    >
                      {errors.contact}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>

            <Section title="Phân loại khách hàng">
              <div className="acm-grid acm-grid--single">
                <Input label="Loại khách hàng">
                  <select
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-type"
                    value={form.customerTypeVN}
                    onChange={(event) =>
                      onChange("customerTypeVN", event.target.value)
                    }
                  >
                    <option value="Mới">Mới</option>
                    <option value="Thường xuyên">Thường xuyên</option>
                    <option value="VIP">VIP</option>
                  </select>
                </Input>
              </div>
            </Section>

            <Section title="Địa chỉ">
              <div className="acm-grid">
                <div className="acm-col-2">
                  <div className="acm-address-head">
                    <div>
                      <span className="acm-address-title">Địa chỉ nhận diện</span>
                      <small>Không bắt buộc, có thể bổ sung sau.</small>
                    </div>
                    <button
                      type="button"
                      className="acm-btn-locate"
                      onClick={handleGetCurrentAddress}
                      disabled={addressLoading || locating}
                    >
                      <LocateFixed size={15} aria-hidden="true" />
                      {locating ? "Đang lấy địa chỉ..." : "Lấy địa chỉ hiện tại"}
                    </button>
                  </div>
                </div>

                <Input label="Tỉnh/Thành phố">
                  <select
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-province"
                    value={provinceKey || ""}
                    onChange={(event) =>
                      handleProvinceChange(event.target.value)
                    }
                    disabled={addressLoading}
                  >
                    <option value="">Chọn tỉnh/thành</option>
                    {(provinces || []).map((province) => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </Input>

                <Input label="Quận/Huyện">
                  <select
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-district"
                    value={districtKey || ""}
                    onChange={(event) =>
                      handleDistrictChange(event.target.value)
                    }
                    disabled={!provinceKey || addressLoading}
                  >
                    <option value="">Chọn quận/huyện</option>
                    {(districts || []).map((district) => (
                      <option key={district.code} value={district.code}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                </Input>

                <Input label="Phường/Xã">
                  <select
                    {...NO_AUTOFILL_PROPS}
                    className="acm-input"
                    name="new-customer-ward"
                    value={wardKey || ""}
                    onChange={(event) => handleWardChange(event.target.value)}
                    disabled={!districtKey || addressLoading}
                  >
                    <option value="">Chọn phường/xã</option>
                    {(wards || []).map((ward) => (
                      <option key={ward.code} value={ward.code}>
                        {ward.name}
                      </option>
                    ))}
                  </select>
                </Input>

                <div className="acm-col-2">
                  <Input label="Chi tiết địa chỉ">
                    <input
                      {...NO_AUTOFILL_PROPS}
                      className="acm-input"
                      name="new-customer-address-detail"
                      placeholder="Số nhà, tên đường, tòa nhà..."
                      value={form.addressDetail}
                      onChange={(event) =>
                        onChange("addressDetail", event.target.value)
                      }
                    />
                  </Input>
                  <div className="acm-address-preview" aria-live="polite">
                    <span>Địa chỉ hiển thị</span>
                    <strong>{previewAddress || "Chưa có địa chỉ"}</strong>
                  </div>
                  {addressError ? (
                    <div
                      className="acm-field__error acm-field__error--block"
                      role="alert"
                    >
                      {addressError}
                    </div>
                  ) : null}
                </div>
              </div>
            </Section>
          </>
        ) : (
          <Section title="Khách vãng lai" badge="Tạo nhanh">
            <div className="acm-grid">
              <Input label="Họ và tên" required error={errors.fullName}>
                <input
                  {...NO_AUTOFILL_PROPS}
                  className="acm-input"
                  name="new-guest-full-name"
                  placeholder="Khách vãng lai"
                  value={form.fullName}
                  required
                  aria-invalid={Boolean(errors.fullName)}
                  onChange={(event) =>
                    onChange("fullName", event.target.value)
                  }
                />
              </Input>

              <Input label="Số điện thoại" required error={errors.phone}>
                <input
                  {...NO_AUTOFILL_PROPS}
                  className="acm-input"
                  name="new-guest-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0901234567"
                  value={form.phone}
                  required
                  aria-invalid={Boolean(errors.phone)}
                  onChange={(event) => onChange("phone", event.target.value)}
                />
              </Input>

              <div className="acm-col-2">
                <div className="acm-note">
                  Hồ sơ khách vãng lai chỉ lưu họ tên và số điện thoại, tự hết
                  hạn sau 30 ngày theo cấu hình hiện tại.
                </div>
              </div>
            </div>
          </Section>
        )}
      </form>

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
          type="submit"
          form={CUSTOMER_FORM_ID}
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting
            ? "Đang lưu..."
            : asGuest
              ? "Tạo khách vãng lai"
              : "Lưu khách hàng"}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddCustomerModal;
