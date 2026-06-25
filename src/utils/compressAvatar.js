const MAX_SOURCE_IMAGE_SIZE_BYTES = 30 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_WEBP_QUALITY = 0.82;
const DEFAULT_IMAGE_MAX_DIMENSION = 1600;
const DEFAULT_IMAGE_QUALITY = 0.82;
const DEFAULT_IMAGE_TARGET_BYTES = 1800 * 1024;
const MIN_IMAGE_QUALITY = 0.58;
const WEBP_MIME = "image/webp";
const JPEG_MIME = "image/jpeg";

let webpSupportPromise = null;

export const AVATAR_FILE_ERROR_MESSAGES = {
  required: "Vui lòng chọn ảnh đại diện.",
  invalidType: "File được chọn không phải là ảnh. Vui lòng chọn ảnh PNG, JPG hoặc WebP.",
  tooLarge: "Ảnh quá lớn để xử lý trên trình duyệt. Vui lòng chọn ảnh dưới 30MB.",
  decodeFailed: "Không thể đọc ảnh này. Vui lòng chọn một ảnh hợp lệ khác.",
};

export function validateAvatarFile(file, options = {}) {
  if (!file) {
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.required);
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.invalidType);
  }

  const maxSourceSize = options.maxSourceSizeBytes || MAX_SOURCE_IMAGE_SIZE_BYTES;
  if (file.size > maxSourceSize) {
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.tooLarge);
  }
}

const getOutputFileName = (file, extension) => {
  const baseName = file.name?.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}.${extension}`;
};

const canvasToBlob = (canvas, type, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const loadImageFromFile = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to HTMLImageElement below for browsers that expose
      // createImageBitmap but cannot decode this specific source.
    }
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(AVATAR_FILE_ERROR_MESSAGES.decodeFailed));
    };
    image.src = objectUrl;
  });
};

const supportsWebp = () => {
  if (webpSupportPromise) return webpSupportPromise;

  webpSupportPromise = new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(false);
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob((blob) => resolve(Boolean(blob && blob.type === WEBP_MIME)), WEBP_MIME, 0.7);
  });

  return webpSupportPromise;
};

const getSourceSize = (source) => ({
  width: source.width || source.naturalWidth || 0,
  height: source.height || source.naturalHeight || 0,
});

const calculateContainedSize = (width, height, maxDimension) => {
  if (!width || !height) return { width: maxDimension, height: maxDimension };
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) return { width, height };
  const ratio = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const createImageFile = (blob, sourceFile, mimeType) => {
  const extension = mimeType === WEBP_MIME ? "webp" : "jpg";
  return new File([blob], getOutputFileName(sourceFile, extension), {
    type: mimeType,
    lastModified: Date.now(),
  });
};

const drawContainedImage = (source, targetWidth, targetHeight) => {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return canvas;
};

const drawCroppedSquareImage = (source, sourceWidth, sourceHeight, outputSize) => {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sx = Math.round((sourceWidth - cropSize) / 2);
  const sy = Math.round((sourceHeight - cropSize) / 2);

  ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, outputSize, outputSize);
  return canvas;
};

const exportCanvasToFile = async (canvas, file, mimeType, initialQuality, targetMaxBytes) => {
  const qualitySteps = [initialQuality, 0.76, 0.7, 0.64, MIN_IMAGE_QUALITY]
    .filter((value, index, arr) => value >= MIN_IMAGE_QUALITY && arr.indexOf(value) === index);

  let bestBlob = null;
  for (const quality of qualitySteps) {
    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob) continue;
    bestBlob = blob;
    if (!targetMaxBytes || blob.size <= targetMaxBytes) break;
  }

  if (!bestBlob && mimeType === WEBP_MIME) {
    bestBlob = await canvasToBlob(canvas, JPEG_MIME, Math.max(MIN_IMAGE_QUALITY, initialQuality - 0.08));
    mimeType = JPEG_MIME;
  }

  if (!bestBlob) return file;
  return createImageFile(bestBlob, file, mimeType);
};

export async function compressImageForUpload(file, options = {}) {
  validateAvatarFile(file, options);

  let source;
  try {
    source = await loadImageFromFile(file);
  } catch (error) {
    throw new Error(error?.message || AVATAR_FILE_ERROR_MESSAGES.decodeFailed);
  }

  try {
    const { width: sourceWidth, height: sourceHeight } = getSourceSize(source);
    if (!sourceWidth || !sourceHeight) throw new Error(AVATAR_FILE_ERROR_MESSAGES.decodeFailed);

    const maxDimension = options.maxDimension || DEFAULT_IMAGE_MAX_DIMENSION;
    const targetSize = calculateContainedSize(sourceWidth, sourceHeight, maxDimension);
    const targetMaxBytes = options.targetMaxBytes || DEFAULT_IMAGE_TARGET_BYTES;
    const initialQuality = options.quality || DEFAULT_IMAGE_QUALITY;
    const mimeType = (await supportsWebp()) ? WEBP_MIME : JPEG_MIME;

    const alreadySmallEnough =
      file.size <= targetMaxBytes &&
      Math.max(sourceWidth, sourceHeight) <= maxDimension &&
      [WEBP_MIME, JPEG_MIME, "image/png"].includes(file.type);

    if (alreadySmallEnough && options.keepSmallOriginal !== false) return file;

    const canvas = drawContainedImage(source, targetSize.width, targetSize.height);
    if (!canvas) return file;
    return exportCanvasToFile(canvas, file, mimeType, initialQuality, targetMaxBytes);
  } finally {
    source?.close?.();
  }
}

export async function compressAvatar(file) {
  validateAvatarFile(file);

  let source;
  try {
    source = await loadImageFromFile(file);
  } catch (error) {
    throw new Error(error?.message || AVATAR_FILE_ERROR_MESSAGES.decodeFailed);
  }

  try {
    const { width: sourceWidth, height: sourceHeight } = getSourceSize(source);
    if (!sourceWidth || !sourceHeight) throw new Error(AVATAR_FILE_ERROR_MESSAGES.decodeFailed);

    const canvas = drawCroppedSquareImage(source, sourceWidth, sourceHeight, AVATAR_OUTPUT_SIZE);
    if (!canvas) return file;

    const mimeType = (await supportsWebp()) ? WEBP_MIME : JPEG_MIME;
    return exportCanvasToFile(canvas, file, mimeType, AVATAR_WEBP_QUALITY, 420 * 1024);
  } finally {
    source?.close?.();
  }
}
