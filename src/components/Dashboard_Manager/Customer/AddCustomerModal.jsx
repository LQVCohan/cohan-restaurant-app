import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../common/Modal";
import useUserManagement from "../../../hooks/useUserManagement";
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

const AddCustomerModal = ({ onClose }) => {
  const { roleList, createUser, createGuest, creating, creatingGuest } =
    useUserManagement(); // dùng đúng flags để disable nút
  const { showNotification } = useNotification();
  const submitting = creating || creatingGuest;

  // role "customer" mặc định
  const defaultCustomerRoleId = useMemo(() => {
    const found =
      (roleList || []).find(
        (r) => (r.slug || "").toLowerCase() === "customer"
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
    address: {
      line1: "",
      line2: "",
      ward: "",
      district: "",
      city: "",
      country: "Vietnam",
    },
    customerTypeVN: "Mới",
    roleId: "",
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!form.roleId && defaultCustomerRoleId) {
      setForm((f) => ({ ...f, roleId: defaultCustomerRoleId }));
    }
  }, [defaultCustomerRoleId]); // eslint-disable-line

  const onChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const onAddr = (field, value) =>
    setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));

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
        showNotification("Tạo khách vãng lai thành công.", "success");
        onClose?.();
        return;
      }

      await createUser({
        fullName: form.fullName.trim(),
        username: form.username.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: normalizePhoneVN(form.phone) || undefined,
        password: form.password,
        address: form.address,
        customerType: VN_TO_ENUM(form.customerTypeVN),
        roleId: form.roleId || defaultCustomerRoleId,
        provider: "local",
        status: "active",
        captchaToken:
          typeof window !== "undefined" && window.__recaptchaToken
            ? window.__recaptchaToken
            : undefined,
      });

      showNotification("Tạo khách hàng thành công.", "success");
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

            <Section title="Phân loại & vai trò">
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

                <Input label="Vai trò" icon="🛡️">
                  <select
                    className="acm-input"
                    value={form.roleId}
                    onChange={(e) => onChange("roleId", e.target.value)}
                  >
                    {(roleList || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.slug})
                      </option>
                    ))}
                  </select>
                </Input>
              </div>
            </Section>

            <Section title="Địa chỉ" badge="Tuỳ chọn">
              <div className="acm-grid">
                <Input label="Dòng 1" icon="🏠">
                  <input
                    className="acm-input"
                    placeholder="Số nhà, đường"
                    value={form.address.line1}
                    onChange={(e) => onAddr("line1", e.target.value)}
                  />
                </Input>
                <Input label="Dòng 2">
                  <input
                    className="acm-input"
                    placeholder="Khu, tòa nhà (nếu có)"
                    value={form.address.line2}
                    onChange={(e) => onAddr("line2", e.target.value)}
                  />
                </Input>
                <Input label="Phường/Xã">
                  <input
                    className="acm-input"
                    value={form.address.ward}
                    onChange={(e) => onAddr("ward", e.target.value)}
                  />
                </Input>
                <Input label="Quận/Huyện">
                  <input
                    className="acm-input"
                    value={form.address.district}
                    onChange={(e) => onAddr("district", e.target.value)}
                  />
                </Input>
                <Input label="Thành phố/Tỉnh">
                  <input
                    className="acm-input"
                    value={form.address.city}
                    onChange={(e) => onAddr("city", e.target.value)}
                  />
                </Input>
                <Input label="Quốc gia">
                  <input
                    className="acm-input"
                    value={form.address.country}
                    onChange={(e) => onAddr("country", e.target.value)}
                  />
                </Input>
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
