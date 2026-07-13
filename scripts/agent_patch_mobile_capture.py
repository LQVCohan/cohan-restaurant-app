from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if new in text:
        print(f"already patched: {label}")
        return False
    if old not in text:
        raise RuntimeError(f"missing patch marker: {label} in {path}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {label}")
    return True


builder = "src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.jsx"
replace_once(
    builder,
    'import React, { useMemo, useState } from "react";',
    'import React, { useEffect, useMemo, useState } from "react";',
    "builder React hooks",
)
replace_once(
    builder,
    '} from "@/utils/tableManagementOptions";\n',
    '} from "@/utils/tableManagementOptions";\nimport {\n  clearAiTableCaptureDraft,\n  getTable3DBuilderSessionState,\n  loadAiTableCaptureDraft,\n  processAiTableCapture,\n  saveAiTableCaptureDraftSlot,\n  setTable3DBuilderSessionState,\n} from "@/utils/aiTableCaptureDraft";\n',
    "builder capture utility import",
)
replace_once(
    builder,
    'const CustomTableModelBuilderModal = ({ open, onClose, onApply }) => {\n  const [mode, setMode] = useState(BUILDER_MODES.PARAMETRIC);',
    'const CustomTableModelBuilderModal = ({\n  open,\n  onClose,\n  onApply,\n  draftScope = "default",\n}) => {\n  const [mode, setMode] = useState(() =>\n    getTable3DBuilderSessionState().mode === BUILDER_MODES.AI\n      ? BUILDER_MODES.AI\n      : BUILDER_MODES.PARAMETRIC,\n  );',
    "builder draft scope and restored mode",
)
replace_once(
    builder,
    '  const [isUploading, setIsUploading] = useState(false);\n',
    '  const [isUploading, setIsUploading] = useState(false);\n  const [aiImageMetadata, setAiImageMetadata] = useState(\n    Array(AI_REQUIRED_IMAGES).fill(null),\n  );\n  const [aiCaptureProcessingIndex, setAiCaptureProcessingIndex] = useState(null);\n  const [aiDraftMessage, setAiDraftMessage] = useState("");\n',
    "builder capture states",
)
replace_once(
    builder,
    '  const isBusy = isUploading || aiStatus === "submitting";\n\n  const updateField',
    '  const isBusy =\n    isUploading ||\n    aiStatus === "submitting" ||\n    aiCaptureProcessingIndex !== null;\n\n  useEffect(() => {\n    if (!open) return undefined;\n    let cancelled = false;\n    const sessionState = getTable3DBuilderSessionState();\n    if (sessionState.mode === BUILDER_MODES.AI) setMode(BUILDER_MODES.AI);\n\n    loadAiTableCaptureDraft(draftScope, AI_REQUIRED_IMAGES)\n      .then(({ images, metadata }) => {\n        if (cancelled) return;\n        const restoredCount = images.filter(Boolean).length;\n        if (restoredCount) {\n          setAiForm((previous) => ({ ...previous, images }));\n          setAiImageMetadata(metadata);\n          const wasReloaded =\n            Boolean(document.wasDiscarded) ||\n            performance.getEntriesByType?.("navigation")?.[0]?.type === "reload";\n          setAiDraftMessage(\n            wasReloaded\n              ? `Đã khôi phục ${restoredCount}/5 ảnh sau khi trang được tải lại.`\n              : `Đã khôi phục ${restoredCount}/5 ảnh đã chụp trước đó.`,\n          );\n        }\n      })\n      .catch(() => {\n        if (!cancelled) {\n          setAiDraftMessage(\n            "Trình duyệt không cho lưu bản nháp ảnh; hãy giữ trang mở cho đến khi gửi đủ 5 ảnh.",\n          );\n        }\n      });\n\n    return () => {\n      cancelled = true;\n    };\n  }, [draftScope, open]);\n\n  const updateField',
    "builder restore draft effect",
)
replace_once(
    builder,
    '''  const handleAiImageChange = (index, file) => {\n    setAiForm((prev) => {\n      const images = AI_CAPTURE_STEPS.map(\n        (_, imageIndex) => prev.images?.[imageIndex] || null,\n      );\n      images[index] = file || null;\n      return { ...prev, images };\n    });\n    setError("");\n  };''',
    '''  const handleAiImageChange = async (index, file, inputElement) => {\n    if (!file || aiCaptureProcessingIndex !== null) return;\n    setError("");\n    setAiDraftMessage("");\n    setAiCaptureProcessingIndex(index);\n    try {\n      const processed = await processAiTableCapture(file);\n      await saveAiTableCaptureDraftSlot(draftScope, index, processed);\n      setAiForm((previous) => {\n        const images = AI_CAPTURE_STEPS.map(\n          (_, imageIndex) => previous.images?.[imageIndex] || null,\n        );\n        images[index] = processed.file;\n        return { ...previous, images };\n      });\n      setAiImageMetadata((previous) => {\n        const next = [...previous];\n        next[index] = processed.metadata;\n        return next;\n      });\n      setAiDraftMessage(\n        `Đã tối ưu ảnh ${index + 1}: ${formatFileSize(\n          processed.metadata.originalSize,\n        )} → ${formatFileSize(processed.file.size)} và lưu bản nháp.`,\n      );\n    } catch (captureError) {\n      setError(captureError?.message || "Không thể xử lý ảnh vừa chụp.");\n    } finally {\n      if (inputElement) inputElement.value = "";\n      setAiCaptureProcessingIndex(null);\n    }\n  };''',
    "builder async capture processing",
)
replace_once(
    builder,
    '  const handleModeChange = (nextMode) => {\n    setMode(nextMode);',
    '  const handleModeChange = (nextMode) => {\n    setMode(nextMode);\n    setTable3DBuilderSessionState({ open: true, mode: nextMode });',
    "builder mode persistence",
)
replace_once(
    builder,
    '  const handleReferenceImage = (event) => {',
    '  const handleClearAiImages = async () => {\n    if (aiCaptureProcessingIndex !== null || isAiGenerating) return;\n    await clearAiTableCaptureDraft(draftScope, AI_REQUIRED_IMAGES).catch(() => {});\n    setAiForm((previous) => ({\n      ...previous,\n      images: Array(AI_REQUIRED_IMAGES).fill(null),\n    }));\n    setAiImageMetadata(Array(AI_REQUIRED_IMAGES).fill(null));\n    setAiDraftMessage("Đã xóa bản nháp 5 ảnh trên thiết bị này.");\n    setError("");\n  };\n\n  const handleReferenceImage = (event) => {',
    "builder clear capture draft",
)
replace_once(
    builder,
    '      setAiJob(payload);\n      setAiStatus(payload.status || "queued");',
    '      setAiJob(payload);\n      setAiStatus(payload.status || "queued");\n      await clearAiTableCaptureDraft(draftScope, AI_REQUIRED_IMAGES).catch(() => {});\n      setAiDraftMessage("Đã gửi đủ 5 ảnh; bản nháp trên thiết bị đã được xóa.");',
    "builder clear draft after submit",
)
replace_once(
    builder,
    '''                  <small className="custom-table-builder__hint">\n                    Giữ bàn đứng yên, dùng cùng khoảng cách và ánh sáng. Trên điện\n                    thoại, nút chọn ảnh sẽ ưu tiên mở camera sau.\n                  </small>''',
    '''                  <small className="custom-table-builder__hint">\n                    Giữ bàn đứng yên, dùng cùng khoảng cách và ánh sáng. Mỗi ảnh sẽ\n                    được nén ngay và lưu bản nháp trên thiết bị trước khi chụp ảnh kế\n                    tiếp.\n                  </small>''',
    "builder mobile capture hint",
)
replace_once(
    builder,
    '                      const file = aiImages[index];\n                      return (',
    '                      const file = aiImages[index];\n                      const metadata = aiImageMetadata[index];\n                      return (',
    "builder metadata in capture list",
)
replace_once(
    builder,
    '                          <small>{file ? file.name : step.hint}</small>\n                          <input\n                            type="file"\n                            accept="image/png,image/jpeg,image/webp"\n                            capture="environment"\n                            aria-label={`Ảnh ${index + 1}: ${step.label}`}\n                            onChange={(event) =>\n                              handleAiImageChange(\n                                index,\n                                event.target.files?.[0] || null,\n                              )\n                            }\n                          />',
    '                          <small>\n                            {aiCaptureProcessingIndex === index\n                              ? "Đang nén và lưu ảnh…"\n                              : file\n                                ? `${file.name}${\n                                    metadata\n                                      ? ` · ${formatFileSize(\n                                          metadata.originalSize,\n                                        )} → ${formatFileSize(file.size)}`\n                                      : ""\n                                  }`\n                                : step.hint}\n                          </small>\n                          <input\n                            type="file"\n                            accept="image/*"\n                            capture="environment"\n                            aria-label={`Ảnh ${index + 1}: ${step.label}`}\n                            disabled={\n                              aiCaptureProcessingIndex !== null || isAiGenerating\n                            }\n                            onChange={(event) => {\n                              const input = event.currentTarget;\n                              void handleAiImageChange(\n                                index,\n                                input.files?.[0] || null,\n                                input,\n                              );\n                            }}\n                          />',
    "builder capture input",
)
replace_once(
    builder,
    '              <StatusCard tone={aiStatus === "failed" ? "danger" : "info"}>',
    '              {aiDraftMessage && <StatusCard>{aiDraftMessage}</StatusCard>}\n              <StatusCard tone={aiStatus === "failed" ? "danger" : "info"}>',
    "builder draft status",
)
replace_once(
    builder,
    '                    isUploading ||\n                    isAiGenerating ||\n                    capturedImageCount !== AI_REQUIRED_IMAGES',
    '                    isUploading ||\n                    isAiGenerating ||\n                    aiCaptureProcessingIndex !== null ||\n                    capturedImageCount !== AI_REQUIRED_IMAGES',
    "builder generation disabled while processing",
)
replace_once(
    builder,
    '''                {aiJob?.jobId && (\n                  <Button variant="secondary" onClick={handleRefreshAiJob}>\n                    Kiểm tra job\n                  </Button>\n                )}''',
    '''                {capturedImageCount > 0 && (\n                  <Button\n                    type="button"\n                    variant="secondary"\n                    onClick={handleClearAiImages}\n                    disabled={\n                      aiCaptureProcessingIndex !== null || isAiGenerating\n                    }\n                  >\n                    Xóa ảnh đã chụp\n                  </Button>\n                )}\n                {aiJob?.jobId && (\n                  <Button variant="secondary" onClick={handleRefreshAiJob}>\n                    Kiểm tra job\n                  </Button>\n                )}''',
    "builder clear images button",
)

