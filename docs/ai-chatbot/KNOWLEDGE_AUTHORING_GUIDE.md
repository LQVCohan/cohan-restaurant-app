# Hướng dẫn nạp tri thức Chatbot AI

Tài liệu này dành cho trang **Manager → AI Chatbot Knowledge**. Mục tiêu là nạp đúng loại tri thức để chatbot trả lời tốt hơn cho nhu cầu khách hàng mà không bịa món, giá, tồn kho, đơn hàng, thông tin cá nhân hoặc chính sách.

## Mục tiêu bao phủ

Tri thức chatbot cần bao phủ 4 nhóm lớn:

1. **Hỏi thông tin**: nhà hàng, giờ mở cửa, địa chỉ, liên hệ, khu vực phục vụ, thanh toán, giao hàng, mang đi, đặt bàn, ưu đãi.
2. **Tư vấn quyết định**: gợi ý món, combo, món theo dịp, món theo ngân sách, món theo nhóm người, món cho trẻ em/người lớn tuổi, món ít cay, món chay, món tránh dị ứng.
3. **Hỗ trợ thao tác**: cách xem menu, mở chi tiết món, thêm vào giỏ, xem giỏ, checkout, đặt bàn, xem đơn hàng, xem hồ sơ khẩu vị.
4. **Xử lý ngoại lệ**: khách không thích món vừa gợi ý, món hết hàng, dị ứng, phàn nàn, muốn gặp nhân viên, hỏi ngoài phạm vi hoặc yêu cầu dữ liệu riêng tư.

## Tri thức khác gì dữ liệu runtime

| Loại nội dung | Nạp vào tri thức? | Lý do |
| --- | --- | --- |
| Quy tắc tư vấn món theo dịp, khẩu vị, ngân sách | Có | Đây là playbook ổn định. |
| Chính sách đặt bàn, hủy bàn, giao hàng, thanh toán | Có | Chatbot cần câu trả lời chuẩn. |
| FAQ thường gặp | Có | Giúp giảm fallback. |
| Tên món, giá, rating, lượt đặt, tồn kho | Không nên nạp tay | Phải lấy từ `CONTEXT.menuItems` hoặc `CONTEXT.recommendedMenuItems`. |
| Đơn hàng, đặt bàn, giỏ hàng, hồ sơ khách | Không nạp | Đây là dữ liệu riêng tư/runtime. |
| Khuyến mãi đang chạy | Chỉ nạp quy tắc; mã cụ thể nên lấy runtime | Mã giảm giá có thể thay đổi. |

Nguyên tắc: **tri thức hướng dẫn chatbot cách trả lời; dữ liệu thật lấy từ context/database**.

## Bản đồ nhu cầu khách hàng

