import React, { useState, useEffect } from "react";
import Modal, { ModalFooter } from "../../../../components/common/Modal";
import "./OrderSettingsModal.scss";

const DEFAULT_TIME_COLORS = {
  ok: "#16a34a", // xanh lá
  warn: "#eab308", // vàng
  danger: "#f97316", // cam/đỏ
  critical: "#b91c1c", // đỏ đậm
};

const OrderSettingsModal = ({
  open,
  onClose,
  timeSettings,
  onSaveTimeSettings,
  chipSize,
  onSaveChipSize,
  timeColors,
  onSaveTimeColors,
}) => {
  const [localTime, setLocalTime] = useState(timeSettings);
  const [localChip, setLocalChip] = useState(chipSize || "m");
  const [localColors, setLocalColors] = useState(
    timeColors || DEFAULT_TIME_COLORS
  );

  useEffect(() => {
    setLocalTime(timeSettings);
  }, [timeSettings, open]);

  useEffect(() => {
    setLocalChip(chipSize || "m");
  }, [chipSize, open]);

  useEffect(() => {
    setLocalColors(timeColors || DEFAULT_TIME_COLORS);
  }, [timeColors, open]);

  const handleTimeChange = (field, value) => {
    setLocalTime((prev) => ({
      ...prev,
      [field]: value === "" ? "" : Number(value),
    }));
  };

  const handleColorChange = (field, value) => {
    setLocalColors((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    let normalized = {
      warn: Number(localTime.warn) || 0,
      danger: Number(localTime.danger) || 0,
      critical: Number(localTime.critical) || 0,
    };

    // đảm bảo thứ tự tăng dần
    if (normalized.danger < normalized.warn)
      normalized.danger = normalized.warn;
    if (normalized.critical < normalized.danger)
      normalized.critical = normalized.danger;

    onSaveTimeSettings?.(normalized);
    onSaveChipSize?.(localChip);
    onSaveTimeColors?.(localColors);

    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="⚙️ Cài đặt hiển thị đơn hàng"
      size="lg"
    >
      <div className="orderSettingsModal">
        {/* SECTION 1: Thời gian cảnh báo */}
        <section className="orderSettingsModal__section">
          <h3 className="orderSettingsModal__title">
            ⏱ Ngưỡng thời gian cảnh báo
          </h3>
          <p className="orderSettingsModal__hint">
            Dùng để đổi màu cảnh báo thời gian trên thẻ đơn. Giá trị tính theo
            phút, khi vượt qua sẽ chuyển cấp độ.
          </p>

          <div className="orderSettingsModal__grid">
            <div className="orderSettingsModal__field">
              <label>Cảnh báo (warn) ≥</label>
              <div className="orderSettingsModal__field-row">
                <input
                  type="number"
                  min={0}
                  value={localTime.warn}
                  onChange={(e) => handleTimeChange("warn", e.target.value)}
                />
                <span className="suffix">phút</span>
              </div>
            </div>

            <div className="orderSettingsModal__field">
              <label>Nguy hiểm (danger) ≥</label>
              <div className="orderSettingsModal__field-row">
                <input
                  type="number"
                  min={0}
                  value={localTime.danger}
                  onChange={(e) => handleTimeChange("danger", e.target.value)}
                />
                <span className="suffix">phút</span>
              </div>
            </div>

            <div className="orderSettingsModal__field">
              <label>Khẩn cấp (critical) ≥</label>
              <div className="orderSettingsModal__field-row">
                <input
                  type="number"
                  min={0}
                  value={localTime.critical}
                  onChange={(e) => handleTimeChange("critical", e.target.value)}
                />
                <span className="suffix">phút</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: Chế độ bếp */}
        <section className="orderSettingsModal__section">
          <h3 className="orderSettingsModal__title">🍳 Chế độ Bếp (Focus)</h3>
          <p className="orderSettingsModal__hint">
            Điều chỉnh kích thước các thẻ món trong phần tóm tắt để đầu bếp dễ
            nhìn hơn.
          </p>

          <div className="orderSettingsModal__chipsize">
            <label className="orderSettingsModal__chipsize-label">
              Cỡ thẻ món (tóm tắt):
            </label>
            <div className="orderSettingsModal__chipsize-options">
              <label className="chipSizeOption">
                <input
                  type="radio"
                  name="chipSize"
                  value="s"
                  checked={localChip === "s"}
                  onChange={(e) => setLocalChip(e.target.value)}
                />
                <span>Nhỏ</span>
              </label>
              <label className="chipSizeOption">
                <input
                  type="radio"
                  name="chipSize"
                  value="m"
                  checked={localChip === "m"}
                  onChange={(e) => setLocalChip(e.target.value)}
                />
                <span>Vừa</span>
              </label>
              <label className="chipSizeOption">
                <input
                  type="radio"
                  name="chipSize"
                  value="l"
                  checked={localChip === "l"}
                  onChange={(e) => setLocalChip(e.target.value)}
                />
                <span>Lớn (dễ nhìn)</span>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 3: Màu cảnh báo */}
        <section className="orderSettingsModal__section">
          <h3 className="orderSettingsModal__title">
            🎨 Màu cảnh báo theo thời gian
          </h3>
          <p className="orderSettingsModal__hint">
            Áp dụng cho badge thời gian và viền thẻ trong chế độ Bếp. Bạn có thể
            chỉnh cho hợp với ánh sáng bếp / màn hình.
          </p>

          <div className="orderSettingsModal__colors">
            <div className="orderSettingsModal__color-row">
              <div className="orderSettingsModal__color-label">
                <span
                  className="dot dot--preview"
                  style={{ backgroundColor: localColors.ok }}
                />
                <div>
                  <div className="colorName">Mới / Bình thường (OK)</div>
                  <div className="colorDesc">Đơn mới, trong ngưỡng an toàn</div>
                </div>
              </div>
              <input
                type="color"
                value={localColors.ok}
                onChange={(e) => handleColorChange("ok", e.target.value)}
              />
            </div>

            <div className="orderSettingsModal__color-row">
              <div className="orderSettingsModal__color-label">
                <span
                  className="dot dot--preview"
                  style={{ backgroundColor: localColors.warn }}
                />
                <div>
                  <div className="colorName">Cảnh báo (Warn)</div>
                  <div className="colorDesc">Đơn đã lâu, cần chuẩn bị sớm</div>
                </div>
              </div>
              <input
                type="color"
                value={localColors.warn}
                onChange={(e) => handleColorChange("warn", e.target.value)}
              />
            </div>

            <div className="orderSettingsModal__color-row">
              <div className="orderSettingsModal__color-label">
                <span
                  className="dot dot--preview"
                  style={{ backgroundColor: localColors.danger }}
                />
                <div>
                  <div className="colorName">Nguy hiểm (Danger)</div>
                  <div className="colorDesc">
                    Đơn rất lâu, nên ưu tiên xử lý
                  </div>
                </div>
              </div>
              <input
                type="color"
                value={localColors.danger}
                onChange={(e) => handleColorChange("danger", e.target.value)}
              />
            </div>

            <div className="orderSettingsModal__color-row">
              <div className="orderSettingsModal__color-label">
                <span
                  className="dot dot--preview"
                  style={{ backgroundColor: localColors.critical }}
                />
                <div>
                  <div className="colorName">Khẩn cấp (Critical)</div>
                  <div className="colorDesc">
                    Đơn vượt xa ngưỡng, cần chú ý ngay
                  </div>
                </div>
              </div>
              <input
                type="color"
                value={localColors.critical}
                onChange={(e) => handleColorChange("critical", e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* sau này có thể thêm:
            - Ẩn đơn đã hoàn thành sau X phút
            - Mật độ card (compact vs rộng)
            - Bật/tắt highlight theo thời gian
         */}
      </div>

      <ModalFooter>
        <button className="btn btn--secondary" onClick={onClose}>
          Hủy
        </button>
        <button className="btn btn--primary" onClick={handleSave}>
          Lưu cài đặt
        </button>
      </ModalFooter>
    </Modal>
  );
};

export default OrderSettingsModal;
