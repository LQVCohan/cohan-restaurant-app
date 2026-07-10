# Giảm độ trễ AI chatbot

## Hiện trạng và nguyên nhân gốc

Frontend chuyển mutation `askAiChatbot` sang endpoint SSE `/ai/chatbot/stream`. Endpoint này vẫn chờ toàn bộ pipeline hoàn tất trước khi phát ký tự đầu tiên.

Critical path hiện tại gồm:

1. Xác định phạm vi nhà hàng và tải ngữ cảnh MongoDB.
2. Tìm knowledge; semantic retrieval gọi embedding local BGE-M3 với timeout mặc định 30 giây.
3. Gọi Gemini bằng `fetch` trực tiếp nhưng không có timeout.
4. Nếu Gemini thất bại, chờ Qwen3 local với timeout mặc định 30 giây.
5. Lưu kết quả rồi mới trả dữ liệu hoàn chỉnh cho SSE.

Model runtime được ép về `gemini-3.5-flash`; vấn đề chính là thời gian chờ không bị giới hạn ở các provider phụ thuộc mạng/local.

## Luồng thật đã kiểm tra

`AiChatbotWidget` → `aiChatbotStreamFetchPatch` → `POST /ai/chatbot/stream` → `handleRestaurantChatbotMessage` → scope/context/knowledge → `callAiProvider` → Gemini → Ollama fallback → SSE trả kết quả.

GraphQL schema/resolver vẫn là contract tương thích khi stream endpoint không khả dụng; thay đổi này không sửa payload GraphQL.

## Phạm vi đã triển khai

- Thêm policy timeout dùng chung cho các request Gemini cũ chưa tự truyền `AbortSignal`.
- Backend cài policy sau khi nạp `.env` và trước khi import các module phụ thuộc cấu hình.
- Gemini chatbot có giới hạn mặc định 8 giây.
- Qwen3 local chat có giới hạn tương tác mặc định 4 giây.
- BGE-M3 local embedding có giới hạn tương tác mặc định 2,5 giây; khi provider không trả kịp, semantic retrieval tiếp tục dùng nhánh text search/fallback hiện có.
- Local provider vẫn cho caller truyền timeout riêng khi một tác vụ nền cần thời gian dài hơn.
- Bổ sung cấu hình mẫu và test khóa hành vi abort của Gemini.

## Ngoài phạm vi

- Chưa chuyển Gemini sang streaming token thật.
- Không thay đổi model, schema, resolver output, permission, restaurant scoping, safety, history hoặc persistence.
- Không tắt semantic search hay local fallback.

## Tiêu chí nghiệm thu

- Gemini request trực tiếp không thể chờ vô hạn.
- Ollama embedding chậm không giữ request theo timeout chung 30 giây.
- Qwen3 fallback chậm không cộng thêm 30 giây vào request tương tác.
- Caller có thể ghi đè timeout local khi cần.
- Provider failure vẫn đi qua fallback an toàn hiện có.
- Cấu hình model vẫn là `gemini-3.5-flash`.

## Kiểm tra

Đã thêm:

- `cohan-restaurant-backend/tests/services/aiRuntimeTimeout.service.test.js`

Chưa chạy trong phiên GitHub connector:

- `vitest run cohan-restaurant-backend/tests/services/aiRuntimeTimeout.service.test.js`
- `vitest run cohan-restaurant-backend/tests/services/restaurantChatbot.service.test.js`
- `vitest run cohan-restaurant-backend/tests/services/restaurantChatbotEmbedding.service.test.js`
- `npm run check:graphql`
- `npm run build`
