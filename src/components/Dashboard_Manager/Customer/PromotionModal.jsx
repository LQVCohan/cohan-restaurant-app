// src/pages/CustomerManagement/PromotionModal.jsx
import React, { useState, useMemo } from "react";
import {
  Gift,
  Check,
  ArrowRight,
  ArrowLeft,
  X,
  Clock,
  Zap,
  Star,
  Sparkles,
  Cake,
} from "lucide-react";
import Modal from "../../common/Modal"; // Đảm bảo đường dẫn đúng
import "./PromotionModal.scss";

// Dữ liệu giả lập (Move outside component to avoid recreate)
const CAMPAIGN_DATA = [
  {
    id: "welcome",
    title: "Chào Bạn Mới",
    description:
      "Giảm 20% cho đơn hàng đầu tiên, tối đa 100k. Áp dụng cho menu chính.",
    icon: <Gift size={24} className="text-green-600" />,
    bgColor: "bg-green-100",
    validDays: 30,
    targetGroup: "Khách mới",
    kind: "promotion",
  },
  {
    id: "vip",
    title: "Tri Ân VIP",
    description:
      "Giảm 15% tổng bill + Tặng món tráng miệng đặc biệt theo ngày.",
    icon: <Star size={24} className="text-yellow-600" />,
    bgColor: "bg-yellow-100",
    validDays: 15,
    targetGroup: "Khách VIP",
    kind: "promotion",
  },
  {
    id: "weekend",
    title: "Happy Weekend",
    description: "Mua 2 tặng 1 cho nhóm đồ uống. Áp dụng T7 & CN.",
    icon: <Zap size={24} className="text-purple-600" />,
    bgColor: "bg-purple-100",
    validDays: 3,
    targetGroup: "Tất cả khách",
    kind: "promotion",
  },
  {
    id: "birthday",
    title: "Sinh Nhật Vui Vẻ",
    description:
      "Giảm 25% bill + Tặng bánh kem mini. Áp dụng trong tháng sinh nhật.",
    icon: <Cake size={24} className="text-pink-600" />,
    bgColor: "bg-pink-100",
    validDays: 30,
    targetGroup: "Sinh nhật",
    kind: "promotion",
  },
  {
    id: "tet-voucher",
    title: "Voucher Tết Sum Vầy",
    description: "Giảm 20% cho nhóm món ăn chính dịp Tết.",
    icon: <Sparkles size={24} className="text-red-600" />,
    bgColor: "bg-red-100",
    validDays: 20,
    targetGroup: "Tất cả khách",
    kind: "voucher",
  },
  {
    id: "shipping-voucher",
    title: "Voucher Freeship",
    description: "Miễn phí giao hàng cho đơn đủ điều kiện.",
    icon: <Zap size={24} className="text-blue-600" />,
    bgColor: "bg-blue-100",
    validDays: 15,
    targetGroup: "Khách đặt món",
    kind: "voucher",
  },
  {
    id: "newbie-pack",
    title: "Gói Voucher Người Mới",
    description: "Bao gồm voucher món ăn, đặt bàn và freeship.",
    icon: <Gift size={24} className="text-emerald-600" />,
    bgColor: "bg-emerald-100",
    validDays: 45,
    targetGroup: "Khách mới",
    kind: "package",
  },
];

const CUSTOMER_GROUPS = [
  { id: "vip", name: "Khách VIP (Vàng/Kim Cương)", icon: "⭐", count: 89 },
  { id: "frequent", name: "Khách Thường Xuyên", icon: "🔥", count: 234 },
  { id: "new", name: "Khách Mới (Đăng ký < 30 ngày)", icon: "🆕", count: 156 },
  { id: "birthday", name: "Sinh Nhật Tháng Này", icon: "🎂", count: 23 },
  { id: "inactive", name: "Khách Cần Tương Tác Lại", icon: "💤", count: 67 },
  { id: "all", name: "Tất Cả Khách Hàng", icon: "👥", count: 1247 },
];

