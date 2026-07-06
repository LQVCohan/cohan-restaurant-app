import { toApiUrl } from "./apiBaseUrl";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";

const normalizeNominatimAddress = (data = {}) => {
  const address = data.address || {};
  const streetName =
    address.road ||
    address.pedestrian ||
    address.residential ||
    address.neighbourhood ||
    "";

  return {
    full: String(data.display_name || "").trim(),
    street: [address.house_number, streetName].filter(Boolean).join(" ").trim(),
    provinceName: String(address.state || address.region || "").trim(),
    cityName: String(
      address.city ||
        address.town ||
        address.municipality ||
        address.village ||
        address.state ||
        "",
    ).trim(),
    districtName: String(
      address.city_district || address.district || address.county || "",
    ).trim(),
    wardName: String(
      address.suburb ||
        address.ward ||
        address.quarter ||
        address.neighbourhood ||
        address.hamlet ||
        "",
    ).trim(),
    countryName: String(address.country || "").trim(),
    postalCode: String(address.postcode || "").trim(),
  };
};

export const reverseGeocodeCoordinates = async ({ lat, lng, signal } = {}) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("invalid_coordinates");
  }

  const query = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    lat: String(latitude),
    lon: String(longitude),
  });

  try {
    const response = await fetch(`${NOMINATIM_REVERSE}?${query.toString()}`, {
      signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "vi",
      },
    });
    if (!response.ok) throw new Error("nominatim_unavailable");
    return normalizeNominatimAddress(await response.json());
  } catch (directError) {
    if (directError?.name === "AbortError") throw directError;

    const backendQuery = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
    });
    const response = await fetch(
      toApiUrl(`/api/reverse-geocode?${backendQuery.toString()}`),
      {
        method: "GET",
        credentials: "include",
        signal,
        headers: { Accept: "application/json" },
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok) throw directError;
    return result.address || {};
  }
};
