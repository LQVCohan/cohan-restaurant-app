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
          Mở camera AR rồi di chuyển thiết bị chậm quanh khu vực cần đặt bàn. Khi
          thiết bị nhận diện được mặt sàn, bạn có thể đặt tạm mô hình để đánh giá
          kiểu dáng, tỉ lệ và khoảng trống. Chế độ xem thử này không thay đổi dữ
          liệu bàn hoặc sơ đồ tầng.
        </p>
      </details>
    </div>
  );
}