parent = "src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.jsx"
replace_once(
    parent,
    'import {\n  deleteCustomTableModel,',
    'import {\n  clearTable3DBuilderSessionState,\n  getTable3DBuilderSessionState,\n  setTable3DBuilderSessionState,\n} from "@/utils/aiTableCaptureDraft";\nimport {\n  deleteCustomTableModel,',
    "simulator builder session import",
)
replace_once(
    parent,
    '  const [showCustomBuilder, setShowCustomBuilder] = useState(false);',
    '  const [showCustomBuilder, setShowCustomBuilder] = useState(\n    () => getTable3DBuilderSessionState().open,\n  );',
    "simulator restore builder open state",
)
replace_once(
    parent,
    '  const customModelScope = restaurantName || restaurantId || "default";\n',
    '  const customModelScope = restaurantName || restaurantId || "default";\n\n  const openCustomBuilder = () => {\n    setTable3DBuilderSessionState({ open: true });\n    setShowCustomBuilder(true);\n  };\n\n  const closeCustomBuilder = () => {\n    clearTable3DBuilderSessionState();\n    setShowCustomBuilder(false);\n  };\n',
    "simulator builder open close handlers",
)
replace_once(
    parent,
    '          onCreateCustomModel={() => setShowCustomBuilder(true)}',
    '          onCreateCustomModel={openCustomBuilder}',
    "simulator open builder handler",
)
replace_once(
    parent,
    '            {selectedModel?.modelUrl && !modelError ? (',
    '            {!showCustomBuilder && selectedModel?.modelUrl && !modelError ? (',
    "simulator release model viewer while capturing",
)
replace_once(
    parent,
    '            {modelLoading && selectedModel?.modelUrl && (',
    '            {!showCustomBuilder && modelLoading && selectedModel?.modelUrl && (',
    "simulator hide loading layer while builder open",
)
replace_once(
    parent,
    '''      <CustomTableModelBuilderModal\n        open={showCustomBuilder}\n        onClose={() => setShowCustomBuilder(false)}\n        onApply={(customItem) => {''',
    '''      <CustomTableModelBuilderModal\n        open={showCustomBuilder}\n        onClose={closeCustomBuilder}\n        draftScope={customModelScope}\n        onApply={(customItem) => {''',
    "simulator pass draft scope",
)
replace_once(
    parent,
    '          setSelectedModelKey(customItem.key);\n          setShowCustomBuilder(false);',
    '          setSelectedModelKey(customItem.key);\n          closeCustomBuilder();',
    "simulator close builder after apply",
)

