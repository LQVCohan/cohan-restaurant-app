import { describe, expect, it } from "vitest";
import { buildHeroSlides } from "./HeroSection";

describe("HeroSection live restaurant showcase", () => {
  it("uses real restaurant image when the backend provides it", () => {
    const restaurant = {
      id: "restaurant-1",
      name: "Cohan Central",
      coverImage: "https://cdn.example.com/cohan-central.jpg",
    };

    const [slide] = buildHeroSlides([restaurant]);

    expect(slide).toMatchObject({
      id: "restaurant-1",
      src: "https://cdn.example.com/cohan-central.jpg",
      alt: "Món ăn nổi bật tại Cohan Central",
      restaurant,
    });
  });

  it("keeps the previous image and label fallbacks when data is missing", () => {
    const slides = buildHeroSlides([]);

    expect(slides).toHaveLength(3);
    expect(slides[0].src).toContain("images.unsplash.com");
    expect(slides[0].restaurant).toBeNull();
  });
});
