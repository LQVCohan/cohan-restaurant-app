from base64 import b64decode
from gzip import decompress
from pathlib import Path

parts = sorted(Path("scripts/.schedule-ui-patch").glob("part-*.txt"))
if len(parts) != 8:
    raise RuntimeError(f"Expected 8 schedule patch parts, found {len(parts)}")

payload = "".join(part.read_text(encoding="utf-8").strip() for part in parts).encode("ascii")
source = decompress(b64decode(payload)).decode("utf-8")
exec(compile(source, "apply_schedule_ui_data_integrity", "exec"))

modal_path = Path(
    "src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.jsx"
)
modal_text = modal_path.read_text(encoding="utf-8")
old_get_cell_ui = '''function getCellUi(cell) {
  return CELL_UI[cell?.state] || {
    short: "—",
    label: cell?.label || "Không rõ",
    tone: cell?.className || "neutral",
  };
}'''
new_get_cell_ui = '''function getCellUi(cell) {
  const configured = CELL_UI[cell?.state];
  if (!configured) {
    return {
      short: "—",
      label: cell?.label || "Không rõ",
      tone: cell?.className || "neutral",
    };
  }

  return {
    ...configured,
    label: cell?.label || configured.label,
  };
}'''
if old_get_cell_ui not in modal_text:
    raise RuntimeError("getCellUi contract changed before the focused test fix")
modal_text = modal_text.replace(old_get_cell_ui, new_get_cell_ui, 1)
modal_text = modal_text.replace(
    'label: "Theo workingDays"',
    'label: "Theo lịch làm cố định"',
)
modal_path.write_text(modal_text, encoding="utf-8")

test_path = Path(
    "src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.test.jsx"
)
test_text = test_path.read_text(encoding="utf-8")
old_shift_test = '''  it("uses shiftTemplates array key and renders shift header", () => {
    renderModal();'''
new_shift_test = '''  it("uses shiftTemplates array key and renders shift header", () => {
    renderModal({
      staffList: [
        {
          id: "f1",
          fullName: "FT",
          employeeCode: "F1",
          employmentType: "full_time",
          workingDays: ["MON"],
        },
      ],
    });'''
if old_shift_test not in test_text:
    raise RuntimeError("Shift-header focused test changed before the test fix")
test_text = test_text.replace(old_shift_test, new_shift_test, 1)
test_text = test_text.replace(
    'getAllByTitle("Theo workingDays")',
    'getAllByTitle("Theo lịch làm cố định")',
)
test_path.write_text(test_text, encoding="utf-8")
