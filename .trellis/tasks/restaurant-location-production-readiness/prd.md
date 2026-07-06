# Shared browser reverse geocoding

## Current behavior and root cause

Browser geolocation succeeds and returns valid latitude/longitude values. The manager restaurant profile previously sent those coordinates to the backend `/api/reverse-geocode` proxy. Manual Network inspection showed that the backend could not reach Nominatim, so the form kept a stale street, district, and city beside the new coordinates.

The customer Home page already uses browser-side Nominatim reverse geocoding successfully. The root cause is therefore the inconsistent reverse-geocoding path, not the GPS API, GraphQL mutation, or restaurant address schema.

## End-to-end flow

1. Browser `navigator.geolocation` returns latitude and longitude.
2. Shared `reverseGeocodeCoordinates` calls Nominatim directly from the browser, matching the working Home flow.
3. If direct access fails, the existing backend `/api/reverse-geocode` endpoint is used as a fallback.
4. The normalized address updates the manager restaurant form or customer address form.
5. `UpdateRestaurantInput.address` persists the restaurant address and coordinates.
6. Existing model synchronization continues to build GeoJSON coordinates for AR and geofence consumers.

## Implementation

- Add `src/lib/reverseGeocode.js` as the single shared reverse-geocoding boundary.
- Normalize house number, road, ward, district, province/city, country, and postal code once.
- Reuse the helper in Home, restaurant setup, and customer address management.
- Preserve the previous manual address when both direct and backend lookup fail.
- Keep the existing backend endpoint as a fallback; do not add a new provider or dependency.

## Files changed

- `src/lib/reverseGeocode.js`: browser-first Nominatim lookup with backend fallback.
- `src/lib/reverseGeocode.test.js`: direct-success and backend-fallback coverage.
- `src/components/Customer/Homepage_Client/components/HeroSection.jsx`: reuse the shared helper.
- `src/components/Customer/AddressPage/AddressPageV2.jsx`: reuse the shared helper.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: reuse the shared helper and populate the form.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: verify direct Nominatim request and saved address payload.

## Acceptance criteria

- Restaurant setup no longer depends exclusively on backend access to Nominatim.
- A successful browser lookup updates Lat/Lng and visible address fields.
- Home current-location behavior remains unchanged from the user perspective.
- Customer address current-location behavior uses the same shared path.
- Backend fallback remains available when direct browser access is blocked.
- If both paths fail, captured coordinates remain and existing manual address values are not erased.
- No new package or external provider is introduced.

## Validation plan

- Targeted unit test for `reverseGeocodeCoordinates`.
- Targeted component test for `RestaurantInfoManagement`.
- Existing frontend unit/component suite, production build, and Playwright smoke tests through CI.
- Existing backend suite through CI because the fallback endpoint remains part of the path.
- Manual browser test at the reported coordinates with Network inspection.

## Out of scope

- Guaranteeing exact storefront-level accuracy when OpenStreetMap lacks detailed address data.
- Automatically saving after location capture.
- Changing GraphQL address fields, restaurant schema, AR radius, or geofence calculations.
