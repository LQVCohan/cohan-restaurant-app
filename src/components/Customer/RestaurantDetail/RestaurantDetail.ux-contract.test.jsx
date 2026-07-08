import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const detailSource = readSource("./RestaurantDetail.jsx");
const detailStyles = readSource("./RestaurantDetail.complete.scss");
const infoSource = readSource("./components/RestaurantInfo/RestaurantInfo.jsx");
const infoStyles = readSource("./components/RestaurantInfo/RestaurantInfo.complete.scss");
const menuSource = readSource("./components/MenuSection/MenuSection.jsx");
const gallerySource = readSource("./components/PhotoGallery/PhotoGallery.jsx");

describe("Restaurant detail complete UX contract", () => {
  it("queries the public decision data already exposed by Restaurant", () => {
    [
      "priceRange",
      "seatingCapacity",
      "weeklyOpeningHours",
      "specialHours",
      "nextOpeningTime",
      "canTableOrder",
      "canDelivery",
      "canPickup",
      "reservationPolicy",
      "reservationSettings",
      "notesOnAmenities",
    ].forEach((field) => expect(detailSource).toContain(field));
  });

  it("does not present third-party stock photos as restaurant or dish photos", () => {
    expect(detailSource).not.toContain("DETAIL_FALLBACK_COVERS");
    expect(detailSource).not.toContain("images.unsplash.com/photo-");
    expect(menuSource).not.toContain("DISH_FALLBACK_IMAGES");
    expect(menuSource).toContain("Ảnh đang cập nhật");
  });

  it("uses the parent publicRestaurant contract instead of a duplicate profile query", () => {
    expect(infoSource).not.toContain("useQuery");
    expect(infoSource).not.toContain("GET_PUBLIC_RESTAURANT_PROFILE");
    expect(infoSource).toContain("weeklyOpeningHours");
    expect(infoSource).toContain("reservationSettings");
    expect(infoSource).toContain("customerInfo.faqs");
  });

  it("keeps restaurant information readable without raw keys or nested scrolling", () => {
    expect(infoSource).toContain("CORE_AMENITY_LABELS[text] || text");
    expect(infoStyles).toContain("align-items: start");
    expect(infoStyles).toContain(".info-card--policy");
    expect(infoStyles).toContain("grid-template-columns: 1fr");
    expect(detailStyles).toContain(".sidebar-content");
    expect(detailStyles).toContain("position: static");
    expect(detailStyles).toContain("overflow: visible");
  });

  it("keeps dish browsing available when ordering is unavailable", () => {
    expect(menuSource).toMatch(/const openFoodDetail = \(item\) => \{\s+if \(!item\?\.id\) return;/);
    expect(menuSource).toContain('orderable ? "Chọn món" : "Xem chi tiết"');
    expect(menuSource).not.toContain("if (!isDishOrderable(item) || !item?.id) return;");
  });

  it("does not leave visible controls without an action", () => {
    expect(gallerySource).not.toContain("Xem tất cả");
    expect(gallerySource).toContain("navigator.share");
    expect(gallerySource).toContain("Mở ảnh gốc");
    expect(detailStyles).toContain('[aria-label="Bình luận"]');
  });
});
