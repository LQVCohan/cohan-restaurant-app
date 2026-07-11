# AI table photo compression

## Current behavior

The five-photo AI table flow stores original camera files, then rejects any image above 5 MB before building the multipart request. Phone camera photos commonly exceed this limit.

## Flow

`CustomTableModelBuilderModal` camera input -> `aiForm.images` -> `validateAiForm` -> `FormData` -> `/table-3d-ai/generate` -> backend image validation -> Hi3D.

## Root cause

The frontend validates source file size before using the existing `compressImageForUpload` helper. The upload limit is correct; the missing step is client-side optimization before that final validation.

## Scope

- Reuse `compressImageForUpload`.
- Compress images sequentially before upload to avoid decoding five large phone photos at once.
- Limit the longest edge to 1920 px and target 4 MB per image.
- Keep the existing 5 MB validation after compression.
- Show optimization progress and prevent repeat submission while optimizing.

## Acceptance criteria

- A supported source image above 5 MB is optimized before validation and upload.
- All five images remain in front, left, right, rear, top order.
- Uploaded files remain PNG, JPEG, or WebP and each is at most 5 MB.
- Existing metadata, backend route, Hi3D provider behavior, and catalog creation are unchanged.
- Compression errors are shown in the existing error card.

## Validation

```bash
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run build
```

Manual mobile validation should include at least one camera image above 5 MB.