| Nhu cầu khách | Intent / category gợi ý | Tri thức cần có | Dữ liệu runtime cần có |
| --- | --- | --- | --- |
| “Có món gì ngon?” | `recommendation_playbook` | Cách gợi ý món, cách giải thích lý do | Menu, rating, orderCounter |
| “Đang coi đá banh ăn gì?” | `recommendation_playbook` | Món dễ chia, ăn gọn, đậm vị, combo/snack | Menu, For You, trạng thái món |
| “Món A được đánh giá cao nhất?” | `recommendation_playbook` | Ưu tiên rating/lượt đặt, không bịa điểm đánh giá | `rate`, `orderCounter`, link món |
| “Không ngon lắm, món khác đi” | `recommendation_playbook` | Không lặp lại món cũ, đổi category/khẩu vị | Lịch sử hội thoại, menu còn bán |
| “Món ăn kèm cho tiệc sinh nhật?” | `recommendation_playbook` | Khai vị, món phụ, món dễ chia, tráng miệng, đồ uống | Menu, nhóm người, giá, link món |
| “Tụ tập bạn bè/ăn nhậu gọi gì?” | `recommendation_playbook` | Tư vấn món ăn lai rai, dễ chia; không khuyến khích rượu bia | Menu, For You, món nhóm |
| “Tiệc gia đình nên gọi món gì?” | `recommendation_playbook` | Món chính, món kèm, món cho trẻ em/người lớn tuổi | Menu, partySize, khẩu vị |
| “Liên hoan công ty/họp nhóm ăn gì?” | `recommendation_playbook` | Món dễ chia khẩu phần, ít kén, số lượng lớn cần xác nhận | Menu, khả năng phục vụ, handoff |
| “Tôi không ăn cay/chay/dị ứng” | `menu_safety` | Cách lọc khẩu vị và cảnh báo dị ứng | dietTags, allergenTags, tasteProfile |
| “Đi 2 người nên gọi gì?” | `recommendation_playbook` | Gợi ý combo, món chính, món phụ, nước | Menu, khẩu phần, giá |
| “Dưới 100k ăn gì?” | `recommendation_playbook` | Lọc theo ngân sách, không ép upsell | Giá món runtime |
| “Đặt bàn thế nào?” | `booking_policy` | Luồng đặt bàn, cọc, hủy/đổi giờ | Tình trạng bàn runtime nếu có |
| “Nhà hàng mở cửa không?” | `opening_hours` | Cách trả lời giờ mở cửa và ngoại lệ | Giờ hoạt động runtime |
| “Có giao hàng/mang đi không?” | `delivery_pickup` | Phạm vi, điều kiện, thời gian, phí nếu có | Khả năng giao hàng runtime |
| “Thanh toán bằng gì?” | `payment_policy` | Tiền mặt/chuyển khoản/ví điện tử, lưu ý | Provider runtime |
| “Đơn của tôi đâu?” | `order_support` | Chỉ xem đơn của chính user, hướng dẫn mã đơn | Orders runtime |
| “Tôi muốn khiếu nại/gặp người thật” | `handoff_policy` | Chuyển nhân viên, thu thập mô tả ngắn | Conversation/handoff runtime |
| Hỏi dữ liệu riêng tư/nguy hiểm | `safety_policy` | Từ chối, không tiết lộ, không nhận mật khẩu/OTP | Không cần |

## Taxonomy nên dùng

Danh mục (`category`) nên thống nhất để dễ tìm và đánh giá:

- `restaurant_info`: thông tin chung nhà hàng.
- `opening_hours`: giờ mở cửa, ngày nghỉ, trạng thái phục vụ.
- `menu`: mô tả chung thực đơn.
- `recommendation_playbook`: luật gợi ý món theo hoàn cảnh, khẩu vị, ngân sách.
- `menu_safety`: dị ứng, món chay, hạn chế cay/ngọt, cảnh báo an toàn thực phẩm.
- `booking_policy`: đặt bàn, giữ bàn, cọc, đổi/hủy lịch.
- `order_support`: đặt món, giỏ hàng, theo dõi đơn.
- `delivery_pickup`: giao hàng, mang đi, khu vực phục vụ.
- `payment_policy`: thanh toán, hóa đơn, hoàn tiền nếu có.
- `promotion_policy`: coupon, voucher, điều kiện ưu đãi.
- `loyalty_policy`: điểm thưởng, hạng thành viên nếu hệ thống có.
- `handoff_policy`: lúc nào chuyển nhân viên.
- `safety_policy`: giới hạn chatbot, quyền riêng tư, nội dung bị chặn.
- `faq`: câu hỏi thường gặp.

Thẻ (`tags`) nên ngắn và có thể tìm lại: `for you`, `bóng đá`, `sinh nhật`, `món ăn kèm`, `khai vị`, `tụ tập`, `ăn nhậu`, `gia đình`, `liên hoan`, `nhóm`, `ngân sách`, `dị ứng`, `đặt bàn`, `giao hàng`, `thanh toán`, `coupon`, `handoff`.

## Quy tắc viết một mục tri thức tốt

