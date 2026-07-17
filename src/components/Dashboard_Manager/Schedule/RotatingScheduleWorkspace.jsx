import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import useSchedulingPolicy from "@/hooks/useSchedulingPolicy";
import RotatingShiftModal from "./components/RotatingShiftModal";
import {
  buildVietnamShiftRange,
  groupRotatingShiftRows,
  isRotatingStaff,
} from "./utils/rotatingSchedule";
import { toVietnamTime } from "./utils/partTimeSchedule";
import "./RotatingScheduleWorkspace.scss";

const ME_QUERY = gql`
  query RotatingScheduleMe {
    me {
      id
      roleName
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query RotatingScheduleRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_SCOPED_RESTAURANTS = gql`
  query RotatingScheduleScopedRestaurants($limit: Int = 100, $cursor: ID) {
    scopedRestaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_ROTATING_STAFF = gql`
  query RotatingScheduleStaff($restaurantId: ID, $search: String) {
    staffList(restaurantId: $restaurantId, search: $search) {
      id
      fullName
      employeeCode
      department
      roleName
      positionTitle
      employmentStatus
      employmentType
      shiftType
      role {
        id
        slug
        name
        department
      }
    }
  }
`;

const GET_ROTATING_SHIFTS = gql`
  query RotatingScheduleShifts(
    $restaurantId: ID
    $startDate: DateTime
    $endDate: DateTime
  ) {
    staffShifts(
      restaurantId: $restaurantId
      startDate: $startDate
      endDate: $endDate
      limit: 1000
    ) {
      id
      employeeId
      employeeName
      restaurantId
      shiftType
      startTime
      endTime
      status
      notes
    }
  }
`;

const GET_SCHEDULE_PUBLICATION = gql`
  query RotatingSchedulePublication(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    schedulePublication(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      id
      status
      effectiveStatus
      publishedAt
      lastChangedAt
      permissions {
        canEditDraftSchedule
        canDeleteShiftGroup
        requiresChangeReason
        requiresEmployeeNotification
        isReadOnly
      }
    }
  }
`;

const CREATE_ROTATING_SHIFTS = gql`
  mutation CreateRotatingStaffShifts($inputs: [CreateStaffShiftInput!]!) {
    createStaffShifts(inputs: $inputs) {
      successCount
      failedCount
      shifts {
        id
        employeeId
      }
      errors {
        index
        employeeId
        message
        code
      }
    }
  }
`;

const DELETE_ROTATING_SHIFT = gql`
  mutation DeleteRotatingStaffShift(
    $shiftId: ID!
    $reason: String
    $notifyEmployee: Boolean
  ) {
    deleteStaffShift(
      shiftId: $shiftId
      reason: $reason
      notifyEmployee: $notifyEmployee
    )
  }
`;

const STATUS_LABELS = {
  draft: "Bản nháp",
  revision_draft: "Đang chỉnh sửa",
  published: "Đã công bố",
  active: "Đang hoạt động",
  locked: "Đã khóa",
  closed: "Đã đóng",
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const formatValidationIssues = (validation) => [
  ...(validation?.blockingErrors || []),
  ...(validation?.warnings || []),
]
  .map((issue) => issue?.message)
  .filter(Boolean);

const RotatingScheduleWorkspace = () => {
  const { showNotification } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState("");

  const weekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate],
  );
  const weekEnd = useMemo(
    () => endOfWeek(currentDate, { weekStartsOn: 1 }),
    [currentDate],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const { data: meData } = useQuery(ME_QUERY, {
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });
  const me = meData?.me;

  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: me?.roleName !== "admin",
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });
  const { data: scopedRestaurantsData } = useQuery(GET_SCOPED_RESTAURANTS, {
    variables: { limit: 100 },
    skip: !me?.id || me?.roleName === "admin",
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const restaurantOptions = useMemo(() => {
    const edges =
      me?.roleName === "admin"
        ? allRestaurantsData?.restaurants?.edges
        : scopedRestaurantsData?.scopedRestaurants?.edges;
    return (edges || []).map((edge) => edge?.node).filter(Boolean);
  }, [allRestaurantsData, me?.roleName, scopedRestaurantsData]);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantOptions.length) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    }
  }, [restaurantOptions, selectedRestaurantId]);

  const { policy: schedulingPolicy, validateShiftAssignment } =
    useSchedulingPolicy({ restaurantId: selectedRestaurantId });

  const {
    data: staffData,
    loading: staffLoading,
    error: staffError,
  } = useQuery(GET_ROTATING_STAFF, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
  });

  const {
    data: shiftsData,
    loading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useQuery(GET_ROTATING_SHIFTS, {
    variables: {
      restaurantId: selectedRestaurantId,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const {
    data: publicationData,
    loading: publicationLoading,
  } = useQuery(GET_SCHEDULE_PUBLICATION, {
    variables: {
      restaurantId: selectedRestaurantId,
      periodStart: weekStart.toISOString(),
      periodEnd: weekEnd.toISOString(),
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const [createShifts] = useMutation(CREATE_ROTATING_SHIFTS);
  const [deleteShift] = useMutation(DELETE_ROTATING_SHIFT);

  const rotatingStaff = useMemo(
    () =>
      (staffData?.staffList || [])
        .filter(
          (person) =>
            isRotatingStaff(person) &&
            String(person?.employmentStatus || "").toLowerCase() === "working",
        )
        .map((person) => ({
          ...person,
          name: person.fullName || "Nhân viên",
          departmentLabel: person.department || "Khác",
        })),
    [staffData?.staffList],
  );

  const staffById = useMemo(
    () => new Map(rotatingStaff.map((person) => [String(person.id), person])),
    [rotatingStaff],
  );
  const shiftRows = useMemo(
    () => shiftsData?.staffShifts || [],
    [shiftsData?.staffShifts],
  );
  const groups = useMemo(
    () => groupRotatingShiftRows(shiftRows, staffById),
    [shiftRows, staffById],
  );

  const publication = publicationData?.schedulePublication || null;
  const lifecycleStatus = String(
    publication?.effectiveStatus || publication?.status || "draft",
  ).toLowerCase();
  const permissions = publication?.permissions || null;
  const canCreate =
    !publicationLoading &&
    (publication
      ? permissions?.canEditDraftSchedule === true && permissions?.isReadOnly !== true
      : true);
  const canDelete =
    !publicationLoading &&
    (publication
      ? permissions?.canDeleteShiftGroup === true && permissions?.isReadOnly !== true
      : true);

  const validateAllAssignments = async ({ staffIds, range, overrideReason }) => {
    const results = await Promise.all(
      staffIds.map(async (employeeId) => {
        const response = await validateShiftAssignment({
          variables: {
            input: {
              employeeId,
              restaurantId: selectedRestaurantId,
              startTime: range.startTime.toISOString(),
              endTime: range.endTime.toISOString(),
            },
          },
        });
        return {
          employeeId,
          validation: response?.data?.validateShiftAssignment,
        };
      }),
    );

    const blocked = results.filter(({ validation }) => !validation?.ok);
    const warned = results.filter(
      ({ validation }) => (validation?.warnings || []).length > 0,
    );
    if ((blocked.length || warned.length) && !overrideReason) {
      const details = [...blocked, ...warned]
        .map(({ employeeId, validation }) => {
          const name = staffById.get(String(employeeId))?.name || employeeId;
          const issues = formatValidationIssues(validation);
          return `${name}: ${issues.join("; ") || "Không đủ điều kiện nhận ca"}`;
        })
        .join("\n");
      throw new Error(
        `${details}\nVui lòng nhập lý do ghi đè nếu đây là cảnh báo được phép xử lý.`,
      );
    }

    return results;
  };

  const rollbackCreatedRows = async (rows = []) => {
    if (!rows.length) return;
    const rollbackResults = await Promise.allSettled(
      rows.map((row) =>
        deleteShift({
          variables: {
            shiftId: row.id,
            reason: "Hoàn tác batch ca xoay tạo không đầy đủ",
            notifyEmployee: false,
          },
        }),
      ),
    );
    const failedRollbackCount = rollbackResults.filter(
      (result) => result.status === "rejected",
    ).length;
    if (failedRollbackCount) {
      throw new Error(
        `Batch tạo ca thất bại và còn ${failedRollbackCount} phân công chưa hoàn tác được.`,
      );
    }
  };

  const handleCreate = async (payload) => {
    if (!selectedRestaurantId) throw new Error("Chưa chọn nhà hàng.");
    if (!canCreate) {
      throw new Error("Trạng thái lịch hiện tại không cho phép tạo nhóm ca xoay mới.");
    }

    const range = buildVietnamShiftRange(payload);
    if (range.startTime.getTime() <= Date.now()) {
      throw new Error("Không thể tạo ca đã bắt đầu hoặc đã kết thúc.");
    }

    setIsCreating(true);
    try {
      await validateAllAssignments({
        staffIds: payload.staffIds,
        range,
        overrideReason: payload.overrideReason,
      });

      const overrideInput = payload.overrideReason
        ? {
            allowOverride: true,
            overrideReason: payload.overrideReason,
          }
        : {};
      const response = await createShifts({
        variables: {
          inputs: payload.staffIds.map((employeeId) => ({
            employeeId,
            restaurantId: selectedRestaurantId,
            shiftType: "ROTATING",
            startTime: range.startTime.toISOString(),
            endTime: range.endTime.toISOString(),
            notes: payload.notes || "Ca xoay",
            ...overrideInput,
          })),
        },
      });
      const result = response?.data?.createStaffShifts;
      if (!result) throw new Error("Không nhận được kết quả tạo ca xoay.");

      if (Number(result.failedCount || 0) > 0) {
        await rollbackCreatedRows(result.shifts || []);
        const details = (result.errors || [])
          .map((error) => {
            const name = staffById.get(String(error?.employeeId))?.name || error?.employeeId;
            return `${name || "Nhân viên"}: ${error?.message || error?.code || "Không thể tạo ca"}`;
          })
          .join("\n");
        throw new Error(
          `Không tạo ca xoay vì batch không hoàn tất. Dữ liệu đã được hoàn tác.${details ? `\n${details}` : ""}`,
        );
      }

      await refetchShifts();
      setModalDate("");
      showNotification(
        `Đã tạo ca xoay cho ${Number(result.successCount || payload.staffIds.length)} nhân viên.`,
        "success",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    if (!canDelete || !group?.records?.length) return;
    const requiresReason = permissions?.requiresChangeReason === true;
    const reason = requiresReason
      ? window.prompt("Nhập lý do xóa nhóm ca xoay đã công bố:", "Điều chỉnh vận hành")
      : "Xóa nhóm ca xoay ở lịch chưa công bố";
    if (requiresReason && !String(reason || "").trim()) return;
    if (!window.confirm(`Xóa ca ${toVietnamTime(group.startTime)} - ${toVietnamTime(group.endTime)}?`)) {
      return;
    }

    setDeletingGroupId(group.id);
    try {
      await Promise.all(
        group.records.map((record) =>
          deleteShift({
            variables: {
              shiftId: record.id,
              reason: String(reason || "").trim(),
              notifyEmployee: permissions?.requiresEmployeeNotification === true,
            },
          }),
        ),
      );
      await refetchShifts();
      showNotification("Đã xóa nhóm ca xoay.", "success");
    } catch (error) {
      showNotification(getErrorMessage(error, "Không thể xóa nhóm ca xoay."), "error");
    } finally {
      setDeletingGroupId("");
    }
  };

  const loading = staffLoading || shiftsLoading || publicationLoading;
  const loadError = staffError || shiftsError;

  return (
    <section className="rotating-schedule-workspace">
      <header className="rotating-schedule-header">
        <div>
          <span className="rotating-schedule-header__eyebrow">Lịch xoay ca</span>
          <h2>Phân công linh hoạt cho nhân sự ROTATING</h2>
          <p>
            Workspace này chỉ xử lý nhân viên được cấu hình xoay ca; không dùng
            ngày làm cố định hoặc bộ lọc của lịch toàn thời gian.
          </p>
        </div>
        <div className="rotating-schedule-header__status">
          <span className={`status-${lifecycleStatus}`}>
            {STATUS_LABELS[lifecycleStatus] || lifecycleStatus}
          </span>
          <strong>{rotatingStaff.length} nhân viên xoay ca</strong>
        </div>
      </header>

      <div className="rotating-schedule-toolbar">
        <select
          value={selectedRestaurantId}
          onChange={(event) => setSelectedRestaurantId(event.target.value)}
        >
          <option value="" disabled>
            Chọn nhà hàng
          </option>
          {restaurantOptions.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>
        <div className="rotating-week-navigation">
          <button type="button" onClick={() => setCurrentDate((date) => subWeeks(date, 1))}>
            <ChevronLeft size={17} /> Trước
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date())}>
            Hôm nay
          </button>
          <strong>
            {format(weekStart, "dd/MM")} - {format(weekEnd, "dd/MM/yyyy")}
          </strong>
          <button type="button" onClick={() => setCurrentDate((date) => addWeeks(date, 1))}>
            Sau <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {!canCreate && !publicationLoading ? (
        <div className="rotating-schedule-notice">
          Trạng thái lịch hiện tại không cho phép tạo nhóm ca xoay mới. Các nút
          thao tác được điều khiển trực tiếp từ quyền backend.
        </div>
      ) : null}

      {loading ? (
        <div className="rotating-schedule-feedback">Đang tải lịch xoay ca…</div>
      ) : loadError ? (
        <div className="rotating-schedule-feedback error">
          {getErrorMessage(loadError, "Không tải được lịch xoay ca.")}
        </div>
      ) : (
        <div className="rotating-week-board">
          {weekDays.map((day) => {
            const date = format(day, "yyyy-MM-dd");
            const dayGroups = groups.filter((group) => group.date === date);
            return (
              <article className="rotating-day-column" key={date}>
                <header className={isSameDay(day, new Date()) ? "today" : ""}>
                  <div>
                    <span>{format(day, "EEE", { locale: vi })}</span>
                    <strong>{format(day, "dd/MM")}</strong>
                  </div>
                  <small>{dayGroups.length} ca</small>
                </header>
                <div className="rotating-day-column__body">
                  {dayGroups.map((group) => (
                    <div className="rotating-shift-group" key={group.id}>
                      <div className="rotating-shift-group__time">
                        <Clock3 size={15} />
                        <strong>
                          {toVietnamTime(group.startTime)} - {toVietnamTime(group.endTime)}
                        </strong>
                      </div>
                      <div className="rotating-shift-group__staff">
                        <Users size={15} />
                        <div>
                          {group.staffIds.map((staffId) => (
                            <span key={staffId}>
                              {staffById.get(String(staffId))?.name || "Nhân viên"}
                            </span>
                          ))}
                        </div>
                      </div>
                      {canDelete ? (
                        <button
                          type="button"
                          className="rotating-shift-group__delete"
                          onClick={() => handleDeleteGroup(group)}
                          disabled={deletingGroupId === group.id}
                          aria-label={`Xóa ca xoay ${toVietnamTime(group.startTime)} - ${toVietnamTime(group.endTime)}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}

                  {canCreate ? (
                    <button
                      type="button"
                      className="rotating-add-shift"
                      onClick={() => setModalDate(date)}
                    >
                      <Plus size={17} />
                      <span>
                        Thêm ca xoay
                        <small>Chọn khung giờ và nhân sự riêng</small>
                      </span>
                    </button>
                  ) : null}

                  {!dayGroups.length && !canCreate ? (
                    <div className="rotating-day-empty">Chưa có ca xoay</div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="rotating-schedule-footer-note">
        <RefreshCw size={17} />
        <span>
          Nhân viên xoay ca được xác định trực tiếp từ metadata `shiftType`, không
          sửa giả `workingDays` ở giao diện.
        </span>
        <CalendarDays size={17} />
      </footer>

      <RotatingShiftModal
        isOpen={Boolean(modalDate)}
        date={modalDate}
        staffList={rotatingStaff}
        existingShifts={shiftRows}
        shiftTemplates={schedulingPolicy?.shiftTemplates || []}
        onClose={() => setModalDate("")}
        onConfirm={handleCreate}
        submitting={isCreating}
      />
    </section>
  );
};

export default RotatingScheduleWorkspace;
