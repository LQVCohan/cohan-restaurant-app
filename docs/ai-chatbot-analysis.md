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

## 11. Phase 2 - Persisted conversation history

Phase 2 bổ sung lưu lịch sử hội thoại chatbot vào MongoDB để chatbot không còn hoàn toàn stateless.

### Vì sao cần lưu hội thoại

- Duy trì ngữ cảnh giữa các lượt hỏi đáp liên tiếp.
- Cho phép xem lại các câu hỏi phổ biến của khách hàng.
- Tạo nền tảng cho handoff sang nhân viên thật ở phase sau.
- Hỗ trợ phân tích như câu hỏi chưa được giải quyết hoặc tỉ lệ fallback.

### Hai model mới

- `AiChatConversation`: lưu metadata của phiên hội thoại (user/guest, nhà hàng, trạng thái open/closed/handoff_requested, messageCount, lastIntent, ...).
- `AiChatMessage`: lưu từng tin nhắn user/assistant theo `conversationId`, cùng intent/confidence/isFallback/actions/sources/context.

### Luồng guestId và conversationId

1. Frontend tạo/đọc `guestId` trong localStorage (`cohan_ai_guest_id`).
2. Frontend tạo khóa conversation theo nhà hàng: `cohan_ai_conversation_id:${restaurantId || "global"}`.
3. Mỗi lần gửi `askAiChatbot`, frontend gửi `guestId` + `conversationId` (nếu có).
4. Backend tìm conversation đang mở đúng chủ thể (user hoặc guest) và cùng ngữ cảnh nhà hàng.
5. Backend lưu message user trước khi gọi AI/fallback.
6. Backend tạo câu trả lời như cũ (ưu tiên OpenAI nếu có key, fallback nếu không có key hoặc lỗi).
7. Backend lưu message assistant, cập nhật `lastMessageAt`, `lastMessagePreview`, `messageCount`, `lastIntent`.
8. Backend trả `conversationId` để frontend lưu lại cho lần chat tiếp theo.

### Chuẩn bị cho handoff nhân viên thật

Trạng thái conversation đã chuẩn hóa `open | closed | handoff_requested` để phase sau có thể:

- đánh dấu hội thoại cần nhân viên tiếp nhận,
- hiển thị danh sách chat cần xử lý,
- truy vết lịch sử đầy đủ trước khi nhân viên trả lời.

## 12. Phase 3 - Human staff handoff

Phase 3 bổ sung cơ chế chuyển hội thoại chatbot sang nhân viên thật theo hướng explicit và an toàn cho guest.

### Thiết kế chính

- Mutation mới `requestAiChatbotHandoff` để gửi yêu cầu gặp nhân viên một cách tường minh.
- `askAiChatbot` **không tự động** tạo handoff, chỉ trả về gợi ý handoff (`handoffSuggested`, `handoffReason`, `handoffMessage`) khi intent support, fallback, low confidence hoặc có từ khóa yêu cầu người thật.
- `AiChatConversation` được liên kết sang `ChatThread` nội bộ qua `chatThreadId`.
- Reuse `ChatThread.channel = support`, `targetRole = support` để không mở rộng enum ở phase này.

### Luồng handoff

1. Client gọi `requestAiChatbotHandoff` với `conversationId` + `guestId` (guest flow) hoặc session user.
2. Backend xác thực ownership hội thoại:
   - user đăng nhập phải khớp `conversation.userId`
   - guest phải khớp `conversation.guestId`
3. Nếu đã `handoff_requested` và có `chatThreadId`, mutation trả idempotent success.
4. Nếu chưa có, backend tạo/reuse `ChatThread` support cho staff/manager, kèm summary lịch sử AI gần nhất vào message đầu tiên.
5. Tạo `Notification` loại `ai_chatbot_handoff` cho staff/manager theo nhà hàng.
6. Cập nhật conversation status thành `handoff_requested` và lưu metadata handoff.

### Quy tắc guest privacy

- Guest không được đưa vào `ChatThread.participants` (participants là user ObjectId).
- guestId/conversationId chỉ lưu trong metadata/payload cần thiết để staff đối soát.
- conversationId sai hoặc không thuộc ownership sẽ trả lỗi an toàn, không rò rỉ dữ liệu.

### Giới hạn hiện tại

- Chưa có inbox staff chuyên biệt cho AI handoff.
- Đang reuse kênh `support` của communication system.
- Guest chưa tham gia trực tiếp vào luồng ChatThread yêu cầu đăng nhập; staff xử lý dựa trên summary + lịch sử AI đã bàn giao.


## 13. Phase 4 - Staff handoff inbox

