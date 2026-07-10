# Chất lượng và độ trễ AI chatbot

## Hiện trạng và nguyên nhân gốc

Frontend chuyển mutation `askAiChatbot` sang endpoint SSE `/ai/chatbot/stream`. Endpoint này vẫn chờ toàn bộ pipeline hoàn tất trước khi phát ký tự đầu tiên.

Critical path gồm:

1. Xác định phạm vi nhà hàng và tải ngữ cảnh MongoDB.
2. Tìm knowledge; semantic retrieval có thể gọi BGE-M3 local.
3. Gọi Gemini.
4. Nếu Gemini thất bại, gọi Qwen3 local fallback.
5. Post-process và lưu kết quả rồi mới trả dữ liệu hoàn chỉnh cho SSE.

Model runtime được ép về `gemini-3.5-flash`. Bản tối ưu đầu tiên đặt timeout quá ngắn nên có thể rơi fallback trước khi Gemini kịp trả lời tốt.

Ảnh kiểm tra thực tế còn cho thấy câu hỏi về món đang xem như “hết món rồi phải làm sao” bị trả lời bằng mẫu gợi ý món chung. Nguyên nhân là phản hồi `menu` có nguồn món bị UI rút gọn, trong khi lớp post-process chưa có nhánh riêng cho trạng thái tồn kho của món đã xác minh.

## Luồng thật đã kiểm tra

`AiChatbotWidget` → `aiChatbotStreamFetchPatch` → `POST /ai/chatbot/stream` → `restaurantChatbotReviewed.service` → `restaurantChatbotCore.service` → scope/context/knowledge → Gemini → Ollama fallback → post-process → SSE.

Trang `/food/:foodId` gửi `selectedMenuItem` trong `pageContext`. Lớp reviewed xác minh món và nhà hàng từ database trước khi dùng ngữ cảnh này.

## Phạm vi đã triển khai

- Giữ model `gemini-3.5-flash` và ưu tiên chất lượng thay vì fallback sớm.
- Tăng giới hạn mặc định:
  - Gemini: 30 giây.
  - Qwen3 local fallback: 15 giây.
  - BGE-M3 embedding: 8 giây.
- Vẫn cho phép ghi đè timeout bằng biến môi trường.
- Khi người dùng đang ở trang món và hỏi về hết nguyên liệu, tồn kho hoặc số lượng còn lại:
  - xác minh món/nhà hàng như luồng cũ;
  - đọc tồn kho thực bằng `getMenuItemInventoryAvailability`;
  - trả số lượng tối đa hoặc giải thích rõ khi hết hàng/chưa theo dõi tồn kho;
  - đổi intent thành `menuItemStatus` để UI không thay câu trả lời bằng mẫu menu chung.
- Bổ sung test cho timeout và câu trả lời tồn kho có căn cứ.

## Ngoài phạm vi

- Chưa chuyển Gemini sang streaming token thật.
- Không thay đổi GraphQL schema, permission, restaurant scoping, safety, history hoặc persistence.
- Không tắt semantic search hay local fallback.

## Tiêu chí nghiệm thu

- Gemini có đủ thời gian trả lời trước khi fallback nhưng vẫn không thể chờ vô hạn.
- Câu hỏi tồn kho của món đang xem không bị thay bằng câu “Mình tìm được vài món phù hợp”.
- Món hết nguyên liệu trả số lượng có thể đặt là 0.
- Món còn hàng trả số lượng tối đa tính từ recipe và tồn kho.
- Món chưa theo dõi recipe không bị bịa số lượng.
- Cấu hình model vẫn là `gemini-3.5-flash`.

## Kiểm tra

Đã thêm/cập nhật:

- `cohan-restaurant-backend/tests/services/aiRuntimeTimeout.service.test.js`
- `cohan-restaurant-backend/tests/services/restaurantChatbotReviewedAvailability.service.test.js`

Chưa chạy trong phiên GitHub connector:

- `vitest run cohan-restaurant-backend/tests/services/aiRuntimeTimeout.service.test.js`
- `vitest run cohan-restaurant-backend/tests/services/restaurantChatbotReviewedAvailability.service.test.js`
- `vitest run cohan-restaurant-backend/tests/services/restaurantChatbot.service.test.js`
- `npm run check:graphql`
- `npm run build`
