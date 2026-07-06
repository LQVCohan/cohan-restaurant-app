# Restaurant location production readiness

## Previous behavior

The restaurant profile page could capture browser latitude and longitude, but the address form kept its old street, ward, district, and city values. This produced an inconsistent form: new GPS coordinates beside a stale address.

The repository already had a rate-limited backend reverse-geocode endpoint used by the customer address page, so adding a second provider or client-side integration was unnecessary.

## End-to-end flow

1. Browser geolocation returns latitude and longitude.
2. `RestaurantInfoManagement` validates the coordinates and stores them in the form.
3. The frontend calls the existing `/api/reverse-geocode` endpoint through the shared API URL helper.
4. The backend calls Nominatim and normalizes house number, street, ward, district, province/city, country, and postal code.
5. The manager form replaces stale address fields with the resolved address while preserving the manually entered `line2` field.
6. `UpdateRestaurantInput.address` persists the address and coordinates.
7. Existing model synchronization continues to build GeoJSON `location.coordinates = [lng, lat]` for AR and geofence consumers.

## Implemented changes

- Current location now updates both coordinates and visible address fields.
- House number and road are combined into the street field.
- Province-level data is preferred over city-level data when both are returned by the provider.
- Street, ward, district, province/city, country, and postal code inputs have accessible labels.
- The location button stays pending until reverse geocoding completes.
- When reverse geocoding fails, the captured coordinates remain and the previous manual address is preserved with a warning.
- No new map, geocoder, or frontend dependency was introduced.

## Changed files

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: calls the shared reverse-geocode endpoint and fills the address form.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: covers successful address replacement and provider failure fallback.
- `src/data/vietnamLocationData.js`: prefers province-level provider data when mapping Vietnamese locations.
- `src/data/vietnamLocationData.test.js`: covers a city-within-province response such as Biên Hòa, Đồng Nai.
- `cohan-restaurant-backend/src/server/createServer.js`: returns a normalized address hierarchy and combined house number/street.
- `cohan-restaurant-backend/tests/server/reverse-geocode.security.test.js`: verifies normalized output and hidden upstream failures.

## Acceptance criteria

- Clicking **Lấy vị trí hiện tại** updates Lat and Lng with six decimal places.
- A successful reverse-geocode response replaces stale street, ward, district, city/province, country, and postal code fields.
- `line2` is not overwritten.
- Saving sends numeric coordinates and the resolved address in the restaurant mutation.
- A reverse-geocode outage does not discard the captured coordinates or the existing manual address.
- Invalid or partial coordinate pairs remain blocked at frontend and backend trust boundaries.

## Automated validation completed

GitHub Actions run `28818809602` passed:

- conflict-marker check;
- frontend lint and unit tests;
- menu RBAC tests;
- changed component tests with async-leak detection;
- production frontend build;
- Playwright browser installation and smoke tests;
- backend lint, full tests, menu RBAC tests, and build.

## Manual validation still required

- Open the manager restaurant profile from an HTTPS origin.
- Grant location permission and confirm the visible address matches the device position closely enough for the available map data.
- Review the suggested address before saving because reverse geocoding can return the nearest mapped road rather than an exact storefront.
- Save, reload, and confirm address and coordinates persist.

## Out of scope

- Automatically saving immediately after location capture.
- Adding Google Maps, Mapbox, or another geocoding provider.
- Guaranteeing exact storefront or apartment-level accuracy when the upstream map data does not contain it.
- Changing AR geofence radius or calibration logic.
