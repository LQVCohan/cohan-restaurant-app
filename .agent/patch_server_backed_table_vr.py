from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:140]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


# Allow pre-compressed panorama files to use the same local backend upload as avatars
# without compressing them a second time to avatar dimensions.
replace_once(
    "src/hooks/useAvatarUploadLocal.js",
    '''  const upload = async (file, onProgress) => {\n    const uploadFile = await prepareUploadFile(file);\n''',
    '''  const upload = async (file, onProgress, options = {}) => {\n    const uploadFile = options?.skipCompression\n      ? file\n      : await prepareUploadFile(file);\n''',
)

# Expose the compressed Blob so it can be uploaded to the backend as a real file.
replace_once(
    "src/utils/tableVrImageProcessing.js",
    '''      `Ảnh vẫn còn ${formatTableVrBytes(compressed.processedBytes)} sau khi nén và có thể làm đầy Local Storage. Hãy xuất JPG nhẹ hơn.`,\n''',
    '''      `Ảnh vẫn còn ${formatTableVrBytes(compressed.processedBytes)} sau khi nén và vượt giới hạn tải lên. Hãy xuất JPG nhẹ hơn.`,\n''',
)
replace_once(
    "src/utils/tableVrImageProcessing.js",
    '''  return {\n    dataUrl,\n''',
    '''  return {\n    blob: compressed.blob,\n    dataUrl,\n''',
)

