from pathlib import Path

path = Path("src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx")
text = path.read_text(encoding="utf-8")

replacements = []

replacements.append((
'''import {
  loadTableVrImage,
  removeTableVrImage,
  storeTableVrImage,
} from "@/utils/vrStorage";''',
'''import {
  loadTableVrImage,
  loadTableVrImageMetadata,
  removeTableVrImage,
  storeTableVrImage,
} from "@/utils/vrStorage";
import {
  MAX_TABLE_VR_SOURCE_BYTES,
  TABLE_VR_ACCEPT,
  TABLE_VR_TARGET_BYTES,
  formatTableVrBytes,
  prepareTableVrImageFile,
} from "@/utils/tableVrImageProcessing";'''))

replacements.append((
'''const joinUniqueLabels = (values = [], separator = " · ") =>
  getUniqueDisplayLabels(values).join(separator);

const DEFAULT_TABLE_POSITION''',
'''const joinUniqueLabels = (values = [], separator = " · ") =>
  getUniqueDisplayLabels(values).join(separator);

const getTableVrFileSummary = (metadata) => {
  if (!metadata) return "";
  const originalBytes = Number(metadata.originalBytes || 0);
  const processedBytes = Number(metadata.processedBytes || 0);
  const dimensions =
    metadata.width && metadata.height
      ? `${metadata.width} × ${metadata.height}`
      : "";
  const compression =
    originalBytes > processedBytes && processedBytes
      ? `${formatTableVrBytes(originalBytes)} → ${formatTableVrBytes(processedBytes)}${metadata.savingsPercent ? ` (giảm ${metadata.savingsPercent}%)` : ""}`
      : processedBytes
        ? formatTableVrBytes(processedBytes)
        : "";
  return [dimensions, compression].filter(Boolean).join(" • ");
};

const DEFAULT_TABLE_POSITION'''))

replacements.append((
'''    const storedImage = loadTableVrImage(table?.id);
    const fallbackVrUrl =
      !table?.vrUrl && storedImage ? `/vr/table/${table?.id}` : "";
    setVrUrl(table?.vrUrl || fallbackVrUrl);
    setVrUploadStatus("");
    setVrUploadError("");
    setVrFileName("");
    setVrFileSizeLabel("");
    setVrPreviewUrl(storedImage || "");''',
'''    const storedImage = loadTableVrImage(table?.id);
    const storedMetadata = loadTableVrImageMetadata(table?.id);
    const fallbackVrUrl =
      !table?.vrUrl && storedImage ? `/vr/table/${table?.id}` : "";
    setVrUrl(table?.vrUrl || fallbackVrUrl);
    setVrUploadStatus("");
    setVrUploadError("");
    setVrFileName(storedMetadata?.name || "");
    setVrFileSizeLabel(getTableVrFileSummary(storedMetadata));
    setVrPreviewUrl(storedImage || "");'''))

replacements.append((
'''  const handleVrFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file || !table?.id) return;
    setVrUploadError("");
    setVrUploadStatus("");
    setVrUploadStatusTone("info");
    if (!file.type.startsWith("image/")) {
      setVrUploadError("Vui lòng chọn file ảnh hợp lệ để làm ảnh 360.");
      return;
    }
    const maxSizeMb = 4;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setVrUploadError(`Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn ${maxSizeMb}MB.`);
      return;
    }
    if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(vrPreviewUrl);
    }
    setVrFileName(file.name || "");
    setVrFileSizeLabel(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setVrPreviewUrl(URL.createObjectURL(file));
    setVrUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      const stored = storeTableVrImage(table.id, dataUrl);
      if (!stored) {
        setVrUploadError("Không thể lưu ảnh 360. Vui lòng thử ảnh nhỏ hơn.");
        setVrUploading(false);
        return;
      }
      setVrUrl(`/vr/table/${table.id}`);
      setVrUploadStatus(
        "Ảnh đã nạp vào phiên làm việc. Bấm “Lưu thay đổi” để lưu cấu hình chính thức."
      );
      setVrUploadStatusTone("info");
      setVrUploading(false);
    };
    reader.onerror = () => {
      setVrUploadError("Không thể đọc file ảnh.");
      setVrUploading(false);
    };
    reader.readAsDataURL(file);
  };''',
'''  const handleVrFileChange = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !table?.id) return;

    setVrUploadError("");
    setVrUploadStatus(
      `Đang kiểm tra và nén ${formatTableVrBytes(file.size)}. Vui lòng không đóng cửa sổ...`,
    );
    setVrUploadStatusTone("info");
    setVrUploading(true);

    try {
      const panorama = await prepareTableVrImageFile(file);
      const stored = storeTableVrImage(table.id, panorama.dataUrl, panorama);
      if (!stored) {
        throw new Error(
          "Local Storage của trình duyệt đã đầy. Hãy xóa ảnh 360° cũ hoặc dữ liệu trang rồi thử lại.",
        );
      }

      if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(vrPreviewUrl);
      }
      setVrFileName(panorama.name);
      setVrFileSizeLabel(getTableVrFileSummary(panorama));
      setVrPreviewUrl(panorama.dataUrl);
      setVrUrl(`/vr/table/${table.id}`);
      setVrUploadStatus(
        `Đã nén ảnh còn ${formatTableVrBytes(panorama.processedBytes)}${panorama.savingsPercent ? `, giảm ${panorama.savingsPercent}%` : ""}. Bấm “Lưu thay đổi” để cập nhật cấu hình bàn.`,
      );
      setVrUploadStatusTone("success");
    } catch (error) {
      setVrUploadError(error?.message || "Không thể xử lý ảnh 360°.");
      setVrUploadStatus("");
    } finally {
      setVrUploading(false);
      input.value = "";
    }
  };'''))

replacements.append((
'''                        Chọn ảnh panorama để đại diện cho bàn này. Khuyến nghị
                        tỉ lệ ngang rộng, dung lượng dưới 4MB.''',
'''                        Chọn ảnh cầu equirectangular gần tỷ lệ 2:1, không phải
                        panorama ngang thông thường. Nhận JPG/PNG/WebP/AVIF đến {formatTableVrBytes(MAX_TABLE_VR_SOURCE_BYTES)} và tự nén xuống khoảng {formatTableVrBytes(TABLE_VR_TARGET_BYTES)}.'''))

replacements.append((
'''                      accept="image/*"''',
'''                      accept={TABLE_VR_ACCEPT}'''))

replacements.append((
'''                    <span className="btn ghost">
                      Chọn ảnh 360
                    </span>''',
'''                    <span className="btn ghost">
                      {vrUploading ? "Đang nén ảnh..." : "Chọn ảnh 360"}
                    </span>'''))

replacements.append((
'''                    <div className="hint">Dung lượng tệp: {vrFileSizeLabel}</div>''',
'''                    <div className="hint">Thông tin ảnh: {vrFileSizeLabel}</div>'''))

replacements.append((
'''                        <span>Xem trước ảnh 360 đã chọn</span>''',
'''                        <span>Xem trước ảnh 360 sau khi nén</span>'''))

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match, found {count}: {old[:100]!r}")
    text = text.replace(old, new, 1)

path.write_text(text, encoding="utf-8")
print(f"Patched {path}")
