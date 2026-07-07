import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installAttendanceWordingTuning } from "./AttendanceWordingTuning";

const OBSERVER_KEY = "__cohanAttendanceWordingObserver";
const STYLE_ID = "cohan-attendance-wording-tuning";

describe("installAttendanceWordingTuning", () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    document.body.innerHTML = "";
    document.getElementById(STYLE_ID)?.remove();
    window[OBSERVER_KEY]?.disconnect();
    delete window[OBSERVER_KEY];
  });

  afterEach(() => {
    window[OBSERVER_KEY]?.disconnect();
    delete window[OBSERVER_KEY];
    document.body.innerHTML = "";
    document.getElementById(STYLE_ID)?.remove();
    vi.restoreAllMocks();
  });

  it("replaces mixed English-Vietnamese attendance copy without removing icons", async () => {
    document.body.innerHTML = `
      <main class="attendance-management-page">
        <p>Theo dõi công thực tế, xử lý chỉnh công có kiểm soát và đối chiếu trước kỳ lương.</p>
        <span>No-show / Vắng lịch</span>
        <span>Thiếu check-out</span>
        <small>Timesheet có overtime trong ngày</small>
        <button type="button"><svg data-testid="icon"></svg>Lọc để xem</button>
        <input placeholder="🔍 Tìm nhân viên / lý do..." />
      </main>
    `;

    installAttendanceWordingTuning();

    const page = document.querySelector(".attendance-management-page");
    expect(page.textContent).toContain(
      "Theo dõi giờ làm thực tế, xử lý điều chỉnh và kiểm tra dữ liệu trước khi tính lương.",
    );
    expect(page.textContent).toContain("Vắng ca");
    expect(page.textContent).toContain("Quên tan ca");
    expect(page.textContent).toContain("Số ca có phát sinh tăng ca trong ngày");
    expect(page.textContent).toContain("Xem bản ghi");
    expect(page.querySelector("button svg")).not.toBeNull();
    expect(page.querySelector("input")).toHaveAttribute(
      "placeholder",
      "Tìm nhân viên hoặc lý do...",
    );

    const dynamicCopy = document.createElement("p");
    dynamicCopy.textContent = "Payroll chỉ dùng số phút đã duyệt";
    page.appendChild(dynamicCopy);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(dynamicCopy).toHaveTextContent("Bảng lương chỉ tính thời gian đã duyệt");
  });
});
