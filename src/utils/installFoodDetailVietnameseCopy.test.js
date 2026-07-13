import { beforeEach, describe, expect, it } from "vitest";
import {
  syncFoodDetailVietnameseCopy,
  translateFoodDetailText,
} from "./installFoodDetailVietnameseCopy";

describe("food detail Vietnamese copy", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("translates common allergen and diet labels", () => {
    expect(
      translateFoodDetailText(
        "Món được đánh dấu có thể chứa: Milk, Gluten, Peanuts. Hãy ghi chú hoặc liên hệ nhà hàng nếu bạn cần xác nhận kỹ hơn.",
      ),
    ).toBe(
      "Món này có thể chứa: Sữa, gluten, Đậu phộng. Vui lòng ghi rõ yêu cầu hoặc liên hệ nhà hàng nếu bạn cần xác nhận thêm.",
    );
    expect(translateFoodDetailText("Dairy Free")).toBe("Không chứa sữa");
    expect(translateFoodDetailText("High Protein")).toBe("Giàu đạm");
  });

  it("uses natural Vietnamese for live availability and location count", () => {
    expect(translateFoodDetailText("Còn có thể đặt 85 suất")).toBe(
      "Còn 85 suất có thể đặt",
    );
    expect(translateFoodDetailText("0 suất đang được giữ")).toBe(
      "Chưa có suất nào đang được giữ",
    );
    expect(translateFoodDetailText("1 nhà hàng")).toBe("1 địa điểm");
  });

  it("updates only the food detail surface", () => {
    document.body.innerHTML = `
      <main class="food-detail-v2">
        <section class="food-detail-v2__about">
          <div class="food-detail-v2__section-heading">
            <span>Thông tin món</span>
            <h2>Khách cần biết trước khi đặt</h2>
          </div>
          <div class="food-detail-v2__allergen">
            <p>Món được đánh dấu có thể chứa: Milk, Gluten.</p>
          </div>
        </section>
        <div class="food-detail-v2__live">
          <div class="food-detail-v2__subheading"><span>Tình trạng hiện tại</span></div>
          <strong>Còn có thể đặt 85 suất</strong>
          <div class="food-detail-v2__live-meta"><span>0 suất đang được giữ</span></div>
        </div>
        <section class="food-location-selector">
          <div class="food-location-selector__heading">
            <span>Chọn nơi phục vụ</span>
            <strong>Nhà hàng có món này</strong>
            <small>1 nhà hàng</small>
          </div>
        </section>
      </main>
      <p id="outside">Khách cần biết trước khi đặt</p>
    `;

    syncFoodDetailVietnameseCopy(document);

    expect(document.querySelector(".food-detail-v2__section-heading span")?.textContent).toBe(
      "Thông tin món ăn",
    );
    expect(document.querySelector(".food-detail-v2__section-heading h2")?.textContent).toBe(
      "Thông tin cần biết trước khi đặt món",
    );
    expect(document.querySelector(".food-detail-v2__allergen p")?.textContent).toBe(
      "Món này có thể chứa: Sữa, gluten.",
    );
    expect(document.querySelector(".food-detail-v2__live strong")?.textContent).toBe(
      "Còn 85 suất có thể đặt",
    );
    expect(document.querySelector(".food-location-selector__heading small")?.textContent).toBe(
      "1 địa điểm",
    );
    expect(document.querySelector("#outside")?.textContent).toBe(
      "Khách cần biết trước khi đặt",
    );
  });
});
