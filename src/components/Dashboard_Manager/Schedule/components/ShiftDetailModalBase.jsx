import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import "./ShiftDetailModal.scss";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Search,
  Trash2,
  UserMinus,
  Users,
  X,
  Edit3,
} from "lucide-react";
import {
  shiftTypes,
  formatDate,
  getDayName,
  jobOptions,
  getJobName,
  normalizeRoleKey,
  resolveConcreteStaffRoleSlug,
} from "../utils/scheduleHelpers";
const getInitials = (name) =>
  String(name || "NV")
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "NV";

const formatLogDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTimeOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getScheduleLogLabel = (verb) => {
  const map = {
    "schedule.publish": "Công bố lịch",
    "schedule.published_shift_time_change": "Đổi giờ ca đã công bố",
    "schedule.published_shift_add_employee": "Thêm nhân viên vào ca đã công bố",
    "schedule.published_shift_remove_employee":
      "Gỡ nhân viên khỏi ca đã công bố",
    "schedule.shift_remove_employee": "Gỡ nhân viên khỏi ca",
    "schedule.published_shift_group_delete": "Xóa ca đã công bố",
    "schedule.lock": "Khóa lịch",
    "schedule.close": "Đóng lịch",
    "schedule.reopen": "Mở lại lịch để chỉnh sửa",
    "schedule.republish": "Công bố lại lịch",
  };

  return map[verb] || verb || "Thay đổi lịch";
};

