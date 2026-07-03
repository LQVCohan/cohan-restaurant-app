# Hi3D table 3D provider

## Current behavior
The table model builder uploads 3–4 reference images to `/table-3d-ai/generate`. The shared generation service supports mock, Gemini prompt-only, and Meshy. Unknown providers return `pending_provider`.

## Root cause
Hi3D cannot be selected because no provider adapter exchanges AK/SK credentials for a token, submits multipart images, polls the asynchronous task, or downloads the returned GLB.

## Flow
`CustomTableModelBuilderModal` → `/table-3d-ai/generate` → `upload.route.js` → `table3dAiGeneration.service.js` → Hi3D token/submit/query APIs → local GLB download → `/table-3d-ai/jobs/:jobId` → catalog item.

## Scope
- Add `hi3d` as a real provider option.
- Read client credentials only from backend environment variables.
- Submit existing 3–4 uploaded images as Hi3D `multi_images`.
- Poll task state and download successful GLB output to the existing local model directory.
- Preserve the existing frontend/REST response contract.

## Acceptance criteria
- Provider reports `ready` only when enabled and both Hi3D client credentials exist.
- Task creation performs Basic token exchange and Bearer multipart submission.
- Created/queueing/processing/success/failed states map to the existing COHAN job statuses.
- Successful output is stored under `/uploads/table-3d/models/*.glb`.
- Tests cover configuration, submission, processing, success download, and failure.

## Out of scope
- Storing credentials in Git.
- Webhook handling or persistent job storage.
- Reworking the frontend or GraphQL schema.
- Removing the existing Meshy compatibility path.
