import React, { useState, useEffect } from "react";
import Modal from "../../../common/Modal"; // Đảm bảo import đúng đường dẫn Base Modal mới
import "./AutoScheduleModal.scss";
import {
  Calendar,
  Settings,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldCheck,
  Users,
  CheckCircle2,
} from "lucide-react";

const AutoScheduleModal = ({ isOpen, onClose, onConfirm }) => {
  // --- STATE ---
  const [config, setConfig] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 6))
      .toISOString()
      .split("T")[0],
    strategy: "balanced", // balanced | cost | quality
    // Advanced Constraints
    fillEmpty: true,
    avoidOvertime: true,
    respectAvailability: true,
    prioritizeFullTime: false,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);

  // --- EFFECT: RESET ON OPEN ---
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setProgress(0);
      setLogs([]);
      setShowAdvanced(false);
    }
  }, [isOpen]);

  // --- HANDLER: RUN SIMULATION ---
  const handleRun = () => {
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);

    const processSteps = [
      { pct: 10, msg: "Đang kết nối cơ sở dữ liệu nhân sự..." },
      { pct: 30, msg: "Phân tích yêu cầu ca làm việc..." },
      { pct: 50, msg: "Kiểm tra đơn xin nghỉ phép & tính khả dụng..." },
      { pct: 70, msg: "Tối ưu hóa chi phí theo chiến lược..." },
      { pct: 85, msg: "Kiểm tra ràng buộc tăng ca (Overtime)..." },
      { pct: 95, msg: "Đang hoàn tất và xuất bản lịch..." },
    ];

    let currentStepIndex = 0;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            onConfirm(config);
            onClose();
          }, 800);
          return 100;
        }

        const nextPct = prev + Math.floor(Math.random() * 8) + 2;

        if (
          currentStepIndex < processSteps.length &&
          nextPct >= processSteps[currentStepIndex].pct
        ) {
          setLogs((prevLogs) => [
            ...prevLogs,
            processSteps[currentStepIndex].msg,
          ]);
          currentStepIndex++;
        }

        return Math.min(nextPct, 100);
      });
    }, 150);
  };

  // --- FOOTER RENDER ---
  // Chỉ hiển thị nút khi KHÔNG xử lý. Khi xử lý thì ẩn footer đi.
  const footerContent = !isProcessing ? (
    <>
      <button className="btn btn--secondary" onClick={onClose}>
        Hủy bỏ
      </button>
      <button className="btn btn--primary" onClick={handleRun}>
        <Zap size={16} fill="currentColor" style={{ marginRight: "8px" }} />
        Bắt đầu xếp lịch
      </button>
    </>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={!isProcessing ? onClose : undefined} // Không cho đóng khi đang chạy
      title="AI Auto Schedule"
      size="md"
      footer={footerContent}
      className="auto-schedule-modal" // Class scope cho nội dung
    >
      <div className="auto-schedule-body">
        {!isProcessing ? (
          /* --- VIEW 1: CONFIGURATION FORM --- */
          <>
            {/* 1. Intro Banner */}
            <div className="ai-banner">
              <div className="ai-icon">
                <Zap size={24} fill="currentColor" />
              </div>
              <div className="ai-text">
                <strong>Trợ lý xếp lịch thông minh</strong>
                <p>
                  Hệ thống tự động phân bổ nhân sự tối ưu dựa trên KPI, chi phí
                  và luật lao động.
                </p>
              </div>
            </div>

            {/* 2. Date Range */}
            <div className="section-group">
              <div className="group-header">
                <Calendar size={18} className="icon-blue" />
                <span>Phạm vi thời gian</span>
              </div>
              <div className="date-inputs">
                <div className="input-wrap">
                  <span className="label">Từ ngày</span>
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) =>
                      setConfig({ ...config, startDate: e.target.value })
                    }
                  />
                </div>
                <span className="arrow">➝</span>
                <div className="input-wrap">
                  <span className="label">Đến ngày</span>
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) =>
                      setConfig({ ...config, endDate: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            {/* 3. Strategy Selector */}
            <div className="section-group">
              <div className="group-header">
                <Settings size={18} className="icon-blue" />
                <span>Chiến lược ưu tiên</span>
              </div>
              <div className="strategy-options">
                {[
                  {
                    id: "balanced",
                    icon: "⚖️",
                    title: "Cân bằng",
                    desc: "Hài hòa chi phí & vận hành",
                  },
                  {
                    id: "cost",
                    icon: "💰",
                    title: "Tiết kiệm",
                    desc: "Tối ưu chi phí lương",
                  },
                  {
                    id: "quality",
                    icon: "⭐",
                    title: "Chất lượng",
                    desc: "Ưu tiên nhân sự giỏi",
                  },
                ].map((opt) => (
                  <div
                    key={opt.id}
                    className={`strategy-item ${
                      config.strategy === opt.id ? "active" : ""
                    }`}
                    onClick={() => setConfig({ ...config, strategy: opt.id })}
                  >
                    <div className="header-row">
                      <span className="icon">{opt.icon}</span>
                      <div className="radio-circle"></div>
                    </div>
                    <span className="title">{opt.title}</span>
                    <span className="desc">{opt.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Advanced Settings (Collapsible) */}
            <div className={`advanced-section ${showAdvanced ? "open" : ""}`}>
              <div
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>Cấu hình nâng cao & Ràng buộc</span>
                {showAdvanced ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </div>

              {showAdvanced && (
                <div className="advanced-panel">
                  {/* Switch: Overtime */}
                  <label className="switch-row">
                    <div className="label-text">
                      <ShieldCheck size={18} className="text-indigo" />
                      <div className="text-col">
                        <strong>Tránh tăng ca (Overtime)</strong>
                        <span>Giới hạn tối đa 40h/tuần/người</span>
                      </div>
                    </div>
                    <div
                      className={`switch-control ${
                        config.avoidOvertime ? "checked" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        hidden
                        checked={config.avoidOvertime}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            avoidOvertime: e.target.checked,
                          })
                        }
                      />
                      <div className="switch-circle"></div>
                    </div>
                  </label>

                  {/* Switch: Availability */}
                  <label className="switch-row">
                    <div className="label-text">
                      <AlertTriangle size={18} className="text-orange" />
                      <div className="text-col">
                        <strong>Tôn trọng lịch nghỉ</strong>
                        <span>Không xếp vào ngày phép/bận</span>
                      </div>
                    </div>
                    <div
                      className={`switch-control ${
                        config.respectAvailability ? "checked" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        hidden
                        checked={config.respectAvailability}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            respectAvailability: e.target.checked,
                          })
                        }
                      />
                      <div className="switch-circle"></div>
                    </div>
                  </label>

                  {/* Switch: Full-time */}
                  <label className="switch-row">
                    <div className="label-text">
                      <Users size={18} className="text-green" />
                      <div className="text-col">
                        <strong>Ưu tiên Full-time</strong>
                        <span>Xếp lịch cho NV chính thức trước</span>
                      </div>
                    </div>
                    <div
                      className={`switch-control ${
                        config.prioritizeFullTime ? "checked" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        hidden
                        checked={config.prioritizeFullTime}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            prioritizeFullTime: e.target.checked,
                          })
                        }
                      />
                      <div className="switch-circle"></div>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </>
        ) : (
          /* --- VIEW 2: PROCESSING STATE --- */
          <div className="processing-view">
            <div className="circular-progress-container">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${progress}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="percentage">
                <span className="number">{progress}%</span>
              </div>
            </div>

            <h3 className="process-title">AI đang tối ưu hóa lịch trình...</h3>
            <p className="process-subtitle">Vui lòng không tắt trình duyệt</p>

            <div className="terminal-logs">
              <div className="log-header">
                <span className="dot red"></span>
                <span className="dot yellow"></span>
                <span className="dot green"></span>
                <span className="title">System Logs</span>
              </div>
              <div className="log-content">
                {logs.map((log, idx) => (
                  <div key={idx} className="log-line">
                    <CheckCircle2 size={12} className="tick" />
                    <span className="text">{log}</span>
                  </div>
                ))}
                <div className="log-line blinking">_</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AutoScheduleModal;
