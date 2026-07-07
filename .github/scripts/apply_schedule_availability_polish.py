from pathlib import Path


def replace_once(path, old, new, label):
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    matches = text.count(old)
    print(f"{label}: {matches} match(es)")
    if matches != 1:
        raise SystemExit(f"Expected one match for {label}, found {matches}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


jsx = "src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.jsx"
scss = "src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.scss"
test = "src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.test.jsx"
sage = "src/styles/schedule-manager-sage-upgrade.css"
workflow = ".github/workflows/apply-schedule-availability-polish.yml"
script = ".github/scripts/apply_schedule_availability_polish.py"

replace_once(
    jsx,
    '<div className="availability-snapshot-modal-overlay" role="dialog" aria-modal="true">',
    '<div className="availability-snapshot-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="availability-snapshot-title">',
    "label modal dialog",
)

replace_once(
    jsx,
    '''            <span className="eyebrow">Availability matrix</span>
            <h3>Availability đã chốt</h3>
            <p>
              Tuần {format(new Date(weekStart), "dd/MM/yyyy")} -{" "}
              {format(new Date(weekEnd), "dd/MM/yyyy")}. Dữ liệu này là nguồn
              chính thức dùng để xếp lịch.
            </p>''',
    '''            <span className="eyebrow">LỊCH RẢNH NHÂN VIÊN</span>
            <h3 id="availability-snapshot-title">Lịch rảnh đã đăng ký</h3>
            <p>
              Tuần {format(new Date(weekStart), "dd/MM/yyyy")} -{" "}
              {format(new Date(weekEnd), "dd/MM/yyyy")}. Kiểm tra dữ liệu trước
              khi xếp và công bố lịch làm việc.
            </p>''',
    "localize modal heading",
)

replace_once(
    jsx,
    '<option value="all">Tất cả loại HĐ</option>',
    '<option value="all">Tất cả loại hợp đồng</option>',
    "expand employment filter label",
)
replace_once(
    jsx,
    '<option value="all">Tất cả role/phòng</option>',
    '<option value="all">Tất cả vai trò / phòng ban</option>',
    "localize role filter label",
)
replace_once(
    jsx,
    '            Chỉ thiếu availability',
    '            Chỉ hiện nhân viên thiếu đăng ký',
    "localize missing filter label",
)

replace_once(
    jsx,
    '''        {!hasWindow ? (
          <div className="availability-empty-state">
            Chưa có kỳ availability đã chốt cho tuần này.
          </div>
        ) : null}''',
    '''        {!hasWindow ? (
          <div className="availability-window-note" role="status">
            <strong>Tuần này chưa có kỳ đăng ký đã chốt.</strong>
            <span>
              Bảng dưới vẫn hiển thị lịch làm cố định của nhân viên toàn thời gian
              và đánh dấu các trường hợp chưa đăng ký.
            </span>
          </div>
        ) : null}''',
    "replace blocking no-window state",
)

replace_once(
    jsx,
    'Không thể tải availability đã chốt: {error.message || String(error)}',
    'Không thể tải lịch rảnh đã đăng ký: {error.message || String(error)}',
    "localize error copy",
)

replace_once(
    jsx,
    '''        {hasWindow ? (
          <div className="availability-table-shell">''',
    '''        {!loading && !error && (rows.length > 0 || hasWindow) ? (
          <div className="availability-table-shell">''',
    "render matrix without matching window",
)

replace_once(
    jsx,
    '''              <tbody>
                {filteredRows.map(''',
    '''              <tbody>
                {!filteredRows.length ? (
                  <tr>
                    <td
                      className="availability-filter-empty"
                      colSpan={1 + days.length * shiftTypes.length}
                    >
                      Không có nhân viên phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : null}
                {filteredRows.map(''',
    "add filtered empty row",
)

replace_once(
    scss,
    '''.availability-snapshot-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.2rem;
  background: rgba(15, 23, 42, 0.5);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}''',
    '''.availability-snapshot-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  padding: clamp(0.75rem, 2.5vh, 1.5rem);
  background: rgba(28, 45, 37, 0.26);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  overscroll-behavior: contain;
}''',
    "lighten scrollable overlay",
)

replace_once(
    scss,
    '''.availability-snapshot-modal {
  width: min(1320px, 96vw);
  max-height: 90vh;
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: #ffffff;
  box-shadow: 0 34px 90px rgba(15, 23, 42, 0.28);
  display: flex;
  flex-direction: column;
}''',
    '''.availability-snapshot-modal {
  width: min(1480px, calc(100vw - 1.5rem));
  max-height: calc(100dvh - 1.5rem);
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 22px;
  border: 1px solid rgba(79, 108, 94, 0.24);
  background: #fbfdfc;
  box-shadow: 0 28px 72px rgba(24, 42, 33, 0.24);
  display: flex;
  flex-direction: column;
  overscroll-behavior: contain;
}''',
    "make modal complete and scrollable",
)

replace_once(
    scss,
    '''.availability-snapshot-header {
  padding: 1.15rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);''',
    '''.availability-snapshot-header {
  position: sticky;
  top: 0;
  z-index: 12;
  padding: 1.15rem 1.25rem;
  border-bottom: 1px solid rgba(79, 108, 94, 0.18);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(239, 245, 241, 0.98) 100%);''',
    "keep modal header visible",
)

replace_once(
    scss,
    '''.availability-empty-state,
.availability-error-state,
.availability-loading-state {
  margin: 1rem 1.25rem;
  border-radius: 16px;
  padding: 1rem;
  font-weight: 750;
}

.availability-empty-state,
.availability-loading-state {
  background: #f8fafc;
  color: #64748b;
  border: 1px dashed #cbd5e1;
}''',
    '''.availability-window-note,
.availability-error-state,
.availability-loading-state {
  margin: 0.85rem 1.25rem 0;
  border-radius: 14px;
  padding: 0.78rem 0.9rem;
  font-weight: 700;
}

.availability-window-note {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  background: #edf4f0;
  color: #40584d;
  border: 1px solid rgba(79, 108, 94, 0.22);
  font-size: 0.8rem;
  line-height: 1.45;
}

.availability-window-note strong {
  flex: 0 0 auto;
}

.availability-loading-state {
  background: #f8fafc;
  color: #64748b;
  border: 1px dashed #cbd5e1;
}''',
    "style informational no-window state",
)

replace_once(
    scss,
    '  max-height: min(58vh, 620px);',
    '  max-height: min(60dvh, 680px);',
    "use dynamic table viewport",
)

replace_once(
    scss,
    '''.employee-cell {
  strong {''',
    '''.availability-filter-empty {
  padding: 2.2rem 1rem !important;
  color: #64748b;
  background: #f8fafc;
  font-weight: 750;
  text-align: center !important;
}

.employee-cell {
  strong {''',
    "style filter empty row",
)

replace_once(
    scss,
    '''@media (max-width: 620px) {
  .availability-snapshot-header {
    flex-direction: column;
  }''',
    '''@media (max-width: 620px) {
  .availability-snapshot-modal-overlay {
    padding: 0.5rem;
  }

  .availability-snapshot-modal {
    width: calc(100vw - 1rem);
    max-height: calc(100dvh - 1rem);
    border-radius: 16px;
  }

  .availability-snapshot-header {
    flex-direction: column;
  }''',
    "complete mobile modal sizing",
)

sage_text = Path(sage).read_text(encoding="utf-8")
marker = "/* Schedule action emphasis: important controls remain distinct after legacy overrides. */"
if marker in sage_text:
    raise SystemExit("Schedule action emphasis already applied")

sage_text += '''

/* Schedule action emphasis: important controls remain distinct after legacy overrides. */
.manager-page-shell--schedules .schedule-container.schedule-container .header-actions .primary-action {
  border-color: var(--schedule-primary) !important;
  background: var(--schedule-primary) !important;
  color: #ffffff !important;
  box-shadow: 0 9px 20px rgba(61, 87, 75, 0.18) !important;
}

.manager-page-shell--schedules .schedule-container.schedule-container .header-actions .primary-action:hover:not(:disabled) {
  border-color: var(--schedule-primary-hover) !important;
  background: var(--schedule-primary-hover) !important;
}

.manager-page-shell--schedules .schedule-container.schedule-container .header-actions .secondary-action:not(.schedule-header-auto-action-duplicate) {
  border-color: rgba(79, 108, 94, 0.28) !important;
  background: #e8f0ec !important;
  color: var(--schedule-primary-hover) !important;
}

.manager-page-shell--schedules .schedule-container.schedule-container .toolbar-group--actions .btn-availability-snapshot.schedule-toolbar-utility-action {
  border-color: rgba(47, 125, 104, 0.3) !important;
  background: #e5f2ec !important;
  color: #2f6f5e !important;
  box-shadow: 0 7px 16px rgba(47, 125, 104, 0.1) !important;
}

.manager-page-shell--schedules .schedule-container.schedule-container .toolbar-group--actions .btn-availability-snapshot.schedule-toolbar-utility-action:hover:not(:disabled) {
  border-color: rgba(47, 125, 104, 0.45) !important;
  background: #d8ebe2 !important;
}

.manager-page-shell--schedules .schedule-container.schedule-container .toolbar-group--actions .btn-auto-schedule.schedule-toolbar-assist-action {
  border-color: #3f7563 !important;
  background: #3f7563 !important;
  color: #ffffff !important;
  box-shadow: 0 9px 20px rgba(47, 101, 82, 0.17) !important;
}

.manager-page-shell--schedules .schedule-container.schedule-container .toolbar-group--actions .btn-auto-schedule.schedule-toolbar-assist-action:hover:not(:disabled) {
  border-color: #315f50 !important;
  background: #315f50 !important;
  color: #ffffff !important;
}
'''
Path(sage).write_text(sage_text, encoding="utf-8")

replace_once(
    test,
    'expect(screen.getByText("Availability đã chốt")).toBeInTheDocument();',
    'expect(screen.getByText("Lịch rảnh đã đăng ký")).toBeInTheDocument();',
    "update modal title assertion",
)

insert_after = '''  it("matches availability window by date key even with different periodEnd timestamp/timezone", () => {
'''
new_test = '''  it("shows the staff matrix when no finalized availability window exists", () => {
    renderModal({
      availabilityWindows: [],
      staffList: [
        {
          id: "f1",
          fullName: "Nhân viên toàn thời gian",
          employeeCode: "FT01",
          employmentType: "full_time",
          workingDays: ["MON"],
        },
      ],
    });

    expect(screen.getByText("Tuần này chưa có kỳ đăng ký đã chốt.")).toBeInTheDocument();
    expect(screen.getByText("Nhân viên toàn thời gian")).toBeInTheDocument();
    expect(screen.getAllByTitle("Theo workingDays").length).toBeGreaterThan(0);
  });

'''
replace_once(test, insert_after, new_test + insert_after, "add no-window matrix regression")

for helper in (workflow, script):
    Path(helper).unlink(missing_ok=True)