const getScheduleLogTone = (verb) => {
  if (verb === "schedule.publish") return "info";
  if (verb?.includes("delete") || verb?.includes("remove")) return "danger";
  if (verb?.includes("time_change")) return "warning";
  if (verb?.includes("add_employee")) return "success";
  return "info";
};
const ShiftDetailModal = ({
  isOpen,
  onClose,
  shift,
  staffList,
  readOnly = false,
  onRemoveStaff,
  onAddStaff,
  onAddStaffBatch,
  onDeleteShift,
  onUpdateNotes,
  isSchedulePublished = false,
  isChangingShiftTime = false,
  onChangeShiftGroupTime,
  shiftConfig = shiftTypes,

  isAddingPublishedStaff = false,
  isDeletingPublishedShiftGroup = false,
  scheduleChangeLogs = [],
  scheduleChangeLogsLoading = false,
  scheduleLifecycleStatus = "draft",
  schedulePermissions = null,
}) => {
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [candidateRoleFilter, setCandidateRoleFilter] = useState("all");
  const [noteDraft, setNoteDraft] = useState("");
  const [timeChangeOpen, setTimeChangeOpen] = useState(false);
  const [timeChangeDraft, setTimeChangeDraft] = useState({
    startTime: "",
    endTime: "",
    reason: "",
    notifyEmployees: true,
    allowOverride: false,
    overrideReason: "",
  });
  const [timeChangeError, setTimeChangeError] = useState("");
  const [isSubmittingTimeChange, setIsSubmittingTimeChange] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeMode, setRemoveMode] = useState("remove_staff");
  const [removeError, setRemoveError] = useState("");
  const [addConfirm, setAddConfirm] = useState(null);
  const [addReason, setAddReason] = useState("");
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [addStaffError, setAddStaffError] = useState("");
  const [pendingAddStaffIds, setPendingAddStaffIds] = useState([]);
  const [saveChangesError, setSaveChangesError] = useState("");
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [deleteGroupReason, setDeleteGroupReason] = useState("");
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [isChangeHistoryExpanded, setIsChangeHistoryExpanded] =
    useState(false);
  const [isRemovingStaff, setIsRemovingStaff] = useState(false);
  const effectivePermissions = schedulePermissions || {
    canChangeShiftTime: scheduleLifecycleStatus === "published",
    canAddStaffToShift:
      scheduleLifecycleStatus === "draft" ||
      scheduleLifecycleStatus === "published",
    canRemoveStaffFromShift:
      scheduleLifecycleStatus === "draft" ||
      scheduleLifecycleStatus === "published",
    canDeleteShiftGroup:
      scheduleLifecycleStatus === "draft" ||
      scheduleLifecycleStatus === "published",
    isReadOnly: ["active", "locked", "closed"].includes(
      scheduleLifecycleStatus,
    ),
  };
  const modalReadOnly = readOnly || effectivePermissions.isReadOnly;
  const requiresChangeReason = Boolean(
    effectivePermissions.requiresChangeReason,
  );
  const shouldNotifyEmployees = Boolean(
    effectivePermissions.requiresEmployeeNotification,
  );
  const shiftStaffIds = useMemo(() => shift?.staffIds || [], [shift?.staffIds]);
  const effectiveShiftStaffIds = useMemo(() => {
    const currentIds = (shiftStaffIds || []).map((item) => String(item));
    const pendingIds = (pendingAddStaffIds || []).map((item) => String(item));

    return Array.from(new Set([...currentIds, ...pendingIds]));
  }, [shiftStaffIds, pendingAddStaffIds]);
  const assignedStaff = useMemo(() => {
    const staffById = new Map(
      (staffList || []).map((person) => [String(person.id), person]),
    );

    return effectiveShiftStaffIds
      .map((staffId) => staffById.get(String(staffId)))
      .filter(Boolean);
  }, [effectiveShiftStaffIds, staffList]);
  const unresolvedAssignedStaffCount = Math.max(
    0,
    effectiveShiftStaffIds.length - assignedStaff.length,
  );

  const hasPendingAdds = pendingAddStaffIds.length > 0;
  const hasNoteChanged = noteDraft !== (shift?.notes || "");
  const hasPendingChanges = hasPendingAdds || hasNoteChanged;
  const hasUnsavedShiftDetailChanges = useMemo(() => {
    const noteChanged = noteDraft !== (shift?.notes || "");
    const hasPendingStaffAdds = pendingAddStaffIds.length > 0;

    const timeDraftChanged =
      timeChangeOpen &&
      (timeChangeDraft.startTime !== (shift?.startTime || "") ||
        timeChangeDraft.endTime !== (shift?.endTime || "") ||
        Boolean(timeChangeDraft.reason?.trim()) ||
        timeChangeDraft.allowOverride ||
        Boolean(timeChangeDraft.overrideReason?.trim()));

    const removeDraftChanged =
      Boolean(removeConfirm) && Boolean(removeReason.trim());
    const addDraftChanged = Boolean(addConfirm) && Boolean(addReason.trim());
    const deleteDraftChanged =
      deleteGroupOpen && Boolean(deleteGroupReason.trim());

    return (
      noteChanged ||
      hasPendingStaffAdds ||
      timeDraftChanged ||
      removeDraftChanged ||
      addDraftChanged ||
      deleteDraftChanged
    );
  }, [
    noteDraft,
    shift?.notes,
    shift?.startTime,
    shift?.endTime,
    pendingAddStaffIds.length,
    timeChangeOpen,
    timeChangeDraft,
    removeConfirm,
    removeReason,
    addConfirm,
    addReason,
    deleteGroupOpen,
    deleteGroupReason,
  ]);
  const shiftEssentialJobs = useMemo(
    () => shift?.essentialJobs || [],
    [shift?.essentialJobs],
  );
  const shiftRequiredRoleKeys = useMemo(
    () =>
      Array.from(
        new Set(
          (shiftEssentialJobs || [])
            .map((role) => normalizeRoleKey(role))
            .filter(Boolean),
        ),
      ),
    [shiftEssentialJobs],
  );

  const getStaffRoleInfo = (staff) => {
    const roleSlug = normalizeRoleKey(
      resolveConcreteStaffRoleSlug(staff) || staff?.roleSlug || staff?.job,
    );

    const roleLabel = roleSlug ? getJobName(roleSlug) : "Chưa xác định vị trí";
    const matched =
      shiftRequiredRoleKeys.length === 0 ||
      (roleSlug && shiftRequiredRoleKeys.includes(roleSlug));

    return {
      roleSlug,
      roleLabel,
      matched,
    };
  };

  const getStaffRoleLine = (staff, roleLabel) => {
    const departmentLabel = staff?.departmentLabel || "Khác";

    if (!departmentLabel || departmentLabel === roleLabel) {
      return roleLabel;
    }

    return `${roleLabel} · ${departmentLabel}`;
  };
  const availableStaff = useMemo(() => {
    if (!shift || readOnly) return [];

    const currentStaffSet = new Set(
      (effectiveShiftStaffIds || []).map((item) => String(item)),
    );
    const normalizedSearch = search.trim().toLowerCase();
    const normalizedJobFilter = normalizeRoleKey(jobFilter);

    return staffList.filter((staff) => {
      const notInShift = !currentStaffSet.has(String(staff.id));
      if (!notInShift) return false;

      const roleInfo = getStaffRoleInfo(staff);

      if (normalizedJobFilter && roleInfo.roleSlug !== normalizedJobFilter) {
        return false;
      }

      if (candidateRoleFilter === "matched" && !roleInfo.matched) {
        return false;
      }

      if (candidateRoleFilter === "mismatch" && roleInfo.matched) {
        return false;
      }

      if (!normalizedSearch) return true;

      const searchableText = [
        staff.name,
        staff.employeeCode,
        staff.departmentLabel,
        staff.positionTitle,
        staff.roleName,
        roleInfo.roleLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [
    effectiveShiftStaffIds,
    jobFilter,
    candidateRoleFilter,
    readOnly,
    search,
    shift,
    staffList,
    shiftRequiredRoleKeys,
  ]);
  useEffect(() => {
    setNoteDraft(shift?.notes || "");
    setSearch("");
    setJobFilter("");
    setCandidateRoleFilter("all");
    setTimeChangeOpen(false);
    setTimeChangeDraft({
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      reason: "",
      notifyEmployees: true,
      allowOverride: false,
      overrideReason: "",
    });
    setTimeChangeError("");
    setIsSubmittingTimeChange(false);
    setIsSavingNotes(false);
    setRemoveConfirm(null);
    setRemoveReason("");
    setRemoveMode("remove_staff");
    setRemoveError("");
    setIsRemovingStaff(false);
    setAddConfirm(null);
    setAddReason("");
    setIsAddingStaff(false);
    setAddStaffError("");
    setPendingAddStaffIds([]);
    setSaveChangesError("");
    setIsSavingChanges(false);
    setDeleteGroupOpen(false);
    setDeleteGroupReason("");
    setIsDeletingGroup(false);
    setCloseConfirmOpen(false);
    setIsChangeHistoryExpanded(false);
  }, [shift]);

  if (!isOpen || !shift) return null;

  const currentShiftType =
    shiftConfig[shift.shiftType] || shiftTypes[shift.shiftType];
  const requiredStaffCount = Math.max(shiftRequiredRoleKeys.length, 1);
  const missingCount = Math.max(
    0,
    requiredStaffCount - assignedStaff.length,
  );
  const isComplete =
    missingCount === 0 && unresolvedAssignedStaffCount === 0;
  const coverageStatusLabel =
    missingCount > 0
      ? `Thiếu ${missingCount} người`
      : unresolvedAssignedStaffCount > 0
        ? `Cần kiểm tra ${unresolvedAssignedStaffCount} phân công`
        : "Đủ nhân sự";
  const getBatchSaveErrorText = (result) => {
    if (result?.errorText) return result.errorText;

    const errors = Array.isArray(result?.errors) ? result.errors : [];
    if (errors.length > 0) {
      const firstError =
        errors[0]?.message || "Một số nhân viên chưa lưu được.";
      if (errors.length === 1) return firstError;
      return `${firstError} Và còn ${errors.length - 1} lỗi khác.`;
    }

    return "Một số nhân viên chưa lưu được. Vui lòng kiểm tra lại.";
  };

  const getSaveChangesLabel = () => {
    if (isSavingChanges) return "Đang lưu thay đổi...";

    if (pendingAddStaffIds.length > 0 && hasNoteChanged) {
      return "Lưu thay đổi";
    }

    if (pendingAddStaffIds.length > 0) {
      return `Lưu ${pendingAddStaffIds.length} nhân viên`;
    }

    return "Lưu thay đổi";
  };
  const handleSaveChanges = async () => {
    if (modalReadOnly || isSavingChanges) return;

    const shouldSaveNotes = noteDraft !== (shift?.notes || "");
    const staffIdsToAdd = Array.from(
      new Set((pendingAddStaffIds || []).map((item) => String(item))),
    );

    if (!shouldSaveNotes && staffIdsToAdd.length === 0) {
      return;
    }

    if (shouldSaveNotes && !onUpdateNotes) {
      setSaveChangesError("Không thể lưu ghi chú ca ở trạng thái hiện tại.");
      return;
    }

    if (staffIdsToAdd.length > 0 && !onAddStaffBatch && !onAddStaff) {
      setSaveChangesError(
        "Không thể thêm nhân viên vào ca ở trạng thái hiện tại.",
      );
      return;
    }

    setSaveChangesError("");
    setAddStaffError("");
    setIsSavingChanges(true);
    setIsSavingNotes(shouldSaveNotes);

    try {
      if (shouldSaveNotes) {
        await onUpdateNotes(noteDraft);
      }

      if (staffIdsToAdd.length > 0) {
        if (onAddStaffBatch) {
          const result = await onAddStaffBatch(shift.id, staffIdsToAdd);

          const errors = Array.isArray(result?.errors) ? result.errors : [];
          const failedCount = Number(result?.failedCount || errors.length || 0);

          if (failedCount > 0 || errors.length > 0) {
            const failedIdSet = new Set(
              errors
                .map((error) => String(error?.employeeId || ""))
                .filter(Boolean),
            );

            if (failedIdSet.size > 0) {
              setPendingAddStaffIds((prev) =>
                (prev || []).filter((staffId) =>
                  failedIdSet.has(String(staffId)),
                ),
              );
            }

            setSaveChangesError(getBatchSaveErrorText(result));
            return;
          }

          setPendingAddStaffIds([]);
        } else {
          const failedIds = [];

          for (const staffId of staffIdsToAdd) {
            try {
              await onAddStaff(shift.id, staffId);
            } catch (error) {
              failedIds.push(String(staffId));
              setSaveChangesError(
                error?.message || "Không thể lưu một số nhân viên vào ca.",
              );
              break;
            }
          }

          if (failedIds.length > 0) {
            const failedIdSet = new Set(failedIds);
            setPendingAddStaffIds((prev) =>
              (prev || []).filter((staffId) =>
                failedIdSet.has(String(staffId)),
              ),
            );
            return;
          }

          setPendingAddStaffIds([]);
        }
      }
    } catch (error) {
      setSaveChangesError(error?.message || "Không thể lưu thay đổi ca.");
    } finally {
      setIsSavingChanges(false);
      setIsSavingNotes(false);
    }
  };
  const openRemoveConfirm = (person) => {
    if (
      modalReadOnly ||
      !effectivePermissions.canRemoveStaffFromShift ||
      !onRemoveStaff
    ) {
      return;
    }
    const isLastStaffInShift = shiftStaffIds.length === 1;
    setRemoveConfirm(person);
    setRemoveReason("");
    setRemoveMode(isLastStaffInShift ? "delete_shift_group" : "remove_staff");
    setRemoveError("");
  };

  const closeRemoveConfirm = () => {
    if (isRemovingStaff) return;
    setRemoveConfirm(null);
    setRemoveReason("");
    setRemoveMode("remove_staff");
    setRemoveError("");
  };

  const handleConfirmRemoveStaff = async () => {
    if (
      !removeConfirm ||
      modalReadOnly ||
      !effectivePermissions.canRemoveStaffFromShift
    )
      return;

    if (!removeReason.trim()) {
      return;
    }
    const isLastStaffInShift = shiftStaffIds.length === 1;

    setIsRemovingStaff(true);

    try {
      if (isLastStaffInShift && removeMode === "delete_shift_group") {
        if (!onDeleteShift || !effectivePermissions.canDeleteShiftGroup) {
          throw new Error("Không thể xóa ca ở trạng thái lịch hiện tại.");
        }
        await onDeleteShift(shift.id, {
          reason: removeReason.trim(),
          notifyEmployees: isSchedulePublished,
        });
      } else {
        if (!onRemoveStaff) {
          throw new Error("Không thể xóa nhân viên khỏi ca.");
        }
        await onRemoveStaff(shift.id, removeConfirm.id, {
          reason: removeReason.trim(),
          notifyEmployee: true,
        });
      }

      setRemoveConfirm(null);
      setRemoveReason("");
      setRemoveMode("remove_staff");
      setRemoveError("");
    } catch (error) {
      setRemoveError(error?.message || "Không thể xóa nhân viên khỏi ca.");
    } finally {
      setIsRemovingStaff(false);
    }
  };
  const openTimeChangeModal = () => {
    if (
      modalReadOnly ||
      !onChangeShiftGroupTime ||
      !effectivePermissions.canChangeShiftTime
    )
      return;

    setTimeChangeDraft({
      startTime: shift?.startTime || "",
      endTime: shift?.endTime || "",
      reason: "",
      notifyEmployees: true,
      allowOverride: false,
      overrideReason: "",
    });
    setTimeChangeError("");
    setTimeChangeOpen(true);
  };

  const closeTimeChangeModal = () => {
    if (isSubmittingTimeChange || isChangingShiftTime) return;
    setTimeChangeOpen(false);
    setTimeChangeError("");
  };

  const handleConfirmTimeChange = async () => {
    if (
      modalReadOnly ||
      !onChangeShiftGroupTime ||
      !effectivePermissions.canChangeShiftTime
    )
      return;

    if (!timeChangeDraft.startTime || !timeChangeDraft.endTime) {
      setTimeChangeError("Cần nhập đủ giờ bắt đầu và giờ kết thúc.");
      return;
    }

    if (timeChangeDraft.startTime === timeChangeDraft.endTime) {
      setTimeChangeError("Giờ kết thúc phải khác giờ bắt đầu.");
      return;
    }

    if (!timeChangeDraft.reason.trim()) {
      setTimeChangeError("Cần nhập lý do thay đổi giờ ca.");
      return;
    }

    if (
      timeChangeDraft.allowOverride &&
      !timeChangeDraft.overrideReason.trim()
    ) {
      setTimeChangeError("Cần nhập lý do override policy.");
      return;
    }

    setTimeChangeError("");
    setIsSubmittingTimeChange(true);

    try {
      await onChangeShiftGroupTime(shift, {
        startTime: timeChangeDraft.startTime,
        endTime: timeChangeDraft.endTime,
        reason: timeChangeDraft.reason.trim(),
        notifyEmployees: timeChangeDraft.notifyEmployees,
        allowOverride: timeChangeDraft.allowOverride,
        overrideReason: timeChangeDraft.overrideReason.trim(),
      });

      setTimeChangeOpen(false);
    } catch (error) {
      setTimeChangeError(error?.message || "Không thể đổi giờ ca.");
    } finally {
      setIsSubmittingTimeChange(false);
    }
  };
  const handleAddCandidate = (person) => {
    if (
      modalReadOnly ||
      !effectivePermissions.canAddStaffToShift ||
      isAddingStaff ||
      isAddingPublishedStaff ||
      isSavingChanges
    ) {
      return;
    }

    setAddStaffError("");
    setSaveChangesError("");

    if (isSchedulePublished) {
      if (!onAddStaff) {
        setAddStaffError(
          "Không thể thêm nhân viên vào ca ở trạng thái hiện tại.",
        );
        return;
      }

      setAddConfirm(person);
      setAddReason("");
      return;
    }

    setPendingAddStaffIds((prev) => {
      const current = new Set((prev || []).map((item) => String(item)));
      current.add(String(person.id));
      return Array.from(current);
    });
  };
  const handleRemovePendingStaff = (staffId) => {
    setPendingAddStaffIds((prev) =>
      (prev || []).filter((item) => String(item) !== String(staffId)),
    );
  };
  const closeAddConfirm = () => {
    if (isAddingStaff || isAddingPublishedStaff) return;
    setAddConfirm(null);
    setAddReason("");
  };

  const handleConfirmAddStaff = async () => {
    if (!addConfirm || readOnly || !onAddStaff) return;

    if (!addReason.trim()) return;
    setAddStaffError("");
    setIsAddingStaff(true);

    try {
      await onAddStaff(shift.id, addConfirm.id, {
        reason: addReason.trim(),
        notifyEmployee: true,
      });

      setAddConfirm(null);
      setAddReason("");
      setAddStaffError("");
    } catch (error) {
      setAddStaffError(error?.message || "Không thể thêm nhân viên vào ca.");
    } finally {
      setIsAddingStaff(false);
    }
  };

  const openDeleteGroupConfirm = () => {
    if (
      modalReadOnly ||
      !onDeleteShift ||
      !effectivePermissions.canDeleteShiftGroup
    )
      return;
    setDeleteGroupOpen(true);
    setDeleteGroupReason("");
  };

  const closeDeleteGroupConfirm = () => {
    if (isDeletingGroup || isDeletingPublishedShiftGroup) return;
    setDeleteGroupOpen(false);
    setDeleteGroupReason("");
  };

  const handleConfirmDeleteGroup = async () => {
    if (
      modalReadOnly ||
      !onDeleteShift ||
      !effectivePermissions.canDeleteShiftGroup
    )
      return;

    if (requiresChangeReason && !deleteGroupReason.trim()) return;

    setIsDeletingGroup(true);

    try {
      await onDeleteShift(shift.id, {
        reason: deleteGroupReason.trim() || "Xóa ca ở lịch chưa công bố",
        notifyEmployees: shouldNotifyEmployees,
      });

      setDeleteGroupOpen(false);
      setDeleteGroupReason("");
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const requestCloseModal = () => {
    if (
      isSavingChanges ||
      isSavingNotes ||
      isAddingStaff ||
      isAddingPublishedStaff ||
      isRemovingStaff ||
      isDeletingGroup ||
      isDeletingPublishedShiftGroup ||
      isSubmittingTimeChange ||
      isChangingShiftTime
    ) {
      return;
    }

    if (hasUnsavedShiftDetailChanges) {
      setCloseConfirmOpen(true);
      return;
    }

    onClose?.();
  };

  const confirmDiscardAndClose = () => {
    setCloseConfirmOpen(false);
    onClose?.();
  };

  const cancelDiscardAndClose = () => {
    setCloseConfirmOpen(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={requestCloseModal}>
      <Modal.Header>
        <div className="shift-detail-title">
          <div>
            <span className="eyebrow">Quản lý lịch làm</span>
            <h2>Chi tiết ca làm việc</h2>
          </div>
          <button
            type="button"
            className="header-close-btn"
            onClick={requestCloseModal}
            aria-label="Đóng chi tiết ca làm việc"
          >
            <X size={18} />
          </button>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="shift-detail-content">
          <div className={`summary-card ${isComplete ? "success" : "warning"}`}>
            <div className="summary-main">
              <div className="shift-icon-wrap">
                <Clock size={22} />
              </div>

              <div className="main-info">
                <span className="shift-type-label">
                  {currentShiftType?.label}
                </span>
                <h3 className="shift-name">
                  {formatDate(shift.date)}
                  {getDayName(shift.date) ? ` • ${getDayName(shift.date)}` : ""}
                </h3>

                <div className="summary-meta">
                  <span>
                    <Clock size={14} />
                    {shift.startTime} - {shift.endTime}
                  </span>
                  <span>
                    <Users size={14} />
                    {assignedStaff.length} nhân sự
                  </span>
                </div>
              </div>

              <div
                className={`status-badge ${isComplete ? "complete" : "missing"}`}
                role="status"
              >
                {isComplete ? (
                  <CheckCircle size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span>{coverageStatusLabel}</span>
              </div>
            </div>

            {shift.notes ? (
              <div className="summary-note">
                <span>Ghi chú hiện tại</span>
                <p>{shift.notes}</p>
              </div>
            ) : null}
            {!readOnly && onChangeShiftGroupTime ? (
              <div className="summary-actions">
                <button
                  type="button"
                  className="btn-time-change"
                  onClick={openTimeChangeModal}
                  disabled={isChangingShiftTime}
                >
                  <Edit3 size={16} />
                  Đổi giờ ca
                </button>

                <span
                  className={
                    isSchedulePublished ? "published-hint" : "draft-hint"
                  }
                >
                  {isSchedulePublished
                    ? "Lịch đã công bố: đổi giờ sẽ yêu cầu lý do, validate policy, ghi log và thông báo nhân viên."
                    : "Lịch chưa công bố: hệ thống vẫn sẽ validate nhân viên trước khi đổi giờ."}
                </span>
              </div>
            ) : null}
          </div>

          <div className="section-block">
            <div className="section-header">
              <h4>Nhân viên trong ca ({assignedStaff.length})</h4>
            </div>

            <div className="assigned-list">
              {assignedStaff.length > 0 ? (
                assignedStaff.map((person) => {
                  const staffId = String(person.id);
                  const isPendingAdd = pendingAddStaffIds
                    .map((item) => String(item))
                    .includes(staffId);
                  return (
                    <div key={staffId} className="staff-row assigned">
                      <div className="info">
                        <div className="avatar">{getInitials(person.name)}</div>
                        <div className="details">
                          <span className="name">{person.name}</span>
                          <span className="role">
                            {getStaffRoleLine(
                              person,
                              getStaffRoleInfo(person).roleLabel,
                            )}
                          </span>
                          {isPendingAdd ? (
                            <span className="tag-pending">Chưa lưu</span>
                          ) : null}
                        </div>
                      </div>
                      {isPendingAdd ? (
                        <button
                          type="button"
                          className="btn-icon remove"
                          onClick={() => handleRemovePendingStaff(staffId)}
                          title="Bỏ khỏi danh sách chờ lưu"
                          aria-label={`Bỏ ${person.name} khỏi danh sách chờ lưu`}
                        >
                          <X size={18} />
                        </button>
                      ) : !modalReadOnly &&
                        effectivePermissions.canRemoveStaffFromShift ? (
                        <button
                          type="button"
                          className="btn-icon remove"
                          onClick={() => openRemoveConfirm(person)}
                          title="Xóa khỏi ca"
                          aria-label={`Xóa ${person.name} khỏi ca`}
                        >
                          <UserMinus size={18} />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="empty-placeholder">Chưa có nhân viên nào</div>
              )}
            </div>
            {unresolvedAssignedStaffCount > 0 ? (
              <div className="empty-placeholder" role="alert">
                Có {unresolvedAssignedStaffCount} phân công không còn hồ sơ nhân
                viên hợp lệ trong phạm vi nhà hàng. Các phân công này không được
                tính là nhân sự của ca.
              </div>
            ) : null}
          </div>

          <div className="section-block">
            <div className="section-header">
              <h4>Ghi chú ca</h4>
            </div>
            <textarea
              className="note-textarea"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Nhập ghi chú ca làm..."
              rows={2}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>

          {!readOnly ? (
            <div className="section-block add-section">
              <div className="section-header">
                <h4>Thêm nhân sự</h4>
                {search || jobFilter || candidateRoleFilter !== "all" ? (
                  <button
                    type="button"
                    className="clear-filter"
                    onClick={() => {
                      setSearch("");
                      setJobFilter("");
                      setCandidateRoleFilter("all");
                    }}
                  >
                    Xóa lọc
                  </button>
                ) : null}
              </div>

              <div className="filter-bar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Tìm tên, mã NV, vị trí..."
                    aria-label="Tìm nhân viên để thêm vào ca"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search ? (
                    <button
                      type="button"
                      className="clear-icon"
                      onClick={() => setSearch("")}
                      aria-label="Xóa từ khóa tìm kiếm"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <select
                  value={jobFilter}
                  onChange={(event) => setJobFilter(event.target.value)}
                  className="job-select"
                  aria-label="Lọc theo vị trí"
                >
                  <option value="">Tất cả vị trí</option>
                  {jobOptions.map((job) => (
                    <option key={job.value} value={job.value}>
                      {job.label}
                    </option>
                  ))}
                </select>

                <div className="candidate-filter-tabs">
                  {[
                    { value: "all", label: "Tất cả" },
                    { value: "matched", label: "Khớp yêu cầu" },
                    { value: "mismatch", label: "Không khớp" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={
                        candidateRoleFilter === item.value ? "active" : ""
                      }
                      aria-pressed={candidateRoleFilter === item.value}
                      onClick={() => setCandidateRoleFilter(item.value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="candidate-list">
                {addStaffError ? (
                  <div className="submit-error">{addStaffError}</div>
                ) : null}
                {availableStaff.length > 0 ? (
                  availableStaff.map((person) => {
                    const roleInfo = getStaffRoleInfo(person);
                    const isRecommended =
                      shiftRequiredRoleKeys.length > 0 && roleInfo.matched;
                    return (
                      <div key={person.id} className="staff-row candidate">
                        <div className="info">
                          <div className="details">
                            <span className="name">{person.name}</span>
                            <div className="sub-row">
                              <span className="role">
                                {getStaffRoleLine(person, roleInfo.roleLabel)}
                              </span>
                              {isRecommended ? (
                                <span className="tag-rec">Ưu tiên</span>
                              ) : null}
                              {!isRecommended &&
                              shiftRequiredRoleKeys.length > 0 ? (
                                <span className="tag-mismatch">
                                  Khác vị trí
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-icon add"
                          onClick={() => handleAddCandidate(person)}
                          disabled={
                            isSchedulePublished
                              ? isAddingStaff ||
                                isAddingPublishedStaff ||
                                isSavingChanges
                              : isSavingChanges
                          }
                          aria-label={`Thêm ${person.name} vào ca`}
                          title={
                            isSchedulePublished
                              ? isAddingStaff ||
                                isAddingPublishedStaff ||
                                isSavingChanges
                                ? "Đang xử lý..."
                                : "Thêm nhân viên vào lịch đã công bố"
                              : isSavingChanges
                                ? "Đang lưu thay đổi..."
                                : "Thêm tạm vào ca"
                          }
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-placeholder">
                    Không tìm thấy nhân viên phù hợp với bộ lọc hiện tại.
                  </div>
                )}
              </div>
            </div>
          ) : null}
          {saveChangesError ? (
            <div className="submit-error">{saveChangesError}</div>
          ) : null}
          {timeChangeOpen ? (
            <div className="time-change-backdrop">
              <div className="time-change-card">
                <div className="time-change-icon">
                  <Clock size={22} />
                </div>

                <div className="time-change-content">
                  <h4>Đổi giờ ca làm việc</h4>

                  <p>
                    Bạn đang đổi giờ <strong>{currentShiftType?.label}</strong>{" "}
                    ngày <strong>{formatDate(shift.date)}</strong>. Giờ hiện
                    tại:{" "}
                    <strong>
                      {shift.startTime} - {shift.endTime}
                    </strong>
                    .
                  </p>

                  {isSchedulePublished ? (
                    <div className="time-change-warning">
                      Lịch này đã được công bố. Khi lưu, hệ thống sẽ validate
                      toàn bộ nhân viên trong ca, ghi log và gửi thông báo đến
                      nhân viên liên quan.
                    </div>
                  ) : (
                    <div className="time-change-info">
                      Lịch chưa công bố. Hệ thống vẫn sẽ kiểm tra trùng ca, nghỉ
                      phép, giới hạn giờ làm và các policy liên quan trước khi
                      lưu.
                    </div>
                  )}

                  <div className="time-change-grid">
                    <label>
                      Giờ bắt đầu mới
                      <input
                        type="time"
                        value={timeChangeDraft.startTime}
                        onChange={(event) =>
                          setTimeChangeDraft((prev) => ({
                            ...prev,
                            startTime: event.target.value,
                          }))
                        }
                        disabled={isSubmittingTimeChange || isChangingShiftTime}
                      />
                    </label>

                    <label>
                      Giờ kết thúc mới
                      <input
                        type="time"
                        value={timeChangeDraft.endTime}
                        onChange={(event) =>
                          setTimeChangeDraft((prev) => ({
                            ...prev,
                            endTime: event.target.value,
                          }))
                        }
                        disabled={isSubmittingTimeChange || isChangingShiftTime}
                      />
                    </label>
                  </div>

                  <label className="time-change-reason">
                    Lý do thay đổi <span>*</span>
                    <textarea
                      value={timeChangeDraft.reason}
                      onChange={(event) =>
                        setTimeChangeDraft((prev) => ({
                          ...prev,
                          reason: event.target.value,
                        }))
                      }
                      placeholder="Ví dụ: điều chỉnh theo nhu cầu vận hành, thay đổi giờ mở ca..."
                      rows={3}
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    />
                  </label>

                  <label className="time-change-check">
                    <input
                      type="checkbox"
                      checked={timeChangeDraft.notifyEmployees}
                      onChange={(event) =>
                        setTimeChangeDraft((prev) => ({
                          ...prev,
                          notifyEmployees: event.target.checked,
                        }))
                      }
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    />
                    <span>Gửi thông báo đến nhân viên trong ca</span>
                  </label>

                  <label className="time-change-check">
                    <input
                      type="checkbox"
                      checked={timeChangeDraft.allowOverride}
                      onChange={(event) =>
                        setTimeChangeDraft((prev) => ({
                          ...prev,
                          allowOverride: event.target.checked,
                        }))
                      }
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    />
                    <span>Cho phép override nếu chỉ có cảnh báo policy</span>
                  </label>

                  {timeChangeDraft.allowOverride ? (
                    <label className="time-change-reason">
                      Lý do override policy <span>*</span>
                      <textarea
                        value={timeChangeDraft.overrideReason}
                        onChange={(event) =>
                          setTimeChangeDraft((prev) => ({
                            ...prev,
                            overrideReason: event.target.value,
                          }))
                        }
                        placeholder="Giải thích vì sao vẫn cần đổi giờ dù có cảnh báo policy..."
                        rows={2}
                        disabled={isSubmittingTimeChange || isChangingShiftTime}
                      />
                    </label>
                  ) : null}

                  {timeChangeError ? (
                    <div className="time-change-error">{timeChangeError}</div>
                  ) : null}

                  <div className="time-change-actions">
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeTimeChangeModal}
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    >
                      Hủy
                    </button>

                    <button
                      type="button"
                      className="btn-primary-danger"
                      onClick={handleConfirmTimeChange}
                      disabled={isSubmittingTimeChange || isChangingShiftTime}
                    >
                      {isSubmittingTimeChange || isChangingShiftTime
                        ? "Đang kiểm tra..."
                        : "Kiểm tra & lưu"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {addConfirm ? (
            <div className="remove-confirm-backdrop">
              <div className="remove-confirm-card">
                <div className="remove-confirm-icon">
                  <AlertTriangle size={22} />
                </div>

                <div className="remove-confirm-content">
                  <h4>Thêm nhân viên vào lịch đã công bố?</h4>
                  <p>
                    Bạn đang thêm <strong>{addConfirm.name}</strong> vào ca{" "}
                    <strong>{currentShiftType?.label}</strong> ngày{" "}
                    <strong>{formatDate(shift.date)}</strong>, thời gian{" "}
                    <strong>
                      {shift.startTime} - {shift.endTime}
                    </strong>
                    .
                  </p>

                  <label>
                    Lý do thêm vào ca <span>*</span>
                    <textarea
                      value={addReason}
                      onChange={(event) => setAddReason(event.target.value)}
                      placeholder="Ví dụ: bổ sung nhân sự do tăng nhu cầu vận hành..."
                      rows={3}
                      disabled={isAddingStaff || isAddingPublishedStaff}
                    />
                  </label>

                  <div className="remove-confirm-note">
                    Hệ thống sẽ validate nhân viên này, ghi log và gửi thông báo
                    đến nhân viên được thêm.
                  </div>
                  {addStaffError ? (
                    <div className="submit-error">{addStaffError}</div>
                  ) : null}
                  <div className="remove-confirm-actions">
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeAddConfirm}
                      disabled={isAddingStaff || isAddingPublishedStaff}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleConfirmAddStaff}
                      disabled={
                        isAddingStaff ||
                        isAddingPublishedStaff ||
                        !addReason.trim()
                      }
                    >
                      {isAddingStaff || isAddingPublishedStaff
                        ? "Đang thêm..."
                        : "Xác nhận thêm"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {deleteGroupOpen ? (
            <div className="remove-confirm-backdrop">
              <div className="remove-confirm-card">
                <div className="remove-confirm-icon">
                  <AlertTriangle size={22} />
                </div>

                <div className="remove-confirm-content">
                  <h4>Xóa toàn bộ ca làm?</h4>
                  <p>
                    Ca <strong>{currentShiftType?.label}</strong> ngày{" "}
                    <strong>{formatDate(shift.date)}</strong>, thời gian{" "}
                    <strong>
                      {shift.startTime} - {shift.endTime}
                    </strong>{" "}
                    đang có <strong>{assignedStaff.length}</strong> nhân viên.
                  </p>

                  <label>
                    Lý do xóa ca {requiresChangeReason ? <span>*</span> : null}
                    <textarea
                      value={deleteGroupReason}
                      onChange={(event) =>
                        setDeleteGroupReason(event.target.value)
                      }
                      placeholder="Ví dụ: hủy ca do thay đổi kế hoạch vận hành..."
                      rows={3}
                      disabled={
                        isDeletingGroup || isDeletingPublishedShiftGroup
                      }
                    />
                  </label>

                  <div className="remove-confirm-note">
                    {isSchedulePublished
                      ? "Lịch đã công bố. Hệ thống sẽ gửi thông báo đến toàn bộ nhân viên trong ca và ghi EventLog."
                      : "Lịch chưa công bố. Ca sẽ được xóa khỏi lịch làm việc."}
                  </div>

                  <div className="remove-confirm-actions">
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeDeleteGroupConfirm}
                      disabled={
                        isDeletingGroup || isDeletingPublishedShiftGroup
                      }
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleConfirmDeleteGroup}
                      disabled={
                        isDeletingGroup ||
                        isDeletingPublishedShiftGroup ||
                        (requiresChangeReason && !deleteGroupReason.trim())
                      }
                    >
                      {isDeletingGroup || isDeletingPublishedShiftGroup
                        ? "Đang xóa..."
                        : "Xác nhận xóa ca"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {removeConfirm ? (
            <div className="remove-confirm-backdrop">
              <div className="remove-confirm-card">
                <div className="remove-confirm-icon">
                  <AlertTriangle size={22} />
                </div>

                <div className="remove-confirm-content">
                  <h4>
                    {shiftStaffIds.length === 1
                      ? "Xóa nhân viên cuối cùng khỏi ca?"
                      : "Xóa nhân viên khỏi ca?"}
                  </h4>
                  <p>
                    Bạn đang chuẩn bị xóa <strong>{removeConfirm.name}</strong>{" "}
                    khỏi ca <strong>{currentShiftType?.label}</strong> ngày{" "}
                    <strong>{formatDate(shift.date)}</strong>, thời gian{" "}
                    <strong>
                      {shift.startTime} - {shift.endTime}
                    </strong>
                    .
                  </p>
                  {shiftStaffIds.length === 1 ? (
                    <div className="remove-confirm-warning">
                      Đây là nhân viên cuối cùng trong ca. Vì hệ thống hiện lưu
                      ca theo phân công nhân viên, nếu tiếp tục thì ca này cũng
                      sẽ bị xóa khỏi lịch.
                      <br />
                      Muốn chỉnh lại lịch hoặc mở thêm ca sau khi đã công bố,
                      hãy dùng &quot;Mở lại để chỉnh sửa&quot;.
                    </div>
                  ) : null}

                  <label>
                    Lý do xóa khỏi ca <span>*</span>
                    <textarea
                      value={removeReason}
                      onChange={(event) => setRemoveReason(event.target.value)}
                      placeholder="Ví dụ: nhân viên xin nghỉ, đổi ca, phân công nhầm..."
                      rows={3}
                      disabled={isRemovingStaff}
                    />
                  </label>

                  <div className="remove-confirm-note">
                    Sau khi xác nhận, hệ thống sẽ gửi thông báo đến nhân viên
                    này.
                  </div>
                  {removeError ? (
                    <div className="time-change-error">{removeError}</div>
                  ) : null}

                  <div className="remove-confirm-actions">
                    <button
                      type="button"
                      className="btn-close"
                      onClick={closeRemoveConfirm}
                      disabled={isRemovingStaff}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={handleConfirmRemoveStaff}
                      disabled={isRemovingStaff || !removeReason.trim()}
                    >
                      {isRemovingStaff
                        ? "Đang xử lý..."
                        : shiftStaffIds.length === 1
                          ? "Xóa nhân viên và xóa ca"
                          : "Xác nhận xóa"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {closeConfirmOpen ? (
            <div className="close-confirm-backdrop">
              <div className="close-confirm-card">
                <div className="close-confirm-content">
                  <h4>Bạn có thay đổi chưa lưu</h4>
                  <p>
                    Nếu đóng cửa sổ này, các thay đổi tạm thời như ghi chú hoặc
                    nhân viên chưa lưu sẽ bị mất.
                  </p>
                </div>
                <div className="close-confirm-actions">
                  <button
                    type="button"
                    className="btn-close"
                    onClick={cancelDiscardAndClose}
                  >
                    Tiếp tục chỉnh sửa
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={confirmDiscardAndClose}
                  >
                    Đóng và bỏ thay đổi
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          <div className="section-block schedule-log-section">
            <div className="section-header schedule-log-header">
              <div>
                <h4>Lịch sử thay đổi</h4>
                <p>
                  {scheduleChangeLogsLoading
                    ? "Đang tải lịch sử..."
                    : `${scheduleChangeLogs.length || 0} mục thay đổi`}
                </p>
              </div>

              <button
                type="button"
                className="history-toggle-btn"
                onClick={() =>
                  setIsChangeHistoryExpanded((prev) => !prev)
                }
              >
                {isChangeHistoryExpanded ? "Ẩn" : "Hiện"}
              </button>
            </div>

            {isChangeHistoryExpanded ? (
              scheduleChangeLogsLoading ? (
                <div className="empty-placeholder">
                  Đang tải lịch sử thay đổi...
                </div>
              ) : scheduleChangeLogs.length <= 0 ? (
                <div className="empty-placeholder">
                  Chưa có lịch sử thay đổi cho ca này.
                </div>
              ) : (
                <div className="schedule-log-list">
                  {scheduleChangeLogs.map((log) => {
                    const tone = getScheduleLogTone(log.verb);
                    const hasTimeChange = log.oldStartTime && log.newStartTime;

                    return (
                      <div key={log.id} className={`schedule-log-item ${tone}`}>
                        <div className="log-marker" />

                        <div className="log-content">
                          <div className="log-head">
                            <strong>{getScheduleLogLabel(log.verb)}</strong>
                            <span>
                              {formatLogDateTime(log.at || log.createdAt)}
                            </span>
                          </div>

                          {hasTimeChange ? (
                            <div className="log-time-change">
                              {formatTimeOnly(log.oldStartTime)} -{" "}
                              {formatTimeOnly(log.oldEndTime)} →{" "}
                              {formatTimeOnly(log.newStartTime)} -{" "}
                              {formatTimeOnly(log.newEndTime)}
                            </div>
                          ) : null}

                          {log.reason ? (
                            <p className="log-reason">Lý do: {log.reason}</p>
                          ) : null}

                          <div className="log-meta-row">
                            {Array.isArray(log.affectedEmployeeIds) &&
                            log.affectedEmployeeIds.length > 0 ? (
                              <span>
                                Ảnh hưởng {log.affectedEmployeeIds.length} nhân
                                viên
                              </span>
                            ) : null}

                            {log.notifyEmployees === true ? (
                              <span>Đã gửi thông báo</span>
                            ) : log.notifyEmployees === false ? (
                              <span>Không gửi thông báo</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="schedule-log-collapsed-hint">
                Nhấn Hiện để xem lịch sử thay đổi của ca này.
              </div>
            )}
          </div>
          {effectivePermissions.isReadOnly ? (
            <div className="empty-placeholder">
              Lịch đang ở trạng thái không cho chỉnh sửa trực tiếp. Các thay đổi
              cần thực hiện qua quy trình chấm công/lương phù hợp.
            </div>
          ) : null}
          <div className="modal-footer-actions">
            {!readOnly ? (
              <>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleSaveChanges}
                  disabled={
                    !hasPendingChanges || isSavingChanges || modalReadOnly
                  }
                >
                  {getSaveChangesLabel()}
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={openDeleteGroupConfirm}
                >
                  <Trash2 size={16} />
                  Xóa ca
                </button>
              </>
            ) : null}
            <button type="button" className="btn-close" onClick={requestCloseModal}>
              Đóng
            </button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ShiftDetailModal;