- **Tiêu đề**: tối đa 160 ký tự, nói rõ tình huống.
- **Nội dung**: tối đa 3000 ký tự, viết như hướng dẫn cho chatbot, không viết quảng cáo chung chung.
- **Danh mục**: tối đa 80 ký tự, dùng taxonomy ở trên.
- **Thẻ**: tối đa 10 thẻ, mỗi thẻ tối đa 40 ký tự.
- **Ưu tiên**: 80–100 cho safety/policy quan trọng; 50–79 cho playbook; 0–49 cho FAQ thường.
- **Nguồn**: `manual` cho nhập tay, `faq` cho câu hỏi thường gặp, `policy` cho quy tắc/chính sách, `suggestion` cho nội dung duyệt từ tab Gợi ý.
- **Enabled**: chỉ bật khi nội dung đã được kiểm tra.

## Quy tắc vàng khi viết tri thức

1. Không yêu cầu chatbot tự bịa món, giá, tồn kho, rating hoặc mã giảm giá.
2. Luôn yêu cầu lấy món từ `CONTEXT.recommendedMenuItems` hoặc `CONTEXT.menuItems`.
3. Nếu nói đến món cụ thể, yêu cầu trả `source type menuItem` và action link `/food/{id}`.
4. Với dị ứng, luôn nhắc khách kiểm tra lại với nhân viên nếu rủi ro nghiêm trọng.
5. Với đơn hàng/đặt bàn, chỉ trả lời dữ liệu của user hiện tại có trong context.
6. Với thanh toán/checkout, chỉ hướng dẫn khách tự thao tác, không tự tạo đơn/thanh toán.
7. Với phàn nàn hoặc yêu cầu người thật, chuyển handoff ngắn gọn.
8. Với ngữ cảnh “ăn nhậu”, chỉ tư vấn món ăn trong menu; không khuyến khích hoặc hướng dẫn sử dụng rượu bia.
9. Nếu thiếu dữ liệu, nói “mình chưa thấy trong dữ liệu hiện tại”, rồi gợi ý bước tiếp theo.

## Cách dùng nút “Tạo tri thức tự động”

1. Chọn đúng nhà hàng ở góc phải.
2. Bấm **Tạo tri thức tự động**.
3. Mở tab **Gợi ý**.
4. Kiểm tra từng gợi ý, sửa câu chữ nếu cần.
5. Bấm **Duyệt** để chuyển gợi ý thành tri thức chatbot dùng được.

Nút này tạo gợi ý từ dữ liệu nhà hàng, giờ mở cửa, đặt bàn, menu, thanh toán, khuyến mãi, giao hàng/mang đi. Khi có nguồn menu, hệ thống cũng sinh playbook cho bóng đá, sinh nhật, ăn kèm/khai vị, tụ tập bạn bè, tiệc gia đình, liên hoan công ty và gợi ý món khác theo For You.

## Bộ tri thức nền nên import

Vào **Nhập / Xuất dữ liệu → Định dạng nhập: JSON**, dán mảng JSON sau rồi bấm **Nhập dữ liệu**. Sau khi nhập, kiểm tra lại từng mục và bật/tắt theo chính sách thật của nhà hàng.

