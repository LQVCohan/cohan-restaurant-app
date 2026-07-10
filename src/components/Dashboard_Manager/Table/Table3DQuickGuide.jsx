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
          Giữ điện thoại cách vùng sàn khoảng 1–1,5 m, đủ sáng và quét chậm theo
          vòng cung nhỏ. Giữ thêm mép tường, chân bàn hoặc chi tiết có độ tương
          phản trong khung hình để thiết bị dễ bám điểm; tránh sàn quá tối, bóng
          hoặc trống hoàn toàn. Chỉ chạm đặt khi dấu nhận diện đã đứng yên. Sau
          khi đặt, dùng hai ngón tay để thu nhỏ hoặc phóng to mô hình và di chuyển
          điện thoại chậm để hạn chế trôi vị trí. Chế độ xem thử này không thay
          đổi dữ liệu bàn hoặc sơ đồ tầng.
        </p>
      </details>
    </div>
  );
}
