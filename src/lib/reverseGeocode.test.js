import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeCoordinates } from "./reverseGeocode";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("reverseGeocodeCoordinates", () => {
  it("uses the same browser-side Nominatim flow as Home", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        display_name: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
        address: {
          house_number: "12",
          road: "Nguyễn Ái Quốc",
          suburb: "Phường Long Bình",
          city: "Biên Hòa",
          state: "Đồng Nai",
          country: "Việt Nam",
          postcode: "810000",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reverseGeocodeCoordinates({ lat: 10.895109, lng: 106.83339 }),
    ).resolves.toEqual({
      full: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
      street: "12 Nguyễn Ái Quốc",
      provinceName: "Đồng Nai",
      cityName: "Biên Hòa",
      districtName: "",
      wardName: "Phường Long Bình",
      countryName: "Việt Nam",
      postalCode: "810000",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "https://nominatim.openstreetmap.org/reverse?",
    );
    expect(fetchMock.mock.calls[0][0]).toContain("lat=10.895109");
    expect(fetchMock.mock.calls[0][0]).toContain("lon=106.83339");
  });

  it("falls back to the backend proxy when direct browser access fails", async () => {
    const backendAddress = {
      full: "Fallback address",
      street: "Fallback road",
      provinceName: "Đồng Nai",
    };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("direct blocked"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, address: backendAddress }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      reverseGeocodeCoordinates({ lat: 10.895109, lng: 106.83339 }),
    ).resolves.toEqual(backendAddress);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/reverse-geocode?");
  });
});
