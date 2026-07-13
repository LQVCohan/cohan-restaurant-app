import React from "react";
import { Calculator, CheckCircle2, MinusCircle } from "lucide-react";

import Modal from "../../../common/Modal";
import "./ScoringGuideModal.scss";

const POSITIVE_ITEMS = [
  {
    key: "roleFit",
    label: "Đúng vị trí",
    fallback: 20,
    explanation:
      "Đúng hẳn vị trí thì nhận đủ điểm. Khớp gần đúng thì nhận khoảng 70%. Sai vị trí thì không được chọn.",
  },
  {
    key: "availabilityFit",
    label: "Đúng lịch rảnh",
    fallback: 15,
    explanation:
      "Không có cảnh báo lịch rảnh thì nhận đủ điểm. Cảnh báo càng nặng thì điểm càng giảm; trường hợp không hợp lệ có thể bị loại.",
  },
  {
    key: "workloadBalance",
    label: "Cân bằng giờ làm",
    fallback: 15,
    explanation:
      "Người còn ít giờ trong tuần nhận nhiều điểm hơn. Càng gần hoặc vượt mục tiêu giờ thì điểm càng thấp.",
  },
  {
    key: "fairness",
    label: "Chia đều giờ đã xếp",
    fallback: 10,
    explanation:
      "Hệ thống so tổng giờ giữa các ứng viên. Người đang có ít giờ hơn sẽ được cộng nhiều điểm hơn.",
  },
  {
    key: "performance",
    label: "Hiệu suất",
    fallback: 10,
    explanation:
      "Điểm hiệu suất 80/100 sẽ nhận 80% mức điểm này. Chưa có dữ liệu thì tạm tính 75/100.",
  },
  {
    key: "employmentTypeFit",
    label: "Loại nhân sự",
    fallback: 10,
    explanation:
      "Dùng mức ưu tiên đã đặt cho full-time, part-time, thử việc, thời vụ hoặc hợp đồng.",
  },
  {
    key: "costEfficiency",
    label: "Chi phí",
    fallback: 5,
    explanation:
      "Hệ thống đổi lương giờ, lương ca hoặc lương tháng thành chi phí một giờ. Người có chi phí thấp hơn nhận nhiều điểm hơn.",
  },
  {
    key: "reliability",
    label: "Độ tin cậy",
    fallback: 5,
    explanation:
      "Lấy trung bình điểm đúng giờ và tuân thủ. Điểm 80/100 sẽ nhận 80% mức điểm này.",
  },
];

const PENALTY_ITEMS = [
  {
    key: "fatiguePenalty",
    label: "Làm liên tục quá nhiều ngày",
    fallback: 20,
    explanation:
      "Khi số ngày làm liên tục chạm ngưỡng cảnh báo, hệ thống trừ toàn bộ mức phạt này.",
  },
  {
    key: "overtimePenalty",
    label: "Vượt giờ khuyến nghị",
    fallback: 15,
    explanation:
      "Khi tổng giờ sau khi xếp vượt mức giờ khuyến nghị trong tuần, hệ thống trừ toàn bộ mức phạt này.",
  },
  {
    key: "ruleRiskPenalty",
    label: "Có cảnh báo quy tắc",
    fallback: 30,
    explanation:
      "Cảnh báo nhẹ trừ ít, cảnh báo vừa trừ khoảng 60%, cảnh báo nặng trừ toàn bộ. Lỗi chặn sẽ loại ứng viên trước.",
  },
];

const readWeight = (weights, item) => {
  const value = Number(weights?.[item.key]);
  return Number.isFinite(value) ? value : item.fallback;
};

function GuideRow({ item, weights, tone }) {
  const Icon = tone === "penalty" ? MinusCircle : CheckCircle2;

  return (
    <article className={`scoring-guide-row ${tone}`}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <strong>{item.label}</strong>
        <p>{item.explanation}</p>
      </div>
      <span className="scoring-guide-weight">Mức {readWeight(weights, item)}</span>
    </article>
  );
}

const ScoringGuideModal = ({ isOpen, onClose, weights = {} }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    size="sm"
    zIndex={1140}
    className="scoring-guide-modal"
  >
    <Modal.Header onClose={onClose}>
      <div className="scoring-guide-title">
        <Calculator size={19} aria-hidden="true" />
        <div>
          <span>Giải thích nhanh</span>
          <strong>Cách hệ thống tính điểm</strong>
        </div>
      </div>
    </Modal.Header>

    <Modal.Body className="scoring-guide-body">
      <section className="scoring-guide-summary">
        <strong>Hệ thống làm 3 bước</strong>
        <ol>
          <li>Cộng điểm từ các điểm tốt của nhân viên.</li>
          <li>Trừ điểm khi có rủi ro hoặc cảnh báo.</li>
          <li>Đổi kết quả về thang 0–100 và ưu tiên người có điểm cao hơn.</li>
        </ol>
        <div className="scoring-guide-formula">
          Điểm cuối = (điểm cộng − điểm trừ) ÷ tổng mức điểm cộng × 100
        </div>
        <p className="scoring-guide-zero-note">
          Số đang đặt là <strong>mức ảnh hưởng</strong>, không phải điểm cố định.
          Đặt một mục bằng <strong>0</strong> nghĩa là bỏ qua mục đó.
        </p>
      </section>

      <section className="scoring-guide-section">
        <div className="scoring-guide-section-title positive">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>Điểm cộng</strong>
            <span>Nhân viên phù hợp hơn sẽ nhận nhiều hơn.</span>
          </div>
        </div>
        <div className="scoring-guide-list">
          {POSITIVE_ITEMS.map((item) => (
            <GuideRow key={item.key} item={item} weights={weights} tone="positive" />
          ))}
        </div>
      </section>

      <section className="scoring-guide-section">
        <div className="scoring-guide-section-title penalty">
          <MinusCircle size={18} aria-hidden="true" />
          <div>
            <strong>Điểm trừ</strong>
            <span>Chỉ trừ khi điều kiện rủi ro xảy ra.</span>
          </div>
        </div>
        <div className="scoring-guide-list">
          {PENALTY_ITEMS.map((item) => (
            <GuideRow key={item.key} item={item} weights={weights} tone="penalty" />
          ))}
        </div>
      </section>

      <section className="scoring-guide-example">
        <strong>Ví dụ dễ hiểu</strong>
        <p>
          Hiệu suất đang đặt mức 20 và nhân viên đạt 80/100 thì mục này cộng 16
          điểm. Nếu mức phạt tăng ca là 15 và người đó vượt giờ khuyến nghị thì
          bị trừ 15 điểm.
        </p>
      </section>
    </Modal.Body>

    <Modal.Footer>
      <button type="button" className="btn-primary" onClick={onClose}>
        Đã hiểu
      </button>
    </Modal.Footer>
  </Modal>
);

export { PENALTY_ITEMS, POSITIVE_ITEMS };
export default ScoringGuideModal;
