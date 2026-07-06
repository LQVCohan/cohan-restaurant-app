import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findLocationOption,
  findWardOption,
  getFallbackLocationData,
  loadVietnamLocationData,
  mapReverseGeocodeToGeo,
} from "./vietnamLocationData";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("vietnamLocationData", () => {
  it("provides a fallback dataset with major cities", () => {
    const data = getFallbackLocationData();

    expect(data["01"]?.name).toMatch(/Hà Nội/i);
    expect(data["79"]?.name).toMatch(/Hồ Chí Minh/i);
    expect(data["92"]?.name).toMatch(/Cần Thơ/i);
  });

  it("matches location names with accents, prefixes and partial values", () => {
    const data = getFallbackLocationData();
    const hcmCode = findLocationOption(data, "thanh pho ho chi minh");
    const districtCode = findLocationOption(data[hcmCode].districts, "thu duc");
    const ward = findWardOption(data[hcmCode].districts[districtCode].wards, "thao dien");

    expect(hcmCode).toBe("79");
    expect(districtCode).toBe("769");
    expect(ward).toBe("Phường Thảo Điền");
  });

  it("maps reverse geocode payload to province/district/ward codes", () => {
    const data = getFallbackLocationData();
    const mapped = mapReverseGeocodeToGeo(
      {
        cityName: "TP. Hồ Chí Minh",
        districtName: "Thành phố Thủ Đức",
        wardName: "Phường Thảo Điền",
        street: "12 Nguyễn Văn Hưởng",
      },
      data,
    );

    expect(mapped).toEqual({
      province: "79",
      district: "769",
      ward: "Phường Thảo Điền",
      specificAddress: "12 Nguyễn Văn Hưởng",
    });
  });

  it("prefers province-level data when the provider also returns a city", () => {
    const data = getFallbackLocationData();
    const mapped = mapReverseGeocodeToGeo(
      {
        provinceName: "Đồng Nai",
        cityName: "Biên Hòa",
        districtName: "TP. Biên Hòa",
        wardName: "Phường Long Bình",
        street: "12 Nguyễn Ái Quốc",
      },
      data,
    );

    expect(mapped).toEqual({
      province: "75",
      district: "731",
      ward: "Phường Long Bình",
      specificAddress: "12 Nguyễn Ái Quốc",
    });
  });

  it("loads remote province data when the API is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            code: 1,
            name: "TP. Test",
            districts: [
              {
                code: 101,
                name: "Quận Test",
                wards: [{ name: "Phường Test" }],
              },
            ],
          },
        ],
      }),
    );

    const result = await loadVietnamLocationData();

    expect(result.source).toBe("remote");
    expect(result.data["01"].name).toBe("TP. Test");
    expect(result.data["01"].districts["101"].wards).toContain("Phường Test");
  });

  it("falls back when remote province data fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await loadVietnamLocationData();

    expect(result.source).toBe("fallback");
    expect(result.data["01"]?.name).toMatch(/Hà Nội/i);
  });
});
