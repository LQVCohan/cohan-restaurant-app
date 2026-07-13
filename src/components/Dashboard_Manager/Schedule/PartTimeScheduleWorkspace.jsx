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
  Trash2,
  Users,
} from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import useSchedulingPolicy from "@/hooks/useSchedulingPolicy";
import PartTimeShiftModal from "./components/PartTimeShiftModal";
import {
  buildLocalShiftRange,
  durationLabel,
  getNextPartTimeStart,
  groupPartTimeShiftRows,
  isPartTimeEmployment,
} from "./utils/partTimeSchedule";
import "./PartTimeScheduleWorkspace.scss";

const ME_QUERY = gql`
  query PartTimeScheduleMe {
    me { id roleName refRestaurants { id name } }
  }
`;
const GET_ALL_RESTAURANTS = gql`
  query PartTimeScheduleRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) { edges { node { id name } } }
  }
`;
const GET_SCOPED_RESTAURANTS = gql`
  query PartTimeScheduleScopedRestaurants($limit: Int = 100, $cursor: ID) {
    scopedRestaurants(limit: $limit, cursor: $cursor) { edges { node { id name } } }
  }
`;
const GET_STAFF_LIST = gql`
  query PartTimeScheduleStaff($restaurantId: ID, $search: String) {
    staffList(restaurantId: $restaurantId, search: $search) {
      id fullName employeeCode department roleName positionTitle
      employmentStatus employmentType workingDays
      role { id slug name department }
    }
  }
`;
const GET_STAFF_SHIFTS = gql`
  query PartTimeScheduleShifts($restaurantId: ID, $startDate: DateTime, $endDate: DateTime) {
    staffShifts(
      restaurantId: $restaurantId
      startDate: $startDate
      endDate: $endDate
      limit: 1000
    ) {
      id employeeId employeeName restaurantId shiftType startTime endTime status notes
    }
  }
`;
const GET_SCHEDULE_PUBLICATION = gql`
  query PartTimeSchedulePublication(
    $restaurantId: ID!
    $periodStart: DateTime!
    $periodEnd: DateTime!
  ) {
    schedulePublication(
      restaurantId: $restaurantId
      periodStart: $periodStart
      periodEnd: $periodEnd
    ) {
      id status effectiveStatus
      permissions { canEditDraftSchedule isReadOnly }
    }
  }
`;
const CREATE_STAFF_SHIFT = gql`
  mutation CreatePartTimeStaffShift($input: CreateStaffShiftInput!) {
    createStaffShift(input: $input) { id }
  }
`;
const DELETE_STAFF_SHIFT = gql`
  mutation DeletePartTimeStaffShift(
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

const SCHEDULE_STATUS_LABELS = {
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

const PartTimeScheduleWorkspace = () => {
  const { showNotification } = useNotification();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [modalContext, setModalContext] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingBlockId, setDeletingBlockId] = useState("");

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "cache-and-network" });
  const me = meData?.me;
  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: me?.roleName !== "admin",
    fetchPolicy: "cache-and-network",
  });
  const { data: scopedRestaurantsData } = useQuery(GET_SCOPED_RESTAURANTS, {
    variables: { limit: 100 },
    skip: !me?.id || me?.roleName === "admin",
    fetchPolicy: "cache-and-network",
  });

  const restaurantOptions = useMemo(() => {
    const edges =
      me?.roleName === "admin"
        ? allRestaurantsData?.restaurants?.edges
        : scopedRestaurantsData?.scopedRestaurants?.edges;
    return (edges || []).map((edge) => edge.node).filter(Boolean);
  }, [allRestaurantsData, scopedRestaurantsData, me?.roleName]);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantOptions.length) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    }
  }, [restaurantOptions, selectedRestaurantId]);

  const { policy: schedulingPolicy, validateShiftAssignment } =
    useSchedulingPolicy({ restaurantId: selectedRestaurantId });

  const { data: staffData, loading: staffLoading } = useQuery(GET_STAFF_LIST, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const {
    data: shiftsData,
    loading: shiftsLoading,
    error: shiftsError,
    refetch: refetchShifts,
  } = useQuery(GET_STAFF_SHIFTS, {
    variables: {
      restaurantId: selectedRestaurantId,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });
  const { data: publicationData } = useQuery(GET_SCHEDULE_PUBLICATION, {
    variables: {
      restaurantId: selectedRestaurantId,
      periodStart: weekStart.toISOString(),
      periodEnd: weekEnd.toISOString(),
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });
  const [createShift] = useMutation(CREATE_STAFF_SHIFT);
  const [deleteShift] = useMutation(DELETE_STAFF_SHIFT);

  const partTimeStaff = useMemo(
    () =>
      (staffData?.staffList || [])
        .filter(
          (person) =>
            isPartTimeEmployment(person) &&
            String(person.employmentStatus || "").toLowerCase() === "working",
        )
        .map((person) => ({
          ...person,
          name: person.fullName || "Nhân viên",
          departmentLabel: person.department || "Khác",
        })),
    [staffData?.staffList],
  );
  const staffById = useMemo(
    () => new Map(partTimeStaff.map((person) => [String(person.id), person])),
    [partTimeStaff],
  );
  const blocks = useMemo(
    () => groupPartTimeShiftRows(shiftsData?.staffShifts || [], staffById),
    [shiftsData?.staffShifts, staffById],
  );

  const publication = publicationData?.schedulePublication;
  const lifecycleStatus = publication?.effectiveStatus || publication?.status || "draft";
  const canEdit = ["draft", "revision_draft"].includes(lifecycleStatus);
  const defaultStartTime = useMemo(() => {
    const starts = (schedulingPolicy?.shiftTemplates || [])
      .filter((template) => template.enabled !== false && template.startTime)
      .map((template) => template.startTime)
      .sort();
    return starts[0] || "08:00";
  }, [schedulingPolicy?.shiftTemplates]);

  const openCreateModal = (day) => {
    if (!canEdit) {
      showNotification(
        `Lịch đang ở trạng thái ${SCHEDULE_STATUS_LABELS[lifecycleStatus] || lifecycleStatus}. Hãy mở lại lịch để tạo block mới.`,
        "warning",
      );
      return;
    }
    const date = format(day, "yyyy-MM-dd");
    const startTime = getNextPartTimeStart(blocks, date, defaultStartTime);
    if (!startTime) {
      showNotification("Block cuối đã kết thúc sang ngày kế tiếp.", "warning");
      return;
    }
    setModalContext({ date, startTime });
  };

  const validateEmployee = async ({ employeeId, startTime, endTime, overrideReason }) => {
    const response = await validateShiftAssignment({
      variables: {
        input: {
          employeeId,
          restaurantId: selectedRestaurantId,
          shiftType: "ROTATING",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          allowOverride: true,
          overrideReason: "__PART_TIME_SHIFT_PRECHECK__",
        },
      },
    });
    const validation = response?.data?.validateShiftAssignment;
    if (!validation) throw new Error("Không nhận được kết quả kiểm tra xếp ca.");
    if (!validation.ok) {
      throw new Error(
        (validation.blockingErrors || []).map((issue) => issue.message).join("\n") ||
          "Nhân viên không đủ điều kiện nhận ca.",
      );
    }
    if (validation.warnings?.length && !overrideReason) {
      throw new Error(
        `${validation.warnings.map((issue) => issue.message).join("; ")} Vui lòng nhập lý do ghi đè để tiếp tục.`,
      );
    }
    return validation;
  };

  const handleCreateBlock = async (payload) => {
    if (!selectedRestaurantId) throw new Error("Chưa chọn nhà hàng.");
    if (!canEdit) throw new Error("Lịch hiện tại không cho phép tạo ca mới.");
    const range = buildLocalShiftRange(payload);
    if (range.startTime.getTime() <= Date.now()) {
      throw new Error("Không thể tạo ca đã bắt đầu hoặc đã kết thúc.");
    }

    setIsCreating(true);
    try {
      const failures = [];
      let successCount = 0;
      for (const employeeId of payload.staffIds) {
        const person = staffById.get(String(employeeId));
        try {
          const validation = await validateEmployee({
            employeeId,
            startTime: range.startTime,
            endTime: range.endTime,
            overrideReason: payload.overrideReason,
          });
          const hasWarnings = Boolean(validation.warnings?.length);
          await createShift({
            variables: {
              input: {
                employeeId,
                restaurantId: selectedRestaurantId,
                shiftType: "ROTATING",
                startTime: range.startTime.toISOString(),
                endTime: range.endTime.toISOString(),
                status: "scheduled",
                notes: payload.notes || "Ca bán thời gian",
                allowOverride: hasWarnings,
                overrideReason: hasWarnings ? payload.overrideReason : undefined,
              },
            },
          });
          successCount += 1;
        } catch (error) {
          failures.push(
            `${person?.name || employeeId}: ${getErrorMessage(error, "Không thể tạo ca")}`,
          );
        }
      }
      if (!successCount) throw new Error(failures.join("\n") || "Không tạo được ca nào.");
      await refetchShifts();
      setModalContext(null);
      showNotification(
        failures.length
          ? `Đã tạo ${successCount}/${payload.staffIds.length} phân công. ${failures.join(" | ")}`
          : `Đã tạo block ${payload.startTime} trong ${payload.durationHours} giờ cho ${successCount} nhân viên.`,
        failures.length ? "warning" : "success",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBlock = async (block) => {
    if (!canEdit || !block?.records?.length) return;
    if (!window.confirm(`Xóa block ${block.startLabel} - ${block.endLabel}?`)) return;
    setDeletingBlockId(block.id);
    try {
      await Promise.all(
        block.records.map((record) =>
          deleteShift({
            variables: {
              shiftId: record.id,
              reason: "Xóa block ca bán thời gian ở lịch chưa công bố",
              notifyEmployee: false,
            },
          }),
        ),
      );
      await refetchShifts();
      showNotification("Đã xóa block ca bán thời gian.", "success");
    } catch (error) {
      showNotification(getErrorMessage(error, "Không thể xóa block ca."), "error");
    } finally {
      setDeletingBlockId("");
    }
  };

  return (
    <section className="part-time-schedule-workspace">
      <header className="part-time-schedule-header">
        <div>
          <span className="part-time-schedule-header__eyebrow">Lịch bán thời gian</span>
          <h2>Block ca linh hoạt theo khung giờ</h2>
          <p>
            Ca mặc định 4 giờ. Block mới tự nối từ giờ kết thúc của block trước;
            quản lý có thể chọn thời lượng khác theo quy định doanh nghiệp.
          </p>
        </div>
        <div className="part-time-schedule-header__status">
          <span>{SCHEDULE_STATUS_LABELS[lifecycleStatus] || lifecycleStatus}</span>
          <strong>{partTimeStaff.length} nhân viên bán thời gian</strong>
        </div>
      </header>

      <div className="part-time-schedule-toolbar">
        <select
          value={selectedRestaurantId}
          onChange={(event) => setSelectedRestaurantId(event.target.value)}
        >
          <option value="" disabled>Chọn nhà hàng</option>
          {restaurantOptions.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
          ))}
        </select>
        <div className="part-time-week-navigation">
          <button type="button" onClick={() => setCurrentDate((date) => subWeeks(date, 1))}>
            <ChevronLeft size={17} /> Trước
          </button>
          <button type="button" onClick={() => setCurrentDate(new Date())}>Hôm nay</button>
          <strong>{format(weekStart, "dd/MM")} - {format(weekEnd, "dd/MM/yyyy")}</strong>
          <button type="button" onClick={() => setCurrentDate((date) => addWeeks(date, 1))}>
            Sau <ChevronRight size={17} />
          </button>
        </div>
      </div>

      {!canEdit ? (
        <div className="part-time-schedule-notice">
          Lịch đã công bố hoặc đang vận hành. Chuyển lịch về bản chỉnh sửa để thay đổi block ca.
        </div>
      ) : null}

      {staffLoading || shiftsLoading ? (
        <div className="part-time-schedule-feedback">Đang tải lịch bán thời gian…</div>
      ) : shiftsError ? (
        <div className="part-time-schedule-feedback error">
          {getErrorMessage(shiftsError, "Không tải được lịch bán thời gian.")}
        </div>
      ) : (
        <div className="part-time-week-board">
          {weekDays.map((day) => {
            const date = format(day, "yyyy-MM-dd");
            const dayBlocks = blocks.filter((block) => block.date === date);
            const nextStart = getNextPartTimeStart(blocks, date, defaultStartTime);
            return (
              <article className="part-time-day-column" key={date}>
                <header className={isSameDay(day, new Date()) ? "today" : ""}>
                  <div>
                    <span>{format(day, "EEE", { locale: vi })}</span>
                    <strong>{format(day, "dd/MM")}</strong>
                  </div>
                  <small>{dayBlocks.length} block</small>
                </header>
                <div className="part-time-day-column__body">
                  {dayBlocks.map((block) => (
                    <div className="part-time-shift-block" key={block.id}>
                      <div className="part-time-shift-block__time">
                        <Clock3 size={15} />
                        <strong>{block.startLabel} - {block.endLabel}</strong>
                        <span>{durationLabel(block.startTime, block.endTime)}</span>
                      </div>
                      <div className="part-time-shift-block__staff">
                        <Users size={15} />
                        <div>
                          {block.staffIds.map((staffId) => (
                            <span key={staffId}>
                              {staffById.get(String(staffId))?.name || "Nhân viên"}
                            </span>
                          ))}
                        </div>
                      </div>
                      {canEdit ? (
                        <button
                          type="button"
                          className="part-time-shift-block__delete"
                          onClick={() => handleDeleteBlock(block)}
                          disabled={deletingBlockId === block.id}
                          aria-label={`Xóa block ${block.startLabel} - ${block.endLabel}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {canEdit ? (
                    <button
                      type="button"
                      className="part-time-add-block"
                      onClick={() => openCreateModal(day)}
                      disabled={!nextStart}
                    >
                      <Plus size={17} />
                      <span>
                        Thêm block
                        <small>{nextStart ? `Bắt đầu tự động lúc ${nextStart}` : "Đã kín ngày"}</small>
                      </span>
                    </button>
                  ) : null}
                  {!dayBlocks.length && !canEdit ? (
                    <div className="part-time-day-empty">Chưa có ca bán thời gian</div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="part-time-schedule-footer-note">
        <CalendarDays size={17} />
        <span>
          Mọi phân công vẫn đi qua kiểm tra trùng ca, giờ tuần và lịch rảnh chính thức của hệ thống.
        </span>
      </footer>

      <PartTimeShiftModal
        isOpen={Boolean(modalContext)}
        date={modalContext?.date || ""}
        startTime={modalContext?.startTime || defaultStartTime}
        staffList={partTimeStaff}
        onClose={() => setModalContext(null)}
        onConfirm={handleCreateBlock}
        submitting={isCreating}
        defaultDurationHours={4}
      />
    </section>
  );
};

export default PartTimeScheduleWorkspace;
