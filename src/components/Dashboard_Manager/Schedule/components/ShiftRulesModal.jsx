import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import { Plus, Settings2, Trash2 } from "lucide-react";
import {
  buildSmartShiftRules,
  validateShiftRules,
} from "../utils/scheduleHelpers";
import "./ShiftRulesModal.scss";

const ShiftRulesModal = ({ isOpen, onClose, rules, onApply }) => {
  const [draftRules, setDraftRules] = useState(rules);

  useEffect(() => {
    if (isOpen) setDraftRules(rules);
  }, [isOpen, rules]);

  const validation = useMemo(() => validateShiftRules(draftRules), [draftRules]);

  const handleUseSmartCount = (count) => {
    setDraftRules(buildSmartShiftRules(count));
  };

  const handleChangeTime = (type, field, value) => {
    setDraftRules((prev) =>
      prev.map((rule) =>
        rule.type === type
          ? { ...rule, [field]: value, time: `${field === "startTime" ? value : rule.startTime} - ${
              field === "endTime" ? value : rule.endTime
            }` }
          : rule,
      ),
    );
  };

  const handleAddShift = () => {
    setDraftRules((prev) => buildSmartShiftRules(Math.min(3, prev.length + 1)));
  };

  const handleRemoveShift = () => {
    setDraftRules((prev) => buildSmartShiftRules(Math.max(2, prev.length - 1)));
  };

  const handleSubmit = () => {
    if (!validation.ok) return;
    onApply(draftRules);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" className="shift-rules-modal">
      <Modal.Header>Cài đặt quy tắc ca làm</Modal.Header>
      <Modal.Body>
        <div className="shift-rules-toolbar">
          <div className="toolbar-title">
            <Settings2 size={18} />
            <div>
              <strong>Khung ca theo ngày</strong>
              <span>Tên ca được tự điền theo số lượng ca đang dùng.</span>
            </div>
          </div>
          <div className="smart-count-actions">
            <button type="button" onClick={() => handleUseSmartCount(2)}>
              2 ca
            </button>
            <button type="button" onClick={() => handleUseSmartCount(3)}>
              3 ca
            </button>
          </div>
        </div>

        <div className="shift-rule-list">
          {draftRules.map((rule) => (
            <div className="shift-rule-row" key={rule.type}>
              <div className="rule-name">
                <span className="rule-icon">{rule.icon}</span>
                <div>
                  <strong>{rule.label}</strong>
                  <span>{rule.type}</span>
                </div>
              </div>
              <label>
                Bắt đầu
                <input
                  type="time"
                  value={rule.startTime}
                  onChange={(event) => handleChangeTime(rule.type, "startTime", event.target.value)}
                />
              </label>
              <label>
                Kết thúc
                <input
                  type="time"
                  value={rule.endTime}
                  onChange={(event) => handleChangeTime(rule.type, "endTime", event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>

        <div className="shift-rule-actions">
          <button type="button" onClick={handleAddShift} disabled={draftRules.length >= 3}>
            <Plus size={16} />
            Thêm ca
          </button>
          <button type="button" onClick={handleRemoveShift} disabled={draftRules.length <= 2}>
            <Trash2 size={16} />
            Bớt ca
          </button>
        </div>

        {!validation.ok ? (
          <div className="shift-rule-errors">
            {validation.errors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Đóng
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!validation.ok}
        >
          Lưu quy tắc
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShiftRulesModal;
