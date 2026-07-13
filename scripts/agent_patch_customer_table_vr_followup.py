from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    '  const { search } = useLocation();\n',
    '  const location = useLocation();\n  const { search } = location;\n',
)

replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    '''  const navigateBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(returnTo || "/", { replace: true });
  };
''',
    '''  const navigateBack = () => {
    if (location.key !== "default" || window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(returnTo || "/", { replace: true });
  };
''',
)

replace_once(
    "src/components/Customer/TableBooking/TableBooking.jsx",
    '''  const selectedTableVrUrl = (() => {
    const configuredUrl = String(selectedTable?.vrUrl || "").trim();
    if (configuredUrl) return configuredUrl;
    if (!selectedTable?.id || !loadTableVrImage(selectedTable.id)) return "";
    return `/vr/table/${encodeURIComponent(selectedTable.id)}`;
  })();
''',
    '''  const selectedTableVrUrl = (() => {
    const configuredUrl = String(selectedTable?.vrUrl || "").trim();
    const storedImage = selectedTable?.id
      ? loadTableVrImage(selectedTable.id)
      : null;
    const isInternalViewer = configuredUrl.startsWith("/vr/table/");

    if (configuredUrl && (!isInternalViewer || storedImage)) return configuredUrl;
    if (!selectedTable?.id || !storedImage) return "";
    return `/vr/table/${encodeURIComponent(selectedTable.id)}`;
  })();
''',
)
