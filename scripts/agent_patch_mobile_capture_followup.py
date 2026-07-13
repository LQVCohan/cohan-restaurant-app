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


utility = "src/utils/aiTableCaptureDraft.js"
replace_once(
    utility,
    '''export const TABLE_3D_BUILDER_OPEN_SESSION_KEY =\n  "cohan:table-3d-builder:open";\nexport const TABLE_3D_BUILDER_MODE_SESSION_KEY =''',
    '''export const TABLE_3D_SIMULATOR_OPEN_SESSION_KEY =\n  "cohan:table-3d-simulator:open";\nexport const TABLE_3D_BUILDER_OPEN_SESSION_KEY =\n  "cohan:table-3d-builder:open";\nexport const TABLE_3D_BUILDER_MODE_SESSION_KEY =''',
    "simulator session key",
)
replace_once(
    utility,
    '''export const getTable3DBuilderSessionState = () => {\n  if (typeof window === "undefined") return { open: false, mode: "parametric" };\n  try {\n    return {\n      open: window.sessionStorage.getItem(TABLE_3D_BUILDER_OPEN_SESSION_KEY) === "1",\n      mode:\n        window.sessionStorage.getItem(TABLE_3D_BUILDER_MODE_SESSION_KEY) ||\n        "parametric",\n    };\n  } catch {\n    return { open: false, mode: "parametric" };\n  }\n};''',
    '''export const getTable3DBuilderSessionState = () => {\n  const fallback = { open: false, simulatorOpen: false, mode: "parametric" };\n  if (typeof window === "undefined") return fallback;\n  try {\n    return {\n      open: window.sessionStorage.getItem(TABLE_3D_BUILDER_OPEN_SESSION_KEY) === "1",\n      simulatorOpen:\n        window.sessionStorage.getItem(TABLE_3D_SIMULATOR_OPEN_SESSION_KEY) === "1",\n      mode:\n        window.sessionStorage.getItem(TABLE_3D_BUILDER_MODE_SESSION_KEY) ||\n        "parametric",\n    };\n  } catch {\n    return fallback;\n  }\n};''',
    "session state includes simulator",
)
replace_once(
    utility,
    '''export const setTable3DBuilderSessionState = ({ open, mode } = {}) => {\n  if (typeof window === "undefined") return;\n  try {\n    if (typeof open === "boolean") {\n      window.sessionStorage.setItem(\n        TABLE_3D_BUILDER_OPEN_SESSION_KEY,\n        open ? "1" : "0",\n      );\n    }\n    if (mode) {\n      window.sessionStorage.setItem(TABLE_3D_BUILDER_MODE_SESSION_KEY, mode);\n    }\n  } catch {\n    // Private browsing or strict storage policies may block sessionStorage.\n  }\n};''',
    '''export const setTable3DBuilderSessionState = ({\n  open,\n  simulatorOpen,\n  mode,\n} = {}) => {\n  if (typeof window === "undefined") return;\n  try {\n    if (typeof simulatorOpen === "boolean") {\n      window.sessionStorage.setItem(\n        TABLE_3D_SIMULATOR_OPEN_SESSION_KEY,\n        simulatorOpen ? "1" : "0",\n      );\n    }\n    if (typeof open === "boolean") {\n      window.sessionStorage.setItem(\n        TABLE_3D_BUILDER_OPEN_SESSION_KEY,\n        open ? "1" : "0",\n      );\n    }\n    if (mode) {\n      window.sessionStorage.setItem(TABLE_3D_BUILDER_MODE_SESSION_KEY, mode);\n    }\n  } catch {\n    // Private browsing or strict storage policies may block sessionStorage.\n  }\n};''',
    "set simulator session state",
)
replace_once(
    utility,
    '''export const clearTable3DBuilderSessionState = () => {\n  if (typeof window === "undefined") return;\n  try {\n    window.sessionStorage.removeItem(TABLE_3D_BUILDER_OPEN_SESSION_KEY);\n    window.sessionStorage.removeItem(TABLE_3D_BUILDER_MODE_SESSION_KEY);\n  } catch {\n    // Closing the builder must still work when storage is unavailable.\n  }\n};''',
    '''export const clearTable3DBuilderSessionState = ({\n  keepSimulator = false,\n} = {}) => {\n  if (typeof window === "undefined") return;\n  try {\n    if (!keepSimulator) {\n      window.sessionStorage.removeItem(TABLE_3D_SIMULATOR_OPEN_SESSION_KEY);\n    }\n    window.sessionStorage.removeItem(TABLE_3D_BUILDER_OPEN_SESSION_KEY);\n    window.sessionStorage.removeItem(TABLE_3D_BUILDER_MODE_SESSION_KEY);\n  } catch {\n    // Closing the builder must still work when storage is unavailable.\n  }\n};''',
    "clear builder while optionally keeping simulator",
)
replace_once(
    utility,
    '''const decodeImage = async (file) => {\n  if (typeof createImageBitmap === "function") {\n    const bitmap = await createImageBitmap(file, {\n      imageOrientation: "from-image",\n    });\n    return {\n      source: bitmap,\n      width: bitmap.width,\n      height: bitmap.height,\n      dispose: () => bitmap.close?.(),\n    };\n  }\n\n  const objectUrl = URL.createObjectURL(file);''',
    '''const decodeImage = async (file) => {\n  if (typeof createImageBitmap === "function") {\n    let bitmap = null;\n    try {\n      bitmap = await createImageBitmap(file, {\n        imageOrientation: "from-image",\n      });\n    } catch {\n      try {\n        bitmap = await createImageBitmap(file);\n      } catch {\n        bitmap = null;\n      }\n    }\n    if (bitmap) {\n      return {\n        source: bitmap,\n        width: bitmap.width,\n        height: bitmap.height,\n        dispose: () => bitmap.close?.(),\n      };\n    }\n  }\n\n  const objectUrl = URL.createObjectURL(file);''',
    "image bitmap fallback",
)