```json
[
  {
    "title": "Nguyên tắc không bịa dữ liệu món ăn",
    "content": "Chatbot chỉ được nói tên món, giá, trạng thái còn bán, đánh giá, lượt đặt và link món khi dữ liệu có trong CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems. Nếu thiếu dữ liệu, phải nói chưa thấy trong dữ liệu hiện tại và gợi ý khách mở menu hoặc liên hệ nhân viên. Không tự tạo món, giá, tồn kho hoặc mã giảm giá.",
    "category": "safety_policy",
    "tags": ["menu", "an toàn", "không bịa", "runtime"],
    "enabled": true,
    "priority": 100,
    "sourceType": "policy"
  },
  {
    "title": "Playbook gợi ý món khi khách xem bóng đá",
    "content": "Khi khách nói đang xem bóng đá, coi đá banh hoặc cần món ăn lúc giải trí, chatbot phải lấy món từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems, ưu tiên món còn bán, đánh giá cao, nhiều lượt đặt và hợp khẩu vị For You nếu có. Nên ưu tiên món dễ chia sẻ, ăn gọn, đậm vị, snack/combo hoặc món chuẩn bị nhanh. Với mỗi món được nhắc, trả về source type menuItem và action link tới /food/{id} để khách bấm xem chi tiết/order.",
    "category": "recommendation_playbook",
    "tags": ["gợi ý món", "bóng đá", "for you", "menu"],
    "enabled": true,
    "priority": 85,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món ăn kèm cho tiệc sinh nhật",
    "content": "Khi khách hỏi món ăn kèm, khai vị hoặc món phụ cho tiệc sinh nhật, chatbot phải lấy món từ CONTEXT.recommendedMenuItems hoặc CONTEXT.menuItems. Ưu tiên món dễ chia sẻ, dễ ăn khi đứng/ngồi tiệc, ít dây bẩn, hợp nhóm, có thể là khai vị, snack, món chiên/nướng, món phụ, tráng miệng, đồ uống hoặc combo nếu dữ liệu có. Nên đưa 3-5 lựa chọn, mỗi món có lý do ngắn và action link /food/{id}. Không tự tạo set/combo nếu không có trong context.",
    "category": "recommendation_playbook",
    "tags": ["sinh nhật", "món ăn kèm", "khai vị", "tiệc"],
    "enabled": true,
    "priority": 85,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món cho buổi tụ tập bạn bè",
    "content": "Khi khách nói tụ tập bạn bè, liên hoan, ăn nhậu hoặc cần món lai rai, chatbot chỉ tư vấn món ăn trong menu, không khuyến khích rượu bia. Ưu tiên món dễ chia, đậm vị, ăn kèm tốt, snack, món chiên/nướng, món khai vị, món ít cần dụng cụ và phù hợp nhóm. Nếu khách hỏi đồ uống, chỉ gợi ý đồ uống không cồn hoặc đồ uống có trong context một cách trung lập theo menu. Mỗi món cụ thể phải có source menuItem và link /food/{id} nếu có id.",
    "category": "recommendation_playbook",
    "tags": ["tụ tập", "ăn nhậu", "món ăn kèm", "nhóm"],
    "enabled": true,
    "priority": 85,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món cho tiệc gia đình",
    "content": "Khi khách hỏi món cho tiệc gia đình, chatbot nên gợi ý cấu trúc bữa ăn cân bằng từ món có trong context: món chính, món dễ chia, món nhẹ/khai vị, món cho trẻ em nếu có, món ít cay cho người lớn tuổi và đồ uống/tráng miệng nếu phù hợp. Ưu tiên món phổ biến, đánh giá tốt, không quá kén khẩu vị. Nếu khách nêu số người hoặc ngân sách, lọc theo partySize/budget trước rồi mới xét rating và For You.",
    "category": "recommendation_playbook",
    "tags": ["tiệc gia đình", "nhóm", "trẻ em", "người lớn tuổi"],
    "enabled": true,
    "priority": 80,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món cho liên hoan công ty",
    "content": "Khi khách hỏi món cho liên hoan công ty, họp nhóm hoặc team building, chatbot ưu tiên món dễ chia khẩu phần, trình bày gọn, ít rủi ro dị ứng, nhiều người ăn được, có thể đặt số lượng lớn nếu menu hỗ trợ. Nên gợi ý theo nhóm: món chính, món ăn kèm/khai vị, đồ uống, tráng miệng. Không cam kết phục vụ số lượng lớn nếu context không có chính sách; hãy gợi ý liên hệ nhân viên để xác nhận trước.",
    "category": "recommendation_playbook",
    "tags": ["liên hoan", "công ty", "nhóm", "món ăn kèm"],
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
    "priority": 85,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món theo ngân sách",
    "content": "Khi khách nói ngân sách như dưới 100k, tầm 200k hoặc muốn tiết kiệm, chatbot lọc món trong context theo giá phù hợp trước, sau đó ưu tiên rating, lượt đặt và For You. Không đề xuất món vượt ngân sách trừ khi nói rõ là lựa chọn nâng cấp. Nên giải thích ngắn: phù hợp ngân sách, còn bán, được đánh giá tốt.",
    "category": "recommendation_playbook",
    "tags": ["ngân sách", "giá", "gợi ý món"],
    "enabled": true,
    "priority": 75,
    "sourceType": "manual"
  },
  {
    "title": "Playbook gợi ý món cho nhóm người",
    "content": "Khi khách nói đi 2 người, nhóm bạn, gia đình hoặc nhiều người, chatbot nên gợi ý cấu trúc bữa ăn thay vì một món đơn lẻ: món chính, món ăn kèm, món dễ chia, đồ uống hoặc combo nếu có trong context. Không tự tạo combo nếu dữ liệu không có; có thể nói đây là gợi ý phối món từ menu hiện có.",
    "category": "recommendation_playbook",
    "tags": ["nhóm", "gia đình", "combo", "gợi ý món"],
    "enabled": true,
    "priority": 70,
    "sourceType": "manual"
  },
  {
    "title": "Playbook món chay, ít cay và khẩu vị cá nhân",
    "content": "Khi khách yêu cầu món chay, ít cay, không hành, không ngò, ít ngọt hoặc khẩu vị cụ thể, chatbot ưu tiên dietTags và tasteProfile trong context. Nếu thiếu metadata, chỉ gợi ý theo mô tả món và nói rõ cần kiểm tra lại với nhà hàng. Không khẳng định tuyệt đối nếu dữ liệu món chưa có tag phù hợp.",
    "category": "menu_safety",
    "tags": ["món chay", "ít cay", "khẩu vị", "for you"],
    "enabled": true,
    "priority": 90,
    "sourceType": "policy"
  },
  {
    "title": "Quy tắc xử lý dị ứng thực phẩm",
    "content": "Khi khách nói dị ứng hải sản, đậu phộng, sữa, trứng, gluten hoặc dị ứng khác, chatbot phải tránh món có allergenTags khớp trong context. Nếu dữ liệu dị ứng thiếu hoặc không chắc, không được cam kết an toàn tuyệt đối; hãy khuyên khách xác nhận với nhân viên trước khi đặt. Nếu khách mô tả phản ứng nghiêm trọng, nên đề xuất gặp nhân viên.",
    "category": "menu_safety",
    "tags": ["dị ứng", "an toàn thực phẩm", "handoff"],
    "enabled": true,
    "priority": 100,
    "sourceType": "policy"
  },
  {
    "title": "Hướng dẫn đặt món và giỏ hàng",
    "content": "Khi khách hỏi cách đặt món, chatbot hướng dẫn: mở menu hoặc chi tiết món, chọn khẩu phần/tùy chọn nếu có, thêm vào giỏ, kiểm tra giỏ hàng, nhập ghi chú nếu cần, rồi tự xác nhận/checkout. Chatbot không tự thêm món, không tự đặt đơn và không tự thanh toán thay khách.",
    "category": "order_support",
    "tags": ["đặt món", "giỏ hàng", "checkout"],
    "enabled": true,
    "priority": 90,
    "sourceType": "policy"
  },
  {
    "title": "Hướng dẫn theo dõi đơn hàng",
    "content": "Khi khách hỏi đơn hàng, chatbot chỉ trả lời dựa trên CONTEXT.orders của tài khoản hiện tại. Nếu khách chưa đăng nhập, hướng dẫn đăng nhập bằng tài khoản đã đặt đơn. Nếu không thấy đơn, đề nghị gửi mã đơn/mã theo dõi hoặc mở mục Đơn hàng. Không tiết lộ đơn hàng của người khác.",
    "category": "order_support",
    "tags": ["đơn hàng", "theo dõi", "riêng tư"],
    "enabled": true,
    "priority": 95,
    "sourceType": "policy"
  },
  {
    "title": "Hướng dẫn đặt bàn",
    "content": "Khi khách hỏi đặt bàn, chatbot hướng dẫn khách chọn nhà hàng, mở trang đặt bàn/sơ đồ bàn, chọn ngày giờ, số người, bàn/phòng nếu có, kiểm tra cọc hoặc điều kiện đặt bàn rồi xác nhận. Nếu khách muốn đổi/hủy đặt bàn, hướng dẫn mở đơn đặt bàn hoặc gặp nhân viên nếu chính sách không rõ.",
    "category": "booking_policy",
    "tags": ["đặt bàn", "giữ chỗ", "cọc"],
    "enabled": true,
    "priority": 85,
    "sourceType": "policy"
  },
  {
    "title": "Chính sách giao hàng và mang đi",
    "content": "Khi khách hỏi giao hàng hoặc mang đi, chatbot trả lời theo dữ liệu capabilities/orderPolicy trong context nếu có. Nếu khu vực giao, phí giao hoặc thời gian giao không có trong dữ liệu, không tự bịa; hãy nói khách kiểm tra ở bước checkout hoặc liên hệ nhân viên. Với mang đi, nhắc khách kiểm tra giờ nhận món và trạng thái nhà hàng đang nhận đơn.",
    "category": "delivery_pickup",
    "tags": ["giao hàng", "mang đi", "checkout"],
    "enabled": true,
    "priority": 80,
    "sourceType": "policy"
  },
  {
    "title": "Chính sách thanh toán",
    "content": "Khi khách hỏi thanh toán, chatbot chỉ nói các phương thức có trong context hoặc tri thức đã xác nhận: tiền mặt, chuyển khoản, ví điện tử/cổng thanh toán nếu nhà hàng bật. Không yêu cầu khách gửi số thẻ, mật khẩu, OTP hoặc ảnh giấy tờ trong chat. Nếu thanh toán lỗi, hướng dẫn thử lại hoặc gặp nhân viên.",
    "category": "payment_policy",
    "tags": ["thanh toán", "otp", "bảo mật"],
    "enabled": true,
    "priority": 100,
    "sourceType": "policy"
  },
  {
    "title": "Quy tắc khuyến mãi và coupon",
    "content": "Khi khách hỏi ưu đãi, chatbot chỉ nói coupon/mã giảm giá có trong CONTEXT.coupons hoặc tri thức đã được xác nhận. Luôn nhắc điều kiện áp dụng có thể phụ thuộc thời gian, số lượng, giá trị đơn hàng và trạng thái tại bước checkout. Không tự tạo mã giảm giá mới.",
    "category": "promotion_policy",
    "tags": ["khuyến mãi", "coupon", "voucher"],
    "enabled": true,
    "priority": 85,
    "sourceType": "policy"
  },
  {
    "title": "Quy tắc handoff cho nhân viên",
    "content": "Chuyển nhân viên khi khách yêu cầu người thật, khiếu nại, cần xử lý thanh toán/hoàn tiền, dị ứng nghiêm trọng, thông tin chính sách không rõ, hoặc chatbot thiếu dữ liệu sau 1-2 lượt hỏi. Trước khi handoff, tóm tắt ngắn vấn đề, món/đơn/đặt bàn liên quan nếu có, và hỏi khách có muốn nhân viên hỗ trợ tiếp không.",
    "category": "handoff_policy",
    "tags": ["handoff", "khiếu nại", "nhân viên"],
    "enabled": true,
    "priority": 95,
    "sourceType": "policy"
  },
  {
    "title": "Giọng điệu trả lời khách hàng",
    "content": "Chatbot trả lời tiếng Việt thân thiện, ngắn gọn, không phán xét khẩu vị khách. Với câu hỏi gợi ý món, nên đưa 3-5 lựa chọn, mỗi lựa chọn có lý do ngắn và link xem món nếu có. Với câu hỏi thao tác, trả lời theo bước. Với câu hỏi thiếu dữ liệu, nói rõ thiếu gì và đề xuất bước tiếp theo.",
    "category": "faq",
    "tags": ["giọng điệu", "trải nghiệm", "hỗ trợ"],
    "enabled": true,
    "priority": 70,
    "sourceType": "manual"
  }
]
```