Phase 4 bổ sung giao diện xử lý handoff AI tối thiểu cho nhân viên/quản lý, tái sử dụng communication system hiện có thay vì xây một live chat mới.

- Staff có route riêng: `/staff/ai-handoff`.
- Manager/Admin dùng hash page trong dashboard: `/manager#ai-handoff`.
- Danh sách yêu cầu được nhận diện qua `Notification.type = ai_chatbot_handoff`, đồng thời có fallback nhận diện theo subject `AI handoff` của `ChatThread`.
- Khi mở một yêu cầu: frontend lấy `payload.threadId` để tải `chatThread`, đồng thời thử `markNotificationRead` và `markChatThreadRead` theo best-effort.
- Phản hồi của nhân viên dùng mutation `sendChatMessage` trên thread support hiện có, sau đó reload thread/list để đồng bộ UI.

Giới hạn hiện tại:

- Luồng trả lời của nhân viên đang là hỗ trợ nội bộ dựa trên `ChatThread` authenticated; guest có thể chưa nhận phản hồi trực tiếp theo thời gian thực cho đến khi có cơ chế guest messaging 2 chiều ở phase sau.

## 14. Phase 5 - Guest-facing staff replies (MVP polling)

Phase 5 MVP cho phép guest nhận phản hồi của nhân viên/quản lý ngay trong `AiChatbotWidget` sau khi đã bấm handoff.

### Kiến trúc MVP

- Thêm query guest-safe mới: `aiChatbotGuestReplies(input)` trong schema `aiChatbot`.
- Guest chỉ được truy vấn bằng cặp `conversationId + guestId` (không cho truy cập theo `threadId`).
- Backend lấy `chatThreadId` từ `AiChatConversation`, sau đó đọc trực tiếp từ `ChatThread.messages`.
- Chỉ trả về payload tối thiểu cho guest: `id`, `role=staff`, `senderLabel=Nhân viên`, `content`, `createdAt`.

### Quy tắc bảo mật

- Chuẩn hóa `guestId` cùng style sanitizer như handoff service.
- Validate `conversationId` ObjectId.
- Nếu conversation không tồn tại / không thuộc guest / input không hợp lệ: trả safe response `ok=false`, `handoffRequested=false`, `replies=[]`.
- Không expose `senderId`, `participants`, `unreadBy`, hoặc toàn bộ object `ChatThread`.

### Quy tắc lọc tin nhắn staff

- Loại bỏ system message và mọi message chứa marker `[AI HANDOFF]`.
- Loại bỏ message rỗng.
- Loại bỏ vai trò guest/customer/user.
- Chỉ giữ nhóm vai trò staff-facing (không phân biệt hoa thường): staff, manager, admin, support, employee, server, supervisor, host, cashier, chef, cook, kitchen_helper, cleaner, shipper, storekeeper, bartender, hr, accountant.

### Frontend polling

- `AiChatbotWidget` chỉ polling khi đủ điều kiện: `handoffRequested=true`, có `conversationId`, có `guestId`, và widget đang mở.
- Poll mỗi ~6 giây, có gọi fetch ngay khi handoff thành công.
- Dedupe bằng `reply.id` hoặc fallback `createdAt + content` để tránh append trùng.
- Luồng AI cũ trước handoff giữ nguyên (ask, quick replies, actions, context summary).

### Chưa làm trong MVP

- Chưa bật Socket.IO guest room cho phản hồi realtime.
- Chưa mirror staff replies vào `AiChatMessage`.

### Hướng Phase 5.1

- Bổ sung Socket.IO bảo mật cho guest qua token/ownership check ở room-level (`conversationId + guestId`).
- Duy trì polling như fallback khi socket mất kết nối.

## 15. Phase 5.1 - Realtime Socket.IO staff replies for guest

Phase 5.1 bổ sung realtime delivery cho phản hồi nhân viên sau AI handoff, đồng thời giữ nguyên polling của Phase 5 làm fallback.

### Thiết kế realtime

- Guest join room theo conversation, không theo thread nội bộ.
- Room name: `ai_conv_${conversationId}`.
- Event join mới trên Socket.IO:
  - `joinAiChatbotConversation({ conversationId, guestId })`
  - `leaveAiChatbotConversation({ conversationId, guestId })`
- Join chỉ thành công khi backend xác thực ownership:
  - `conversationId` hợp lệ ObjectId.
  - `guestId` được normalize theo sanitizer Phase 5.
  - `AiChatConversation.guestId` phải khớp `guestId` đã normalize.

### Phát sự kiện staff reply

