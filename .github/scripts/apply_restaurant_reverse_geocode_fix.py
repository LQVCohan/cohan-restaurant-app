from pathlib import Path


def replace_once(path, old, new, label):
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    print(f"{label}: {count} match(es)")
    if count != 1:
        raise SystemExit(f"Expected exactly one match for {label}, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


frontend = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx"
frontend_test = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx"
location_data = "src/data/vietnamLocationData.js"
location_data_test = "src/data/vietnamLocationData.test.js"
backend = "cohan-restaurant-backend/src/server/createServer.js"
backend_test = "cohan-restaurant-backend/tests/server/reverse-geocode.security.test.js"

replace_once(
    frontend,
    '''import { useAvatarUploadLocal } from "../../../hooks/useAvatarUploadLocal";
import "./RestaurantInfoManagement.scss";
''',
    '''import { useAvatarUploadLocal } from "../../../hooks/useAvatarUploadLocal";
import { toApiUrl } from "../../../lib/apiBaseUrl";
import "./RestaurantInfoManagement.scss";
''',
    "frontend API URL import",
)

replace_once(
    frontend,
    '''    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords?.latitude);
        const longitude = Number(coords?.longitude);
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          setLocating(false);
          message.error("Thiết bị trả về tọa độ không hợp lệ");
          return;
        }

        setRestaurantForm((prev) => ({
          ...prev,
          lat: latitude.toFixed(6),
          lng: longitude.toFixed(6),
        }));
        setIsDirty(true);
        setLocating(false);
        message.success(
          "Đã cập nhật tọa độ hiện tại. Vui lòng kiểm tra địa chỉ chi tiết trước khi lưu.",
        );
      },
''',
    '''    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = Number(coords?.latitude);
        const longitude = Number(coords?.longitude);
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          setLocating(false);
          message.error("Thiết bị trả về tọa độ không hợp lệ");
          return;
        }

        const lat = latitude.toFixed(6);
        const lng = longitude.toFixed(6);
        setRestaurantForm((prev) => ({ ...prev, lat, lng }));
        setIsDirty(true);

        try {
          const query = new URLSearchParams({ lat, lng });
          const response = await fetch(
            toApiUrl(`/api/reverse-geocode?${query.toString()}`),
            {
              method: "GET",
              credentials: "include",
              headers: { Accept: "application/json" },
            },
          );
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result?.ok) {
            throw new Error(result?.message || "reverse_geocode_failed");
          }

          const address = result.address || {};
          setRestaurantForm((prev) => ({
            ...prev,
            lat,
            lng,
            line1: String(address.street || address.full || "").trim(),
            ward: String(address.wardName || "").trim(),
            district: String(address.districtName || "").trim(),
            city: String(address.provinceName || address.cityName || "").trim(),
            country: String(address.countryName || prev.country || "Vietnam").trim(),
            postalCode: String(address.postalCode || "").trim(),
          }));
          message.success(
            "Đã cập nhật tọa độ và gợi ý địa chỉ hiện tại. Vui lòng kiểm tra trước khi lưu.",
          );
        } catch {
          message.warning(
            "Đã cập nhật tọa độ nhưng chưa tra được địa chỉ. Vui lòng nhập địa chỉ thủ công.",
          );
        } finally {
          setLocating(false);
        }
      },
''',
    "frontend reverse geocode flow",
)

for value, label in (
    ("ward", "Phường / Xã"),
    ("district", "Quận / Huyện"),
    ("city", "Tỉnh / Thành phố"),
    ("country", "Quốc gia"),
    ("postalCode", "Mã bưu chính"),
):
    replace_once(
        frontend,
        f'''                          <Input\n                            value={{restaurantForm.{value}}}\n''',
        f'''                          <Input\n                            aria-label="{label}"\n                            value={{restaurantForm.{value}}}\n''',
        f"{value} input accessibility",
    )

replace_once(
    backend,
    '''      const data = await res.json();
      const addr = data.address || {};
      const cityName = addr.city || addr.town || addr.village || addr.state || "";
      const districtName = addr.county || addr.district || addr.city_district || addr.suburb || "";
      const wardName = addr.suburb || addr.city_district || addr.quarter || addr.hamlet || "";
      const street = addr.road || addr.residential || addr.neighbourhood || addr.house_number || "";

      return reply.send({ ok: true, address: { full: data.display_name || "", street, cityName, districtName, wardName } });
''',
    '''      const data = await res.json();
      const addr = data.address || {};
      const provinceName = addr.state || addr.region || "";
      const cityName = addr.city || addr.town || addr.municipality || addr.village || provinceName;
      const districtName = addr.city_district || addr.district || addr.county || "";
      const wardName = addr.suburb || addr.quarter || addr.neighbourhood || addr.hamlet || "";
      const streetName = addr.road || addr.pedestrian || addr.residential || addr.neighbourhood || "";
      const street = [addr.house_number, streetName].filter(Boolean).join(" ").trim();

      return reply.send({
        ok: true,
        address: {
          full: data.display_name || "",
          street,
          provinceName,
          cityName,
          districtName,
          wardName,
          countryName: addr.country || "",
          postalCode: addr.postcode || "",
        },
      });
''',
    "backend address hierarchy",
)

replace_once(
    location_data,
    '''  const province = findLocationOption(locationData, address.cityName || address.provinceName);
''',
    '''  const province = findLocationOption(locationData, address.provinceName || address.cityName);
''',
    "province mapping precedence",
)

replace_once(
    location_data_test,
    '''  it("loads remote province data when the API is available", async () => {
''',
    '''  it("prefers province-level data when the provider also returns a city", () => {
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
''',
    "province mapping regression test",
)

replace_once(
    backend_test,
    '''  it("calls upstream for valid request and hides upstream message", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ address: { city: "HCM" }, display_name: "x" }) })
      .mockRejectedValueOnce(new Error("internal details"));
    const app = await createServer();
    const ok = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=10&lng=106" });
    expect(ok.statusCode).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const bad = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=10&lng=106" });
    expect(bad.statusCode).toBe(500);
    expect(bad.json().error).not.toContain("internal details");
    await app.close();
  });
''',
    '''  it("normalizes the upstream address hierarchy and hides upstream failures", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            house_number: "12",
            road: "Nguyễn Ái Quốc",
            suburb: "Phường Long Bình",
            city: "Biên Hòa",
            state: "Đồng Nai",
            country: "Việt Nam",
            postcode: "810000",
          },
          display_name: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
        }),
      })
      .mockRejectedValueOnce(new Error("internal details"));
    const app = await createServer();
    const ok = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=10&lng=106" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().address).toEqual({
      full: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
      street: "12 Nguyễn Ái Quốc",
      provinceName: "Đồng Nai",
      cityName: "Biên Hòa",
      districtName: "",
      wardName: "Phường Long Bình",
      countryName: "Việt Nam",
      postalCode: "810000",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const bad = await app.inject({ method: "GET", url: "/api/reverse-geocode?lat=10&lng=106" });
    expect(bad.statusCode).toBe(500);
    expect(bad.json().error).not.toContain("internal details");
    await app.close();
  });
''',
    "backend reverse geocode test",
)

replace_once(
    frontend_test,
    '''  vi.spyOn(message, "success").mockImplementation(() => {});
  vi.spyOn(message, "error").mockImplementation(() => {});
''',
    '''  vi.spyOn(message, "success").mockImplementation(() => {});
  vi.spyOn(message, "warning").mockImplementation(() => {});
  vi.spyOn(message, "error").mockImplementation(() => {});
''',
    "message warning mock",
)

replace_once(
    frontend_test,
    '''  it("captures current coordinates without overwriting the street address and saves numbers", async () => {
    const getCurrentPosition = vi.fn((success, _error, options) => {
      expect(options).toEqual({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      success({
        coords: {
          latitude: 10.7769,
          longitude: 106.7009,
        },
      });
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });

    const locatedRestaurant = {
      ...restaurant,
      address: {
        ...restaurant.address,
        lat: 10.7769,
        lng: 106.7009,
      },
    };
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: locatedRestaurant },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant: locatedRestaurant },
    });

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Vĩ độ")).toHaveValue(10.7769);
      expect(screen.getByLabelText("Kinh độ")).toHaveValue(106.7009);
    });
    expect(screen.getByLabelText("Số nhà / Đường")).toHaveValue(
      "123 Existing Street",
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    expect(updateRestaurantMock.mock.calls[0][0].variables.input.address).toEqual(
      expect.objectContaining({
        line1: "123 Existing Street",
        lat: 10.7769,
        lng: 106.7009,
      }),
    );
  });
''',
    '''  it("reverse-geocodes current coordinates into the address form and saves numbers", async () => {
    const getCurrentPosition = vi.fn((success, _error, options) => {
      expect(options).toEqual({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      success({
        coords: {
          latitude: 10.895109,
          longitude: 106.83339,
        },
      });
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          address: {
            full: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
            street: "12 Nguyễn Ái Quốc",
            wardName: "Phường Long Bình",
            districtName: "TP. Biên Hòa",
            cityName: "Biên Hòa",
            provinceName: "Đồng Nai",
            countryName: "Việt Nam",
            postalCode: "810000",
          },
        }),
      }),
    );

    const locatedRestaurant = {
      ...restaurant,
      address: {
        ...restaurant.address,
        line1: "12 Nguyễn Ái Quốc",
        ward: "Phường Long Bình",
        district: "TP. Biên Hòa",
        city: "Đồng Nai",
        country: "Việt Nam",
        postalCode: "810000",
        lat: 10.895109,
        lng: 106.83339,
      },
    };
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: locatedRestaurant },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant: locatedRestaurant },
    });

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Vĩ độ")).toHaveValue(10.895109);
      expect(screen.getByLabelText("Kinh độ")).toHaveValue(106.83339);
      expect(screen.getByLabelText("Số nhà / Đường")).toHaveValue("12 Nguyễn Ái Quốc");
      expect(screen.getByLabelText("Phường / Xã")).toHaveValue("Phường Long Bình");
      expect(screen.getByLabelText("Quận / Huyện")).toHaveValue("TP. Biên Hòa");
      expect(screen.getByLabelText("Tỉnh / Thành phố")).toHaveValue("Đồng Nai");
      expect(screen.getByLabelText("Quốc gia")).toHaveValue("Việt Nam");
      expect(screen.getByLabelText("Mã bưu chính")).toHaveValue("810000");
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/reverse-geocode?lat=10.895109&lng=106.833390"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    expect(updateRestaurantMock.mock.calls[0][0].variables.input.address).toEqual(
      expect.objectContaining({
        line1: "12 Nguyễn Ái Quốc",
        ward: "Phường Long Bình",
        district: "TP. Biên Hòa",
        city: "Đồng Nai",
        country: "Việt Nam",
        postalCode: "810000",
        lat: 10.895109,
        lng: 106.83339,
      }),
    );
  });

  it("keeps captured coordinates and the manual address when reverse geocoding fails", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: { latitude: 10.895109, longitude: 106.83339 } }),
        ),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Vĩ độ")).toHaveValue(10.895109);
      expect(screen.getByLabelText("Kinh độ")).toHaveValue(106.83339);
      expect(screen.getByLabelText("Số nhà / Đường")).toHaveValue("123 Existing Street");
      expect(message.warning).toHaveBeenCalledWith(
        "Đã cập nhật tọa độ nhưng chưa tra được địa chỉ. Vui lòng nhập địa chỉ thủ công.",
      );
    });
  });
''',
    "frontend reverse geocode tests",
)

for helper in (
    ".github/workflows/apply-restaurant-reverse-geocode-fix.yml",
    ".github/scripts/apply_restaurant_reverse_geocode_fix.py",
):
    Path(helper).unlink(missing_ok=True)
