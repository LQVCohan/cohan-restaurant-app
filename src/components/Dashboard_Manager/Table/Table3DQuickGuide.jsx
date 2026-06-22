import React from "react";
import { Info } from "lucide-react";

export default function Table3DQuickGuide() {
  return (
    <div className="table-3d-quick-guide">
      <div><span>1</span><strong>Chọn mẫu bàn</strong></div>
      <div><span>2</span><strong>Xem thử bằng camera</strong></div>
      <div><span>3</span><strong>Áp dụng hoặc đặt vị trí</strong></div>
      <details>
        <summary><Info size={14} />AR hoạt động thế nào?</summary>
        <p>
          Xem AR chỉ giúp quan sát mẫu bàn trong không gian thực. Muốn lưu vị trí
          vào sơ đồ tầng, hãy dùng chức năng đặt vị trí hoặc nhập tọa độ thủ công
          khi thiết bị chưa hỗ trợ đầy đủ.
        </p>
      </details>
    </div>
  );
}