- Khi staff gửi `sendChatMessage`, backend kiểm tra thread có được link với `AiChatConversation` qua `chatThreadId` hay không.
- Nếu có link và message đạt rule guest-safe, backend emit:
  - event: `aiChatbotStaffReplyCreated`
  - room: `ai_conv_${conversationId}`
  - payload tối thiểu: `id`, `role=staff`, `senderLabel=Nhân viên`, `content`, `createdAt`.

### Bảo mật dữ liệu

- Guest không được join bằng `chatThreadId`.
- Không leak thông tin ownership conversation qua lỗi chi tiết.
- Không emit dữ liệu nội bộ như `threadId`, `senderId`, `participants`, `unreadBy`, email nhân viên.
- Lọc message giữ nguyên rule Phase 5 (allowlist role staff-facing + denylist guest/system + loại marker `[AI HANDOFF]`).

### Fallback và chống trùng

- Polling `aiChatbotGuestReplies` vẫn hoạt động song song làm fallback khi socket không khả dụng.
- Frontend tiếp tục dedupe theo `reply.id` (hoặc fallback key), nên nếu cùng reply đi qua socket + polling chỉ hiển thị một lần.

### Giới hạn và bước tiếp theo

- Hiện chưa thêm cơ chế token hóa socket riêng cho guest; ownership vẫn dựa trên cặp `conversationId + guestId`.
- Có thể nâng cấp thêm rate-limit/join-throttle và audit log cho room join của guest ở phase sau.

## 16. Phase 6 - Two-way guest → staff messaging after handoff

Phase 6 hoàn thiện luồng handoff 2 chiều: sau khi đã handoff, guest tiếp tục nhắn trong `AiChatbotWidget` và tin nhắn sẽ đi vào `ChatThread` nội bộ để staff/manager xử lý trong cùng một luồng.

### Thiết kế chính

- Thêm mutation guest-safe mới trong `aiChatbot` schema: `sendAiChatbotGuestMessage(input)`.
- Ownership bắt buộc theo cặp `conversationId + guestId`.
- Chỉ cho phép gửi khi `AiChatConversation.status === handoff_requested` và có `chatThreadId` hợp lệ.
- Không expose mutation authenticated của communication cho guest.

### Data flow

1. Guest gửi message trong widget khi `handoffRequested=true`.
2. Frontend gọi `sendAiChatbotGuestMessage` (không gọi `askAiChatbot`).
3. Backend validate ownership và trạng thái handoff.
4. Backend append message vào `ChatThread.messages` với metadata cố định:
   - `senderRole = guest`
   - `senderName = Khách hàng`
   - `messageType = text`
5. Backend cập nhật `lastMessageAt`, `lastMessagePreview`, `unreadBy` và notification nội bộ.
6. Backend emit event communication hiện có (`chatMessageCreated`, `threadUpdated`, `notificationCreated`) để staff inbox tự cập nhật nếu đang subscribe, đồng thời polling vẫn là fallback.

### Quy tắc bảo mật

- Guest không thể gửi vào thread tùy ý vì không nhận `threadId` từ client.
- Guest không được tự set `senderRole`, `senderName`, `attachments`.
- `content` bị giới hạn độ dài tối đa để tránh abuse cơ bản.
- Trả lỗi an toàn (`ok=false`) cho input sai hoặc ownership không hợp lệ.

### Giới hạn hiện tại

- Chưa bổ sung rate-limit riêng cho mutation guest send (để phase tiếp theo).
- Chưa hỗ trợ attachment từ guest trong luồng handoff.

## 16. Phase 7 - Close/resolve AI handoff lifecycle

Phase 7 bổ sung khả năng cho staff/manager đóng phiên handoff sau khi xử lý xong yêu cầu của khách.

### Trạng thái và vòng đời

- `AiChatConversation.status` chuyển từ `handoff_requested` sang `closed`.
- `ChatThread.status` chuyển từ `open` sang `closed`.
- Không thêm enum mới; tái sử dụng `closed` để giữ tương thích.

### Hành động của staff

- Tại `AiHandoffInbox`, staff có nút `Đánh dấu đã xử lý`.
- Khi bấm nút, frontend gọi mutation `resolveAiChatbotHandoff`.
- Backend cập nhật trạng thái conversation/thread, ghi metadata resolve, và append system closure message vào thread.

### Hành vi guest sau khi đóng

