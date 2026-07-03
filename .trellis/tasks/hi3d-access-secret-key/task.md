# Hi3D Access Key / Secret Key configuration

## Scope
Update the existing Hi3D provider configuration to match the credential labels shown by platform.hi3d.ai.

## Flow traced
`CustomTableModelBuilderModal` -> REST `/api/table-3d-ai/generate` -> `upload.route.js` -> `table3dAiGeneration.service.js` -> Hi3D token/submit/query -> local GLB download -> REST job polling.

## Files
- `cohan-restaurant-backend/src/services/table3d/table3dAiGeneration.service.js`
- `cohan-restaurant-backend/tests/services/table3dAiGeneration.service.test.js`

## Acceptance
- `TABLE_3D_AI_HI3D_ACCESS_KEY` and `TABLE_3D_AI_HI3D_SECRET_KEY` configure Hi3D.
- Legacy `CLIENT_ID` / `CLIENT_SECRET` names remain supported.
- New credential names take precedence when both pairs exist.
- No credential is returned to clients or committed to the repository.
