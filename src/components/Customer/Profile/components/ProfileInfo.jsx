import React, { useState, useEffect } from "react";
import { useMutation, useQuery, gql } from "@apollo/client";
import { useVnAddressLazy } from "@/hooks/useVnAddressLazy";
import { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";
import { compressAvatar } from "@/utils/compressAvatar";
import "./ProfileInfo.scss";

const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      fullName
      email
      phone
      emailVerified
      phoneVerified
      avatarUrl
      address {
        line1
        line2
        ward
        district
        city
        country
      }
    }
  }
`;

const REQUEST_CONTACT_CHANGE_OTP = gql`
  mutation RequestContactChangeOtp($input: RequestContactChangeOtpInput!) {
    requestContactChangeOtp(input: $input) {
      ok
      target
      maskedDestination
      status
      message
      cooldownUntil
    }
  }
`;

const CONFIRM_CONTACT_CHANGE_OTP = gql`
  mutation ConfirmContactChangeOtp($input: ConfirmContactChangeOtpInput!) {
    confirmContactChangeOtp(input: $input) {
      id
      email
      phone
      emailVerified
      phoneVerified
      emailVerifiedAt
      phoneVerifiedAt
    }
  }
`;

const CANCEL_CONTACT_CHANGE_OTP = gql`
  mutation CancelContactChangeOtp($target: ContactChangeTarget!) {
    cancelContactChangeOtp(target: $target)
  }
`;

const CREATE_WALLET = gql`
  mutation CreateMyWallet($input: CreateWalletInput!) {
    createMyWallet(input: $input) {
      id
      wallet {
        provider
        status
        balance
        currency
        createdAt
        updatedAt
      }
    }
  }
`;

const MY_WALLET_TRANSACTIONS = gql`
  query MyWalletTransactions($limit: Int, $offset: Int) {
    myWalletTransactions(limit: $limit, offset: $offset) {
      id
      type
      amount
      currency
      balanceBefore
      balanceAfter
      status
      referenceType
      createdAt
    }
  }