- Guest widget nhận sự kiện realtime `aiChatbotHandoffResolved` hoặc thấy cờ đóng qua polling (`handoffClosed`, `conversationStatus`).
- Widget hiển thị thông báo: `Nhân viên đã kết thúc phiên hỗ trợ.`
- Widget dừng luồng handoff realtime/polling cho conversation đã đóng.
- Guest không thể gửi thêm tin nhắn theo luồng staff-thread của handoff đã đóng (backend trả `ok=false`).
- Guest vẫn có thể tiếp tục chat AI bình thường và yêu cầu handoff mới khi cần.

### Bảo mật

- Chỉ user đã xác thực và có quyền truy cập thread/restaurant mới resolve được handoff.
- Guest/unauthenticated không được đóng handoff.
- Cross-restaurant access bị chặn theo quyền truy cập communication hiện có.
- Payload trả cho guest chỉ chứa field an toàn; không lộ internals của `ChatThread`.

### Realtime + polling fallback

- Realtime: emit `aiChatbotHandoffResolved` tới room guest `ai_conv_${conversationId}` (payload guest-safe).
- Staff side: emit `threadUpdated` và closure marker (`chatMessageCreated`) theo pattern communication hiện hữu.
- Polling fallback vẫn giữ nguyên; response `aiChatbotGuestReplies` bổ sung `conversationStatus` + `handoffClosed` để parity với realtime.

### Giới hạn hiện tại

- Inbox hiện ưu tiên danh sách open handoff; lịch sử closed chưa có trang archive riêng.
- Closure note hiện chủ yếu phục vụ vận hành nội bộ trên thread/message log.

## 16. Phase 8 - AI handoff archive/history and status-filter inbox

Phase 8 bổ sung khả năng xem lịch sử handoff đã xử lý cho staff/manager, thay vì chỉ nhìn được luồng đang mở.

### Mục tiêu

- Inbox handoff có 2 trạng thái rõ ràng:
  - `Đang xử lý` (open handoff)
  - `Đã xử lý` (closed handoff)
- Staff/manager có thể mở lại lịch sử hội thoại đã đóng để tra cứu.

### Backend thay đổi

- Mở rộng query `chatThreads` với tham số tùy chọn `status`:
  - `chatThreads(restaurantId, channel, limit, status: String)`
- Quy tắc tương thích ngược:
  - Nếu không truyền `status`, backend mặc định `open` (giữ nguyên hành vi cũ).
- Validate status chặt chẽ:
  - Chỉ chấp nhận `open` hoặc `closed`.
  - Giá trị khác trả lỗi kiểm soát `BAD_USER_INPUT`.
- Vẫn giữ nguyên guard truy cập:
  - `requireRestaurantAccess`
  - `canAccessThread`
  - Không mở rộng quyền truy cập closed thread ngoài phạm vi nhà hàng/role hợp lệ.

### Frontend inbox behavior

- `AiHandoffInbox` có 2 tab:
  - `Đang xử lý`: dùng open threads + notifications (`ai_chatbot_handoff`) như hiện tại.
  - `Đã xử lý`: dùng closed threads, không phụ thuộc notifications.
- Ở tab `Đã xử lý`:
  - vẫn xem đầy đủ message history,
  - không cho gửi phản hồi,
  - không cho resolve lại (hiển thị trạng thái đã xử lý).

### Quy tắc nhận diện AI handoff (MVP)

- Vẫn giữ cách nhận diện theo subject prefix chuẩn hóa `AI handoff`.
- Chưa thêm migration hoặc field mới cho `ChatThread` trong phase này.

### Quy tắc bảo mật

- Archive closed handoff chỉ hiển thị cho staff/manager có quyền trong đúng restaurant scope.
- Guest không được truy cập dữ liệu nội bộ `ChatThread` của inbox staff/manager.
- Polling fallback các phase trước không bị loại bỏ.

## 18. Phase 9 - Guest security hardening and rate limiting (MVP)

Phase 9 tập trung vào hardening cho toàn bộ luồng guest-facing của chatbot/handoff, giữ nguyên hành vi Phase 5/6/7/8 nhưng thêm lớp chống abuse tập trung.

### Rủi ro abuse cần chặn

- Spam `askAiChatbot` gây tải AI/context query cao.
- Spam `requestAiChatbotHandoff` tạo notification dồn dập cho staff/manager.
- Spam `sendAiChatbotGuestMessage` sau handoff làm nhiễu inbox nội bộ.
- Polling quá dày vào `aiChatbotGuestReplies` gây DB load không cần thiết.
- Socket `joinAiChatbotConversation` bị spam khi reconnect flapping.
- Cross-conversation probing/guestId spoofing (đã có ownership check, cần thêm giới hạn tần suất brute-force).

### Centralized helper