builder = "src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.jsx"
replace_once(
    builder,
    '''          const wasReloaded =\n            Boolean(document.wasDiscarded) ||\n            performance.getEntriesByType?.("navigation")?.[0]?.type === "reload";''',
    '''          const wasReloaded =\n            Boolean(document.wasDiscarded) ||\n            (typeof performance !== "undefined" &&\n              performance.getEntriesByType?.("navigation")?.[0]?.type ===\n                "reload");''',
    "safe navigation performance detection",
)

parent = "src/components/Dashboard_Manager/Table/Table3DSimulatorModalV2.jsx"
replace_once(
    parent,
    '    setTable3DBuilderSessionState({ open: true });',
    '    setTable3DBuilderSessionState({ open: true, simulatorOpen: true });',
    "builder open keeps simulator session",
)
replace_once(
    parent,
    '    clearTable3DBuilderSessionState();\n    setShowCustomBuilder(false);',
    '    clearTable3DBuilderSessionState({ keepSimulator: true });\n    setShowCustomBuilder(false);',
    "builder close keeps outer simulator",
)
replace_once(
    parent,
    '''  useEffect(() => {\n    const viewer = viewerRef.current;\n    if (!viewer || !selectedModel?.modelUrl) return undefined;''',
    '''  useEffect(() => {\n    if (showCustomBuilder) return undefined;\n    const viewer = viewerRef.current;\n    if (!viewer || !selectedModel?.modelUrl) return undefined;''',
    "viewer effect pauses while builder open",
)
replace_once(
    parent,
    '  }, [selectedModel?.key, selectedModel?.modelUrl]);',
    '  }, [selectedModel?.key, selectedModel?.modelUrl, showCustomBuilder]);',
    "viewer effect reattaches after builder close",
)
replace_once(
    parent,
    '''                  {selectedModel\n                    ? "Mẫu này chưa có mô hình 3D"\n                    : "Chưa chọn mẫu bàn"}''',
    '''                  {showCustomBuilder\n                    ? "Đã tạm dừng preview 3D"\n                    : selectedModel\n                      ? "Mẫu này chưa có mô hình 3D"\n                      : "Chưa chọn mẫu bàn"}''',
    "viewer paused placeholder title",
)
replace_once(
    parent,
    '''                  {selectedModel\n                    ? "Chọn mẫu có nhãn 3D hoặc dùng Tạo mẫu mới để nhập URL/upload file."\n                    : "Hãy chọn một mẫu trong thư viện để bắt đầu."}''',
    '''                  {showCustomBuilder\n                    ? "Đang giải phóng WebGL để camera trên điện thoại hoạt động ổn định hơn."\n                    : selectedModel\n                      ? "Chọn mẫu có nhãn 3D hoặc dùng Tạo mẫu mới để nhập URL/upload file."\n                      : "Hãy chọn một mẫu trong thư viện để bắt đầu."}''',
    "viewer paused placeholder description",
)