const PromotionModal = ({ onClose }) => {
  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [scheduleType, setScheduleType] = useState("now"); // 'now' | 'later'
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Derived Values
  const totalRecipients = useMemo(() => {
    if (selectedGroupIds.includes("all")) {
      const allGroup = CUSTOMER_GROUPS.find((g) => g.id === "all");
      return allGroup ? allGroup.count : 0;
    }
    return selectedGroupIds.reduce((sum, id) => {
      const group = CUSTOMER_GROUPS.find((g) => g.id === id);
      return sum + (group ? group.count : 0);
    }, 0);
  }, [selectedGroupIds]);

  // Handlers
  const handleGroupToggle = (id) => {
    if (id === "all") {
      if (selectedGroupIds.includes("all")) {
        setSelectedGroupIds([]);
      } else {
        setSelectedGroupIds(["all"]);
      }
      return;
    }

    // Nếu đang chọn "all" mà click cái khác -> bỏ "all"
    let newSelection = selectedGroupIds.filter((gid) => gid !== "all");

    if (newSelection.includes(id)) {
      newSelection = newSelection.filter((gid) => gid !== id);
    } else {
      newSelection.push(id);
    }
    setSelectedGroupIds(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedGroupIds.includes("all")) setSelectedGroupIds([]);
    else setSelectedGroupIds(["all"]);
  };

  const handleSend = () => {
    setIsSending(true);
    // Simulate API call
    setTimeout(() => {
      setIsSending(false);
      alert(
        `✅ Đã gửi chiến dịch "${selectedCampaign.title}" tới ${totalRecipients} khách hàng!`
      );
      onClose();
    }, 1500);
  };

  // Render Steps
  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: "Chọn ưu đãi/Voucher" },
      { num: 2, label: "Đối Tượng" },
      { num: 3, label: "Lên Lịch & Gửi" },
    ];
    return (
      <div className="pm-steps">
        {steps.map((s) => (
          <div
            key={s.num}
            className={`step-item ${currentStep === s.num ? "active" : ""} ${
              currentStep > s.num ? "completed" : ""
            }`}
          >
            <div className="step-num">
              {currentStep > s.num ? <Check size={14} /> : s.num}
            </div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      className="promotion-modal-wrapper"
    >
      <div className="pm-container">
        {/* HEADER */}
        <div className="pm-header">
          <h2>
            <Gift className="text-blue-500" />
            Tạo Chiến Dịch Mới
          </h2>
          <button className="pm-close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* STEPS */}
        {renderStepIndicator()}

        {/* BODY */}
        <div className="pm-body">
          {/* STEP 1: CHỌN CHIẾN DỊCH */}
          {currentStep === 1 && (
            <div className="step-content">
              <div className="promo-grid">
                {CAMPAIGN_DATA.map((promo) => (
                  <div
                    key={promo.id}
                    className={`promo-card ${
                      selectedCampaign?.id === promo.id ? "selected" : ""
                    }`}
                    onClick={() => setSelectedCampaign(promo)}
                  >
                    <div className="check-mark">
                      <Check size={14} />
                    </div>
                    <div className={`pc-icon ${promo.bgColor}`}>
                      {promo.icon}
                    </div>
                    <h4>{promo.title}</h4>
                    <p>{promo.description}</p>
                    <div className="pc-footer">
                      <span>Hiệu lực: {promo.validDays} ngày</span>
                      <span>{promo.targetGroup}</span>
                    </div>
                    <span className={`promo-tag type-${promo.kind}`}>
                      {promo.kind === "voucher"
                        ? "Voucher"
                        : promo.kind === "package"
                          ? "Gói voucher"
                          : "Khuyến mãi"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: CHỌN KHÁCH HÀNG */}
          {currentStep === 2 && (
            <div className="step-content group-selection">
              <div className="gs-header">
                <h3>Chọn nhóm khách hàng mục tiêu</h3>
                <button className="select-all-btn" onClick={handleSelectAll}>
                  {selectedGroupIds.includes("all")
                    ? "Bỏ chọn tất cả"
                    : "Chọn tất cả"}
                </button>
              </div>
              <div className="group-list">
                {CUSTOMER_GROUPS.map((group) => {
                  const isChecked =
                    selectedGroupIds.includes("all") ||
                    selectedGroupIds.includes(group.id);
                  const disabled =
                    selectedGroupIds.includes("all") && group.id !== "all"; // Disable others if All is selected

                  return (
                    <div
                      key={group.id}
                      className={`group-item ${isChecked ? "active" : ""} ${
                        disabled ? "opacity-50 pointer-events-none" : ""
                      }`}
                      onClick={() => !disabled && handleGroupToggle(group.id)}
                    >
                      <input type="checkbox" checked={isChecked} readOnly />
                      <div className="gi-icon">{group.icon}</div>
                      <div className="gi-info">
                        <span className="gi-name">{group.name}</span>
                        <span className="gi-count">
                          {group.count.toLocaleString()} khách
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & SCHEDULE */}
          {currentStep === 3 && (
            <div className="step-content review-layout">
              {/* Cột trái: Lên lịch */}
              <div className="schedule-section">
                <h3>
                  <Clock size={18} /> Thời gian gửi tin
                </h3>
                <div className="radio-options">
                  <label>
                    <input
                      type="radio"
                      name="schedule"
                      value="now"
                      checked={scheduleType === "now"}
                      onChange={(e) => setScheduleType(e.target.value)}
                    />
                    <div>
                      <div>Gửi ngay bây giờ</div>
                      <div className="text-xs text-gray-400 font-normal">
                        Hệ thống sẽ bắt đầu gửi ngay sau khi duyệt
                      </div>
                    </div>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="schedule"
                      value="later"
                      checked={scheduleType === "later"}
                      onChange={(e) => setScheduleType(e.target.value)}
                    />
                    <div>Lên lịch gửi sau</div>
                  </label>
                </div>

                {scheduleType === "later" && (
                  <div className="datetime-inputs">
                    <div className="field">
                      <label>Ngày gửi</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>
                    <div className="field">
                      <label>Giờ gửi</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Cột phải: Summary */}
              <div className="summary-card">
                <h4>Xác nhận thông tin</h4>
                <div className="sum-row">
                  <span className="label">Chiến dịch:</span>
                  <span className="val">{selectedCampaign?.title}</span>
                </div>
                <div className="sum-row">
                  <span className="label">Đối tượng:</span>
                  <span className="val">
                    {selectedGroupIds.includes("all")
                      ? "Tất cả khách hàng"
                      : `${selectedGroupIds.length} nhóm khách`}
                  </span>
                </div>
                <div className="sum-row">
                  <span className="label">Thời gian:</span>
                  <span className="val">
                    {scheduleType === "now"
                      ? "Ngay lập tức"
                      : `${scheduleTime}, ${scheduleDate}`}
                  </span>
                </div>
                <div className="sum-row">
                  <span className="label">Tổng gửi dự kiến:</span>
                  <span className="val text-blue-600">
                    {totalRecipients.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="pm-footer">
          {currentStep > 1 && (
            <button
              className="btn-back"
              onClick={() => setCurrentStep((p) => p - 1)}
              disabled={isSending}
            >
              <ArrowLeft size={16} /> Quay lại
            </button>
          )}

          {currentStep < 3 ? (
            <button
              className="btn-next"
              onClick={() => setCurrentStep((p) => p + 1)}
              disabled={
                (currentStep === 1 && !selectedCampaign) ||
                (currentStep === 2 && selectedGroupIds.length === 0)
              }
            >
              Tiếp theo <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={
                isSending ||
                (scheduleType === "later" && (!scheduleDate || !scheduleTime))
              }
            >
              {isSending ? (
                <>Đang xử lý...</>
              ) : (
                <>
                  <Zap size={16} /> Gửi Chiến Dịch
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PromotionModal;
