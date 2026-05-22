# Phân tích chức năng ChatBot A.I trong Cohan Restaurant App

## 1. Bối cảnh dự án

Cohan Restaurant App là hệ thống quản lý và trải nghiệm nhà hàng gồm nhiều phân hệ: khách hàng xem nhà hàng/menu, đặt bàn, đặt món, theo dõi đơn hàng, dùng coupon; nhân viên xử lý order/bếp/ca làm; quản lý theo dõi vận hành, bàn, khuyến mãi, hiệu suất và dữ liệu nghiệp vụ.

Trong kiến trúc hiện tại, dự án đã có frontend React/Vite, backend Node.js/Fastify, GraphQL, MongoDB, Socket.IO, notification, phân quyền và một số endpoint AI cho bàn/sơ đồ bàn. Vì vậy ChatBot A.I không nên chỉ là một hộp chat tĩnh, mà nên đóng vai trò lớp trợ lý nghiệp vụ đặt trên dữ liệu thật của hệ thống.

## 2. ChatBot A.I sẽ làm được gì?

### 2.1. Với khách hàng

Chatbot có thể hỗ trợ khách hàng ngay trên website/app:

- Gợi ý món ăn dựa trên menu, giá, đánh giá, số lượt đặt và trạng thái còn bán.
- Trả lời câu hỏi về nhà hàng: địa chỉ, giờ mở cửa, loại ẩm thực, trạng thái hoạt động, tiện ích.
- Hướng dẫn đặt bàn và chuyển nhanh đến trang sơ đồ bàn của nhà hàng.
- Kiểm tra đơn hàng nếu người dùng nhập mã đơn/mã theo dõi hoặc đã đăng nhập.
- Gợi ý coupon/ưu đãi đang hoạt động.
- Hướng dẫn người dùng mở trang đơn hàng, coupon, nhà hàng hoặc trung tâm hỗ trợ.

### 2.2. Với nhân viên

Ở giai đoạn mở rộng, chatbot có thể hỗ trợ nhân viên:

- Tra cứu nhanh trạng thái order, bàn, yêu cầu thanh toán.
- Gợi ý xử lý khi khách hỏi về món hết hàng, đơn chậm, cần gọi nhân viên.
- Hướng dẫn thao tác hệ thống POS/bếp/ca làm.
- Tóm tắt các cảnh báo cần xử lý trong ca.

### 2.3. Với quản lý/admin

Chatbot có thể trở thành trợ lý vận hành:

- Tóm tắt tình hình nhà hàng theo dữ liệu thật: đơn gần đây, coupon đang chạy, menu khả dụng.
- Gợi ý khuyến mãi dựa trên menu/coupon hiện có.
- Hỗ trợ đọc nhanh các phân hệ như tồn kho, hiệu suất nhân viên, đặt bàn, doanh thu khi được nối thêm resolver tương ứng.
- Giảm thời gian tìm chức năng bằng cách điều hướng nhanh đến đúng màn hình quản trị.

## 3. Vai trò của ChatBot A.I trong hệ thống

Chatbot nên được hiểu là một lớp giao tiếp thông minh giữa người dùng và dữ liệu nghiệp vụ:

1. **Trợ lý khách hàng:** giúp người dùng hỏi bằng ngôn ngữ tự nhiên thay vì phải tự tìm menu, coupon, đặt bàn hoặc đơn hàng.
2. **Trợ lý điều hướng:** đưa người dùng đến đúng màn hình như nhà hàng, đặt bàn, coupon, đơn hàng.
3. **Trợ lý ra quyết định:** gợi ý món, ưu đãi, hành động tiếp theo dựa trên dữ liệu thật.
4. **Trợ lý vận hành:** sau này có thể hỗ trợ quản lý/nhân viên đọc nhanh dữ liệu vận hành.
5. **Lớp AI an toàn:** nếu chưa có API key AI, hệ thống vẫn trả lời bằng fallback rule-based dựa trên dữ liệu MongoDB.

## 4. Phạm vi MVP đã triển khai

MVP hiện tại tập trung vào tính năng có giá trị ngay, ít rủi ro:

- Thêm service backend `restaurantChatbot.service.js`.
- Thêm GraphQL schema `aiChatbot.graphql`.
- Thêm GraphQL mutation `askAiChatbot`.
- Thêm widget nổi `AiChatbotWidget` ở frontend.
- Chatbot tự lấy ngữ cảnh nhà hàng từ URL `/restaurant/:id` hoặc `/coupons/:restaurantId`.
- Chatbot đọc dữ liệu từ các model: `Restaurant`, `MenuItem`, `Coupon`, `Order`, `Reservation`.
- Nếu có `OPENAI_API_KEY`, chatbot gọi OpenAI để trả lời tự nhiên hơn.
- Nếu chưa có `OPENAI_API_KEY`, chatbot dùng fallback rule-based, vẫn chạy được trong local/demo.

## 5. Luồng hoạt động

1. Người dùng mở widget ChatBot A.I.
2. Người dùng nhập câu hỏi, ví dụ: “Gợi ý món bán chạy”, “Tôi muốn đặt bàn”, “Có mã giảm giá nào không?”, “Kiểm tra đơn ORD123”.
3. Frontend gọi mutation `askAiChatbot`.
4. Backend phân loại intent: menu, reservation, order, promotion, manager, support hoặc general.
5. Backend truy xuất dữ liệu phù hợp từ MongoDB.
6. Nếu có OpenAI API key, backend gửi context đã rút gọn cho model AI.
7. Nếu không có API key hoặc AI lỗi, backend trả lời bằng fallback an toàn.
8. Frontend hiển thị câu trả lời, quick replies, nút hành động và tóm tắt nguồn dữ liệu đã tham chiếu.

## 6. Vì sao chọn GraphQL thay vì REST?

Dự án đang dùng GraphQL làm kênh giao tiếp chính cho hầu hết nghiệp vụ backend. Việc thêm chatbot qua GraphQL giúp:

- Đồng bộ với kiến trúc hiện có.
- Dễ dùng Apollo Client ở frontend.
- Tái sử dụng context đăng nhập/phân quyền.
- Dễ mở rộng thêm field, action, source, confidence, contextSummary.

## 7. An toàn dữ liệu và giới hạn

- Chatbot không tự bịa giá, trạng thái đơn, thông tin nhà hàng nếu context không có dữ liệu.
- Đơn hàng/booking cá nhân chỉ trả về theo user đăng nhập hoặc mã tra cứu.
- Báo cáo quản lý sâu cần kiểm soát role manager/admin trước khi mở rộng.
- API key AI không được commit vào Git, chỉ cấu hình bằng biến môi trường `OPENAI_API_KEY`.
- Khi không có API key, hệ thống vẫn hoạt động bằng fallback.

## 8. Hướng mở rộng tiếp theo

Các hướng nên làm sau MVP:

1. Lưu lịch sử hội thoại vào collection riêng để phân tích nhu cầu khách hàng.
2. Kết nối chatbot với chat thread hiện có để bàn giao cho nhân viên thật khi cần.
3. Thêm intent quản lý: doanh thu hôm nay, món bán chạy, cảnh báo tồn kho, ca làm, hiệu suất nhân viên.
4. Thêm retrieval theo tài liệu hướng dẫn sử dụng hệ thống.
5. Thêm streaming response và Socket.IO để trải nghiệm chat mượt hơn.
6. Thêm test cho service phân loại intent và fallback answer.
7. Thêm cấu hình bật/tắt chatbot theo nhà hàng hoặc theo role.

## 9. Cách demo nhanh

Câu hỏi demo cho khách hàng:

- “Gợi ý món bán chạy cho tôi”
- “Nhà hàng này có mã giảm giá nào không?”
- “Tôi muốn đặt bàn cho 4 người”
- “Kiểm tra đơn hàng ORD123”

Câu hỏi demo cho quản lý:

- “Chatbot có thể hỗ trợ quản lý gì?”
- “Tóm tắt nhanh dữ liệu nhà hàng này”

## 10. Biến môi trường liên quan

Backend có thể cấu hình thêm:

```bash
OPENAI_API_KEY=your_openai_api_key
AI_CHATBOT_MODEL=gpt-5
```

Nếu không cấu hình `OPENAI_API_KEY`, chatbot vẫn chạy bằng fallback rule-based.