launcher = "src/components/Dashboard_Manager/Table/Table3DPreviewLauncher.jsx"
replace_once(
    launcher,
    'import { AuthContext } from "@/context/AuthContext";\n',
    'import { AuthContext } from "@/context/AuthContext";\nimport {\n  clearTable3DBuilderSessionState,\n  getTable3DBuilderSessionState,\n  setTable3DBuilderSessionState,\n} from "@/utils/aiTableCaptureDraft";\n',
    "launcher session imports",
)
replace_once(
    launcher,
    '  const [open, setOpen] = useState(false);',
    '  const [open, setOpen] = useState(\n    () => getTable3DBuilderSessionState().simulatorOpen,\n  );',
    "launcher restores simulator",
)
replace_once(
    launcher,
    '''    if (!isManagerRoute) {\n      setPortalTarget(null);\n      setOpen(false);\n      return undefined;\n    }''',
    '''    if (!isManagerRoute) {\n      setPortalTarget(null);\n      clearTable3DBuilderSessionState();\n      setOpen(false);\n      return undefined;\n    }''',
    "launcher clears session outside manager",
)
replace_once(
    launcher,
    '      setPortalTarget((current) => (current === nextTarget ? current : nextTarget));\n      if (!nextTarget) setOpen(false);',
    '      setPortalTarget((current) => (current === nextTarget ? current : nextTarget));',
    "launcher does not drop restored modal during DOM hydration",
)
replace_once(
    launcher,
    '  const selectedRestaurant = useMemo(',
    '''  const openPreview = () => {\n    setTable3DBuilderSessionState({ simulatorOpen: true });\n    setOpen(true);\n  };\n\n  const closePreview = () => {\n    clearTable3DBuilderSessionState();\n    setOpen(false);\n  };\n\n  const selectedRestaurant = useMemo(''',
    "launcher open close helpers",
)
replace_once(
    launcher,
    '            onClick={() => setOpen(true)}',
    '            onClick={openPreview}',
    "launcher open handler",
)
replace_once(
    launcher,
    '            onClose={() => setOpen(false)}',
    '            onClose={closePreview}',
    "launcher close handler",
)

component_test = "src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx"
replace_once(
    component_test,
    '  getTable3DBuilderSessionState: () => ({ open: false, mode: "parametric" }),',
    '  getTable3DBuilderSessionState: () => ({\n    open: false,\n    simulatorOpen: false,\n    mode: "parametric",\n  }),',
    "component test session shape",
)
replace_once(
    component_test,
    '''    const files = inputs.map((input, index) => {\n      const file = new File([`photo-${index + 1}`], `photo-${index + 1}.jpg`, {\n        type: "image/jpeg",\n      });\n      fireEvent.change(input, { target: { files: [file] } });\n      return file;\n    });\n\n    await waitFor(() => {\n      expect(screen.getByText(/Đã chụp 5\\/5 ảnh/i)).toBeInTheDocument();\n      expect(generateButton).toBeEnabled();\n    });''',
    '''    const files = [];\n    for (const [index, input] of inputs.entries()) {\n      const file = new File([`photo-${index + 1}`], `photo-${index + 1}.jpg`, {\n        type: "image/jpeg",\n      });\n      files.push(file);\n      fireEvent.change(input, { target: { files: [file] } });\n      await waitFor(() => {\n        expect(\n          screen.getByText(new RegExp(`Đã chụp ${index + 1}\\/5 ảnh`, "i")),\n        ).toBeInTheDocument();\n      });\n    }\n\n    expect(generateButton).toBeEnabled();''',
    "component test captures sequentially",
)

utility_test = "src/utils/aiTableCaptureDraft.test.js"
replace_once(
    utility_test,
    '    expect(getTable3DBuilderSessionState()).toEqual({ open: true, mode: "ai" });',
    '    expect(getTable3DBuilderSessionState()).toEqual({\n      open: true,\n      simulatorOpen: false,\n      mode: "ai",\n    });',
    "utility test expanded session state",
)
replace_once(
    utility_test,
    '''    expect(getTable3DBuilderSessionState()).toEqual({\n      open: false,\n      mode: "parametric",\n    });''',
    '''    expect(getTable3DBuilderSessionState()).toEqual({\n      open: false,\n      simulatorOpen: false,\n      mode: "parametric",\n    });''',
    "utility test cleared session shape",
)

launcher_test = "src/components/Dashboard_Manager/Table/Table3DPreviewLauncher.test.jsx"
replace_once(
    launcher_test,
    'import { describe, expect, it, vi } from "vitest";',
    'import { beforeEach, describe, expect, it, vi } from "vitest";',
    "launcher test beforeEach import",
)
replace_once(
    launcher_test,
    'describe("Table3DPreviewLauncher", () => {',
    'describe("Table3DPreviewLauncher", () => {\n  beforeEach(() => {\n    window.sessionStorage.clear();\n  });',
    "launcher test clears session",
)

print("mobile capture follow-up patch complete")
