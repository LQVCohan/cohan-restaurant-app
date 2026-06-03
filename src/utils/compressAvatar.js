const AVATAR_MAX_SOURCE_SIZE_BYTES = 5 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_WEBP_QUALITY = 0.8;

export const AVATAR_FILE_ERROR_MESSAGES = {
  required: "Vui lòng chọn ảnh đại diện.",
  invalidType: "File được chọn không phải là ảnh. Vui lòng chọn ảnh PNG, JPG hoặc WebP.",
  tooLarge: "Ảnh đại diện tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn.",
  decodeFailed: "Không thể đọc ảnh này. Vui lòng chọn một ảnh hợp lệ khác.",
};

export function validateAvatarFile(file) {
  if (!file) {
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.required);
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.invalidType);
  }

  if (file.size > AVATAR_MAX_SOURCE_SIZE_BYTES) {
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.tooLarge);
  }
}

const getOutputFileName = (file, extension) => {
  const baseName = file.name?.replace(/\.[^.]+$/, "") || "avatar";
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

export async function compressAvatar(file) {
  validateAvatarFile(file);

  let source;
  try {
    source = await loadImageFromFile(file);
  } catch (error) {
    throw new Error(error?.message || AVATAR_FILE_ERROR_MESSAGES.decodeFailed);
  }

  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (!sourceWidth || !sourceHeight) {
    source?.close?.();
    throw new Error(AVATAR_FILE_ERROR_MESSAGES.decodeFailed);
  }

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    source?.close?.();
    return file;
  }

  const cropSize = Math.min(sourceWidth, sourceHeight);
  const sx = Math.round((sourceWidth - cropSize) / 2);
  const sy = Math.round((sourceHeight - cropSize) / 2);

  ctx.drawImage(
    source,
    sx,
    sy,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE
  );

  source?.close?.();

  const webpBlob = await canvasToBlob(canvas, "image/webp", AVATAR_WEBP_QUALITY);
  if (webpBlob?.type === "image/webp") {
    return new File([webpBlob], getOutputFileName(file, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  }

  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", AVATAR_WEBP_QUALITY);
  if (jpegBlob) {
    return new File([jpegBlob], getOutputFileName(file, "jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  return file;
}
