export const MAX_TABLE_VR_SOURCE_BYTES = 30 * 1024 * 1024;
export const TABLE_VR_TARGET_BYTES = 1200 * 1024;
export const TABLE_VR_HARD_LIMIT_BYTES = 2 * 1024 * 1024;
export const TABLE_VR_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif";

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const PHONE_CONVERSION_EXTENSIONS = new Set(["heic", "heif"]);
const RENDERING_EXTENSIONS = new Set(["exr", "hdr", "dng", "insp"]);

const getExtension = (fileName = "") => {
  const normalized = String(fileName).trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex + 1) : "";
};

export const formatTableVrBytes = (value) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const estimateTableVrDataUrlBytes = (dataUrl = "") => {
  const payload = String(dataUrl).split(",")[1] || "";
  return Math.ceil((payload.length * 3) / 4);
};

export const getTableVrCompressionSavings = ({
  originalBytes = 0,
  processedBytes = 0,
} = {}) => {
  const original = Number(originalBytes || 0);
  const processed = Number(processedBytes || 0);
  if (!original || !processed || processed >= original) return 0;
  return Math.max(0, Math.round((1 - processed / original) * 100));
};

export const getTableVrUnsupportedFileMessage = (file) => {
  const extension = getExtension(file?.name);
  const mimeType = String(file?.type || "").toLowerCase();

  if (PHONE_CONVERSION_EXTENSIONS.has(extension) || /hei[cf]/.test(mimeType)) {
    return "Ảnh HEIC/HEIF từ điện thoại chưa được trình duyệt này hỗ trợ ổn định. Hãy xuất hoặc chia sẻ ảnh dưới dạng JPG rồi tải lại.";
  }
  if (RENDERING_EXTENSIONS.has(extension)) {
    return `File .${extension || "này"} dùng cho dựng hình/HDR và không hiển thị trực tiếp trên web. Hãy xuất ảnh equirectangular JPG trước khi tải.`;
  }
  return "Định dạng ảnh này không thể giải mã trực tiếp trên web. Hãy dùng JPG, PNG, WebP hoặc AVIF.";
};

export const isPotentialTableVrImageFile = (file) => {
  if (!file) return false;
  const mimeType = String(file.type || "").toLowerCase();
  const extension = getExtension(file.name);
  return SUPPORTED_MIME_TYPES.has(mimeType) || SUPPORTED_EXTENSIONS.has(extension);
};

const loadBrowserImage = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(getTableVrUnsupportedFileMessage(file)));
    };
    image.src = objectUrl;
  });

const createResizedCanvas = ({ image, width, height }, maxWidth, maxHeight) => {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh bằng Canvas.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#fff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, 0, 0, outputWidth, outputHeight);
  return { canvas, width: outputWidth, height: outputHeight };
};

const canvasToJpegBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Không thể mã hóa ảnh panorama thành JPEG."));
      },
      "image/jpeg",
      quality,
    );
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Không thể hoàn tất dữ liệu ảnh 360°."));
    reader.readAsDataURL(blob);
  });

const compressPanorama = async (source) => {
  const dimensionScales = [1, 0.88, 0.76, 0.66, 0.56, 0.5];
  const qualitySteps = [0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
  let best = null;
  let previousDimensions = "";

  for (const dimensionScale of dimensionScales) {
    const maxWidth = Math.max(2048, Math.round(4096 * dimensionScale));
    const maxHeight = Math.max(1024, Math.round(2048 * dimensionScale));
    const dimensionKey = `${maxWidth}x${maxHeight}`;
    if (dimensionKey === previousDimensions) continue;
    previousDimensions = dimensionKey;

    const resized = createResizedCanvas(source, maxWidth, maxHeight);
    try {
      for (const quality of qualitySteps) {
        const blob = await canvasToJpegBlob(resized.canvas, quality);
        const candidate = {
          blob,
          width: resized.width,
          height: resized.height,
          quality,
          processedBytes: blob.size,
        };
        if (!best || candidate.processedBytes < best.processedBytes) best = candidate;
        if (candidate.processedBytes <= TABLE_VR_TARGET_BYTES) return candidate;
      }
    } finally {
      resized.canvas.width = 0;
      resized.canvas.height = 0;
    }
  }

  return best;
};

export const prepareTableVrImageFile = async (file) => {
  if (!file) throw new Error("Chưa chọn ảnh 360°.");
  if (file.size > MAX_TABLE_VR_SOURCE_BYTES) {
    throw new Error(
      `Ảnh gốc vượt quá ${formatTableVrBytes(MAX_TABLE_VR_SOURCE_BYTES)}. Hãy xuất ảnh nhẹ hơn rồi thử lại.`,
    );
  }
  if (!isPotentialTableVrImageFile(file)) {
    throw new Error(getTableVrUnsupportedFileMessage(file));
  }

  const source = await loadBrowserImage(file);
  if (!source.width || !source.height) {
    throw new Error("Không đọc được kích thước ảnh 360°.");
  }

  const ratio = source.width / source.height;
  if (ratio < 1.75 || ratio > 2.25) {
    throw new Error(
      `Ảnh đã chọn có kích thước ${source.width} × ${source.height}. Ảnh cầu 360° cần tỷ lệ gần 2:1, ví dụ 4096 × 2048.`,
    );
  }
  if (source.width < 1600 || source.height < 800) {
    throw new Error("Ảnh 360° có độ phân giải quá thấp. Nên dùng tối thiểu 1600 × 800 để tránh bị mờ.");
  }

  const compressed = await compressPanorama(source);
  if (!compressed?.blob) {
    throw new Error("Không thể nén ảnh 360° trên trình duyệt hiện tại.");
  }
  if (compressed.processedBytes > TABLE_VR_HARD_LIMIT_BYTES) {
    throw new Error(
      `Ảnh vẫn còn ${formatTableVrBytes(compressed.processedBytes)} sau khi nén và vượt giới hạn tải lên. Hãy xuất JPG nhẹ hơn.`,
    );
  }

  const dataUrl = await blobToDataUrl(compressed.blob);
  return {
    blob: compressed.blob,
    dataUrl,
    name: String(file.name || "table-panorama.jpg").replace(/\.[^.]+$/, "") + ".jpg",
    mimeType: "image/jpeg",
    originalBytes: Number(file.size || 0),
    processedBytes: compressed.processedBytes,
    width: compressed.width,
    height: compressed.height,
    quality: compressed.quality,
    savingsPercent: getTableVrCompressionSavings({
      originalBytes: file.size,
      processedBytes: compressed.processedBytes,
    }),
    createdAt: new Date().toISOString(),
  };
};
