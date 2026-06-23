// Restaurant Info copy tuning.
// Visual/wording-only enhancement for the manager restaurant profile page.
// It keeps data flow intact and avoids adding dependencies while the page copy is being refined.

const RESTAURANT_INFO_ROUTE_HASH = "#restaurant-info-management";

const TEXT_REPLACEMENTS = new Map([
  ["RESTAURANT INFO", "HỒ SƠ HIỂN THỊ"],
  ["Mặt tiền số của nhà hàng", "Thông tin khách nhìn thấy đầu tiên"],
  [
    "Ưu tiên các thông tin khách nhìn thấy đầu tiên: hình ảnh, địa chỉ, giờ phục vụ và câu chuyện thương hiệu.",
    "Hoàn thiện hình ảnh, địa chỉ, giờ phục vụ và câu chuyện thương hiệu để khách dễ tin tưởng khi đặt bàn.",
  ],
  ["Trạng thái thực đơn", "Danh mục thực đơn theo ca"],
  ["Đồng bộ", "Cập nhật danh mục"],
  ["Xem trước (Live Preview)", "Xem trước trên ứng dụng khách"],
  ["Lịch sử bản nháp", "Chọn bản nháp"],
  ["Lưu nháp", "Lưu bản nháp"],
  ["Lưu thay đổi", "Lưu hồ sơ"],
  ["Tên Nhà Hàng", "Tên nhà hàng"],
  ["Loại ẩm thực", "Chưa chọn ẩm thực"],
  ["Mô tả ngắn hiển thị", "Câu chuyện hiển thị với khách"],
  ["Bếp trưởng điều hành", "Bếp trưởng phụ trách"],
  ["Chọn từ nhân viên", "Chọn nhân viên"],
  ["Free Wifi", "Wi‑Fi miễn phí"],
  ["Thẻ VISA/Master", "Thanh toán thẻ"],
  ["Tiện ích mở rộng (Nhập & Enter)", "Tiện ích khác"],
  ["Dress Code & Note", "Quy định trang phục / ghi chú"],
  ["FAQ - Câu hỏi thường gặp", "Câu hỏi thường gặp"],
  ["Thanh toán realtime", "Thanh toán thời gian thực"],
  ["Provider mặc định", "Cổng thanh toán mặc định"],
  ["Label hiển thị", "Tên hiển thị"],
  ["Đang hoạt động", "Đang mở cửa"],
  ["Tạm ngưng", "Tạm đóng"],
  ["Đã đồng bộ", "Đã lưu gần nhất"],
  ["Có thay đổi chưa lưu", "Có chỉnh sửa chưa lưu"],
]);

const PLACEHOLDER_REPLACEMENTS = new Map([
  ["Nhập tên nhà hàng", "Ví dụ: Cohan Restaurant"],
  ["Nhập câu chuyện thương hiệu hiển thị ở phần 'Về chúng tôi'", "Viết 2–3 câu ngắn về phong cách, món nổi bật và trải nghiệm khách sẽ nhận được."],
  ["Chọn từ nhân viên hoặc nhập tên bếp trưởng", "Chọn nhân viên phụ trách bếp hoặc nhập tên thủ công"],
  ["VD: Ghế trẻ em, Phòng riêng...", "Ví dụ: ghế trẻ em, phòng riêng, khu hút thuốc"],
  ["VD: Smart Casual", "Ví dụ: lịch sự, không mang đồ ăn ngoài"],
  ["Câu hỏi", "Ví dụ: Nhà hàng có nhận đặt bàn trước không?"],
  ["Trả lời", "Nhập câu trả lời ngắn gọn cho khách"],
  ["Tìm theo tên, vai trò, chức danh", "Tìm nhân viên theo tên hoặc vai trò"],
]);

const replaceDirectText = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  nodes.forEach((textNode) => {
    const original = textNode.nodeValue;
    if (!original || !original.trim()) return;

    const trimmed = original.trim();
    const replacement = TEXT_REPLACEMENTS.get(trimmed);
    if (!replacement) return;

    textNode.nodeValue = original.replace(trimmed, replacement);
  });
};

const tunePlaceholders = (root) => {
  root.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((element) => {
    const current = element.getAttribute("placeholder") || "";
    const replacement = PLACEHOLDER_REPLACEMENTS.get(current.trim());
    if (replacement) element.setAttribute("placeholder", replacement);
  });
};

const tuneAiRewriteButton = (root) => {
  root.querySelectorAll(".ai-btn").forEach((button) => {
    button.textContent = "✨ Gợi ý mô tả AI";
    button.setAttribute(
      "title",
      "Hiện nút này dùng mẫu gợi ý nội bộ. Chưa phát hiện kết nối modal Gemini trong dự án.",
    );
    button.setAttribute("aria-label", "Gợi ý viết lại mô tả bằng AI nội bộ");
  });
};

const tuneCategorySummary = (root) => {
  root.querySelectorAll(".category-card .ant-typography").forEach((element) => {
    const text = element.textContent || "";
    if (!text.includes("Đang có")) return;
    element.innerHTML = element.innerHTML
      .replace("Đang có", "Đang hiển thị")
      .replace("danh mục", "danh mục trong ca này");
  });
};

const applyRestaurantInfoCopyTuning = () => {
  if (window.location.hash !== RESTAURANT_INFO_ROUTE_HASH) return;
  const root = document.querySelector(".restaurant-management-container");
  if (!root) return;

  replaceDirectText(root);
  tunePlaceholders(root);
  tuneAiRewriteButton(root);
  tuneCategorySummary(root);
};

let observer;

export const installRestaurantInfoCopyTuning = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const scheduleApply = () => window.requestAnimationFrame(applyRestaurantInfoCopyTuning);
  scheduleApply();

  window.addEventListener("hashchange", scheduleApply);

  if (!observer) {
    observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder"],
    });
  }
};