`;

const money = (value, currency = "VND") =>
  `${Number(value || 0).toLocaleString("vi-VN")} ${currency || "VND"}`;

const transactionLabel = (type = "") => {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "TOPUP") return "Nạp ví";
  if (normalized === "PAYMENT") return "Thanh toán";
  if (normalized === "REFUND") return "Hoàn tiền";
  if (normalized === "ADJUSTMENT") return "Điều chỉnh";
  return normalized || "Giao dịch";
};

const resetContactModal = () => ({
  open: false,
  target: "EMAIL",
  step: "enter_value",
  value: "",
  otp: "",
  message: "",
  maskedDestination: "",
  cooldownUntil: null,
});

const ProfileInfo = ({
  user,
  isEditMode,
  setIsEditMode,
  refetchUser,
  newAvatarFile,
}) => {
  const [updateUser, { loading: updating }] = useMutation(UPDATE_USER);
  const { upload } = useAvatarUploadLocal();
  const [savingProfile, setSavingProfile] = useState(false);
  const [createWallet, { loading: creatingWallet }] = useMutation(CREATE_WALLET);
  const [requestContactChangeOtp, { loading: requestingContactOtp }] = useMutation(REQUEST_CONTACT_CHANGE_OTP);
  const [confirmContactChangeOtp, { loading: confirmingContactOtp }] = useMutation(CONFIRM_CONTACT_CHANGE_OTP);
  const [cancelContactChangeOtp] = useMutation(CANCEL_CONTACT_CHANGE_OTP);
  const { data: txData, refetch: refetchTx } = useQuery(MY_WALLET_TRANSACTIONS, {
    variables: { limit: 6, offset: 0 },
    skip: !user?.wallet,
    fetchPolicy: "network-only",
  });

  const [formData, setFormData] = useState({
    fullName: "",
    line1: "",
    city: "",
    district: "",
    ward: "",
  });
  const [topupAmount, setTopupAmount] = useState("100000");
  const [contactModal, setContactModal] = useState(resetContactModal());
  const toppingUp = false;

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
    loading: loadingAddress,
  } = useVnAddressLazy({ enabled: true });

  useEffect(() => {
    if (!user) return;
    setFormData({
      fullName: user.fullName || "",
      line1: user.address?.line1 || "",
      city: user.address?.city || "",
      district: user.address?.district || "",
      ward: user.address?.ward || "",
    });
  }, [user]);

  useEffect(() => {
    if (isEditMode && formData.city && provinces?.length > 0 && !provinceKey) {
      const found = provinces.find((p) => p.name === formData.city);
      if (found) setProvince(found.code);
    }
  }, [isEditMode, formData.city, provinces, provinceKey, setProvince]);

  useEffect(() => {
    if (isEditMode && formData.district && districts?.length > 0 && !districtKey) {
      const found = districts.find((d) => d.name === formData.district);
      if (found) setDistrict(found.code);
    }
  }, [isEditMode, formData.district, districts, districtKey, setDistrict]);

  useEffect(() => {
    if (isEditMode && formData.ward && wards?.length > 0 && !wardKey) {
      const found = wards.find((w) => w.name === formData.ward);
      if (found) setWard(found.code);
    }
  }, [isEditMode, formData.ward, wards, wardKey, setWard]);

  const handleAddressChange = (type, e) => {
    const code = e.target.value;
    if (type === "city") {
      const found = provinces?.find((p) => String(p.code) === code);
      setProvince(code);
      setFormData((p) => ({ ...p, city: found?.name || "", district: "", ward: "" }));
      return;
    }
    if (type === "district") {
      const found = districts?.find((d) => String(d.code) === code);
      setDistrict(code);
      setFormData((p) => ({ ...p, district: found?.name || "", ward: "" }));
      return;
    }
    if (type === "ward") {
      const found = wards?.find((w) => String(w.code) === code);
      setWard(code);
      setFormData((p) => ({ ...p, ward: found?.name || "" }));
    }
  };

  const handleSave = async () => {
    if (savingProfile || updating) return;
    setSavingProfile(true);
    try {
      let avatarUrl = user.avatarUrl || "";
      if (newAvatarFile) {
        const compressedAvatar = await compressAvatar(newAvatarFile);
        avatarUrl = await upload(compressedAvatar);
      }

      await updateUser({
        variables: {
          input: {
            fullName: formData.fullName,
            avatarUrl,
            address: {
              line1: formData.line1,
              city: formData.city,
              district: formData.district,
              ward: formData.ward,
              country: "Vietnam",
            },
          },
        },
      });
      alert("Cập nhật hồ sơ thành công!");
      await refetchUser?.();
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
      alert("Lỗi cập nhật: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const openContactModal = (target) => {
    setContactModal({ ...resetContactModal(), open: true, target });
  };

  const closeContactModal = async () => {
    const shouldCancel = contactModal.open && contactModal.step === "enter_otp" && Boolean(contactModal.maskedDestination);
    if (shouldCancel) {
      try {
        await cancelContactChangeOtp({ variables: { target: contactModal.target } });
      } catch (err) {
        console.warn("Không thể hủy OTP đang chờ:", err?.message);
      }
    }
    setContactModal(resetContactModal());
  };

  const handleRequestContactOtp = async () => {
    if (!contactModal.value.trim()) {
      alert(contactModal.target === "EMAIL" ? "Vui lòng nhập email mới." : "Vui lòng nhập số điện thoại mới.");
      return;
    }
    try {
      const { data } = await requestContactChangeOtp({
        variables: { input: { target: contactModal.target, value: contactModal.value } },
      });
      const result = data?.requestContactChangeOtp;
      const sent = result?.status === "SENT" && result?.ok;
      let nextStep = "enter_value";
      if (sent) nextStep = "enter_otp";
      else if (result?.status === "COOLDOWN" && contactModal.step === "enter_otp") nextStep = "enter_otp";

      setContactModal((prev) => ({
        ...prev,
        step: nextStep,
        otp: sent ? "" : prev.otp,
        message: result?.message || (sent ? "Mã OTP đã được gửi." : "Không thể gửi mã OTP. Vui lòng thử lại sau."),
        maskedDestination: result?.maskedDestination || (nextStep === "enter_otp" ? prev.maskedDestination : ""),
        cooldownUntil: result?.cooldownUntil || null,
      }));
    } catch (err) {
      console.error(err);
      alert("Không thể gửi OTP: " + err.message);
    }
  };

  const handleConfirmContactOtp = async () => {
    try {
      await confirmContactChangeOtp({
        variables: { input: { target: contactModal.target, otp: contactModal.otp } },
      });
      alert(contactModal.target === "EMAIL" ? "Cập nhật email thành công!" : "Cập nhật số điện thoại thành công!");
      setContactModal(resetContactModal());
      refetchUser?.();
    } catch (err) {
      console.error(err);
      setContactModal((prev) => ({ ...prev, message: "Mã OTP không đúng hoặc đã hết hạn." }));
      alert("Xác minh OTP thất bại: " + err.message);
    }
  };

  const handleTopupWallet = async () => {
    alert("Nạp ví tự động đang tạm tắt cho đến khi hoàn tất xác minh thanh toán.");
  };

  const handleCreateWallet = async () => {
    try {
      await createWallet({ variables: { input: { provider: "internal", currency: "VND" } } });
      alert("Đã tạo ví điện tử thành công!");
      await refetchUser?.();
      refetchTx?.();
    } catch (err) {
      console.error(err);
      alert("Không thể tạo ví: " + err.message);
    }
  };

  const transactions = txData?.myWalletTransactions || [];
  const walletCurrency = user?.wallet?.currency || "VND";

  return (
    <div className="content-card fade-in">
      <div className="card-header">
        <h2 className="card-title">Hồ sơ cá nhân</h2>
        {!isEditMode ? (
          <button className="btn-edit" onClick={() => setIsEditMode(true)}>✏️ Chỉnh sửa</button>
        ) : (
          <div className="action-group">
            <button className="btn-cancel" onClick={() => setIsEditMode(false)}>Hủy</button>
            <button className="btn-save" onClick={handleSave} disabled={updating || savingProfile}>
              {updating || savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        )}
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Họ và tên</label>
          <input
            type="text"
            className="form-input"
            disabled={!isEditMode}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          />
        </div>

        <div className="form-divider"><span>📍 Địa chỉ giao hàng</span></div>

        <div className="form-group full">
          <label>Số nhà, Tên đường</label>
          <input
            type="text"
            className="form-input"
            disabled={!isEditMode}
            value={formData.line1}
            onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
            placeholder="VD: 123 Đường Nguyễn Huệ..."
          />
        </div>

        <div className="form-group">
          <label>Tỉnh / Thành phố</label>
          <select className="form-select" disabled={!isEditMode || loadingAddress} value={provinceKey} onChange={(e) => handleAddressChange("city", e)}>
            <option value="">-- Chọn Tỉnh/Thành --</option>
            {provinces?.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Quận / Huyện</label>
          <select className="form-select" disabled={!isEditMode || !provinceKey} value={districtKey} onChange={(e) => handleAddressChange("district", e)}>
            <option value="">-- Chọn Quận/Huyện --</option>
            {districts?.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label>Phường / Xã</label>
          <select className="form-select" disabled={!isEditMode || !districtKey} value={wardKey} onChange={(e) => handleAddressChange("ward", e)}>
            <option value="">-- Chọn Phường/Xã --</option>
            {wards?.map((w) => <option key={w.code} value={w.code}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="contact-security-panel">
        <div className="contact-security-header">
          <div>
            <h3>Bảo mật tài khoản</h3>
            <p>Quản lý email đăng nhập và số điện thoại bằng mã OTP gửi đến thông tin mới.</p>
          </div>
        </div>

        <div className="contact-summary-grid">
          <div className="contact-summary-card">
            <div>
              <span className="contact-label">Email đăng nhập</span>
              <strong>{user.email || "Chưa cập nhật"}</strong>
              {user.emailVerified && <span className="contact-verified">Đã xác minh</span>}
            </div>
            <button type="button" className="btn-edit" onClick={() => openContactModal("EMAIL")}>Đổi email</button>
          </div>

          <div className="contact-summary-card">
            <div>
              <span className="contact-label">Số điện thoại</span>
              <strong>{user.phone || "Chưa cập nhật"}</strong>
              {user.phoneVerified && <span className="contact-verified">Đã xác minh</span>}
            </div>
            <button type="button" className="btn-edit" onClick={() => openContactModal("PHONE")}>Đổi số điện thoại</button>
          </div>
        </div>
      </div>

      {contactModal.open && (
        <div className="contact-modal-backdrop" role="presentation">
          <div className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
            <div className="contact-modal-header">
              <div>
                <h3 id="contact-modal-title">{contactModal.target === "EMAIL" ? "Đổi email đăng nhập" : "Đổi số điện thoại"}</h3>
                <p>
                  {contactModal.step === "enter_value"
                    ? contactModal.target === "EMAIL"
                      ? "Nhập email mới để nhận mã OTP."
                      : "Nhập số điện thoại mới để nhận mã OTP."
                    : `Mã OTP đã được gửi đến ${contactModal.maskedDestination}.`}
                </p>
              </div>
              <button type="button" className="contact-modal-close" onClick={closeContactModal} aria-label="Đóng">×</button>
            </div>

            {contactModal.message && <div className="contact-modal-message">{contactModal.message}</div>}
            {contactModal.cooldownUntil && (
              <div className="contact-modal-warning">
                Vui lòng chờ trước khi gửi lại mã. Có thể gửi lại sau {new Date(contactModal.cooldownUntil).toLocaleTimeString("vi-VN")}.
              </div>
            )}

            {contactModal.step === "enter_value" ? (
              <div className="form-group">
                <label>{contactModal.target === "EMAIL" ? "Nhập email mới" : "Nhập số điện thoại mới"}</label>
                <input
                  type={contactModal.target === "EMAIL" ? "email" : "tel"}
                  className="form-input"
                  value={contactModal.value}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, value: e.target.value, message: "", cooldownUntil: null }))}
                  placeholder={contactModal.target === "EMAIL" ? "email-moi@example.com" : "0901234567"}
                />
                <button type="button" className="btn-save contact-modal-primary" onClick={handleRequestContactOtp} disabled={requestingContactOtp}>
                  {requestingContactOtp ? "Đang gửi mã..." : "Gửi mã OTP"}
                </button>
              </div>
            ) : (
              <div className="form-group">
                <label>Nhập mã OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="form-input otp-input"
                  value={contactModal.otp}
                  onChange={(e) => setContactModal((prev) => ({ ...prev, otp: e.target.value.replace(/\D/g, "").slice(0, 6), message: "" }))}
                  placeholder="••••••"
                />
                <div className="contact-modal-actions">
                  <button type="button" className="btn-cancel" onClick={handleRequestContactOtp} disabled={requestingContactOtp}>
                    {requestingContactOtp ? "Đang gửi lại..." : "Gửi lại mã"}
                  </button>
                  <button type="button" className="btn-save" onClick={handleConfirmContactOtp} disabled={confirmingContactOtp || contactModal.otp.length !== 6}>
                    {confirmingContactOtp ? "Đang xác nhận..." : "Xác nhận thay đổi"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <section className={`wallet-panel ${user?.wallet ? "has-wallet" : "is-empty"}`}>
        <div className="wallet-panel-header">
          <div>
            <span className="wallet-eyebrow">Ví điện tử</span>
            <h3>{user?.wallet ? "FoodHub Wallet" : "Mở ví FoodHub"}</h3>
            <p>{user?.wallet ? "Quản lý số dư và giao dịch gần đây trong cùng một khu vực." : "Tạo ví một lần để thanh toán nhanh hơn ở các đơn hàng sau."}</p>
          </div>
          {user?.wallet && <span className="wallet-status-badge">{user.wallet.status || "active"}</span>}
        </div>

        {user?.wallet ? (
          <div className="wallet-dashboard">
            <div className="wallet-balance-card">
              <span>Số dư khả dụng</span>
              <strong>{money(user.wallet.balance, walletCurrency)}</strong>
              <small>Nhà cung cấp: {user.wallet.provider || "Nội bộ"}</small>
            </div>

            <div className="wallet-control-card">
              <label>Nạp tiền vào ví</label>
              <div className="wallet-topup-row">
                <input
                  type="text"
                  className="form-input"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Số tiền nạp"
                />
                <button className="btn-edit" onClick={handleTopupWallet} disabled={toppingUp}>
                  {toppingUp ? "Đang nạp..." : "Nạp tiền"}
                </button>
              </div>
              <p>Nạp ví tự động sẽ hoạt động sau khi hoàn tất cổng thanh toán.</p>
            </div>

            <div className="wallet-history-card">
              <div className="wallet-history-title">
                <strong>Lịch sử gần đây</strong>
                <span>{transactions.length} giao dịch</span>
              </div>
              {transactions.length === 0 ? (
                <p className="wallet-empty-line">Chưa có giao dịch nào.</p>
              ) : (
                <div className="wallet-transaction-list">
                  {transactions.map((tx) => (
                    <div className="wallet-transaction-item" key={tx.id}>
                      <div>
                        <strong>{transactionLabel(tx.type)}</strong>
                        <span>{tx.createdAt ? new Date(tx.createdAt).toLocaleString("vi-VN") : "Chưa có thời gian"}</span>
                      </div>
                      <div className="wallet-transaction-amount">
                        {money(tx.amount, tx.currency || walletCurrency)}
                        <small>Số dư sau: {money(tx.balanceAfter, tx.currency || walletCurrency)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="wallet-empty-state">
            <div>
              <strong>Bạn chưa có ví điện tử</strong>
              <p>Ví FoodHub giúp lưu số dư, theo dõi giao dịch và chuẩn bị cho thanh toán nhanh.</p>
            </div>
            <button className="btn-save" onClick={handleCreateWallet} disabled={creatingWallet}>
              {creatingWallet ? "Đang tạo ví..." : "Tạo ví điện tử"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProfileInfo;