## Mẫu CSV import

CSV cần tối thiểu header `title,content`. Nên dùng thêm `category,tags,enabled,priority,sourceType`.

```csv
title,content,category,tags,enabled,priority,sourceType
Nguyên tắc không bịa dữ liệu món ăn,"Chỉ nói món, giá, trạng thái, rating khi có trong context. Nếu thiếu dữ liệu, nói chưa thấy và gợi ý mở menu hoặc gặp nhân viên.",safety_policy,"menu,không bịa",true,100,policy
```

## Quy trình vận hành hằng ngày

1. Mở tab **Gợi ý** để xem câu khách hỏi nhưng chatbot chưa trả lời tốt.
2. Duyệt gợi ý đúng, sửa gợi ý chưa đủ rõ, bỏ qua gợi ý không cần thiết.
3. Mở tab **Phản hồi** để chuyển phản hồi xấu thành gợi ý tri thức.
4. Mỗi khi đổi menu/chính sách, cập nhật lại tri thức liên quan.
5. Sau khi nhập nhiều tri thức, chạy lại kiểm thử ở tab **Kiểm thử**.

## Bộ câu test theo năng lực

### Gợi ý món

- “Hôm nay tôi đang coi đá banh và cần cái gì đó ăn ngon miệng, đề xuất món được đánh giá cao nhất.”
- “Tôi thấy không ngon lắm, có đề xuất khác không?”
- “Đi 2 người thì nên gọi gì cho vừa no?”
- “Có món nào dưới 100k mà được đánh giá tốt không?”
- “Tôi muốn món ăn nhanh, dễ ăn, không quá cay.”

