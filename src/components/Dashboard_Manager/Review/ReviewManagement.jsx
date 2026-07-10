import React, { useMemo, useState, useCallback, useEffect } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

import "./ReviewManagement.scss";

import ReviewsSidebarFilters from "./components/ReviewsSidebarFilters";
import ReviewsList from "./components/ReviewsList";
import ReviewModal from "./components/ReviewModal";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";
import { hasPermission } from "@/utils/frontendPermissionAccess";
import NotificationBell from "@/components/common/NotificationBell";

const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      avatarUrl
      roleName
      role {
        slug
        name
        permissions {
          code
        }
        directPermissions {
          code
        }
        parentRole {
          slug
          permissions {
            code
          }
        }
      }
    }
  }
`;

const GET_SCOPED_RESTAURANTS = gql`
  query ScopedRestaurants($limit: Int = 100, $cursor: ID) {
    scopedRestaurants(
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query AllRestaurants($limit: Int = 100, $cursor: ID) {
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

const GET_REVIEWS = gql`
  query GetReviews(
    $restaurantId: ID
    $targetType: String
    $status: String
    $minRating: Int
    $maxRating: Int
  ) {
    reviews(
      restaurantId: $restaurantId
      targetType: $targetType
      status: $status
      minRating: $minRating
      maxRating: $maxRating
      limit: 100
      skip: 0
    ) {
      total
      items {
        id
        targetType
        targetId
        targetName
        restaurantId
        restaurantName
        customerId
        customerName
        staffId
        staffName
        customerAvatar
        rating
        title
        content
        images
        location
        verifiedPurchase
        tags
        status
        likesCount
        commentsCount
        reportsCount
        helpfulCount
        verifiedSource
        sentiment
        topicTags
        firstOfficialReplyAt
        reactions {
          like
          love
          care
          haha
          wow
          sad
          angry
          total
        }
        createdAt
        firstOfficialReply {
          id
          authorName
          content
          createdAt
        }
      }
    }
  }
`;

const GET_REVIEW_ANALYTICS = gql`
  query GetReviewAnalytics($restaurantId: ID, $targetType: String) {
    reviewAnalytics(restaurantId: $restaurantId, targetType: $targetType) {
      totalReviews
      avgRating
      verifiedRate
      pendingCount
      negativeCount
      reportedCount
      ratingTrend {
        date
        total
        avgRating
      }
      topTags {
        name
        count
      }
      topStaffMentioned {
        id
        name
        count
      }
      lowRatedTargets {
        id
        name
        targetType
        count
        avgRating
      }
      reportBreakdown {
        name
        count
      }
      actionQueueCounts {
        needsModeration
        needsReply
        highRisk
      }
      reviewInsightSummary {
        summary
        positives
        negatives
        recommendedActions
        topPriorities
        confidence
        source
      }
      recommendedActions
      insightSource
    }
  }
`;

const GET_REVIEW_REPORTS = gql`
  query GetReviewReports($restaurantId: ID, $status: String, $limit: Int = 10) {
    reviewReports(restaurantId: $restaurantId, status: $status, limit: $limit) {
      total
      items {
        id
        reviewId
        restaurantId
        reporterUserId
        reason
        detail
        status
        resolutionNote
        createdAt
        resolvedAt
      }
    }
    reviewReportStats(restaurantId: $restaurantId) {
      total
      pending
      resolved
      rejected
      byReason
    }
  }
`;

const RESOLVE_REVIEW_REPORT = gql`
  mutation ResolveReviewReport($id: ID!, $input: ReviewReportResolveInput!) {
    resolveReviewReport(id: $id, input: $input) {
      id
      status
      resolutionNote
      resolvedAt
    }
  }
`;

const GET_REVIEW_STATS = gql`
  query GetReviewStats($restaurantId: ID, $targetType: String) {
    reviewStats(restaurantId: $restaurantId, targetType: $targetType) {
      total
      avgRating
      pending
      ratingBreakdown
    }
  }
`;

const SET_REVIEW_STATUS = gql`
  mutation SetReviewStatus(
    $id: ID!
    $status: String!
    $reason: String
    $moderationNote: String
  ) {
    setReviewStatus(
      id: $id
      status: $status
      reason: $reason
      moderationNote: $moderationNote
    ) {
      id
      status
      moderationNote
    }
  }
`;

const normalizeReview = (review) => ({
  id: review.id,
  type: review.targetType,
  target_id: review.targetId,
  target_name: review.targetName,
  restaurant_id: review.restaurantId,
  restaurant_name: review.restaurantName,
  customer_id: review.customerId,
  customer_name: review.customerName,
  staff_id: review.staffId || null,
  staff_name: review.staffName || "",
  customer_avatar: review.customerAvatar,
  rating: review.rating,
  title: review.title || "(Không tiêu đề)",
  content: review.content,
  images: JSON.stringify(review.images || []),
  status: review.status,
  location: review.location || "Không rõ",
  verified_purchase: Boolean(review.verifiedPurchase),
  tags: JSON.stringify(review.tags || []),
  likes: review.likesCount || 0,
  replies: review.commentsCount || 0,
  reports_count: review.reportsCount || 0,
  helpful_count: review.helpfulCount || 0,
  verified_source: review.verifiedSource || "",
  sentiment: review.sentiment || "",
  topic_tags: review.topicTags || [],
  first_official_reply_at:
    review.firstOfficialReplyAt || review.firstOfficialReply?.createdAt || "",
  reactions: review.reactions || {},
  created_at: review.createdAt,
  first_official_reply: review.firstOfficialReply || null,
});

function getInsightSourceLabel(source) {
  if (source === "gemini") return "AI Gemini";
  if (source === "ai") return "AI";
  if (source === "heuristic_fallback") return "Phân tích dự phòng";
  return "Tóm tắt tự động";
}

function getReportStatusLabel(status) {
  const labels = {
    pending: "Báo cáo chờ xử lý",
    resolved: "Đã xử lý",
    rejected: "Đã từ chối",
  };
  return labels[status] || status || "Chưa rõ";
}

function asList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getRoleText(user) {
  return String(user?.roleName || user?.role?.slug || user?.role?.name || "")
    .trim()
    .toLowerCase();
}

function getModerationSuccessMessage(_review, status) {
  if (status === "reported")
    return "Đã đánh dấu review đang được xem xét từ report hợp lệ.";
  return "Đã lưu ghi chú hậu kiểm nội bộ.";
}

const defaultReviewFilters = {
  ratings: [5, 4, 3, 2, 1],
  status: "",
  time: "",
  image: "",
  restaurant: "",
  verified: "",
  staffAssigned: "",
  sort: "newest",
  actionQueue: "",
};

const ReviewManagement = () => {
  const [currentTab, setCurrentTab] = useState("all");
  const [filters, setFilters] = useState(defaultReviewFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [notification, setNotification] = useState(null);

  const notify = useCallback((message, type = "success") => {
    setNotification({ message, type });
  }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timer = window.setTimeout(() => setNotification(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;
  const roleText = getRoleText(me);
  const isAdminUser = roleText.includes("admin");
  const canReadAnalytics = hasPermission(me, "review.analytics.read");
  const isAnalyticsTab = currentTab === "analytics";

  const { data: scopedRestaurantsData } = useQuery(GET_SCOPED_RESTAURANTS, {
    variables: { limit: 100 },
    skip: !me?.id || isAdminUser,
    fetchPolicy: "network-only",
  });

  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: !isAdminUser,
    fetchPolicy: "network-only",
  });

  const restaurantOptions = useMemo(() => {
    if (isAdminUser) {
      return (allRestaurantsData?.restaurants?.edges || []).map(
        (edge) => edge.node,
      );
    }
    return (scopedRestaurantsData?.scopedRestaurants?.edges || []).map(
      (edge) => edge.node,
    );
  }, [allRestaurantsData, isAdminUser, scopedRestaurantsData]);

  useEffect(() => {
    if (!me || isAdminUser || filters.restaurant || !restaurantOptions.length)
      return;
    setFilters((prev) =>
      prev.restaurant ? prev : { ...prev, restaurant: restaurantOptions[0].id },
    );
  }, [filters.restaurant, isAdminUser, me, restaurantOptions]);

  const gqlTargetType = [
    "all",
    "analytics",
    "reported",
    "hidden",
    "rejected",
  ].includes(currentTab)
    ? undefined
    : currentTab;
  const gqlStatus = isAnalyticsTab
    ? undefined
    : currentTab === "reported"
      ? "reported"
      : currentTab === "hidden"
        ? "hidden"
        : currentTab === "rejected"
          ? "rejected"
          : filters.status || undefined;
  const gqlMinRating = filters.ratings?.length
    ? Math.min(...filters.ratings)
    : undefined;
  const gqlMaxRating = filters.ratings?.length
    ? Math.max(...filters.ratings)
    : undefined;

  const { data, loading, error, refetch } = useQuery(GET_REVIEWS, {
    variables: {
      restaurantId: filters.restaurant || undefined,
      targetType: gqlTargetType,
      status: gqlStatus,
      minRating: gqlMinRating,
      maxRating: gqlMaxRating,
    },
    fetchPolicy: "cache-and-network",
  });

  const { data: statsData } = useQuery(GET_REVIEW_STATS, {
    variables: {
      restaurantId: filters.restaurant || undefined,
      targetType: gqlTargetType,
    },
  });

  const shouldSkipAnalytics =
    !isAnalyticsTab ||
    !canReadAnalytics ||
    (!isAdminUser && !filters.restaurant);

  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useQuery(GET_REVIEW_ANALYTICS, {
    variables: {
      restaurantId: filters.restaurant || undefined,
      targetType: undefined,
    },
    skip: shouldSkipAnalytics,
    fetchPolicy: "cache-and-network",
  });

  const { data: reportsData, refetch: refetchReports } = useQuery(
    GET_REVIEW_REPORTS,
    {
      variables: {
        restaurantId: filters.restaurant || undefined,
        status: undefined,
        limit: 12,
      },
      skip: shouldSkipAnalytics,
      fetchPolicy: "cache-and-network",
    },
  );

  const [setReviewStatus] = useMutation(SET_REVIEW_STATUS);
  const [resolveReviewReport] = useMutation(RESOLVE_REVIEW_REPORT);

  const reviews = useMemo(
    () => (data?.reviews?.items || []).map(normalizeReview),
    [data],
  );
  const reviewsTotal = Number(data?.reviews?.total || 0);
  const isPartialReviewList = reviewsTotal > reviews.length;

  const filteredReviews = useMemo(() => {
    let list = [...reviews];

    if (filters.ratings?.length) {
      list = list.filter((review) => filters.ratings.includes(review.rating));
    }

    if (filters.time) {
      const now = new Date();
      const cutoff = new Date();
      if (filters.time === "today") cutoff.setHours(0, 0, 0, 0);
      if (filters.time === "week") cutoff.setDate(now.getDate() - 7);
      if (filters.time === "month") cutoff.setMonth(now.getMonth() - 1);
      if (filters.time === "quarter") cutoff.setMonth(now.getMonth() - 3);
      list = list.filter((review) => new Date(review.created_at) >= cutoff);
    }

    if (filters.image === "with-images") {
      list = list.filter(
        (review) => JSON.parse(review.images || "[]").length > 0,
      );
    }
    if (filters.image === "no-images") {
      list = list.filter(
        (review) => JSON.parse(review.images || "[]").length === 0,
      );
    }

    if (filters.verified === "verified") {
      list = list.filter((review) => review.verified_purchase);
    }
    if (filters.verified === "unverified") {
      list = list.filter((review) => !review.verified_purchase);
    }

    if (filters.staffAssigned === "with-staff") {
      list = list.filter((review) => Boolean(review.staff_id));
    }
    if (filters.staffAssigned === "without-staff") {
      list = list.filter((review) => !review.staff_id);
    }

    if (filters.actionQueue === "needsModeration") {
      list = list.filter(
        (review) =>
          review.status === "reported" || Number(review.reports_count || 0) > 0,
      );
    }
    if (filters.actionQueue === "needsReply") {
      list = list.filter(
        (review) =>
          ["published", "reported"].includes(review.status) &&
          Number(review.rating || 0) <= 2 &&
          !review.first_official_reply,
      );
    }
    if (filters.actionQueue === "reports") {
      list = list.filter(
        (review) =>
          review.status === "reported" || Number(review.reports_count || 0) > 0,
      );
    }
    if (filters.actionQueue === "highRisk") {
      list = list.filter(
        (review) =>
          Number(review.reports_count || 0) >= 3 ||
          Number(review.rating || 0) <= 1,
      );
    }
    if (filters.actionQueue === "recentlyDone") {
      list = list.filter(
        (review) =>
          ["published", "hidden", "rejected"].includes(review.status) &&
          (review.first_official_reply || review.reports_count === 0),
      );
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (review) =>
          (review.customer_name || "").toLowerCase().includes(term) ||
          (review.title || "").toLowerCase().includes(term) ||
          (review.content || "").toLowerCase().includes(term) ||
          (review.staff_name || "").toLowerCase().includes(term) ||
          (review.target_name || "").toLowerCase().includes(term) ||
          (review.restaurant_name || "").toLowerCase().includes(term),
      );
    }

    if (filters.sort === "oldest") {
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (filters.sort === "rating_desc") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (filters.sort === "rating_asc") {
      list.sort((a, b) => a.rating - b.rating);
    } else {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return list;
  }, [filters, reviews, searchTerm]);

  const stats = useMemo(() => {
    const apiStats = statsData?.reviewStats;
    if (apiStats) {
      return {
        total: apiStats.total,
        avg: Number(apiStats.avgRating || 0).toFixed(1),
      };
    }

    const total = reviews.length;
    const avg = total
      ? (
          reviews.reduce((sum, review) => sum + review.rating, 0) / total
        ).toFixed(1)
      : "0.0";
    return { total, avg };
  }, [reviews, statsData]);

  const analytics = analyticsData?.reviewAnalytics;
  const queueCounts = analytics?.actionQueueCounts || {};
  const reportRows = reportsData?.reviewReports?.items || [];
  const reportStats = reportsData?.reviewReportStats;
  const localUnderReviewCount = reviews.filter(
    (review) =>
      review.status === "reported" || Number(review.reports_count || 0) > 0,
  ).length;
  const underReviewCount =
    analytics?.reportedCount ??
    queueCounts.needsModeration ??
    reportStats?.pending ??
    localUnderReviewCount;
  const needsReplyCount =
    queueCounts.needsReply ??
    reviews.filter(
      (review) =>
        ["published", "reported"].includes(review.status) &&
        Number(review.rating || 0) <= 2 &&
        !review.first_official_reply,
    ).length;
  const highRiskCount =
    queueCounts.highRisk ??
    reviews.filter(
      (review) =>
        Number(review.reports_count || 0) >= 3 ||
        (Number(review.rating || 0) <= 2 &&
          Number(review.reports_count || 0) > 0),
    ).length;
  const negativeCount =
    analytics?.negativeCount ??
    reviews.filter((review) => Number(review.rating || 0) <= 2).length;
  const doneCount = reviews.filter(
    (review) =>
      (review.status === "published" && review.first_official_reply) ||
      (review.status === "reported" && Number(review.reports_count || 0) === 0),
  ).length;
  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      filters.status ||
      filters.time ||
      filters.image ||
      filters.verified ||
      filters.staffAssigned ||
      filters.actionQueue ||
      filters.sort !== defaultReviewFilters.sort ||
      (isAdminUser && filters.restaurant) ||
      (filters.ratings || []).length !== defaultReviewFilters.ratings.length,
  );
  const reviewsById = new Map(reviews.map((review) => [review.id, review]));

  const pendingReportCount =
    reportStats?.pending ??
    reportRows.filter((report) => report.status === "pending").length;

  const queueTiles = [
    {
      id: "reports",
      label: "Báo cáo cần xử lý",
      value: pendingReportCount || underReviewCount,
      hint: "Hậu kiểm báo cáo và đánh giá bị báo cáo",
      tone: "warning",
    },
    {
      id: "needsReply",
      label: "Đánh giá cần phản hồi",
      value: needsReplyCount,
      hint: "1–2 sao chưa có phản hồi chính thức",
      tone: "danger",
    },
    {
      id: "highRisk",
      label: "Review rủi ro cao",
      value: highRiskCount,
      hint: "Nhiều báo cáo hoặc điểm rất thấp",
      tone: "critical",
    },
    {
      id: "recentlyDone",
      label: "Đã xử lý gần đây",
      value: doneCount,
      hint: "Đã phản hồi hoặc đóng báo cáo",
      tone: "success",
    },
  ];

  const handleQueueClick = useCallback((tile) => {
    setFilters((prev) => ({
      ...prev,
      actionQueue: tile.id,
      ratings: tile.id === "needsReply" ? [1, 2] : prev.ratings,
    }));
    setCurrentTab(tile.id === "reports" ? "reported" : "all");
  }, []);

  const actionCenterItems = useMemo(
    () => ({
      reports: reviews
        .filter(
          (review) =>
            review.status === "reported" ||
            Number(review.reports_count || 0) > 0,
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, 5),
      needsReply: reviews
        .filter(
          (review) =>
            ["published", "reported"].includes(review.status) &&
            Number(review.rating || 0) <= 2 &&
            !review.first_official_reply,
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, 5),
      highRisk: reviews
        .filter(
          (review) =>
            Number(review.reports_count || 0) >= 3 ||
            Number(review.rating || 0) <= 1,
        )
        .sort(
          (a, b) =>
            Number(b.reports_count || 0) - Number(a.reports_count || 0),
        )
        .slice(0, 5),
      recentlyDone: reviews
        .filter(
          (review) =>
            ["published", "hidden", "rejected"].includes(review.status) &&
            (review.first_official_reply ||
              Number(review.reports_count || 0) === 0),
        )
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5),
    }),
    [reviews],
  );

  const handleResolveReport = useCallback(
    async (report, status = "resolved") => {
      const resolutionNote =
        status === "resolved"
          ? "Manager đã xử lý báo cáo từ trung tâm báo cáo vi phạm."
          : "Manager từ chối báo cáo từ trung tâm báo cáo vi phạm.";
      try {
        await resolveReviewReport({
          variables: { id: report.id, input: { status, resolutionNote } },
        });
        await refetchReports?.();
        await refetch();
        notify(
          status === "resolved" ? "Đã xử lý báo cáo" : "Đã từ chối báo cáo",
        );
      } catch (err) {
        notify(err?.message || "Không thể xử lý report.", "error");
      }
    },
    [notify, refetch, refetchReports, resolveReviewReport],
  );

  const handleReportReviewAction = useCallback(
    async (report, reviewStatus) => {
      const reason = "Admin xử lý đánh giá từ trung tâm báo cáo.";
      try {
        await setReviewStatus({
          variables: {
            id: report.reviewId,
            status: reviewStatus,
            reason,
            moderationNote: reason,
          },
        });
        await refetchReports?.();
        await refetch();
        notify("Đã cập nhật đánh giá từ trung tâm báo cáo");
      } catch (err) {
        notify(err?.message || "Không thể cập nhật review từ report.", "error");
      }
    },
    [notify, refetch, refetchReports, setReviewStatus],
  );

  const handleViewReview = useCallback((review) => {
    setSelectedReview(review);
    setModalVisible(true);
  }, []);

  const handleModerate = useCallback(
    async (review, status) => {
      try {
        const reason =
          status === "reported"
            ? "Manager đánh dấu review cần hậu kiểm từ trang quản lý đánh giá."
            : "Admin xử lý review theo chính sách từ trang quản lý đánh giá.";
        await setReviewStatus({
          variables: { id: review.id, status, reason, moderationNote: reason },
        });
        await refetch();
        notify(getModerationSuccessMessage(review, status));
      } catch (err) {
        notify(
          err?.message || "Không thể cập nhật trạng thái đánh giá.",
          "error",
        );
      }
    },
    [notify, refetch, setReviewStatus],
  );

  const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const handleExport = () => {
    if (!permissions.canExport) return;
    const header = [
      "ID",
      "Khách hàng",
      "Nhân viên được đánh giá",
      "Đánh giá",
      "Tiêu đề",
      "Nội dung",
      "Nhà hàng",
      "Loại",
      "Trạng thái",
      "Xác thực",
      "Nguồn xác thực",
      "Sentiment",
      "Topic tags",
      "Official reply",
      "First official reply at",
      "Báo cáo",
      "Target",
      "Thời gian",
    ].join(",");
    const rows = filteredReviews.map((review) =>
      [
        review.id,
        escapeCsv(review.customer_name),
        escapeCsv(review.staff_name || "Không gắn nhân viên"),
        review.rating,
        escapeCsv(review.title),
        escapeCsv(review.content),
        escapeCsv(review.restaurant_name),
        review.type,
        review.status,
        review.verified_purchase ? "yes" : "no",
        escapeCsv(review.verified_source),
        escapeCsv(review.sentiment),
        escapeCsv((review.topic_tags || []).join("; ")),
        review.first_official_reply ? "replied" : "unreplied",
        escapeCsv(
          review.first_official_reply_at
            ? new Date(review.first_official_reply_at).toLocaleString("vi-VN")
            : "",
        ),
        review.reports_count || 0,
        escapeCsv(review.target_name),
        escapeCsv(new Date(review.created_at).toLocaleString("vi-VN")),
      ].join(","),
    );
    const csv = `\uFEFF${[header, ...rows].join("\n")}`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `reviews_export_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    if (analytics) {
      const summaryBlob = new Blob(
        [
          JSON.stringify(
            {
              totalReviews: analytics.totalReviews,
              avgRating: analytics.avgRating,
              negativeCount: analytics.negativeCount,
              verifiedRate: analytics.verifiedRate,
              replyRate: analytics.replyRate,
              topTags: analytics.topTags,
              ratingTrend: analytics.ratingTrend,
              actionQueueCounts: analytics.actionQueueCounts,
              reviewInsightSummary: analytics.reviewInsightSummary,
            },
            null,
            2,
          ),
        ],
        { type: "application/json;charset=utf-8" },
      );
      const summaryUrl = URL.createObjectURL(summaryBlob);
      const summaryLink = document.createElement("a");
      summaryLink.href = summaryUrl;
      summaryLink.download = `reviews_analytics_summary_${today}.json`;
      summaryLink.click();
      URL.revokeObjectURL(summaryUrl);
    }
  };

  const handleResetFilters = useCallback(() => {
    setSearchTerm("");
    setCurrentTab("all");
    setFilters((prev) => ({
      ...defaultReviewFilters,
      restaurant: isAdminUser ? "" : prev.restaurant,
    }));
  }, [isAdminUser]);

  const permissions = {
    canModerate: hasPermission(me, "review.moderate"),
    canAdminModerate: isAdminUser && hasPermission(me, "review.moderate"),
    canExport: hasPermission(me, "review.export"),
    canReply: hasPermission(me, "review.reply"),
    canReadAnalytics,
    canResolveReports: hasPermission(me, "review.report.resolve"),
  };

  const titleMap = {
    all: "Tất cả đánh giá",
    restaurant: "Đánh giá nhà hàng",
    food: "Đánh giá món ăn",
    service: "Đánh giá dịch vụ",
    reported: "Bị báo cáo",
    hidden: "Đã ẩn",
    rejected: "Từ chối",
  };

  const commandTabs = [
    { id: "all", label: "Tất cả" },
    ...(canReadAnalytics ? [{ id: "analytics", label: "Phân tích" }] : []),
    { id: "restaurant", label: "Nhà hàng" },
    { id: "food", label: "Món ăn" },
    { id: "service", label: "Dịch vụ" },
    { id: "reported", label: "Bị báo cáo" },
    { id: "hidden", label: "Đã ẩn" },
    { id: "rejected", label: "Từ chối" },
  ];

  return (
    <div className="reviews-page">
      {notification && (
        <div
          className={`reviews-toast reviews-toast--${notification.type}`}
          role="status"
        >
          {notification.message}
        </div>
      )}

      <div className="reviews-container">
        <ManagementPageHeader
          density="compact"
          showTimeWidget={false}
          eyebrow="REVIEW MANAGER"
          title="Quản lý đánh giá"
          subtitle="Theo dõi phản hồi, điểm đánh giá và trạng thái xử lý của khách hàng theo từng nhà hàng."
          icon="⭐"
          stats={[
            {
              id: "total",
              icon: "🧾",
              label: "Tổng đánh giá",
              value: stats.total,
            },
            {
              id: "avg",
              icon: "⭐",
              label: "Điểm trung bình",
              value: stats.avg,
            },
            {
              id: "needsReply",
              icon: "💬",
              label: "Chưa phản hồi",
              value: needsReplyCount,
            },
            {
              id: "bad",
              icon: "⚠️",
              label: "Tiêu cực/cảnh báo",
              value: negativeCount || highRiskCount,
            },
          ]}
          secondaryActions={
            permissions.canExport
              ? [{ label: "Xuất báo cáo", icon: "📊", onClick: handleExport }]
              : []
          }
        />

        <div className="reviews-notification-row">
          <div>
            <strong>Thông báo đánh giá gần đây</strong>
            <span>
              Quản lý và khách hàng có thể xem thông báo trong ứng dụng và đánh
              dấu đã đọc.
            </span>
          </div>
          <NotificationBell
            restaurantId={filters.restaurant || null}
            title="Thông báo đánh giá"
          />
        </div>

        <ManagerCommandBar
          tabs={commandTabs}
          activeTab={currentTab}
          onTabChange={setCurrentTab}
          searchValue={isAnalyticsTab ? "" : searchTerm}
          onSearchChange={isAnalyticsTab ? undefined : setSearchTerm}
          searchPlaceholder="Tìm khách hàng, nhân viên, tiêu đề, nội dung..."
        />

        <section
          className="reviews-main-content"
          aria-label="Nội dung quản lý đánh giá"
        >
          <div
            className={`reviews-content-grid ${isAnalyticsTab ? "reviews-content-grid--analytics" : ""}`}
          >
            {!isAnalyticsTab && (
              <ReviewsSidebarFilters
                filters={filters}
                onChange={setFilters}
                restaurantOptions={restaurantOptions}
                onReset={handleResetFilters}
              />
            )}

            <section
              className={`reviews-content-area ${isAnalyticsTab ? "reviews-content-area--analytics" : ""}`}
            >
              {isAnalyticsTab ? (
                <>
                  <div className="reviews-analytics-scope">
                    <div>
                      <span>Phạm vi dữ liệu</span>
                      <strong>Phân tích đánh giá</strong>
                    </div>
                    <label>
                      <span>Nhà hàng</span>
                      <select
                        aria-label="Phạm vi nhà hàng phân tích"
                        value={filters.restaurant}
                        onChange={(event) =>
                          setFilters((prev) => ({
                            ...prev,
                            restaurant: event.target.value,
                          }))
                        }
                      >
                        {isAdminUser && (
                          <option value="">Tất cả nhà hàng</option>
                        )}
                        {!isAdminUser && !filters.restaurant && (
                          <option value="">Chọn nhà hàng</option>
                        )}
                        {restaurantOptions.map((restaurant) => (
                          <option key={restaurant.id} value={restaurant.id}>
                            {restaurant.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <section
                    className="reviews-analytics-panel"
                    aria-label="Tổng quan đánh giá"
                  >
                    <div className="reviews-analytics-panel__header">
                      <div>
                        <p className="reviews-analytics-panel__eyebrow">
                          Phân tích
                        </p>
                        <h2>Tổng quan đánh giá</h2>
                      </div>
                      {!shouldSkipAnalytics && analyticsError && (
                        <button
                          type="button"
                          className="reviews-btn reviews-btn-secondary"
                          onClick={() => refetchAnalytics()}
                        >
                          Thử lại phân tích
                        </button>
                      )}
                    </div>

                    {shouldSkipAnalytics ? (
                      <div className="reviews-analytics-loading">
                        Chọn nhà hàng để xem phân tích trong phạm vi quản lý.
                      </div>
                    ) : analyticsLoading ? (
                      <div className="reviews-analytics-loading">
                        Đang tải dữ liệu phân tích...
                      </div>
                    ) : analyticsError ? (
                      <div className="reviews-error-box">
                        Không thể tải phân tích. Hãy thử lại hoặc chuyển về tab
                        đánh giá để tiếp tục xử lý review.
                      </div>
                    ) : (
                      <>
                        {analytics?.reviewInsightSummary ? (
                          <div className="reviews-insight-card">
                            <div>
                              <p>Tóm tắt phân tích</p>
                              <div className="reviews-insight-card__meta">
                                <span>
                                  Nguồn:{" "}
                                  {getInsightSourceLabel(
                                    analytics.reviewInsightSummary.source,
                                  )}
                                </span>
                                {Number.isFinite(
                                  Number(
                                    analytics.reviewInsightSummary.confidence,
                                  ),
                                ) && (
                                  <span>
                                    Độ tin cậy{" "}
                                    {Math.round(
                                      Number(
                                        analytics.reviewInsightSummary
                                          .confidence,
                                      ) * 100,
                                    )}
                                    %
                                  </span>
                                )}
                              </div>
                              <h3>
                                {analytics.reviewInsightSummary.summary}
                              </h3>
                              {analytics.reviewInsightSummary.source ===
                                "heuristic_fallback" && (
                                <small className="reviews-insight-card__fallback-note">
                                  AI không khả dụng, hệ thống dùng phân tích dự
                                  phòng.
                                </small>
                              )}
                            </div>
                            <div className="reviews-insight-card__columns">
                              <section>
                                <strong>Khách khen</strong>
                                {asList(
                                  analytics.reviewInsightSummary.positives,
                                ).map((item) => (
                                  <span key={item}>{item}</span>
                                ))}
                              </section>
                              <section>
                                <strong>Khách chê</strong>
                                {asList(
                                  analytics.reviewInsightSummary.negatives,
                                ).map((item) => (
                                  <span key={item}>{item}</span>
                                ))}
                              </section>
                              <section>
                                <strong>Hành động đề xuất</strong>
                                {asList(
                                  analytics.reviewInsightSummary
                                    .recommendedActions,
                                )
                                  .slice(0, 3)
                                  .map((item) => (
                                    <span key={item}>{item}</span>
                                  ))}
                              </section>
                            </div>
                          </div>
                        ) : (
                          <div className="reviews-insight-card reviews-insight-card--empty">
                            Chưa đủ dữ liệu để tạo phân tích.
                          </div>
                        )}

                        <div className="reviews-queue-grid">
                          {queueTiles.map((tile) => (
                            <button
                              type="button"
                              key={tile.label}
                              className={`reviews-queue-tile reviews-queue-tile--${tile.tone} ${filters.actionQueue === tile.id ? "is-active" : ""}`}
                              onClick={() => handleQueueClick(tile)}
                            >
                              <strong>{tile.value}</strong>
                              <span>{tile.label}</span>
                              <small>{tile.hint}</small>
                            </button>
                          ))}
                        </div>

                        <div className="reviews-action-center">
                          <div className="reviews-action-center__header">
                            <div>
                              <p>Trung tâm xử lý đánh giá</p>
                              <h3>Trung tâm xử lý đánh giá</h3>
                            </div>
                            {filters.actionQueue && (
                              <button
                                type="button"
                                className="reviews-btn reviews-btn-secondary"
                                onClick={() =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    actionQueue: "",
                                  }))
                                }
                              >
                                Xem tất cả
                              </button>
                            )}
                          </div>
                          <div className="reviews-action-center__grid">
                            {[
                              ["reports", "Báo cáo cần xử lý"],
                              ["needsReply", "Đánh giá cần phản hồi"],
                              ["highRisk", "Review rủi ro cao"],
                              ["recentlyDone", "Đã xử lý gần đây"],
                            ].map(([key, label]) => (
                              <div
                                className="reviews-action-center__lane"
                                key={key}
                              >
                                <h4>{label}</h4>
                                {actionCenterItems[key].length ? (
                                  actionCenterItems[key].map((item) => (
                                    <button
                                      type="button"
                                      key={item.id}
                                      onClick={() => handleViewReview(item)}
                                    >
                                      <strong>
                                        {item.rating}/5 ·{" "}
                                        {item.customer_name || "Khách hàng"}
                                      </strong>
                                      <span>{item.title}</span>
                                      <small>
                                        {item.reports_count || 0} báo cáo ·{" "}
                                        {new Date(
                                          item.created_at,
                                        ).toLocaleDateString("vi-VN")}
                                      </small>
                                    </button>
                                  ))
                                ) : (
                                  <p>Không có mục cần xử lý.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="reviews-report-center">
                          <div className="reviews-report-center__header">
                            <div>
                              <p>Trung tâm báo cáo vi phạm</p>
                              <h3>Trung tâm báo cáo vi phạm</h3>
                            </div>
                            <div className="reviews-report-center__stats">
                              <span>
                                Báo cáo chờ xử lý: {reportStats?.pending || 0}
                              </span>
                              <span>
                                Đã xử lý: {reportStats?.resolved || 0}
                              </span>
                              <span>
                                Đã từ chối: {reportStats?.rejected || 0}
                              </span>
                            </div>
                          </div>
                          {reportRows.length ? (
                            <div className="reviews-report-center__list">
                              {reportRows.slice(0, 6).map((report) => {
                                const reportedReview = reviewsById.get(
                                  report.reviewId,
                                );
                                return (
                                  <article key={report.id}>
                                    <header>
                                      <strong>{report.reason}</strong>
                                      <span>
                                        {getReportStatusLabel(report.status)}
                                      </span>
                                    </header>
                                    <p>
                                      {report.detail || "Không có mô tả thêm"}
                                    </p>
                                    <small>
                                      {reportedReview?.title ||
                                        "Đánh giá được báo cáo"}{" "}
                                      ·{" "}
                                      {reportedReview?.customer_name ||
                                        "Người báo cáo đã gửi thông tin"}{" "}
                                      ·{" "}
                                      {new Date(
                                        report.createdAt,
                                      ).toLocaleString("vi-VN")}
                                    </small>
                                    {report.resolutionNote && (
                                      <small>
                                        Ghi chú: {report.resolutionNote}
                                      </small>
                                    )}
                                    <div>
                                      {permissions.canResolveReports && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleResolveReport(
                                                report,
                                                "resolved",
                                              )
                                            }
                                          >
                                            Đánh dấu đã xử lý
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleResolveReport(
                                                report,
                                                "rejected",
                                              )
                                            }
                                          >
                                            Từ chối báo cáo
                                          </button>
                                        </>
                                      )}
                                      {permissions.canAdminModerate && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleReportReviewAction(
                                                report,
                                                "hidden",
                                              )
                                            }
                                          >
                                            Ẩn đánh giá vi phạm
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleReportReviewAction(
                                                report,
                                                "rejected",
                                              )
                                            }
                                          >
                                            Từ chối đánh giá vi phạm
                                          </button>
                                        </>
                                      )}
                                      {!permissions.canResolveReports &&
                                        !permissions.canAdminModerate && (
                                          <small>
                                            Bạn không có quyền xử lý báo cáo.
                                          </small>
                                        )}
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="reviews-report-center__empty">
                              Chưa có báo cáo trong phạm vi hiện tại.
                            </p>
                          )}
                        </div>

                        <div className="reviews-analytics-tables">
                          <div className="reviews-mini-table">
                            <h3>Top vấn đề khách phàn nàn</h3>
                            {(analytics?.topTags || []).length ? (
                              (analytics.topTags || [])
                                .slice(0, 7)
                                .map((item) => (
                                  <div
                                    key={item.name}
                                    className="reviews-mini-table__row"
                                  >
                                    <span>{item.name}</span>
                                    <strong>{item.count}</strong>
                                  </div>
                                ))
                            ) : (
                              <p className="reviews-mini-table__empty">
                                Chưa có tag/vấn đề nổi bật.
                              </p>
                            )}
                          </div>
                          <div className="reviews-mini-table">
                            <h3>Nhân viên được nhắc nhiều</h3>
                            {(analytics?.topStaffMentioned || []).length ? (
                              (analytics.topStaffMentioned || []).map((item) => (
                                <div
                                  key={item.id || item.name}
                                  className="reviews-mini-table__row"
                                >
                                  <span>{item.name || "Chưa đặt tên"}</span>
                                  <strong>{item.count}</strong>
                                </div>
                              ))
                            ) : (
                              <p className="reviews-mini-table__empty">
                                Chưa có đánh giá gắn nhân viên.
                              </p>
                            )}
                          </div>
                          <div className="reviews-mini-table">
                            <h3>Đối tượng điểm thấp</h3>
                            {(analytics?.lowRatedTargets || []).length ? (
                              (analytics.lowRatedTargets || []).map((item) => (
                                <div
                                  key={`${item.targetType}-${item.id}`}
                                  className="reviews-mini-table__row"
                                >
                                  <span>{item.name || "Mục chưa có tên"}</span>
                                  <strong>{item.count}</strong>
                                </div>
                              ))
                            ) : (
                              <p className="reviews-mini-table__empty">
                                Chưa có món/dịch vụ điểm thấp.
                              </p>
                            )}
                          </div>
                          <div className="reviews-mini-table">
                            <h3>Xu hướng điểm đánh giá</h3>
                            {(analytics?.ratingTrend || []).length ? (
                              (analytics.ratingTrend || [])
                                .slice(-6)
                                .map((item) => (
                                  <div
                                    key={item.date}
                                    className="reviews-mini-table__row"
                                  >
                                    <span>{item.date}</span>
                                    <strong>
                                      {item.avgRating}/5 · {item.total}
                                    </strong>
                                  </div>
                                ))
                            ) : (
                              <p className="reviews-mini-table__empty">
                                Chưa có dữ liệu xu hướng.
                              </p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                </>
              ) : (
                <>
                  <div className="reviews-content-header">
                    <h2 className="reviews-content-header__title">
                      {titleMap[currentTab]}
                    </h2>
                    <div className="reviews-content-header__meta">
                      Hiển thị {filteredReviews.length} / {reviewsTotal} đánh giá
                      {isPartialReviewList &&
                        " · Đang hiển thị 100 đánh giá mới nhất, hãy dùng bộ lọc để thu hẹp kết quả."}
                    </div>
                  </div>

                  {error ? (
                    <div className="reviews-error-box">
                      <span>
                        Không thể tải dữ liệu đánh giá. Vui lòng thử lại.
                      </span>
                      <button
                        type="button"
                        className="reviews-btn reviews-btn-secondary"
                        onClick={() => refetch()}
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <ReviewsList
                      isLoading={loading}
                      reviews={filteredReviews}
                      currentTab={currentTab}
                      onView={handleViewReview}
                      onEdit={handleModerate}
                      permissions={permissions}
                      emptyType={hasActiveFilters ? "filtered" : undefined}
                    />
                  )}
                </>
              )}
            </section>
          </div>
        </section>
      </div>

      <ReviewModal
        visible={modalVisible}
        review={selectedReview}
        me={me}
        canReply={permissions.canReply}
        onClose={() => setModalVisible(false)}
      />
    </div>
  );
};

export default ReviewManagement;
