# Restaurant location production readiness

## Previous behavior

The restaurant profile page already rendered a **Lấy vị trí hiện tại** action and called `navigator.geolocation.getCurrentPosition`. The callback read valid browser coordinates but only wrote a fallback text into `address.line1`. The dedicated `lat` and `lng` form fields remained empty, so `UpdateRestaurantInput.address.lat/lng` were sent as `null` and AR/geofence features still saw the restaurant as missing coordinates.

The backend accepted any finite numeric pair in `normalizeRestaurantAddress`; range validation existed only when the Mongoose pre-validation hook built the GeoJSON `location`. An out-of-range `address.lat/lng` pair could therefore be stored while `location` was removed, producing inconsistent location behavior.

The pull-request component-test step also compared against `github.event.pull_request.base.sha`. That SHA can become stale after the base branch advances, causing Vitest to treat unrelated base-branch changes as part of the PR and select the full component suite instead of only the tests related to this change.

## End-to-end flow

1. `Restaurant.address.lat/lng` stores coordinates and the model hook synchronizes valid values to `location.coordinates = [lng, lat]`.
2. `AddressInput` exposes optional Float `lat` and `lng` fields.
3. `normalizeRestaurantAddress` is the shared resolver trust boundary used by create and update mutations.
4. `RestaurantInfoManagement` loads address fields, captures browser geolocation, validates the form, and sends `UpdateRestaurantInput`.
5. `useRestaurant` and AR placement read the saved coordinates for geofence checks.
6. Component and resolver tests cover the browser-to-mutation path and the resolver persistence boundary; HTTPS/device permission behavior remains a physical-browser check.
7. Pull-request CI computes the changed-test baseline from the merge-base with the current remote base branch.

## Implemented changes

- Browser latitude and longitude are written to the dedicated form fields with six decimal places.
- The typed street address is preserved and is never replaced with a coordinate string.
- The location button has a pending state and cannot start duplicate browser requests.
- Geolocation uses `enableHighAccuracy: true`, `timeout: 10000`, and `maximumAge: 0`.
- The UI reports unsupported browsers, insecure contexts, denied permission, unavailable location, timeouts, and invalid device coordinates separately.
- Coordinates remain optional, but when present they must be supplied as a complete numeric pair.
- Frontend validation enforces latitude `-90..90` and longitude `-180..180` before the mutation runs.
- The resolver enforces the same complete-pair, finite-number, and range invariants before assigning data to the model.
- Lat/Lng inputs use numeric semantics and accessible labels.
- Browser API mocks are scoped to the affected component test instead of changing the shared test environment.
- The component test avoids Ant Design async handles and passes with `--detectAsyncLeaks`.
- Pull-request CI resolves `git merge-base HEAD origin/<base-ref>` before invoking `vitest --changed`, preventing stale-base expansion to unrelated tests.

## Changed files

- `.github/workflows/ci.yml`: derives the changed-test baseline from the current remote base branch.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: corrected the UI handler, validation, input semantics, secure-context behavior, error messages, and pending state.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: covers successful capture/save, address preservation, partial and out-of-range input, unsupported browser, denied permission, and async-leak-safe interactions.
- `cohan-restaurant-backend/graphql/resolvers/restaurant/mutation.js`: rejects invalid coordinate pairs at the shared resolver trust boundary.
- `cohan-restaurant-backend/tests/resolvers/restaurant-mutation-access.test.js`: covers valid, partial, and out-of-range coordinates before persistence.

## Acceptance criteria

- Clicking **Lấy vị trí hiện tại** writes six-decimal values to the Lat/Lng inputs and leaves `line1` unchanged.
- The button cannot be triggered repeatedly while the browser request is pending.
- The request uses high accuracy, a finite timeout, and no stale cached position.
- Saving after successful capture sends numeric `address.lat` and `address.lng` values.
- Blank coordinates remain optional.
- Partial, non-numeric, or out-of-range coordinate input is blocked in the UI.
- Create/update resolver paths reject incomplete, non-finite, or out-of-range coordinate pairs with `BAD_USER_INPUT` before saving.
- Valid coordinates continue to pass through unchanged so the existing Mongoose location synchronization remains authoritative.
- Component changed-tests are selected relative to the current base branch and complete within the PR timeout.

## Automated validation completed

- Focused frontend Vitest: `RestaurantInfoManagement.test.jsx` — 7/7 tests passed.
- Focused frontend Vitest with `--detectAsyncLeaks` — 7/7 tests passed with zero reported leaks.
- Focused backend Vitest: `restaurant-mutation-access.test.js` — 16/16 tests passed.
- The repository CI remains the merge gate for conflict checks, lint, unit/component tests, build, backend suite, and Playwright smoke tests.

## Manual validation still required

- Open the profile page from a real HTTPS origin on the target phone.
- Confirm location permission allow/deny behavior in the real browser.
- Compare the captured coordinates with the physical restaurant position.
- Save, reload, and confirm the persisted coordinates are available to the AR geofence.

## Out of scope

- Reverse geocoding coordinates into street/ward/district/city fields.
- Adding Google Maps, Mapbox, or another dependency.
- Automatically saving immediately after location capture.
- Changing geofence radius or AR calibration logic.
- Replacing the existing restaurant address schema.
