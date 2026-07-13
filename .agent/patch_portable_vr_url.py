from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''import {\n  getCurrentPageReturnTo,\n  openTableVrViewerInNewTab,\n} from "@/utils/tableVrNavigation";\n''',
    '''import {\n  getCurrentPageReturnTo,\n  normalizeTableVrStoredUrl,\n  openTableVrViewerInNewTab,\n} from "@/utils/tableVrNavigation";\n''',
)
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''      const uploadedUrl = await uploadAsset(\n        uploadFile,\n        (percent) =>\n          setVrUploadStatus(`Đang tải ảnh 360° lên máy chủ cục bộ... ${percent}%`),\n        { skipCompression: true },\n      );\n\n      const storedLocally = storeTableVrImage(\n''',
    '''      const uploadedUrl = await uploadAsset(\n        uploadFile,\n        (percent) =>\n          setVrUploadStatus(`Đang tải ảnh 360° lên máy chủ cục bộ... ${percent}%`),\n        { skipCompression: true },\n      );\n      const storedVrUrl = normalizeTableVrStoredUrl(uploadedUrl);\n\n      const storedLocally = storeTableVrImage(\n''',
)
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''      setVrUrl(uploadedUrl);\n''',
    '''      setVrUrl(storedVrUrl);\n''',
)

replace_once(
    "src/utils/tableVrNavigation.js",
    '''export const isTableVrImageUrl = (value) => {\n''',
    '''export const normalizeTableVrStoredUrl = (value) => {\n  const raw = String(value || "").trim();\n  if (!raw) return "";\n  try {\n    const parsed = new URL(raw, getOrigin());\n    if (parsed.pathname === "/uploads" || parsed.pathname.startsWith("/uploads/")) {\n      return `${parsed.pathname}${parsed.search}${parsed.hash}`;\n    }\n    return raw;\n  } catch {\n    return raw;\n  }\n};\n\nexport const isTableVrImageUrl = (value) => {\n''',
)
replace_once(
    "src/utils/tableVrNavigation.test.js",
    '''  openTableVrViewerInNewTab,\n  sanitizeTableVrReturnTo,\n''',
    '''  normalizeTableVrStoredUrl,\n  openTableVrViewerInNewTab,\n  sanitizeTableVrReturnTo,\n''',
)
replace_once(
    "src/utils/tableVrNavigation.test.js",
    '''  it("wraps a local backend panorama URL in the spherical viewer", () => {\n''',
    '''  it("stores backend upload paths without pinning the current ngrok domain", () => {\n    expect(\n      normalizeTableVrStoredUrl(\n        "https://temporary-subdomain.ngrok-free.dev/uploads/table-panorama.jpg",\n      ),\n    ).toBe("/uploads/table-panorama.jpg");\n  });\n\n  it("wraps a local backend panorama URL in the spherical viewer", () => {\n''',
)
