# Hướng dẫn nạp tri thức Chatbot AI

Tài liệu này dành cho trang **Manager → AI Chatbot Knowledge**. Mục tiêu là nạp đúng loại tri thức để chatbot trả lời tốt hơn mà không bịa món, giá, tồn kho hoặc chính sách.

## Nên nạp gì vào tri thức

Nạp các nội dung mang tính quy tắc, chính sách, playbook và câu trả lời ổn định:

- Thông tin nhà hàng: mô tả, liên hệ, giờ mở cửa, quy định đặt bàn.
- Chính sách: đặt bàn, hủy bàn, thanh toán, giao hàng, mang đi, khuyến mãi.
- FAQ: câu hỏi khách hay hỏi và câu trả lời chuẩn.
- Playbook tư vấn: cách gợi ý món theo hoàn cảnh, khẩu vị, ngân sách, dị ứng.

Không nạp dữ liệu sống như tồn kho tức thời, giá đang thay đổi liên tục, trạng thái đơn hàng hoặc thông tin cá nhân khách. Các dữ liệu này phải lấy từ database/context runtime.

## Mẫu JSON import nhanh

Vào **Nhập / Xuất dữ liệu → Định dạng nhập: JSON**, dán mảng JSON sau rồi bấm **Nhập dữ liệu**.

```json
[
  {
    "title": "Playbook gợi ý món khi khách xem bóng đá",
    "content": "Khi khách nói đang xem bóng đá, coi đá banh hoặc cần món ăn lúc giải trí, chatbot phải lấy món từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems, ưu tiên món còn bán, đánh giá cao, nhiều lượt đặt và hợp khẩu vị For You nếu có. Nên ưu tiên món dễ chia sẻ, ăn gọn, đậm vị, snack/combo hoặc món chuẩn bị nhanh. Không bịa món, giá hay tồn kho. Với mỗi món được nhắc, trả về source type menuItem và action link tới /food/{id} để khách bấm xem chi tiết/order.",
    "category": "recommendation_playbook",
    "tags": ["gợi ý món", "bóng đá", "for you", "menu"],
    "enabled": true,
    "priority": 80,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món khác theo For You",
    "content": "Khi khách nói món vừa gợi ý không ngon, không hợp khẩu vị, không thích hoặc muốn đề xuất khác, chatbot không lặp lại cùng món trong lượt trước. Hãy đổi sang món khác category hoặc khác khẩu vị, vẫn lấy từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems, ưu tiên For You: loại món có allergen, ưu tiên dietTags/tasteProfile phù hợp, sau đó xét đánh giá và lượt đặt. Nếu không đủ dữ liệu, hỏi thêm khẩu vị/ngân sách hoặc gợi ý mở menu để khách tự chọn.",
    "category": "recommendation_playbook",
    "tags": ["món khác", "for you", "khẩu vị", "menu"],
    "enabled": true,
    "priority": 80,
    "sourceType": "manual"
  },
  {
    "title": "Nguyên tắc không bịa dữ liệu món ăn",
    "content": "Chatbot chỉ được nói tên món, giá, trạng thái còn bán, đánh giá, lượt đặt và link món khi dữ liệu có trong CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems. Nếu thiếu dữ liệu, phải nói chưa thấy trong dữ liệu hiện tại và gợi ý khách mở menu hoặc liên hệ nhân viên.",
    "category": "safety_policy",
    "tags": ["menu", "an toàn", "không bịa"],
    "enabled": true,
    "priority": 100,
    "sourceType": "policy"
  }
]
```

## Cách dùng nút “Tạo tri thức tự động”

1. Chọn đúng nhà hàng ở góc phải.
2. Bấm **Tạo tri thức tự động**.
3. Mở tab **Gợi ý**.
4. Kiểm tra từng gợi ý, sửa câu chữ nếu cần.
5. Bấm **Duyệt** để chuyển gợi ý thành tri thức chatbot dùng được.

Nút này tạo gợi ý từ dữ liệu nhà hàng, giờ mở cửa, đặt bàn, menu, thanh toán, khuyến mãi, giao hàng/mang đi. Với cập nhật hiện tại, khi có nguồn menu, hệ thống cũng sinh thêm playbook gợi ý món khi xem bóng đá và gợi ý món khác theo For You.

## Quy tắc viết một mục tri thức tốt

- **Tiêu đề**: ngắn, nói rõ tình huống.
- **Nội dung**: viết như hướng dẫn cho chatbot, không viết như quảng cáo chung chung.
- **Danh mục**: dùng `recommendation_playbook`, `policy`, `faq`, `menu_safety`, `restaurant_info`.
- **Thẻ**: 3–6 thẻ dễ tìm, ví dụ `for you`, `bóng đá`, `dị ứng`, `đặt bàn`.
- **Ưu tiên**: 80–100 cho quy tắc quan trọng; 0–50 cho FAQ thường.
- **Enabled**: bật khi nội dung đã được kiểm tra.

## Câu test nên dùng sau khi nạp

- “Hôm nay tôi đang coi đá banh và cần cái gì đó ăn ngon miệng, đề xuất món được đánh giá cao nhất.”
- “Tôi thấy không ngon lắm, có đề xuất khác không?”
- “Tôi không ăn cay, gợi ý món dễ ăn.”
- “Tôi dị ứng hải sản, gợi ý món an toàn.”