# Upload table panoramas through the same local backend pipeline as avatars.
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''import { useNotification } from "@/hooks/useNotification";\n''',
    '''import { useNotification } from "@/hooks/useNotification";\nimport { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";\n''',
)
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''  const { showNotification } = useNotification();\n''',
    '''  const { showNotification } = useNotification();\n  const { upload: uploadAsset } = useAvatarUploadLocal();\n''',
)
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''    try {\n      const panorama = await prepareTableVrImageFile(file);\n      const stored = storeTableVrImage(table.id, panorama.dataUrl, panorama);\n      if (!stored) {\n        throw new Error(\n          "Local Storage của trình duyệt đã đầy. Hãy xóa ảnh 360° cũ hoặc dữ liệu trang rồi thử lại.",\n        );\n      }\n\n      if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {\n        URL.revokeObjectURL(vrPreviewUrl);\n      }\n      setVrFileName(panorama.name);\n      setVrFileSizeLabel(getTableVrFileSummary(panorama));\n      setVrPreviewUrl(panorama.dataUrl);\n      setVrUrl(`/vr/table/${table.id}`);\n      setVrUploadStatus(\n        `Đã nén ảnh còn ${formatTableVrBytes(panorama.processedBytes)}${panorama.savingsPercent ? `, giảm ${panorama.savingsPercent}%` : ""}. Bấm “Lưu thay đổi” để cập nhật cấu hình bàn.`,\n      );\n      setVrUploadStatusTone("success");\n''',
    '''    try {\n      const panorama = await prepareTableVrImageFile(file);\n      const uploadFile = new File([panorama.blob], panorama.name, {\n        type: panorama.mimeType,\n        lastModified: Date.now(),\n      });\n\n      setVrUploadStatus(\n        `Đã nén còn ${formatTableVrBytes(panorama.processedBytes)}. Đang tải ảnh lên máy chủ cục bộ...`,\n      );\n      const uploadedUrl = await uploadAsset(\n        uploadFile,\n        (percent) =>\n          setVrUploadStatus(`Đang tải ảnh 360° lên máy chủ cục bộ... ${percent}%`),\n        { skipCompression: true },\n      );\n\n      // Keep a browser cache for backward compatibility, but the server URL is\n      // now the source of truth and works across normal/incognito/ngrok sessions.\n      const storedLocally = storeTableVrImage(\n        table.id,\n        panorama.dataUrl,\n        panorama,\n      );\n      if (!storedLocally) {\n        console.warn("Không thể lưu bản sao ảnh 360° vào Local Storage.");\n      }\n\n      if (vrPreviewUrl && vrPreviewUrl.startsWith("blob:")) {\n        URL.revokeObjectURL(vrPreviewUrl);\n      }\n      setVrFileName(panorama.name);\n      setVrFileSizeLabel(getTableVrFileSummary(panorama));\n      setVrPreviewUrl(panorama.dataUrl);\n      setVrUrl(uploadedUrl);\n      setVrUploadStatus(\n        `Đã nén ảnh còn ${formatTableVrBytes(panorama.processedBytes)}${panorama.savingsPercent ? `, giảm ${panorama.savingsPercent}%` : ""} và tải lên máy chủ. Bấm “Lưu thay đổi” để khách hàng xem được.`,\n      );\n      setVrUploadStatusTone("success");\n''',
)
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''    setVrPreviewUrl("");\n    setVrFileName("");\n''',
    '''    setVrPreviewUrl("");\n    setVrUrl("");\n    setVrFileName("");\n''',
)
replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '''                        openTableVrViewerInNewTab(vrUrl, {\n                          returnTo: getCurrentPageReturnTo(),\n                        });\n''',
    '''                        openTableVrViewerInNewTab(vrUrl, {\n                          tableId: table?.id,\n                          returnTo: getCurrentPageReturnTo(),\n                        });\n''',
)

# Customer booking passes the table id so a stored image URL can be wrapped in
# the spherical viewer rather than opened as a flat JPG.
replace_once(
    "src/components/Customer/TableBooking/TableBooking.jsx",
    '''    openTableVrViewerInNewTab(selectedTableVrUrl, {\n      returnTo: getCurrentPageReturnTo(),\n    });\n''',
    '''    openTableVrViewerInNewTab(selectedTableVrUrl, {\n      tableId: selectedTable?.id,\n      returnTo: getCurrentPageReturnTo(),\n    });\n''',
)

# Viewer can now receive the real server image URL through a safe query param.
replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    '''  const { openedInNewTab, returnTo } = getTableVrViewerNavigation(search);\n\n  useEffect(() => {\n    setImageUrl(loadTableVrImage(tableId));\n  }, [tableId]);\n''',
    '''  const { openedInNewTab, returnTo, imageUrl: sharedImageUrl } =\n    getTableVrViewerNavigation(search);\n\n  useEffect(() => {\n    setImageUrl(sharedImageUrl || loadTableVrImage(tableId));\n  }, [sharedImageUrl, tableId]);\n''',
)
replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    '''            Ảnh được lưu trong <b>Local Storage</b> của trình duyệt hiện tại, nên\n            chỉ xem được trên đúng máy đã upload.\n''',
    '''            Ảnh mới được lưu trên máy chủ cục bộ giống avatar. Ảnh cũ chỉ lưu\n            trong <b>Local Storage</b> vẫn cần mở bằng đúng trình duyệt đã upload.\n''',
)

# Replace navigation utility with server-image support.
(ROOT / "src/utils/tableVrNavigation.js").write_text('''const TABLE_VR_ROUTE_PREFIX = "/vr/table/";\nconst NEW_TAB_PARAM = "openedInNewTab";\nconst RETURN_TO_PARAM = "returnTo";\nconst SOURCE_PARAM = "src";\nconst IMAGE_EXTENSION_PATTERN = /\\.(?:jpe?g|png|webp|avif)(?:$|[?#])/i;\n\nconst getOrigin = () =>\n  typeof window !== "undefined" && window.location?.origin\n    ? window.location.origin\n    : "http://localhost";\n\nexport const sanitizeTableVrReturnTo = (value) => {\n  const raw = String(value || "").trim();\n  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";\n\n  try {\n    const parsed = new URL(raw, getOrigin());\n    if (parsed.origin !== getOrigin()) return "";\n    return `${parsed.pathname}${parsed.search}${parsed.hash}`;\n  } catch {\n    return "";\n  }\n};\n\nexport const sanitizeTableVrImageUrl = (value) => {\n  const raw = String(value || "").trim();\n  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";\n  try {\n    const parsed = new URL(raw, getOrigin());\n    if (!["http:", "https:"].includes(parsed.protocol)) return "";\n    return raw.startsWith("/") && !raw.startsWith("//")\n      ? `${parsed.pathname}${parsed.search}${parsed.hash}`\n      : parsed.toString();\n  } catch {\n    return "";\n  }\n};\n\nexport const isTableVrImageUrl = (value) => {\n  const safeUrl = sanitizeTableVrImageUrl(value);\n  if (!safeUrl) return false;\n  try {\n    const parsed = new URL(safeUrl, getOrigin());\n    return (\n      IMAGE_EXTENSION_PATTERN.test(`${parsed.pathname}${parsed.search}`) ||\n      parsed.pathname.includes("/uploads/")\n    );\n  } catch {\n    return false;\n  }\n};\n\nconst applyViewerNavigationParams = (parsed, { returnTo = "", imageUrl = "" } = {}) => {\n  parsed.searchParams.set(NEW_TAB_PARAM, "1");\n  const safeReturnTo = sanitizeTableVrReturnTo(returnTo);\n  if (safeReturnTo) parsed.searchParams.set(RETURN_TO_PARAM, safeReturnTo);\n  const safeImageUrl = sanitizeTableVrImageUrl(imageUrl);\n  if (safeImageUrl) parsed.searchParams.set(SOURCE_PARAM, safeImageUrl);\n  return `${parsed.pathname}${parsed.search}${parsed.hash}`;\n};\n\nexport const buildTableVrViewerUrl = (\n  vrUrl,\n  { tableId = "", returnTo = "" } = {},\n) => {\n  const raw = String(vrUrl || "").trim();\n  if (!raw) return "";\n\n  try {\n    const parsed = new URL(raw, getOrigin());\n    const isInternalViewer =\n      parsed.origin === getOrigin() &&\n      parsed.pathname.startsWith(TABLE_VR_ROUTE_PREFIX);\n\n    if (isInternalViewer) {\n      return applyViewerNavigationParams(parsed, { returnTo });\n    }\n\n    if (tableId && isTableVrImageUrl(raw)) {\n      const viewer = new URL(\n        `${TABLE_VR_ROUTE_PREFIX}${encodeURIComponent(tableId)}`,\n        getOrigin(),\n      );\n      return applyViewerNavigationParams(viewer, {\n        returnTo,\n        imageUrl: raw,\n      });\n    }\n\n    return raw;\n  } catch {\n    return raw;\n  }\n};\n\nexport const openTableVrViewerInNewTab = (\n  vrUrl,\n  { tableId = "", returnTo = "", openWindow } = {},\n) => {\n  const targetUrl = buildTableVrViewerUrl(vrUrl, { tableId, returnTo });\n  if (!targetUrl) return null;\n\n  const opener =\n    openWindow ||\n    (typeof window !== "undefined" ? window.open.bind(window) : null);\n  if (!opener) return null;\n\n  return opener(targetUrl, "_blank", "noopener,noreferrer");\n};\n\nexport const getTableVrViewerNavigation = (search = "") => {\n  const params = new URLSearchParams(search);\n  return {\n    openedInNewTab: params.get(NEW_TAB_PARAM) === "1",\n    returnTo: sanitizeTableVrReturnTo(params.get(RETURN_TO_PARAM)),\n    imageUrl: sanitizeTableVrImageUrl(params.get(SOURCE_PARAM)),\n  };\n};\n\nexport const getCurrentPageReturnTo = () => {\n  if (typeof window === "undefined") return "";\n  return sanitizeTableVrReturnTo(\n    `${window.location.pathname}${window.location.search}${window.location.hash}`,\n  );\n};\n''', encoding="utf-8")

# Replace focused navigation tests.
(ROOT / "src/utils/tableVrNavigation.test.js").write_text('''import { afterEach, describe, expect, it, vi } from "vitest";\nimport {\n  buildTableVrViewerUrl,\n  getTableVrViewerNavigation,\n  openTableVrViewerInNewTab,\n  sanitizeTableVrReturnTo,\n} from "./tableVrNavigation";\n\nafterEach(() => {\n  vi.restoreAllMocks();\n});\n\ndescribe("tableVrNavigation", () => {\n  it("marks internal table viewers as popup tabs and preserves a safe return route", () => {\n    expect(\n      buildTableVrViewerUrl("/vr/table/table-1", {\n        returnTo: "/booking/restaurant-1?floor=2#map",\n      }),\n    ).toBe(\n      "/vr/table/table-1?openedInNewTab=1&returnTo=%2Fbooking%2Frestaurant-1%3Ffloor%3D2%23map",\n    );\n  });\n\n  it("wraps a local backend panorama URL in the spherical viewer", () => {\n    expect(\n      buildTableVrViewerUrl("/uploads/table-panorama.jpg", {\n        tableId: "table-2",\n        returnTo: "/booking/r1",\n      }),\n    ).toBe(\n      "/vr/table/table-2?openedInNewTab=1&returnTo=%2Fbooking%2Fr1&src=%2Fuploads%2Ftable-panorama.jpg",\n    );\n  });\n\n  it("does not rewrite external viewer links that are not image files", () => {\n    expect(\n      buildTableVrViewerUrl("https://example.com/panorama", {\n        tableId: "table-2",\n        returnTo: "/manager#tables",\n      }),\n    ).toBe("https://example.com/panorama");\n  });\n\n  it("opens the image-backed viewer in a new noopener tab", () => {\n    const openWindow = vi.fn();\n    openTableVrViewerInNewTab("/uploads/table-2.jpg", {\n      tableId: "table-2",\n      returnTo: "/manager#tables",\n      openWindow,\n    });\n\n    expect(openWindow).toHaveBeenCalledWith(\n      "/vr/table/table-2?openedInNewTab=1&returnTo=%2Fmanager%23tables&src=%2Fuploads%2Ftable-2.jpg",\n      "_blank",\n      "noopener,noreferrer",\n    );\n  });\n\n  it("parses popup mode, image source and rejects unsafe return locations", () => {\n    expect(\n      getTableVrViewerNavigation(\n        "?openedInNewTab=1&returnTo=%2Fbooking%2Fr1%3Ffloor%3D1&src=%2Fuploads%2Ftable.jpg",\n      ),\n    ).toEqual({\n      openedInNewTab: true,\n      returnTo: "/booking/r1?floor=1",\n      imageUrl: "/uploads/table.jpg",\n    });\n    expect(sanitizeTableVrReturnTo("//evil.example/path")).toBe("");\n  });\n});\n''', encoding="utf-8")
