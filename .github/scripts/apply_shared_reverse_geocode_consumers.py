from pathlib import Path


def replace_once(path, old, new, label):
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    print(f"{label}: {count} match(es)")
    if count != 1:
        raise SystemExit(f"Expected exactly one match for {label}, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


manager = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx"
manager_test = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx"
home = "src/components/Customer/Homepage_Client/components/HeroSection.jsx"
address_page = "src/components/Customer/AddressPage/AddressPageV2.jsx"

replace_once(
    manager,
    'import { toApiUrl } from "../../../lib/apiBaseUrl";\n',
    'import { reverseGeocodeCoordinates } from "../../../lib/reverseGeocode";\n',
    "manager shared helper import",
)

replace_once(
    manager,
    '''          const query = new URLSearchParams({ lat, lng });
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
''',
    '''          const address = await reverseGeocodeCoordinates({ lat, lng });
''',
    "manager reverse geocode call",
)

replace_once(
    address_page,
    'import { toApiUrl } from "../../../lib/apiBaseUrl";\n',
    'import { reverseGeocodeCoordinates } from "../../../lib/reverseGeocode";\n',
    "address page shared helper import",
)

replace_once(
    address_page,
    '''          const query = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
          const response = await fetch(toApiUrl(`/api/reverse-geocode?${query.toString()}`), {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result?.ok) throw new Error(result?.message || "reverse_geocode_failed");

          const mapped = mapReverseGeocodeToGeo(result.address || {}, locationData);
''',
    '''          const address = await reverseGeocodeCoordinates({
            lat: latitude,
            lng: longitude,
          });
          const mapped = mapReverseGeocodeToGeo(address, locationData);
''',
    "address page reverse geocode call",
)

replace_once(
    home,
    'import LocationPickerMap from "./LocationPickerMap";\n',
    'import LocationPickerMap from "./LocationPickerMap";\nimport { reverseGeocodeCoordinates } from "../../../../lib/reverseGeocode";\n',
    "home shared helper import",
)

replace_once(
    home,
    'const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";\n',
    '',
    "remove duplicate reverse endpoint",
)

replace_once(
    home,
    '''      const url =
        `${NOMINATIM_REVERSE}?format=jsonv2&addressdetails=1` +
        `&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "vi" },
      });

      if (!res.ok) {
        throw new Error("Không thể lấy địa chỉ từ tọa độ");
      }

      const data = await res.json();
      const label = buildShortAddressLabel(
        data?.address,
        data?.display_name || fallbackLabel
      );

      return {
        id: `map-${Date.now()}`,
        label,
        shortLabel: label,
        lat,
        lng,
        address: data?.address || {},
      };
''',
    '''      const resolvedAddress = await reverseGeocodeCoordinates({ lat, lng });
      const labelParts = [
        resolvedAddress.street,
        resolvedAddress.wardName,
        resolvedAddress.districtName,
        resolvedAddress.provinceName || resolvedAddress.cityName,
      ]
        .map((part) => String(part || "").trim())
        .filter(Boolean);
      const label =
        [...new Set(labelParts)].slice(0, 4).join(", ") ||
        resolvedAddress.full ||
        fallbackLabel;

      return {
        id: `map-${Date.now()}`,
        label,
        shortLabel: label,
        lat,
        lng,
        address: resolvedAddress,
      };
''',
    "home reverse geocode helper usage",
)

replace_once(
    manager_test,
    '''    vi.stubGlobal(
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
''',
    '''    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
          address: {
            house_number: "12",
            road: "Nguyễn Ái Quốc",
            suburb: "Phường Long Bình",
            city_district: "TP. Biên Hòa",
            city: "Biên Hòa",
            state: "Đồng Nai",
            country: "Việt Nam",
            postcode: "810000",
          },
        }),
      }),
    );
''',
    "manager direct Nominatim test response",
)

replace_once(
    manager_test,
    '''    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/reverse-geocode?lat=10.895109&lng=106.833390"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
''',
    '''    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1",
      ),
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "vi" }),
      }),
    );
''',
    "manager direct Nominatim request assertion",
)

for helper in (
    ".github/workflows/apply-shared-reverse-geocode-consumers.yml",
    ".github/scripts/apply_shared_reverse_geocode_consumers.py",
):
    Path(helper).unlink(missing_ok=True)
