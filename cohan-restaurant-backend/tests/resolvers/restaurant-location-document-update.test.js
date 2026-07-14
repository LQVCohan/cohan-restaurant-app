import { describe, expect, it, vi } from "vitest";
import {
  applyRestaurantUpdateToDocument,
  buildRestaurantLocationFromAddress,
} from "../../graphql/resolvers/restaurant/updateDocument.js";

describe("restaurant location document updates", () => {
  it("builds GeoJSON coordinates in longitude-latitude order", () => {
    expect(
      buildRestaurantLocationFromAddress({ lat: 10.895109, lng: 106.83339 }),
    ).toEqual({
      type: "Point",
      coordinates: [106.83339, 10.895109],
    });
  });

  it("uses tracked Mongoose setters for address and location", () => {
    const values = {};
    const doc = {
      set: vi.fn((path, value) => {
        if (typeof path === "string") values[path] = value;
        else Object.assign(values, path);
      }),
      markModified: vi.fn(),
    };
    const address = {
      line1: "12 Nguyễn Ái Quốc",
      city: "Đồng Nai",
      lat: 10.895109,
      lng: 106.83339,
    };

    applyRestaurantUpdateToDocument(doc, {
      name: "COHAN Biên Hòa",
      address,
    });

    expect(values.address).toEqual(address);
    expect(values.location).toEqual({
      type: "Point",
      coordinates: [106.83339, 10.895109],
    });
    expect(values.name).toBe("COHAN Biên Hòa");
    expect(doc.markModified).toHaveBeenCalledWith("address");
    expect(doc.markModified).toHaveBeenCalledWith("location");
  });

  it("keeps a plain-document fallback for resolver unit tests", () => {
    const doc = { name: "Old", address: null, location: null };

    applyRestaurantUpdateToDocument(doc, {
      name: "New",
      address: { lat: 10.7769, lng: 106.7009 },
    });

    expect(doc).toEqual({
      name: "New",
      address: { lat: 10.7769, lng: 106.7009 },
      location: {
        type: "Point",
        coordinates: [106.7009, 10.7769],
      },
    });
  });
});
