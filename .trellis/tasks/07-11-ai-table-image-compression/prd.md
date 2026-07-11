# AI table photo compression

## Current behavior

The five-photo AI table flow stores original camera files, then rejects any image above 5 MB before building the multipart request. Phone camera photos commonly exceed this limit.

## Flow

`CustomTableModelBuilderModal` camera input -> guided capture enhancer -> React `aiForm.images` -> `validateAiForm` -> `FormData` -> `/table-3d-ai/generate` -> backend image validation -> Hi3D.

## Root cause

The original camera change reaches React before the existing browser image compressor is used. The upload limit is correct; the missing step is optimizing each selected photo before React stores and validates it.

## Scope

- Reuse `compressImageForUpload` from `compressAvatar.js`.
- Intercept only the five rear-camera inputs in the custom table modal.
- Clear the original file from React state while optimization runs, then redispatch the optimized file through the same native change event.
- Limit the longest edge to 1920 px and target 4 MB per image.
- Keep the existing 5 MB frontend/backend validation as a final safety check.
- Show per-photo optimizing, success, size, and failure feedback.

## Acceptance criteria

- A supported source image above 5 MB is optimized before React validation and upload.
- The five image slots and front, left, right, rear, top order are unchanged.
- Optimized files remain PNG, JPEG, or WebP and target less than 4 MB.
- The submit action cannot use the original oversized file while optimization is running because that slot is temporarily cleared.
- Existing metadata, backend route, Hi3D provider behavior, and catalog creation are unchanged.
- Compression failure leaves the slot empty and asks the user to capture it again.

## Validation

```bash
npx vitest run src/utils/installGuidedAiCaptureCards.test.js
npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx
npm run build
```

Manual mobile validation should include at least one camera image above 5 MB.
