const MAX_PROOF_IMAGE_SIDE = 1600;

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Không thể đọc ảnh minh chứng."));
    };
    image.src = objectUrl;
  });

const canvasToBlob = (canvas) =>
  new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });

/**
 * The generic local upload endpoint crops images to a square avatar thumbnail.
 * Pad proof photos to a square before upload so the scale display and the whole
 * dish stay visible instead of being cropped out.
 */
export async function prepareOrderProofImage(file) {
  if (!file || !String(file.type || "").startsWith("image/")) return file;
  if (typeof document === "undefined" || typeof Image === "undefined") return file;

  const image = await loadImageElement(file);
  const width = Number(image.naturalWidth || image.width || 0);
  const height = Number(image.naturalHeight || image.height || 0);
  if (!width || !height) return file;

  const sourceSide = Math.max(width, height);
  const targetSide = Math.min(MAX_PROOF_IMAGE_SIDE, sourceSide);
  const scale = Math.min(targetSide / width, targetSide / height);
  const drawWidth = Math.max(1, Math.round(width * scale));
  const drawHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetSide;
  canvas.height = targetSide;
  const context = canvas.getContext("2d");
  if (!context) return file;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetSide, targetSide);
  context.drawImage(
    image,
    Math.round((targetSide - drawWidth) / 2),
    Math.round((targetSide - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );

  const blob = await canvasToBlob(canvas);
  if (!blob) return file;

  const baseName = String(file.name || "order-proof")
    .replace(/\.[^.]+$/, "")
    .slice(0, 80);
  return new File([blob], `${baseName}-evidence.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export default prepareOrderProofImage;
