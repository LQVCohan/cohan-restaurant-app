// Restaurant Info copy tuning and AI rewrite bridge.
// This keeps the current component flow intact while ensuring the AI Rewrite button
// performs a real GraphQL API call instead of using only a local template.

import { getGraphqlUrl } from "@/lib/apiBaseUrl";
import { getToken } from "@/lib/authStorage";

const RESTAURANT_INFO_ROUTE_HASH = "#restaurant-info-management";
const wiredAiButtons = new WeakSet();

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
  ["Mô tả ngắn hiển thị", "Câu chuyện hiện với khách"],
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
  [
    "Nhập câu chuyện thương hiệu hiển thị ở phần 'Về chúng tôi'",
    "Viết 2–3 câu ngắn về phong cách, món nổi bật và trải nghiệm khách sẽ nhận được.",
  ],
  [
    "Chọn từ nhân viên hoặc nhập tên bếp trưởng",
    "Chọn nhân viên phụ trách bếp hoặc nhập tên thủ công",
  ],
  ["VD: Ghế trẻ em, Phòng riêng...", "Ví dụ: ghế trẻ em, phòng riêng, khu hút thuốc"],
  ["VD: Smart Casual", "Ví dụ: lịch sự, không mang đồ ăn ngoài"],
  ["Câu hỏi", "Ví dụ: Nhà hàng có nhận đặt bàn trước không?"],
  ["Trả lời", "Nhập câu trả lời ngắn gọn cho khách"],
  ["Tìm theo tên, vai trò, chức danh", "Tìm nhân viên theo tên hoặc vai trò"],
]);

const REWRITE_MUTATION = `
  mutation RewriteRestaurantProfileDescription($input: RewriteRestaurantProfileInput!) {
    rewriteRestaurantProfileDescription(input: $input) {
      text
      provider
      usedGemini
      reason
    }
  }
`;

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

const readRestaurantId = (root) => {
  const iframeSrc = root.querySelector("iframe[title='RestaurantDetail Preview']")?.getAttribute("src") || "";
  const match = iframeSrc.match(/\/preview\/restaurant\/([^/?#]+)/);
  return match?.[1] || "";
};

const readInputByLabel = (root, labelText) => {
  const labels = Array.from(root.querySelectorAll(".ant-form-item-label label"));
  const label = labels.find((node) => (node.textContent || "").trim().includes(labelText));
  const item = label?.closest(".ant-form-item");
  return item?.querySelector("input, textarea")?.value?.trim() || "";
};

const readStoryTextarea = (root) => {
  const labels = Array.from(root.querySelectorAll(".ant-form-item-label label"));
  const label = labels.find((node) => {
    const text = (node.textContent || "").trim();
    return text.includes("Câu chuyện") || text.includes("Mô tả");
  });
  const item = label?.closest(".ant-form-item");
  return item?.querySelector("textarea") || root.querySelector(".ai-textarea-wrapper textarea");
};

const setNativeValue = (element, value) => {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) descriptor.set.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
};

const showToast = (message, type = "success") => {
  const event = new CustomEvent("restaurant-info:ai-rewrite-toast", {
    detail: { message, type },
  });
  window.dispatchEvent(event);
  if (type === "error") console.error(message);
  else console.info(message);
};

const requestRestaurantRewrite = async (root) => {
  const restaurantId = readRestaurantId(root);
  const storyTextarea = readStoryTextarea(root);
  const token = getToken();

  if (!restaurantId) throw new Error("Chưa xác định được nhà hàng để rewrite.");
  if (!storyTextarea) throw new Error("Không tìm thấy ô mô tả để cập nhật.");

  const response = await fetch(getGraphqlUrl(), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      operationName: "RewriteRestaurantProfileDescription",
      query: REWRITE_MUTATION,
      variables: {
        input: {
          restaurantId,
          restaurantName: readInputByLabel(root, "Tên nhà hàng"),
          cuisineType: root.querySelector(".restaurant-title-preview .ant-typography-secondary")?.textContent?.trim() || "",
          currentText: storyTextarea.value || "",
          chefName: readInputByLabel(root, "Bếp trưởng"),
          tone: "ấm áp, chuyên nghiệp, đáng tin cậy, phù hợp nhà hàng cao cấp vừa phải",
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.errors?.length) {
    const message = payload?.errors?.[0]?.message || `Rewrite API lỗi HTTP ${response.status}`;
    throw new Error(message);
  }

  const result = payload?.data?.rewriteRestaurantProfileDescription;
  if (!result?.text) throw new Error("Rewrite API không trả về nội dung.");

  setNativeValue(storyTextarea, result.text);
  return result;
};

const wireAiRewriteButton = (root, button) => {
  if (wiredAiButtons.has(button)) return;
  wiredAiButtons.add(button);

  button.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (button.dataset.aiRewriteLoading === "true") return;
      const originalText = button.textContent || "✨ Gợi ý mô tả AI";
      button.dataset.aiRewriteLoading = "true";
      button.disabled = true;
      button.textContent = "Đang gọi AI...";

      try {
        const result = await requestRestaurantRewrite(root);
        button.textContent = result.usedGemini ? "Đã dùng Gemini" : "Đã dùng fallback";
        showToast(
          result.usedGemini
            ? "Đã rewrite mô tả bằng Gemini."
            : `Đã rewrite qua API fallback: ${result.reason || "chưa cấu hình Gemini API key"}`,
          "success",
        );
        setTimeout(() => {
          button.textContent = originalText;
        }, 1800);
      } catch (error) {
        button.textContent = "Thử lại AI";
        showToast(error?.message || "Không gọi được API rewrite.", "error");
      } finally {
        button.dataset.aiRewriteLoading = "false";
        button.disabled = false;
      }
    },
    true,
  );
};

const tuneAiRewriteButton = (root) => {
  root.querySelectorAll(".ai-btn").forEach((button) => {
    if (button.dataset.aiRewriteLoading !== "true") {
      button.textContent = "✨ Gợi ý mô tả AI";
    }
    button.setAttribute(
      "title",
      "Gọi GraphQL rewriteRestaurantProfileDescription. Backend dùng Gemini nếu đã cấu hình GEMINI_API_KEY, nếu chưa sẽ fallback an toàn.",
    );
    button.setAttribute("aria-label", "Gọi API AI để gợi ý viết lại mô tả nhà hàng");
    wireAiRewriteButton(root, button);
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
