import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ProfilePage.scss";
import Modal from "../../common/Modal";
import ToggleSwitch from "../../common/ToggleSwitch/ToggleSwitch";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { useVnAddressLazy } from "@/hooks/useVnAddressLazy";
import { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";

/* =========================
   GraphQL
   ========================= */
const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      username
      email
      phone
      avatarUrl
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      roleName
      emailVerified
      loyaltyPoints
      totalOrders
      totalSpending
      refRestaurants {
        id
      }
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      fullName
      username
      email
      phone
      avatarUrl
      emailVerified
      roleName
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      updatedAt
    }
  }
`;

const CHANGE_MY_PASSWORD = gql`
  mutation ChangeMyPassword($input: ChangePasswordInput!) {
    changeMyPassword(input: $input)
  }
`;

/* =========================
   Utils (demo)
   ========================= */
const ORDERS = [
  {
    icon: "🍜",
    name: "Golden Dragon Restaurant",
    items: 3,
    price: 450000,
    date: "15/03/2024",
    status: "completed",
  },
  {
    icon: "🍕",
    name: "Pizza Palace",
    items: 2,
    price: 320000,
    date: "12/03/2024",
    status: "completed",
  },
  {
    icon: "🍣",
    name: "Sushi Master",
    items: 5,
    price: 680000,
    date: "10/03/2024",
    status: "pending",
  },
];

function formatVND(n) {
  try {
    return new Intl.NumberFormat("vi-VN").format(n) + "đ";
  } catch {
    return `${n}đ`;
  }
}

export default function ProfilePage() {
  /* ── Gọi me() ─────────────────────────────────────────── */
  const { data, loading, error } = useQuery(ME_QUERY, {
    fetchPolicy: "cache-first",
  });

  /* ── Local states ─────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState("personal");

  // User hiển thị + controlled form
  const [user, setUser] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    avatarUrl: "",
    address: {
      line1: "",
      line2: "",
      ward: "",
      district: "",
      city: "",
      country: "vietnam",
    },
  });
  const originalUserRef = useRef(null);

  const [displayName, setDisplayName] = useState("");

  // Avatar hiển thị:
  // - nếu có file pending thì dùng preview URL tạm
  // - nếu không thì dùng avatarUrl từ server
  const [serverAvatarUrl, setServerAvatarUrl] = useState("");
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    loyaltyPoints: 0,
    totalSpending: "0",
    favoriteRestaurants: 0,
    emailVerified: false,
    roleName: "",
  });

  // UI messages
  const [message, setMessage] = useState(null); // {type: 'success'|'error', text}
  const [saving, setSaving] = useState(false);

  // Modals / forms
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  // Notification toggles (local setting demo)
  const [notif, setNotif] = useState({
    order: true,
    promo: true,
    newRestaurant: false,
    reviewReminder: true,
    emailMarketing: false,
  });

  const fileInputRef = useRef(null);

  /* ── Lazy fetch địa chỉ VN ────────────────────────────── */
  const {
    loading: addrLoading,
    error: addrError,
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
  } = useVnAddressLazy({ enabled: activeTab === "personal" });

  /* ── Đồng bộ dữ liệu từ GraphQL -> UI ─────────────────── */
  useEffect(() => {
    if (!data?.me) return;
    const me = data.me;

    const nextUser = {
      fullName: me.fullName || "",
      username: me.username || "",
      email: me.email || "",
      phone: me.phone || "",
      avatarUrl: me.avatarUrl || "",
      address: {
        line1: me.address?.line1 || "",
        line2: me.address?.line2 || "",
        ward: me.address?.ward || "",
        district: me.address?.district || "",
        city: me.address?.city || "",
        country: me.address?.country || "vietnam",
      },
    };

    setUser(nextUser);
    originalUserRef.current = nextUser;
    setDisplayName(nextUser.fullName || "Người dùng");
    setServerAvatarUrl(nextUser.avatarUrl || "");

    const favCount = Array.isArray(me.refRestaurants)
      ? me.refRestaurants.length
      : 0;
    const spendingNum =
      typeof me.totalSpending === "number" ? me.totalSpending : 0;

    setStats({
      totalOrders: me.totalOrders ?? 0,
      loyaltyPoints: me.loyaltyPoints ?? 0,
      totalSpending:
        spendingNum >= 1_000_000
          ? `${(spendingNum / 1_000_000).toFixed(1)}M`
          : formatVND(spendingNum),
      favoriteRestaurants: favCount,
      emailVerified: !!me.emailVerified,
      roleName: me.roleName || "",
    });
  }, [data]);

  /* ── Ánh xạ địa chỉ server -> select động ─────────────── */
  useEffect(() => {
    if (activeTab !== "personal") return;
    if (!user?.address?.city) return;
    if (!provinces?.length) return;
    if (provinceKey === user.address.city) return;
    setProvince(user.address.city);
  }, [activeTab, user?.address?.city, provinces, provinceKey, setProvince]);

  useEffect(() => {
    if (activeTab !== "personal") return;
    if (!user?.address?.district) return;
    if (!districts?.length) return;
    if (districtKey === user.address.district) return;
    setDistrict(user.address.district);
  }, [activeTab, user?.address?.district, districts, districtKey, setDistrict]);

  useEffect(() => {
    if (activeTab !== "personal") return;
    if (!user?.address?.ward) return;
    if (!wards?.length) return;
    if (wardKey === user.address.ward) return;
    setWard(user.address.ward);
  }, [activeTab, user?.address?.ward, wards, wardKey, setWard]);

  /* ── Tính chữ cái avatar ──────────────────────────────── */
  const nameInitial = useMemo(
    () => (displayName?.trim()?.[0] ?? "").toUpperCase() || "👤",
    [displayName]
  );

  /* ── Helpers UI ───────────────────────────────────────── */
  const showMessage = (text, type = "success") => {
    setMessage({ text, type });
    window.clearTimeout(showMessage._t);
    showMessage._t = window.setTimeout(() => setMessage(null), 5000);
  };

  /* ── Handlers “Thông tin cá nhân” (controlled) ───────── */
  const onField = (key, value) => setUser((u) => ({ ...u, [key]: value }));
  const onAddress = (key, value) =>
    setUser((u) => ({ ...u, address: { ...u.address, [key]: value } }));

  const onProvinceChange = (code) => {
    setProvince(code);
    setUser((u) => ({
      ...u,
      address: { ...u.address, city: code, district: "", ward: "" },
    }));
  };

  const onDistrictChange = (code) => {
    setDistrict(code);
    setUser((u) => ({
      ...u,
      address: { ...u.address, district: code, ward: "" },
    }));
  };

  const onWardChange = (code) => {
    setWard(code);
    setUser((u) => ({ ...u, address: { ...u.address, ward: code } }));
  };

  const [mutateUpdateUser] = useMutation(UPDATE_USER, {
    refetchQueries: ["Me"],
  });

  /* ── Avatar Upload (deferred) ───────────────────────────
     - Người dùng chọn file => chỉ tạo preview (ObjectURL), KHÔNG upload
     - Khi bấm "Lưu thay đổi" => mới upload file (nếu có), nhận url,
       rồi truyền avatarUrl vào mutation updateUser.
  */
  const { upload } = useAvatarUploadLocal(); // POST /api/upload
  const triggerAvatarUpload = () => fileInputRef.current?.click();

  // cleanup object URL tạm
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const onAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // kiểm tra nhẹ
    if (!/^image\//.test(file.type)) {
      showMessage("Vui lòng chọn tệp hình ảnh hợp lệ.", "error");
      return;
    }

    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    const preview = URL.createObjectURL(file);
    setPendingPreviewUrl(preview);
    setPendingAvatarFile(file);

    // chỉ hiển thị trước
    setUploadProgress(0);
    showMessage("Ảnh đã chọn. Nhấn 'Lưu thay đổi' để cập nhật.", "success");
  };

  const handlePersonalSubmit = async (e) => {
    e.preventDefault();

    // chặn double-click
    if (saving) return;

    setSaving(true);
    try {
      let finalAvatarUrl = serverAvatarUrl;

      // Nếu có file ảnh chờ upload => upload trước
      if (pendingAvatarFile) {
        setUploadProgress(1);
        const savedUrl = await upload(pendingAvatarFile, (p) =>
          setUploadProgress(p)
        );
        finalAvatarUrl = savedUrl;
      }

      await mutateUpdateUser({
        variables: {
          input: {
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            phone: user.phone,
            address: user.address,
            avatarUrl: finalAvatarUrl,
          },
        },
      });

      // update UI sau khi lưu thành công
      setDisplayName(user.fullName || "Người dùng");
      setServerAvatarUrl(finalAvatarUrl);
      setUser((u) => ({ ...u, avatarUrl: finalAvatarUrl }));

      // clear preview tạm
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl("");
      setPendingAvatarFile(null);
      setUploadProgress(0);

      showMessage("Thông tin đã được cập nhật thành công!", "success");
    } catch (err) {
      // mở nút lưu lại & giữ preview để người dùng thử lại
      setUploadProgress(0);
      showMessage(err?.message || "Cập nhật thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePersonalReset = () => {
    if (!window.confirm("Bạn có chắc chắn muốn khôi phục dữ liệu từ server?"))
      return;
    if (originalUserRef.current) {
      setUser(originalUserRef.current);
      setDisplayName(originalUserRef.current.fullName || "Người dùng");
      setServerAvatarUrl(originalUserRef.current.avatarUrl || "");

      // clear preview tạm nếu có
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl("");
      setPendingAvatarFile(null);
      setUploadProgress(0);

      if (activeTab === "personal") {
        if (originalUserRef.current.address.city)
          setProvince(originalUserRef.current.address.city);
        if (originalUserRef.current.address.district)
          setDistrict(originalUserRef.current.address.district);
        if (originalUserRef.current.address.ward)
          setWard(originalUserRef.current.address.ward);
      }
      showMessage("Đã khôi phục dữ liệu từ server", "success");
    }
  };

  /* ── Đổi mật khẩu ────────────────────────────────────── */
  const [changePassword, { loading: changingPwd }] =
    useMutation(CHANGE_MY_PASSWORD);

  const submitPassword = async () => {
    const { current, next, confirm } = pwdForm;
    if (!current || !next || !confirm)
      return showMessage("Vui lòng điền đầy đủ thông tin!", "error");
    if (next !== confirm)
      return showMessage("Mật khẩu xác nhận không khớp!", "error");
    if (next.length < 6)
      return showMessage("Mật khẩu mới phải có ít nhất 6 ký tự!", "error");

    try {
      const { data: res } = await changePassword({
        variables: { input: { currentPassword: current, newPassword: next } },
      });
      if (res?.changeMyPassword) {
        setChangePwdOpen(false);
        setPwdForm({ current: "", next: "", confirm: "" });
        showMessage("Mật khẩu đã được thay đổi thành công!", "success");
      } else {
        showMessage("Đổi mật khẩu thất bại.", "error");
      }
    } catch (err) {
      showMessage(err.message || "Đổi mật khẩu thất bại", "error");
    }
  };

  /* ── Khác ────────────────────────────────────────────── */
  const confirmDeleteAccount = () => {
    const ok = window.confirm(
      "⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa tài khoản?\n\nHành động này không thể hoàn tác."
    );
    if (!ok) return;
    const phrase = window.prompt('Nhập "XÓA TÀI KHOẢN" để xác nhận:');
    if (phrase === "XÓA TÀI KHOẢN") {
      // TODO: mutation delete
      showMessage("Yêu cầu xóa tài khoản đã được gửi.", "success");
    }
  };

  const saveNotifications = () => {
    // TODO: mutation lưu cài đặt
    showMessage("Cài đặt thông báo đã được lưu!", "success");
  };

  /* ── Loading / Error ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading">Đang tải thông tin tài khoản…</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="error">Lỗi tải dữ liệu: {error.message}</div>
        </div>
      </div>
    );
  }

  // URL ảnh hiển thị: ưu tiên preview tạm nếu có
  const avatarUrlForDisplay = pendingPreviewUrl || serverAvatarUrl;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Sidebar */}
        <aside className="profile-sidebar">
          <div className="card profile-header">
            <div className="avatar-container">
              <div className="avatar" id="userAvatar" aria-label="Avatar">
                {avatarUrlForDisplay ? (
                  <img src={avatarUrlForDisplay} alt="Avatar" />
                ) : (
                  <span className="avatar-initial">{nameInitial}</span>
                )}
              </div>
              <button
                className="avatar-upload"
                onClick={triggerAvatarUpload}
                aria-label="Tải ảnh đại diện"
                title="Tải ảnh đại diện"
              >
                📷
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onAvatarFile}
                hidden
              />

              {uploadProgress > 0 && (
                <div className="upload-progress" aria-live="polite">
                  <div
                    className="upload-progress__bar"
                    style={{ width: `${uploadProgress}%` }}
                  />
                  <span className="upload-progress__text">
                    {uploadProgress}%
                  </span>
                </div>
              )}
            </div>

            <h1 className="user-name" id="userName">
              {displayName || "Người dùng"}
            </h1>

            <span
              className="user-type user-type--vip"
              id="userType"
              title={stats.roleName ? `Role: ${stats.roleName}` : undefined}
            >
              {stats.emailVerified ? "✅ Email xác thực" : "⚠️ Chưa xác thực"}
            </span>
          </div>

          <div className="card">
            <h3 className="section-title">📊 Thống kê</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <p className="stat-value" id="totalOrders">
                  {stats.totalOrders ?? 0}
                </p>
                <p className="stat-label">Đơn hàng</p>
              </div>
              <div className="stat-item">
                <p className="stat-value" id="loyaltyPoints">
                  {(stats.loyaltyPoints ?? 0).toLocaleString()}
                </p>
                <p className="stat-label">Điểm tích lũy</p>
              </div>
              <div className="stat-item">
                <p className="stat-value" id="totalSpending">
                  {stats.totalSpending}
                </p>
                <p className="stat-label">Tổng chi tiêu</p>
              </div>
              <div className="stat-item">
                <p className="stat-value" id="favoriteRestaurants">
                  {stats.favoriteRestaurants ?? 0}
                </p>
                <p className="stat-label">Nhà hàng yêu thích</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">⚡ Thao tác nhanh</h3>
            <div className="quick-actions">
              <a href="#" className="quick-action">
                <span className="quick-action-icon">🍽️</span>
                <span>Đặt bàn mới</span>
              </a>
              <a href="#" className="quick-action">
                <span className="quick-action-icon">🛒</span>
                <span>Đặt món online</span>
              </a>
              <a href="#" className="quick-action">
                <span className="quick-action-icon">⭐</span>
                <span>Nhà hàng yêu thích</span>
              </a>
              <a href="#" className="quick-action">
                <span className="quick-action-icon">🎁</span>
                <span>Ưu đãi của tôi</span>
              </a>
              <a href="#" className="quick-action">
                <span className="quick-action-icon">💬</span>
                <span>Hỗ trợ khách hàng</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="profile-main">
          <div className="card">
            <div className="tab-nav" role="tablist">
              {[
                { id: "personal", label: "👤 Thông tin cá nhân" },
                { id: "orders", label: "📋 Lịch sử đơn hàng" },
                { id: "security", label: "🔒 Bảo mật" },
                { id: "notifications", label: "🔔 Thông báo" },
              ].map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  className={`tab-button ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {message && (
            <div
              className={`message ${
                message.type === "success" ? "message-success" : "message-error"
              }`}
            >
              <span>{message.type === "success" ? "✅" : "❌"}</span>
              <span>{message.text}</span>
            </div>
          )}

          {/* Personal */}
          {activeTab === "personal" && (
            <section id="personal-tab" className="tab-content active">
              <div className="card">
                <form id="personalInfoForm" onSubmit={handlePersonalSubmit}>
                  <div className="form-section">
                    <h3 className="section-title">👤 Thông tin cơ bản</h3>
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label" htmlFor="fullName">
                          Họ và tên <span className="required">*</span>
                        </label>
                        <input
                          name="fullName"
                          id="fullName"
                          className="form-input"
                          value={user.fullName}
                          onChange={(e) => onField("fullName", e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="username">
                          Tên đăng nhập
                        </label>
                        <input
                          name="username"
                          id="username"
                          className="form-input"
                          value={user.username}
                          onChange={(e) => onField("username", e.target.value)}
                          readOnly
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="email">
                          Email <span className="required">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          className="form-input"
                          value={user.email}
                          onChange={(e) => onField("email", e.target.value)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="phone">
                          Số điện thoại <span className="required">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          className="form-input"
                          value={user.phone}
                          onChange={(e) => onField("phone", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-section">
                    <h3 className="section-title">📍 Địa chỉ</h3>

                    {addrLoading && <p>⏳ Đang tải danh mục địa chỉ...</p>}
                    {addrError && <p>❌ Không thể tải danh mục địa chỉ.</p>}

                    <div className="address-grid">
                      <div className="form-group">
                        <label className="form-label" htmlFor="line1">
                          Địa chỉ 1
                        </label>
                        <input
                          name="line1"
                          id="line1"
                          className="form-input"
                          value={user.address.line1}
                          onChange={(e) => onAddress("line1", e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="line2">
                          Địa chỉ 2
                        </label>
                        <input
                          name="line2"
                          id="line2"
                          className="form-input"
                          value={user.address.line2}
                          onChange={(e) => onAddress("line2", e.target.value)}
                        />
                      </div>

                      {/* City / Province */}
                      <div className="form-group">
                        <label className="form-label">Tỉnh/Thành phố</label>
                        <select
                          className="form-select"
                          value={provinceKey || ""}
                          onChange={(e) => onProvinceChange(e.target.value)}
                          disabled={addrLoading}
                        >
                          <option value="">Chọn Tỉnh/TP...</option>
                          {provinces.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* District */}
                      <div className="form-group">
                        <label className="form-label">Quận/Huyện</label>
                        <select
                          className="form-select"
                          value={districtKey || ""}
                          onChange={(e) => onDistrictChange(e.target.value)}
                          disabled={!selectedProvince || addrLoading}
                        >
                          <option value="">
                            {selectedProvince
                              ? "Chọn Quận/Huyện..."
                              : "Chọn Tỉnh trước"}
                          </option>
                          {districts.map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Ward */}
                      <div className="form-group">
                        <label className="form-label">Phường/Xã</label>
                        <select
                          className="form-select"
                          value={wardKey || ""}
                          onChange={(e) => onWardChange(e.target.value)}
                          disabled={!selectedDistrict || addrLoading}
                        >
                          <option value="">
                            {selectedDistrict
                              ? "Chọn Phường/Xã..."
                              : "Chọn Quận trước"}
                          </option>
                          {wards.map((w) => (
                            <option key={w.code} value={w.code}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Country */}
                      <div className="form-group">
                        <label className="form-label" htmlFor="country">
                          Quốc gia
                        </label>
                        <select
                          name="country"
                          id="country"
                          className="form-select"
                          value={user.address.country}
                          onChange={(e) => onAddress("country", e.target.value)}
                        >
                          <option value="vietnam">Việt Nam</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handlePersonalReset}
                      disabled={saving}
                    >
                      🔄 Khôi phục
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                      title={saving ? "Đang lưu..." : undefined}
                    >
                      {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* Orders */}
          {activeTab === "orders" && (
            <section id="orders-tab" className="tab-content active">
              <div className="card">
                <h3 className="section-title">📋 Lịch sử đơn hàng</h3>
                <div id="ordersList">
                  {ORDERS.map((o, idx) => (
                    <div className="order-item" key={idx}>
                      <div className="order-restaurant" aria-hidden>
                        {o.icon}
                      </div>
                      <div className="order-details">
                        <h4 className="order-restaurant-name">{o.name}</h4>
                        <p className="order-info">
                          {o.items} món • {formatVND(o.price)} • {o.date}
                        </p>
                      </div>
                      <span
                        className={`order-status ${
                          o.status === "completed"
                            ? "order-status--completed"
                            : o.status === "pending"
                            ? "order-status--pending"
                            : "order-status--cancelled"
                        }`}
                      >
                        {o.status === "completed"
                          ? "Hoàn thành"
                          : o.status === "pending"
                          ? "Đang xử lý"
                          : "Đã hủy"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <section id="security-tab" className="tab-content active">
              <div className="card">
                <h3 className="section-title">🔒 Bảo mật tài khoản</h3>

                <div className="security-item">
                  <div className="security-info">
                    <h4>Mật khẩu</h4>
                    <p>
                      Cập nhật lần cuối:{" "}
                      {data?.me?.updatedAt
                        ? new Date(data.me.updatedAt).toLocaleDateString(
                            "vi-VN"
                          )
                        : "—"}
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setChangePwdOpen(true)}
                    disabled={changingPwd}
                  >
                    {changingPwd ? "Đang xử lý..." : "Đổi mật khẩu"}
                  </button>
                </div>

                <div className="security-item">
                  <div className="security-info">
                    <h4>Xác thực email</h4>
                    <p>
                      {stats.emailVerified
                        ? "Email đã được xác thực ✅"
                        : "Chưa xác thực ❌"}
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary"
                    disabled={!!stats.emailVerified}
                  >
                    {stats.emailVerified ? "Đã xác thực" : "Chưa xác thực"}
                  </button>
                </div>

                <div className="security-item">
                  <div className="security-info">
                    <h4>Xác thực 2 bước</h4>
                    <p>Tăng cường bảo mật cho tài khoản</p>
                  </div>
                  <button className="btn btn-primary">Kích hoạt</button>
                </div>

                <div className="security-item">
                  <div className="security-info">
                    <h4>Phiên đăng nhập</h4>
                    <p>Quản lý các thiết bị đã đăng nhập</p>
                  </div>
                  <button className="btn btn-secondary">Xem chi tiết</button>
                </div>

                <div className="btn-group">
                  <button
                    className="btn btn-danger"
                    onClick={confirmDeleteAccount}
                  >
                    🗑️ Xóa tài khoản
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <section id="notifications-tab" className="tab-content active">
              <div className="card">
                <h3 className="section-title">🔔 Cài đặt thông báo</h3>

                <div className="notification-item">
                  <div>
                    <h4>Thông báo đơn hàng</h4>
                    <p>Nhận thông báo về trạng thái đơn hàng</p>
                  </div>
                  <ToggleSwitch
                    checked={notif.order}
                    onChange={(v) => setNotif((n) => ({ ...n, order: v }))}
                  />
                </div>

                <div className="notification-item">
                  <div>
                    <h4>Khuyến mãi và ưu đãi</h4>
                    <p>Nhận thông báo về các chương trình khuyến mãi</p>
                  </div>
                  <ToggleSwitch
                    checked={notif.promo}
                    onChange={(v) => setNotif((n) => ({ ...n, promo: v }))}
                  />
                </div>

                <div className="notification-item">
                  <div>
                    <h4>Nhà hàng mới</h4>
                    <p>Thông báo khi có nhà hàng mới tham gia</p>
                  </div>
                  <ToggleSwitch
                    checked={notif.newRestaurant}
                    onChange={(v) =>
                      setNotif((n) => ({ ...n, newRestaurant: v }))
                    }
                  />
                </div>

                <div className="notification-item">
                  <div>
                    <h4>Đánh giá và phản hồi</h4>
                    <p>Nhắc nhở đánh giá sau khi hoàn thành đơn hàng</p>
                  </div>
                  <ToggleSwitch
                    checked={notif.reviewReminder}
                    onChange={(v) =>
                      setNotif((n) => ({ ...n, reviewReminder: v }))
                    }
                  />
                </div>

                <div className="notification-item">
                  <div>
                    <h4>Email marketing</h4>
                    <p>Nhận newsletter và thông tin sản phẩm mới</p>
                  </div>
                  <ToggleSwitch
                    checked={notif.emailMarketing}
                    onChange={(v) =>
                      setNotif((n) => ({ ...n, emailMarketing: v }))
                    }
                  />
                </div>

                <div className="btn-group">
                  <button
                    className="btn btn-primary"
                    onClick={saveNotifications}
                  >
                    💾 Lưu cài đặt
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={changePwdOpen}
        onClose={() => setChangePwdOpen(false)}
        title="🔒 Đổi mật khẩu"
      >
        <div className="form-group">
          <label className="form-label" htmlFor="currentPassword">
            Mật khẩu hiện tại <span className="required">*</span>
          </label>
          <input
            type="password"
            id="currentPassword"
            className="form-input"
            value={pwdForm.current}
            onChange={(e) =>
              setPwdForm((f) => ({ ...f, current: e.target.value }))
            }
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="newPassword">
            Mật khẩu mới <span className="required">*</span>
          </label>
          <input
            type="password"
            id="newPassword"
            className="form-input"
            value={pwdForm.next}
            onChange={(e) =>
              setPwdForm((f) => ({ ...f, next: e.target.value }))
            }
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">
            Xác nhận mật khẩu mới <span className="required">*</span>
          </label>
          <input
            type="password"
            id="confirmPassword"
            className="form-input"
            value={pwdForm.confirm}
            onChange={(e) =>
              setPwdForm((f) => ({ ...f, confirm: e.target.value }))
            }
            required
          />
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => setChangePwdOpen(false)}
            disabled={changingPwd}
          >
            Hủy
          </button>
          <button
            className="btn btn-primary"
            onClick={submitPassword}
            disabled={changingPwd}
          >
            {changingPwd ? "Đang xử lý..." : "Đổi mật khẩu"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
