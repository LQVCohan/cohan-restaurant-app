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

## Phạm vi sửa

- Thêm timeout riêng cho Gemini chatbot, mặc định 8 giây.
- Cho local provider nhận timeout theo từng caller mà không đổi timeout mặc định của module khác.
- Giới hạn fallback Qwen3 của chatbot, mặc định 3 giây.
- Giới hạn embedding knowledge trên request chatbot, mặc định 1,5 giây; khi hết thời gian tự dùng text search hiện có.
- Bổ sung env example và test khóa các timeout mới.

## Ngoài phạm vi

- Chưa chuyển Gemini sang streaming token thật.
- Không thay đổi model, schema, resolver output, permission, restaurant scoping, safety, history hoặc persistence.
- Không tắt semantic search hay local fallback.

## Tiêu chí nghiệm thu

- Gemini request không thể chờ vô hạn.
- Ollama embedding chậm không giữ request chatbot quá timeout riêng.
- Qwen3 fallback chậm không cộng thêm 30 giây vào request.
- Các caller local AI khác vẫn dùng timeout mặc định hiện tại nếu không truyền override.
- Provider failure vẫn trả deterministic fallback an toàn.
- Test hiện có cho chatbot/embedding vẫn tương thích.

## Kiểm tra dự kiến

- `vitest run cohan-restaurant-backend/tests/services/restaurantChatbot.service.test.js`
- `vitest run cohan-restaurant-backend/tests/services/restaurantChatbotEmbedding.service.test.js`
- `npm run check:graphql`
- `npm run build`