- Thêm service `restaurantChatbotRateLimit.service.js`.
- In-memory fixed-window theo action policy, key chuẩn hóa từ: `action + guestId + conversationId + restaurantId + clientIp (+ socketId cho join)`.
- Trả structured result:
  - `allowed=true`
  - hoặc `allowed=false`, `retryAfterSec`, `code=RATE_LIMITED`, `safeMessage`.
- Safe message chuẩn hóa: `Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.`
- Có cleanup định kỳ theo TTL/window để giảm rò rỉ bộ nhớ.

### Policy MVP theo action

- `askAiChatbot`: 20 request / 5 phút.
- `requestAiChatbotHandoff`: 3 request / 10 phút.
- `sendAiChatbotGuestMessage`: 30 request / 10 phút.
- `aiChatbotGuestReplies`: soft throttle (quá nhanh thì trả safe empty response, tránh query DB nặng).
- `joinAiChatbotConversation`: burst nhỏ 5 join / 30 giây cho mỗi `socket + guest + conversation`.

### Frontend hardening

- `AiChatbotWidget` thêm in-flight guard chống double-submit kể cả spam nhanh nút send/quick-reply.
- Polling giữ nguyên fallback và interval ổn định, tránh overlapping fetch khi request trước chưa xong.
- Socket join thêm guard join-once-per-connect để hạn chế join lặp khi kết nối dao động.
- Nếu backend báo `RATE_LIMITED` hoặc message an toàn tương ứng, UI hiển thị thông điệp thân thiện bằng tiếng Việt.

### Giới hạn MVP in-memory

- Counter không chia sẻ giữa nhiều instance backend.
- Restart process sẽ reset counter.
- Phù hợp bước hardening nhanh cho single-instance hoặc scale nhỏ.

### Hướng production tiếp theo

- Chuyển storage của rate limiter sang Redis/shared store để đồng bộ đa instance.
- Bổ sung observability dashboard cho tỉ lệ bị throttle theo action/restaurant.
- Cân nhắc adaptive policy theo traffic thực tế từng nhà hàng.

## 19. Phase 10 - AI chatbot analytics / observability dashboard

Phase 10 bổ sung trang dashboard read-only cho manager/admin/staff có quyền theo nhà hàng để theo dõi hiệu quả vận hành chatbot.

### Phạm vi dashboard

- Query GraphQL mới: `aiChatbotAnalytics(input)`.
- Chỉ trả về dữ liệu tổng hợp (aggregate-only), không trả transcript.
- Bộ lọc nhanh 7 ngày / 30 ngày.
- Các nhóm số liệu chính:
  - tổng hội thoại AI, tổng tin nhắn AI, hội thoại đang mở,
  - handoff đang xử lý / đã xử lý,
  - fallback và low-confidence,
  - top intents,
  - messages by role,
  - cấu hình rate-limit policy hiện tại.

### Quy tắc bảo mật

- Bắt buộc đăng nhập.
- Chặn guest/customer truy vấn analytics.
- Manager/staff phải có restaurant access theo pattern guard hiện có.
- Dữ liệu chỉ ở mức aggregate.
- Không trả raw message content, guestId, senderId, participants hoặc ChatThread internals.

### Định nghĩa metric

- `openConversations`: số `AiChatConversation.status = open`.
- `handoffRequested`: số `AiChatConversation.status = handoff_requested`.
- `resolvedHandoffs`: số conversation `status=closed` và có dấu hiệu handoff (`chatThreadId` hoặc metadata handoff).
- `handoffConversionRate`: `handoffRequested / totalConversations`.
- `averageMessagesPerConversation`: `totalMessages / totalConversations`.
- `averageHandoffResolutionMinutes`: trung bình phút giữa `metadata.handoffRequestedAt` và `metadata.handoffResolvedAt`, chỉ tính record hợp lệ.

### Giới hạn observability hiện tại

- Chỉ hiển thị **rate-limit policy/config** (`action`, `max`, `windowMs`).
- Chưa có historical rate-limit hit counts (vì limiter in-memory, không lưu bền).
- Chưa có token/cost/latency metrics.
- Chưa có CSAT.


## 16. Phase 11 - Restaurant-level AI chatbot settings
- Added embedded `Restaurant.aiChatbotSettings` for per-restaurant bot behavior (enable, greeting, quick replies, handoff, thresholds, fallback, audit metadata).
- Added manager/staff settings APIs and guest-safe public settings API.
- Widget now consumes public settings and respects disabled chatbot/handoff.
- Runtime uses configurable low-confidence threshold and restaurant fallback message.
- Handoff creation is blocked when restaurant handoff is disabled.
- MVP intentionally excludes advanced support-hours scheduler/timezone logic.
