import React from "react";
import { Info } from "lucide-react";

export default function Table3DQuickGuide() {
  return (
    <div className="table-3d-quick-guide">
      <div>
        <span>1</span>
        <strong>Chọn hoặc nhập model</strong>
      </div>
      <div>
        <span>2</span>
        <strong>Kiểm tra trong khung xem 3D</strong>
      </div>
      <div>
        <span>3</span>
        <strong>Quét mặt sàn và đặt thử bằng AR</strong>
      </div>
      <details>
        <summary>
          <Info size={14} aria-hidden="true" /> AR hoạt động thế nào?
        </summary>
        <p>
          Lùi khỏi vị trí đặt khoảng 1,5–2 m, hướng camera xuống vùng sàn trống,
          đủ sáng và di chuyển chậm sang hai bên. Tránh quét giường, ghế hoặc đồ
          vật vì thiết bị có thể nhận nhầm chúng là mặt phẳng đặt bàn. Sau khi đặt,
          dùng hai ngón tay để thu nhỏ hoặc phóng to mô hình cho đúng tỉ lệ thực tế.
          Chế độ xem thử này không thay đổi dữ liệu bàn hoặc sơ đồ tầng.
        </p>
      </details>
    </div>
  );
}
