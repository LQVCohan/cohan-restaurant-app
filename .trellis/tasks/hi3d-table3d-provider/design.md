# Design

## Provider selection
`TABLE_3D_AI_PROVIDER=hi3d` activates the adapter. The service reads:

- `TABLE_3D_AI_HI3D_ACCESS_KEY`
- `TABLE_3D_AI_HI3D_SECRET_KEY`
- optional `TABLE_3D_AI_ENDPOINT` (default `https://api.hitem3d.ai`)
- optional Hi3D model/resolution/face/PBR overrides

The previous `TABLE_3D_AI_HI3D_CLIENT_ID` and `TABLE_3D_AI_HI3D_CLIENT_SECRET` names remain supported as backward-compatible internal aliases.

## Request mapping
1. POST `/open-api/v1/auth/token` using Basic `base64(access_key:secret_key)`.
2. POST `/open-api/v1/submit-task` with Bearer token and multipart form:
   - repeated `multi_images`
   - `request_type=3`
   - `model=hitem3dv2.1`
   - `resolution=1536fast`
   - `face=200000`
   - `format=2`
   - `pbr=1`
3. GET `/open-api/v1/query-task?task_id=...` using a newly obtained token.
4. Download `data.url` into the existing table model upload directory.

## Status mapping
- `created`, `queueing` → `queued`
- `processing` → `processing`
- `success` → `completed`
- `failed` → `failed`

## Security
Credentials remain backend-only. They are never stored in the job object or returned to callers. The generated remote URL is downloaded immediately because Hi3D result URLs are temporary.
