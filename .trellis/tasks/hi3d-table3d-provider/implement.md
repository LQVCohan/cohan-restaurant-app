# Implementation

1. Extend provider configuration and availability for `hi3d`.
2. Add token exchange, multipart task submission, task polling, and GLB download using native Node fetch/FormData/Blob.
3. Route request/status functions through the Hi3D adapter without changing the REST response shape.
4. Add focused Vitest cases using mocked fetch and temporary upload directories.
5. Run the focused backend test, then CI/build checks through the pull request.

## Files
- `cohan-restaurant-backend/src/services/table3d/table3dAiGeneration.service.js`
- `cohan-restaurant-backend/tests/services/table3dAiGeneration.service.test.js`

## Validation
- `npm --prefix cohan-restaurant-backend test -- tests/services/table3dAiGeneration.service.test.js`
- backend lint/build and repository CI