vite = "vite.config.js"
replace_once(
    vite,
    '  const inferRequestHost = mergedEnv.VITE_DEV_INFER_REQUEST_HOST === "true";\n',
    '  const inferRequestHost = mergedEnv.VITE_DEV_INFER_REQUEST_HOST === "true";\n  const disableDevHmr = mergedEnv.VITE_DEV_HMR === "false";\n',
    "vite mobile HMR flag",
)
replace_once(
    vite,
    '''      ...(inferRequestHost\n        ? {}\n        : {\n            origin: devOrigin,\n            hmr: {\n              protocol: devHmrProtocol,\n              host: devHost,\n              port: devPort,\n              clientPort: devHmrClientPort,\n            },\n          }),''',
    '''      ...(disableDevHmr\n        ? { hmr: false }\n        : inferRequestHost\n          ? {}\n          : {\n              origin: devOrigin,\n              hmr: {\n                protocol: devHmrProtocol,\n                host: devHost,\n                port: devPort,\n                clientPort: devHmrClientPort,\n              },\n            }),''',
    "vite disable HMR in stable mobile mode",
)

mobile_script = "scripts/start-mobile-dev.mjs"
replace_once(
    mobile_script,
    '      VITE_DEV_INFER_REQUEST_HOST: "true",\n',
    '      VITE_DEV_INFER_REQUEST_HOST: "true",\n      VITE_DEV_HMR: "false",\n',
    "mobile launcher disables HMR",
)
replace_once(
    mobile_script,
    'console.log("Backend phải đang chạy trên máy tính trước khi mở trang trên điện thoại.");\n',
    'console.log("Backend phải đang chạy trên máy tính trước khi mở trang trên điện thoại.");\nconsole.log("HMR đã tắt để camera native không làm tải lại trang khi quay về trình duyệt.");\n',
    "mobile launcher HMR notice",
)

