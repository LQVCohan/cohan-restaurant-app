# Restaurant location production readiness

## Current behavior

The restaurant profile page already renders a **Lấy vị trí hiện tại** action and calls `navigator.geolocation.getCurrentPosition`. The callback reads valid browser coordinates but only writes a fallback text into `address.line1`. The dedicated `lat` and `lng` form fields remain empty, so `UpdateRestaurantInput.address.lat/lng` are sent as `null` and AR/geofence features still see the restaurant as missing coordinates.

The backend accepts any finite numeric pair in `normalizeRestaurantAddress`; range validation currently exists only when the Mongoose pre-validation hook builds the GeoJSON `location`. An out-of-range `address.lat/lng` pair can therefore be stored while `location` is removed, producing inconsistent location behavior.

## End-to-end flow

1. `Restaurant.address.lat/lng` stores coordinates and the model hook synchronizes valid values to `location.coordinates = [lng, lat]`.
2. `AddressInput` exposes optional Float `lat` and `lng` fields.
3. `normalizeRestaurantAddress` is the shared resolver trust boundary used by create and update mutations.
4. `RestaurantInfoManagement` loads address fields, captures browser geolocation, validates the form, and sends `UpdateRestaurantInput`.
5. `useRestaurant` and AR placement read the saved coordinates for geofence checks.
6. Component and resolver tests are the nearest reliable automated boundaries; HTTPS/device permission behavior remains a physical-browser check.

## Root causes

1. `fillCurrentLocation` updates `line1` instead of `lat/lng`.
2. The UI has no locating state, timeout options, secure-context guidance, or differentiated geolocation errors.
3. Frontend validation does not enforce numeric ranges or a complete coordinate pair.
4. Resolver normalization does not reject incomplete or out-of-range coordinates before persistence.
5. Existing tests do not cover the current-location action or resolver coordinate validation.

## Scope

- Save browser latitude and longitude into the dedicated form fields without overwriting the typed street address.
- Add a loading state and production-safe geolocation options.
- Return clear messages for unsupported browser, insecure context, permission denied, unavailable location, timeout, and invalid coordinates.
- Validate coordinates as an optional pair: both absent is allowed; otherwise both must be numeric and within latitude/longitude ranges.
- Enforce the same invariant in the shared backend address normalizer.
- Add focused frontend and backend regression tests.

## Files to change

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: fix the UI handler, validation, input semantics, and locating state.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: cover successful capture/save and failure boundaries.
- `cohan-restaurant-backend/graphql/resolvers/restaurant/mutation.js`: reject invalid coordinate pairs at the resolver trust boundary.
- `cohan-restaurant-backend/tests/resolvers/restaurant-mutation-access.test.js`: cover valid, partial, and out-of-range coordinates.

## Acceptance criteria

- Clicking **Lấy vị trí hiện tại** writes six-decimal values to the Lat/Lng inputs and leaves `line1` unchanged.
- The button cannot be triggered repeatedly while the browser request is pending.
- The request uses high accuracy, a finite timeout, and no stale cached position.
- Saving after successful capture sends numeric `address.lat` and `address.lng` values.
- Blank coordinates remain optional.
- Partial, non-numeric, or out-of-range coordinate input is blocked in the UI.
- Create/update resolver paths reject incomplete or out-of-range coordinate pairs with `BAD_USER_INPUT` before saving.
- Valid coordinates continue to pass through unchanged so the existing Mongoose location synchronization remains authoritative.

## Out of scope

- Reverse geocoding coordinates into street/ward/district/city fields.
- Adding Google Maps, Mapbox, or another dependency.
- Automatically saving immediately after location capture.
- Changing geofence radius or AR calibration logic.
- Replacing the existing restaurant address schema.

## Validation plan

- Targeted Vitest for `RestaurantInfoManagement.test.jsx`.
- Targeted backend Vitest for `restaurant-mutation-access.test.js`.
- `npm run check:graphql`.
- `npm run build`.
- Existing CI frontend/backend and smoke checks.
- Manual HTTPS phone test for permission, timeout, and physical GPS accuracy.
