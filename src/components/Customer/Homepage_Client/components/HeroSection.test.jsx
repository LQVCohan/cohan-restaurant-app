import { describe, expect, it } from "vitest";
import { buildHeroMetrics, buildHeroSlides } from "./HeroSection";

describe("HeroSection live restaurant showcase", () => {
  it("uses real restaurant image and metrics when the backend provides them", () => {
    const restaurant = {
      id: "restaurant-1",
      name: "Cohan Central",
      coverImage: "https://cdn.example.com/cohan-central.jpg",
      avgRating: 4.64,
      reviewCount: 128,
      estimatedTravelMinutes: 22.4,
      capabilities: { acceptsDelivery: true },
    };

    const [slide] = buildHeroSlides([restaurant]);
    const metrics = buildHeroMetrics(restaurant);

    expect(slide).toMatchObject({
      id: "restaurant-1",
      src: "https://cdn.example.com/cohan-central.jpg",
      alt: "Món ăn nổi bật tại Cohan Central",
      restaurant,
    });
    expect(metrics).toEqual({
      ratingTitle: "4.6/5",
      ratingDesc: "128 đánh giá",
      timeTitle: "22 phút",
      timeDesc: "Ước tính đến bạn",
      deliveryTitle: "Có giao hàng",
      deliveryDesc: "Nhà hàng hỗ trợ",
    });
  });

  it("keeps the previous image and label fallbacks when data is missing", () => {
    const slides = buildHeroSlides([]);

    expect(slides).toHaveLength(3);
    expect(slides[0].src).toContain("images.unsplash.com");
    expect(slides[0].restaurant).toBeNull();
    expect(buildHeroMetrics(null)).toEqual({
      ratingTitle: "4.9/5",
      ratingDesc: "Đánh giá tốt",
      timeTitle: "30 phút",
      timeDesc: "Giao siêu tốc",
      deliveryTitle: "Freeship",
      deliveryDesc: "Đơn từ 0đ",
    });
  });

  it("does not claim delivery when the restaurant explicitly disables it", () => {
    expect(
      buildHeroMetrics({ capabilities: { acceptsDelivery: false } })
    ).toMatchObject({
      deliveryTitle: "Nhận tại quán",
      deliveryDesc: "Chưa hỗ trợ giao",
    });
  });
});
