import { afterEach, describe, expect, it } from "vitest";
import {
  localizeStaffScheduleDom,
  resolveStaffShellRestaurantName,
  translateStaffScheduleText,
} from "./staffScheduleDomLocalization";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("staffScheduleDomLocalization", () => {
  it("translates remaining English schedule terms into Vietnamese", () => {
    expect(
      translateStaffScheduleText(
        "Tuần đăng ký availability và thực hiện check-in/check-out",
      ),
    ).toBe(
      "Tuần đăng ký lịch khả dụng và thực hiện chấm công vào ca/chấm công kết thúc ca",
    );
  });

  it("reads the active restaurant name from the staff shell", () => {
    document.body.innerHTML = `
      <div class="staff-shell__identity-copy">
        <small>COHAN Quận 1 • Sẵn sàng</small>
      </div>
    `;

    expect(resolveStaffShellRestaurantName(document)).toBe("COHAN Quận 1");
  });

  it("shows the restaurant name and removes raw IDs from schedule cards", () => {
    document.body.innerHTML = `
      <div class="staff-shell__identity-copy">
        <small>COHAN Thủ Đức • Sẵn sàng</small>
      </div>
      <p class="staff-shell__subtitle">
        Phản hồi lịch và thực hiện check-in/check-out đúng thời điểm.
      </p>
      <div class="staff-schedule-page">
        <div class="staff-schedule-hero__meta">
          <span>Tuần đăng ký availability: 20/07 - 26/07/2026</span>
        </div>
        <p>Nhà hàng: 665f91d229a5576c2b8e7abc</p>
        <button aria-label="Check-in">Check-in</button>
      </div>
    `;

    expect(localizeStaffScheduleDom(document)).toBe(true);
    expect(document.body.textContent).toContain("Nhà hàng: COHAN Thủ Đức");
    expect(document.body.textContent).not.toContain("665f91d229a5576c2b8e7abc");
    expect(document.body.textContent).toContain("Tuần đăng ký lịch khả dụng");
    expect(document.body.textContent).toContain("Chấm công vào ca");
    expect(document.body.textContent).toContain("chấm công kết thúc ca");
    expect(
      document.querySelector("button").getAttribute("aria-label"),
    ).toBe("Chấm công vào ca");
    expect(
      document.querySelector(
        '[data-staff-schedule-restaurant-name="hero"]',
      ).textContent,
    ).toBe("Nhà hàng: COHAN Thủ Đức");
  });
});
