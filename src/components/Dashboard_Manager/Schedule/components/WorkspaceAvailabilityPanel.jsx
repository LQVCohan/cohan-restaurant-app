import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarCheck2, Clock3, LockKeyhole, Users } from "lucide-react";
import { useNotification } from "@/hooks/useNotification";
import "./WorkspaceAvailabilityPanel.scss";

const ME_QUERY = gql`
  query WorkspaceAvailabilityMe {
    me {
      id
      roleName
      refRestaurants { id name }
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query WorkspaceAvailabilityRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges { node { id name } }
    }
  }
`;

const GET_SCOPED_RESTAURANTS = gql`
  query WorkspaceAvailabilityScopedRestaurants($limit: Int = 100, $cursor: ID) {
    scopedRestaurants(limit: $limit, cursor: $cursor) {
      edges { node { id name } }
    }
  }
`;

const GET_WINDOWS = gql`
  query WorkspaceAvailabilityWindows(
    $restaurantId: ID!
    $from: DateTime
    $to: DateTime
    $workspaceType: AvailabilityWorkspaceType!
  ) {
    availabilityWindows(
      restaurantId: $restaurantId
      from: $from
      to: $to
      workspaceType: $workspaceType
    ) {
      id
      periodStart
      periodEnd
      openAt
      closeAt
      status
      effectiveStatus
      workspaceType
      targetEmploymentTypes
      allowFullTimeUnavailableException
      lateChangeRequiresApproval
    }
  }
`;

const GET_SUBMISSIONS = gql`
  query WorkspaceAvailabilitySubmissions($windowId: ID!, $restaurantId: ID!) {
    staffAvailabilitySubmissions(windowId: $windowId, restaurantId: $restaurantId) {
      id
      status
    }
  }
`;

const CREATE_WINDOW = gql`
  mutation CreateWorkspaceAvailabilityWindow($input: CreateAvailabilityWindowInput!) {
    createAvailabilityWindow(input: $input) {
      id
      status
      effectiveStatus
      workspaceType
    }
  }
`;

const OPEN_WINDOW = gql`
  mutation OpenWorkspaceAvailabilityWindow($id: ID!) {
    openAvailabilityWindow(id: $id) {
      id
      status
      effectiveStatus
      workspaceType
    }
  }
`;

const CLOSE_WINDOW = gql`
  mutation CloseWorkspaceAvailabilityWindow($id: ID!) {
    closeAvailabilityWindow(id: $id) {
      id
      status
      effectiveStatus
      workspaceType
    }
  }
`;

const WORKSPACE_META = {
  full_time: {
    label: "Toàn thời gian",
    description: "Nhân viên toàn thời gian báo các ca không thể làm.",
    targetEmploymentTypes: ["full_time"],
    allowFullTimeUnavailableException: true,
  },
  part_time: {
    label: "Bán thời gian",
    description: "Nhân viên đăng ký các ca có thể làm trong tuần.",
    targetEmploymentTypes: ["part_time", "seasonal", "probation", "contract"],
    allowFullTimeUnavailableException: false,
  },
  rotating: {
    label: "Xoay ca",
    description: "Chỉ nhân viên được cấu hình ROTATING đăng ký ca khả dụng.",
    targetEmploymentTypes: [
      "full_time",
      "part_time",
      "probation",
      "seasonal",
      "contract",
    ],
    allowFullTimeUnavailableException: false,
  },
};

const STATUS_LABELS = {
  draft: "Chưa mở",
  open: "Đang mở",
  closed: "Đã đóng",
  locked: "Đã khóa",
  used_for_schedule: "Đã dùng để xếp lịch",
  cancelled: "Đã hủy",
  expired: "Hết hạn",
};

const toDateKey = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd");
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