vite_test = "vite.config.test.js"
replace_once(
    vite_test,
    '\n});\n',
    '''\n\n  it("disables HMR for the stable mobile camera profile", () => {\n    vi.stubEnv("VITE_DEV_HMR", "false");\n    vi.stubEnv("VITE_DEV_INFER_REQUEST_HOST", "true");\n\n    const config = createViteConfig({ mode: "test" });\n\n    expect(config.server.hmr).toBe(false);\n  });\n});\n''',
    "vite HMR regression test",
)

component_test = "src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx"
replace_once(
    component_test,
    'vi.mock("@/lib/apiBaseUrl", () => ({\n  toBackendRootUrl: (path) => `/api${path}`,\n}));\n',
    'vi.mock("@/lib/apiBaseUrl", () => ({\n  toBackendRootUrl: (path) => `/api${path}`,\n}));\n\nvi.mock("@/utils/aiTableCaptureDraft", () => ({\n  clearAiTableCaptureDraft: vi.fn().mockResolvedValue(undefined),\n  getTable3DBuilderSessionState: () => ({ open: false, mode: "parametric" }),\n  loadAiTableCaptureDraft: vi.fn().mockResolvedValue({\n    images: Array(5).fill(null),\n    metadata: Array(5).fill(null),\n  }),\n  processAiTableCapture: vi.fn(async (file) => ({\n    file,\n    metadata: { originalSize: file.size, outputSize: file.size },\n  })),\n  saveAiTableCaptureDraftSlot: vi.fn().mockResolvedValue(undefined),\n  setTable3DBuilderSessionState: vi.fn(),\n}));\n',
    "component test capture utility mock",
)
replace_once(
    component_test,
    '      expect(input).toHaveAttribute(\n        "accept",\n        "image/png,image/jpeg,image/webp",\n      );',
    '      expect(input).toHaveAttribute("accept", "image/*");',
    "component test accept attribute",
)
replace_once(
    component_test,
    '    expect(screen.getByText(/Đã chụp 5\/5 ảnh/i)).toBeInTheDocument();\n    expect(generateButton).toBeEnabled();',
    '    await waitFor(() => {\n      expect(screen.getByText(/Đã chụp 5\/5 ảnh/i)).toBeInTheDocument();\n      expect(generateButton).toBeEnabled();\n    });',
    "component test waits for processing",
)

print("mobile capture patch complete")
