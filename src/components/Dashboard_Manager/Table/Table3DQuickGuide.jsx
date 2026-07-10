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
          đủ sáng và di chuyển chậm sang hai bên. Chỉ đặt khi mặt sàn đã được nhận
          diện ổn định. Sau khi đặt, không kéo hoặc chụm hai ngón vì tỷ lệ AR đã
          được khóa để hạn chế mô hình phóng, thu hoặc trôi khi camera đổi khoảng
          cách. Nếu model vẫn sai tỷ lệ, hãy dùng file có đơn vị mét chuẩn. Chế độ
          xem thử này không thay đổi dữ liệu bàn hoặc sơ đồ tầng.
        </p>
      </details>
    </div>
  );
}