export default function WorkspaceAvailabilityPanel({ workspaceType }) {
  const normalizedWorkspace = WORKSPACE_META[workspaceType] ? workspaceType : "full_time";
  const meta = WORKSPACE_META[normalizedWorkspace];
  const { showNotification } = useNotification();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const targetStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }),
    [],
  );
  const targetEnd = useMemo(
    () => endOfWeek(targetStart, { weekStartsOn: 1 }),
    [targetStart],
  );
  const queryFrom = useMemo(() => addDays(targetStart, -1), [targetStart]);
  const queryTo = useMemo(() => addDays(targetEnd, 1), [targetEnd]);

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

  const restaurants = useMemo(() => {
    if (me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || [])
        .map((edge) => edge.node)
        .filter(Boolean);
    }
    const scoped = (scopedRestaurantsData?.scopedRestaurants?.edges || [])
      .map((edge) => edge.node)
      .filter(Boolean);
    return scoped.length ? scoped : me?.refRestaurants || [];
  }, [allRestaurantsData, scopedRestaurantsData, me]);

  useEffect(() => {
    if (!restaurants.length) {
      setSelectedRestaurantId("");
      return;
    }
    if (!restaurants.some((item) => item.id === selectedRestaurantId)) {
      setSelectedRestaurantId(restaurants[0].id);
    }
  }, [restaurants, selectedRestaurantId]);

  const {
    data: windowsData,
    loading: windowsLoading,
    error: windowsError,
    refetch: refetchWindows,
  } = useQuery(GET_WINDOWS, {
    variables: {
      restaurantId: selectedRestaurantId,
      from: queryFrom.toISOString(),
      to: queryTo.toISOString(),
      workspaceType: normalizedWorkspace,
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const windowDoc = useMemo(
    () =>
      (windowsData?.availabilityWindows || []).find(
        (item) =>
          toDateKey(item.periodStart) === toDateKey(targetStart) &&
          toDateKey(item.periodEnd) === toDateKey(targetEnd),
      ) || null,
    [windowsData, targetStart, targetEnd],
  );

  const { data: submissionsData, loading: submissionsLoading } = useQuery(
    GET_SUBMISSIONS,
    {
      variables: { windowId: windowDoc?.id, restaurantId: selectedRestaurantId },
      skip: !windowDoc?.id || !selectedRestaurantId,
      fetchPolicy: "network-only",
    },
  );

  const [createWindow, { loading: creating }] = useMutation(CREATE_WINDOW);
  const [openWindow, { loading: opening }] = useMutation(OPEN_WINDOW);
  const [closeWindow, { loading: closing }] = useMutation(CLOSE_WINDOW);
  const busy = windowsLoading || creating || opening || closing;
  const status = String(windowDoc?.effectiveStatus || windowDoc?.status || "draft").toLowerCase();
  const submissions = submissionsData?.staffAvailabilitySubmissions || [];

  const handleOpen = async () => {
    if (!selectedRestaurantId) return;
    try {
      let id = windowDoc?.id;
      let currentStatus = String(windowDoc?.status || "").toLowerCase();

      if (!id) {
        const result = await createWindow({
          variables: {
            input: {
              restaurantId: selectedRestaurantId,
              periodStart: targetStart.toISOString(),
              periodEnd: targetEnd.toISOString(),
              workspaceType: normalizedWorkspace,
              targetEmploymentTypes: meta.targetEmploymentTypes,
              allowFullTimeUnavailableException:
                meta.allowFullTimeUnavailableException,
              lateChangeRequiresApproval: true,
            },
          },
        });
        id = result.data?.createAvailabilityWindow?.id;
        currentStatus = String(
          result.data?.createAvailabilityWindow?.status || "draft",
        ).toLowerCase();
      }

      if (!id) throw new Error("Không tạo được kỳ đăng ký.");
      if (currentStatus !== "open") {
        await openWindow({ variables: { id } });
      }
      await refetchWindows();
      showNotification(`Đã mở đăng ký lịch ${meta.label.toLowerCase()}.`, "success");
    } catch (error) {
      showNotification(
        getErrorMessage(error, "Không thể mở kỳ đăng ký."),
        "error",
      );
    }
  };

  const handleClose = async () => {
    if (!windowDoc?.id) return;
    try {
      await closeWindow({ variables: { id: windowDoc.id } });
      await refetchWindows();
      showNotification(`Đã đóng đăng ký lịch ${meta.label.toLowerCase()}.`, "success");
    } catch (error) {
      showNotification(
        getErrorMessage(error, "Không thể đóng kỳ đăng ký."),
        "error",
      );
    }
  };

  return (
    <section
      className={`workspace-availability-panel is-${normalizedWorkspace}`}
      data-testid="workspace-availability-panel"
      data-workspace-type={normalizedWorkspace}
    >
      <div className="workspace-availability-panel__heading">
        <div>
          <span className="workspace-availability-panel__eyebrow">
            <CalendarCheck2 size={15} /> Đăng ký lịch theo workspace
          </span>
          <h3>Mở đăng ký · {meta.label}</h3>
          <p>{meta.description}</p>
        </div>
        <span className={`workspace-availability-panel__status is-${status}`}>
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      <div className="workspace-availability-panel__grid">
        <label>
          Nhà hàng
          <select
            value={selectedRestaurantId}
            onChange={(event) => setSelectedRestaurantId(event.target.value)}
            disabled={busy}
          >
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <Clock3 size={16} />
          <span>Tuần đăng ký</span>
          <strong>
            {format(targetStart, "dd/MM", { locale: vi })} – {format(targetEnd, "dd/MM/yyyy", { locale: vi })}
          </strong>
        </div>
        <div>
          <Users size={16} />
          <span>Đã gửi</span>
          <strong>{submissionsLoading ? "…" : submissions.length}</strong>
        </div>
        <div>
          <LockKeyhole size={16} />
          <span>Phạm vi</span>
          <strong>{meta.label}</strong>
        </div>
      </div>

      {windowsError ? (
        <p className="workspace-availability-panel__error">
          {getErrorMessage(windowsError, "Không tải được kỳ đăng ký.")}
        </p>
      ) : null}

      <div className="workspace-availability-panel__actions">
        <button
          type="button"
          className="btn-primary"
          onClick={handleOpen}
          disabled={busy || !selectedRestaurantId || ["locked", "used_for_schedule"].includes(status)}
        >
          {busy ? "Đang xử lý…" : status === "closed" ? "Mở lại đăng ký" : "Mở đăng ký"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={handleClose}
          disabled={busy || status !== "open"}
        >
          Đóng đăng ký
        </button>
      </div>
    </section>
  );
}