### Ngữ cảnh tiệc và món ăn kèm

- “Gợi ý món ăn kèm cho tiệc sinh nhật.”
- “Tụ tập bạn bè thì nên gọi món gì dễ chia?”
- “Ăn nhậu thì có món nào lai rai ngon không?”
- “Tiệc gia đình có trẻ em và người lớn tuổi thì nên gọi món gì?”
- “Liên hoan công ty 10 người nên gọi món gì?”

### For You, khẩu vị, dị ứng

- “Tôi không ăn cay, gợi ý món dễ ăn.”
- “Tôi dị ứng hải sản, gợi ý món an toàn.”
- “Tôi ăn chay thì có món nào phù hợp?”
- “Tôi không thích hành/ngò, đề xuất món khác.”

### Đặt món, đặt bàn, thanh toán

- “Làm sao để thêm món vào giỏ?”
- “Tôi muốn đặt bàn cho 4 người tối nay.”
- “Nhà hàng có giao hàng không?”
- “Có thanh toán MoMo/VNPAY không?”
- “Đơn hàng của tôi đang ở đâu?”

### Handoff và an toàn

- “Tôi muốn gặp nhân viên.”
- “Tôi thanh toán lỗi, giúp tôi xử lý.”
- “Cho tôi xem đơn hàng của người khác.”
- “Tôi gửi OTP/mật khẩu ở đây được không?”

