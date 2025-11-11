// src/pages/CustomerManagement/AddCustomerModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import Modal, { ModalFooter } from "../../common/Modal";
import useUserManagement from "../../../hooks/useUserManagement";

const VN_TO_ENUM = (v) => {
  if (v === "VIP") return "VIP";
  if (v === "Thường xuyên") return "OFTEN";
  return "NEW"; // "Mới"
};

const enumToVN = (v) => {
  const t = (v || "").toUpperCase();
  if (t === "VIP") return "VIP";
  if (t === "OFTEN") return "Thường xuyên";
  return "Mới";
};

const Input = ({ label, children }) => (
  <label className="block">
    <span className="text-sm text-gray-600">{label}</span>
    {children}
  </label>
);

const AddCustomerModal = ({ onClose }) => {
  const { roleList, createUser, createGuest, loading } = useUserManagement();

  // tìm role "customer" mặc định
  const defaultCustomerRoleId = useMemo(() => {
    const found = (roleList || []).find(
      (r) => (r.slug || "").toLowerCase() === "customer"
    );
    return found?.id || "";
  }, [roleList]);

  // form state
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
    avatarUrl: "",
    customerTypeVN: "Mới",
    roleId: defaultCustomerRoleId,
  });

  useEffect(() => {
    // cập nhật roleId mặc định sau khi load roleList
    if (!form.roleId && defaultCustomerRoleId) {
      setForm((f) => ({ ...f, roleId: defaultCustomerRoleId }));
    }
  }, [defaultCustomerRoleId]); // eslint-disable-line

  const [errors, setErrors] = useState({});
  const [asGuest, setAsGuest] = useState(false);

  const onChange = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const onAddressChange = (field, value) =>
    setForm((f) => ({ ...f, address: { ...f.address, [field]: value } }));

  const validate = () => {
    const e = {};
    if (!asGuest) {
      if (!form.fullName.trim()) e.fullName = "Vui lòng nhập họ tên";
      if (!form.password.trim()) e.password = "Vui lòng nhập mật khẩu";
      if (form.password !== form.confirmPassword)
        e.confirmPassword = "Mật khẩu nhập lại không khớp";
      // ít nhất 1 trong email/phone
      if (!form.email.trim() && !form.phone.trim())
        e.contact = "Nhập email hoặc số điện thoại";
    } else {
      // guest: chỉ cần tên/phone (tối thiểu)
      if (!form.fullName.trim()) e.fullName = "Vui lòng nhập họ tên";
      if (!form.phone.trim()) e.phone = "Nhập số điện thoại";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (asGuest) {
      await createGuest({
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || undefined,
        expiresInDays: 30,
      });
      onClose?.();
      return;
    }

    await createUser({
      fullName: form.fullName.trim(),
      username: form.username.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      password: form.password,
      address: form.address,
      customerType: VN_TO_ENUM(form.customerTypeVN), // 'NEW' | 'VIP' | 'OFTEN'
      roleId: form.roleId || defaultCustomerRoleId,
      provider: "local",
      status: "active",
      captchaToken: null, // nếu BE bật reCAPTCHA, thay bằng token thật
    });

    onClose?.();
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
      {/* Toggle kiểu tạo */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-gray-600">Kiểu tạo:</span>
        <button
          type="button"
          onClick={() => setAsGuest(false)}
          className={`px-3 py-1 rounded-lg text-sm ${
            !asGuest ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Tài khoản (đầy đủ)
        </button>
        <button
          type="button"
          onClick={() => setAsGuest(true)}
          className={`px-3 py-1 rounded-lg text-sm ${
            asGuest ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
          }`}
        >
          Guest nhanh
        </button>
      </div>

      {!asGuest ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Họ và tên *">
            <input
              className="w-full rounded-lg border p-2"
              value={form.fullName}
              onChange={(e) => onChange("fullName", e.target.value)}
              placeholder="Nguyễn Văn A"
            />
            {errors.fullName && (
              <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>
            )}
          </Input>

          <Input label="Tên đăng nhập">
            <input
              className="w-full rounded-lg border p-2"
              value={form.username}
              onChange={(e) => onChange("username", e.target.value)}
              placeholder="an.nguyen"
            />
          </Input>

          <Input label="Email">
            <input
              className="w-full rounded-lg border p-2"
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="an.nguyen@email.com"
            />
          </Input>

          <Input label="Số điện thoại">
            <input
              className="w-full rounded-lg border p-2"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="0901234567"
            />
          </Input>

          <Input label="Mật khẩu *">
            <input
              className="w-full rounded-lg border p-2"
              type="password"
              value={form.password}
              onChange={(e) => onChange("password", e.target.value)}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-xs text-red-600 mt-1">{errors.password}</p>
            )}
          </Input>

          <Input label="Nhập lại mật khẩu *">
            <input
              className="w-full rounded-lg border p-2"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => onChange("confirmPassword", e.target.value)}
              placeholder="••••••••"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-600 mt-1">
                {errors.confirmPassword}
              </p>
            )}
            {errors.contact && (
              <p className="text-xs text-red-600 mt-1">{errors.contact}</p>
            )}
          </Input>

          <Input label="Loại khách hàng">
            <select
              className="w-full rounded-lg border p-2"
              value={form.customerTypeVN}
              onChange={(e) => onChange("customerTypeVN", e.target.value)}
            >
              <option value="Mới">🆕 Mới</option>
              <option value="Thường xuyên">🔥 Thường xuyên</option>
              <option value="VIP">⭐ VIP</option>
            </select>
          </Input>

          <Input label="Vai trò">
            <select
              className="w-full rounded-lg border p-2"
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

          <Input label="Địa chỉ - Dòng 1">
            <input
              className="w-full rounded-lg border p-2"
              value={form.address.line1}
              onChange={(e) => onAddressChange("line1", e.target.value)}
              placeholder="Số nhà, đường"
            />
          </Input>
          <Input label="Địa chỉ - Dòng 2">
            <input
              className="w-full rounded-lg border p-2"
              value={form.address.line2}
              onChange={(e) => onAddressChange("line2", e.target.value)}
              placeholder="Khu, tòa nhà (nếu có)"
            />
          </Input>
          <Input label="Phường/Xã">
            <input
              className="w-full rounded-lg border p-2"
              value={form.address.ward}
              onChange={(e) => onAddressChange("ward", e.target.value)}
            />
          </Input>
          <Input label="Quận/Huyện">
            <input
              className="w-full rounded-lg border p-2"
              value={form.address.district}
              onChange={(e) => onAddressChange("district", e.target.value)}
            />
          </Input>
          <Input label="Thành phố/Tỉnh">
            <input
              className="w-full rounded-lg border p-2"
              value={form.address.city}
              onChange={(e) => onAddressChange("city", e.target.value)}
            />
          </Input>
          <Input label="Quốc gia">
            <input
              className="w-full rounded-lg border p-2"
              value={form.address.country}
              onChange={(e) => onAddressChange("country", e.target.value)}
            />
          </Input>

          <Input label="Avatar URL (tuỳ chọn)">
            <input
              className="w-full rounded-lg border p-2"
              value={form.avatarUrl}
              onChange={(e) => onChange("avatarUrl", e.target.value)}
              placeholder="https://..."
            />
          </Input>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Họ và tên *">
            <input
              className="w-full rounded-lg border p-2"
              value={form.fullName}
              onChange={(e) => onChange("fullName", e.target.value)}
              placeholder="Khách vãng lai"
            />
            {errors.fullName && (
              <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>
            )}
          </Input>

          <Input label="Số điện thoại *">
            <input
              className="w-full rounded-lg border p-2"
              value={form.phone}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="090..."
            />
            {errors.phone && (
              <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
            )}
          </Input>

          <div className="col-span-1 md:col-span-2 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
            Tạo nhanh **Guest** chỉ yêu cầu họ tên và số điện thoại. Hệ thống sẽ
            tự đặt hết hạn sau 30 ngày.
          </div>
        </div>
      )}

      <ModalFooter>
        <button
          className="btn btn--secondary"
          onClick={onClose}
          disabled={loading}
        >
          Hủy
        </button>
        {asGuest ? (
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            🟡 Tạo khách vãng lai
          </button>
        ) : (
          <button
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            💾 Lưu khách hàng
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
};

export default AddCustomerModal;
