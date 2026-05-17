# Schedule Management Business Audit

Date: 2026-05-15

Scope: Manager Schedule Management page and related schedule lifecycle flows.

## Current state

The Schedule UI has been polished and schedule-only CSS is now scoped through `src/styles/schedule-polish.css`. The main remaining value is in business-flow hardening: publish/reopen lifecycle, availability window consistency, automatic scheduling validation, and attendance/payroll handoff.

## Findings

### 1. Revision draft add-shift flow is inconsistent

Observed in `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`:

- `openAddShiftModal` allows creating a shift when lifecycle status is `draft` or `revision_draft`.
- `handleConfirmAddShift` also passes the initial guard for `draft` and `revision_draft`.
- Later inside the same function it blocks unless `scheduleLifecycleStatus === "draft"` before calling `createShift`.

Impact:

A schedule that has been reopened for editing can open the Add Shift modal, but confirm may fail with `Không thể thêm nhân viên vào lịch ở trạng thái hiện tại.` This is confusing and breaks the intended reopened-schedule workflow.

Recommended fix:

Allow `revision_draft` in the final mutation branch as well.

Expected patch:

```diff
- if (scheduleLifecycleStatus !== "draft") {
+ if (!["draft", "revision_draft"].includes(scheduleLifecycleStatus)) {
    throw new Error(
      "Không thể thêm nhân viên vào lịch ở trạng thái hiện tại.",
    );
  }
```

After successful create in `revision_draft`, keep the current notification copy: `Đã cập nhật bản chỉnh sửa với ... phân công mới.`

### 2. Publish risk summary does not use acknowledgement summary yet

Observed:

`schedulePublishRiskSummary` currently sets:

```js
const pendingAcknowledgements = 0;
```

Impact:

Publish confirmation/risk view cannot surface employees who have not acknowledged or shifts changed after acknowledgement, even though `GET_SCHEDULE_ACK_SUMMARY` exists.

Recommended follow-up:

Wire `ackSummaryData.scheduleAcknowledgementSummary` into the publish risk summary:

- pending acknowledgements
- changed-after-acknowledgement count
- total assigned staff

This should affect warning text only, not block publishing unless product policy requires it.

### 3. Availability next-week reminder uses a placeholder

Observed:

```js
const managerNextWeekWindow = null;
const shouldRemindNextWeekRegistration = !isSunday && !managerNextWeekWindow?.id;
```

Impact:

The system may always think the next-week registration window is missing. This can create noisy reminders.

Recommended follow-up:

Derive `managerNextWeekWindow` from `managerAvailabilityWindowsData.availabilityWindows` using `nextWeekStart` and `nextWeekEnd`.

### 4. Schedule query fetch policy is still network-heavy

Many schedule queries use `network-only`. A scoped Apollo patch exists for Schedule, but the component still declares network-only policies directly.

Impact:

The page depends on perceived-loading masks and may still feel like it rebuilds on reload/change-week.

Recommended follow-up:

For non-critical read queries, prefer `cache-and-network` plus `nextFetchPolicy: cache-first`, but do this gradually and test carefully.

### 5. Browser-native confirm/prompt remains in business-critical flows

Examples:

- opening/closing availability windows
- overriding assignment warnings

Impact:

Native dialogs are functional but feel less production-grade and cannot be styled or logged uniformly.

Recommended follow-up:

Replace only the most important native prompts with existing modal patterns:

- close availability window confirmation
- shift assignment override reason
- reopen schedule reason already has a modal and can remain.

## Manual QA checklist

After each schedule lifecycle change, test:

1. Draft week with no shifts.
2. Draft week with multiple shifts.
3. Publish week with warnings.
4. Published week, reopen to revision draft.
5. Revision draft add new shift.
6. Revision draft add staff to existing shift.
7. Revision draft republish.
8. Active/locked/closed week read-only behavior.
9. Availability window create/open/close.
10. Auto schedule preview and apply with warnings.
11. Shift detail: add staff, remove staff, change time, delete group.
12. Attendance/payroll navigation into Schedule with `focus` query.

## Safe next code change

The safest immediate bug fix is finding #1: allow `revision_draft` in the final add-shift mutation guard.

Avoid large JSX rewrites in `AvailabilityRegistrationPanel.jsx` and avoid root layout performance hacks.