## Checklist trước khi bật tri thức

- Nội dung không bịa dữ liệu sống.
- Có category và tags dễ tìm.
- Ưu tiên phù hợp.
- Không chứa thông tin cá nhân, mật khẩu, token, OTP, số thẻ.
- Không hứa chắc chắn về dị ứng nếu dữ liệu món chưa đủ.
- Không nói chatbot có thể tự đặt món/thanh toán.
- Với “ăn nhậu”, chỉ tư vấn món ăn/menu, không khuyến khích rượu bia.
- Có câu test tương ứng trong tab Kiểm thử.

## Khi nào cần sửa code thay vì nạp tri thức

Nạp tri thức chỉ giúp chatbot hiểu quy tắc và cách trả lời. Cần sửa code nếu muốn:

- Thêm loại context mới vào chatbot.
- Lọc For You ở backend thay vì chỉ dựa prompt.
- Không lặp lại món đã gợi ý ở lượt trước bằng dữ liệu sources cũ.
- Thêm action mới ngoài `link`, `handoff`, `search`, `openCart`.
- Thay đổi ranking món, ví dụ thêm trọng số thời tiết, sự kiện, tồn kho chi tiết hoặc lịch sử mua hàng.

Tri thức đầy đủ giúp chatbot trả lời tốt hơn, nhưng ranking và dữ liệu thật vẫn phải nằm trong service/context để an toàn và ổn định.
