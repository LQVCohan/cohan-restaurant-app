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
        permissions { code }
        directPermissions { code }
        parentRole { slug permissions { code } }
      }
    }
  }
`;

const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 100, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
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
        firstOfficialReply { id authorName content createdAt }
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
      ratingTrend { date total avgRating }
      topTags { name count }
      topStaffMentioned { id name count }
      lowRatedTargets { id name targetType count avgRating }
      reportBreakdown { name count }
      actionQueueCounts { needsModeration needsReply highRisk }
      reviewInsightSummary { summary positives negatives recommendedActions topPriorities confidence source }
      recommendedActions
      insightSource
    }
  }
`;

const GET_REVIEW_REPORTS = gql`
  query GetReviewReports($restaurantId: ID, $status: String, $limit: Int = 10) {
    reviewReports(restaurantId: $restaurantId, status: $status, limit: $limit) {
      total
      items { id reviewId restaurantId reporterUserId reason detail status resolutionNote createdAt resolvedAt }
    }
    reviewReportStats(restaurantId: $restaurantId) { total pending resolved rejected byReason }
  }
`;

const RESOLVE_REVIEW_REPORT = gql`
  mutation ResolveReviewReport($id: ID!, $input: ReviewReportResolveInput!) {
    resolveReviewReport(id: $id, input: $input) { id status resolutionNote resolvedAt }
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

const DELETE_REVIEW = gql`
  mutation DeleteReview($id: ID!) {
    deleteReview(id: $id)
  }
`;

const SET_REVIEW_STATUS = gql`
  mutation SetReviewStatus($id: ID!, $status: String!, $reason: String, $moderationNote: String) {
    setReviewStatus(id: $id, status: $status, reason: $reason, moderationNote: $moderationNote) {
      id
      status
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
  first_official_reply_at: review.firstOfficialReplyAt || review.firstOfficialReply?.createdAt || "",
  reactions: review.reactions || {},
  created_at: review.createdAt,
  first_official_reply: review.firstOfficialReply || null,
});

function getRoleText(user) {
  return String(user?.roleName || user?.role?.slug || user?.role?.name || "")
    .trim()
    .toLowerCase();
}

function getModerationSuccessMessage(review, status) {
  if (status === "published") {
    return review?.staff_id
      ? "Đã duyệt đánh giá. Đánh giá này sẽ được dùng làm dữ liệu tham khảo hiệu suất ở lần tính lại tiếp theo."
      : "Đã duyệt đánh giá";
  }

  return status === "reported"
    ? "Đã chuyển về trạng thái bị báo cáo"
    : "Đã chuyển đánh giá sang trạng thái ẩn";
}

const ReviewManagement = () => {
  const [currentTab, setCurrentTab] = useState("all");
  const [filters, setFilters] = useState({
    ratings: [5, 4, 3, 2, 1],
    status: "",
    time: "",
    image: "",
    restaurant: "",
    verified: "",
    staffAssigned: "",
    sort: "newest",
    actionQueue: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [notification, setNotification] = useState(null);
  const [reviewPendingDelete, setReviewPendingDelete] = useState(null);
  const [isDeletingReview, setIsDeletingReview] = useState(false);

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
  const isManagerOrStaffUser = roleText.includes("manager") || roleText.includes("staff");
  const canReadAnalytics = hasPermission(me, "review.analytics.read");

  const { data: managerRestaurantsData } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId: me?.id, limit: 100 },
    skip: !me?.id || !isManagerOrStaffUser,
    fetchPolicy: "network-only",
  });

  const { data: allRestaurantsData } = useQuery(GET_ALL_RESTAURANTS, {
    variables: { limit: 100 },
    skip: !isAdminUser,
    fetchPolicy: "network-only",
  });

  const restaurantOptions = useMemo(() => {
    if (isAdminUser) {
      return (allRestaurantsData?.restaurants?.edges || []).map((edge) => edge.node);
    }
    return (managerRestaurantsData?.restaurantsByManager?.edges || []).map(
      (edge) => edge.node,
    );
  }, [allRestaurantsData, isAdminUser, managerRestaurantsData]);

  useEffect(() => {
    if (!me || isAdminUser || filters.restaurant || !restaurantOptions.length) return;
    setFilters((prev) => (prev.restaurant ? prev : { ...prev, restaurant: restaurantOptions[0].id }));
  }, [filters.restaurant, isAdminUser, me, restaurantOptions]);

  const gqlTargetType = ["all", "pending", "reported", "hidden", "rejected"].includes(currentTab)
    ? undefined
    : currentTab;
  const gqlStatus = currentTab === "pending"
    ? "pending"
    : currentTab === "reported"
      ? "reported"
      : currentTab === "hidden"
        ? "hidden"
        : currentTab === "rejected"
          ? "rejected"
          : filters.status || undefined;
  const gqlMinRating = filters.ratings?.length ? Math.min(...filters.ratings) : undefined;
  const gqlMaxRating = filters.ratings?.length ? Math.max(...filters.ratings) : undefined;

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

  const shouldSkipAnalytics = !canReadAnalytics || (!isAdminUser && !filters.restaurant);

  const { data: analyticsData, loading: analyticsLoading, error: analyticsError, refetch: refetchAnalytics } = useQuery(GET_REVIEW_ANALYTICS, {
    variables: {
      restaurantId: filters.restaurant || undefined,
      targetType: gqlTargetType,
    },
    skip: shouldSkipAnalytics,
    fetchPolicy: "cache-and-network",
  });

  const { data: reportsData, refetch: refetchReports } = useQuery(GET_REVIEW_REPORTS, {
    variables: { restaurantId: filters.restaurant || undefined, status: undefined, limit: 12 },
    skip: shouldSkipAnalytics,
    fetchPolicy: "cache-and-network",
  });

  const [deleteReview] = useMutation(DELETE_REVIEW);
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
      list = list.filter((r) => filters.ratings.includes(r.rating));
    }

    if (filters.time) {
      const now = new Date();
      const cutoff = new Date();
      if (filters.time === "today") cutoff.setHours(0, 0, 0, 0);
      if (filters.time === "week") cutoff.setDate(now.getDate() - 7);
      if (filters.time === "month") cutoff.setMonth(now.getMonth() - 1);
      if (filters.time === "quarter") cutoff.setMonth(now.getMonth() - 3);
      list = list.filter((r) => new Date(r.created_at) >= cutoff);
    }

    if (filters.image === "with-images") {
      list = list.filter((r) => JSON.parse(r.images || "[]").length > 0);
    }
    if (filters.image === "no-images") {
      list = list.filter((r) => JSON.parse(r.images || "[]").length === 0);
    }

    if (filters.verified === "verified") {
      list = list.filter((r) => r.verified_purchase);
    }
    if (filters.verified === "unverified") {
      list = list.filter((r) => !r.verified_purchase);
    }

    if (filters.staffAssigned === "with-staff") {
      list = list.filter((r) => Boolean(r.staff_id));
    }
    if (filters.staffAssigned === "without-staff") {
      list = list.filter((r) => !r.staff_id);
    }

    if (filters.actionQueue === "needsModeration") {
      list = list.filter((r) => ["pending", "reported"].includes(r.status));
    }
    if (filters.actionQueue === "needsReply") {
      list = list.filter((r) => r.status === "published" && Number(r.rating || 0) <= 2 && !r.first_official_reply);
    }
    if (filters.actionQueue === "reports") {
      list = list.filter((r) => r.status === "reported" || Number(r.reports_count || 0) > 0);
    }
    if (filters.actionQueue === "highRisk") {
      list = list.filter((r) => Number(r.reports_count || 0) >= 3 || Number(r.rating || 0) <= 1);
    }
    if (filters.actionQueue === "recentlyDone") {
      list = list.filter((r) => ["published", "hidden", "rejected"].includes(r.status) && (r.first_official_reply || r.reports_count === 0));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          (r.customer_name || "").toLowerCase().includes(term) ||
          (r.title || "").toLowerCase().includes(term) ||
          (r.content || "").toLowerCase().includes(term) ||
          (r.staff_name || "").toLowerCase().includes(term) ||
          (r.target_name || "").toLowerCase().includes(term) ||
          (r.restaurant_name || "").toLowerCase().includes(term),
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
        pending: apiStats.pending,
      };
    }

    const total = reviews.length;
    const avg = total ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : "0.0";
    const pending = reviews.filter((r) => r.status === "pending").length;
    return { total, avg, pending };
  }, [reviews, statsData]);


  const analytics = analyticsData?.reviewAnalytics;
  const queueCounts = analytics?.actionQueueCounts || {};
  const needsReplyCount = queueCounts.needsReply ?? reviews.filter((r) => r.status === "published" && Number(r.rating || 0) <= 2 && !r.first_official_reply).length;
  const highRiskCount = queueCounts.highRisk ?? reviews.filter((r) => Number(r.reports_count || 0) >= 3 || (Number(r.rating || 0) <= 2 && Number(r.reports_count || 0) > 0)).length;
  const doneCount = reviews.filter((r) => (r.status === "published" && r.first_official_reply) || (r.status === "reported" && Number(r.reports_count || 0) === 0)).length;

  const analyticsCards = [
    { label: "Tổng review", value: analytics?.totalReviews ?? reviews.length, icon: "🧾" },
    { label: "Điểm TB", value: Number(analytics?.avgRating || stats.avg || 0).toFixed(1), icon: "⭐" },
    { label: "Tỷ lệ verified", value: `${Math.round(Number(analytics?.verifiedRate || 0) * 100)}%`, icon: "✅" },
    { label: "Review tiêu cực", value: analytics?.negativeCount ?? reviews.filter((r) => Number(r.rating || 0) <= 2).length, icon: "⚠️" },
    { label: "Chờ duyệt", value: analytics?.pendingCount ?? stats.pending, icon: "⏳" },
    { label: "Chưa phản hồi", value: needsReplyCount, icon: "💬" },
    { label: "Report pending", value: analytics?.reportedCount ?? reviews.filter((r) => r.status === "reported").length, icon: "🚩" },
    { label: "High risk", value: highRiskCount, icon: "🔥" },
  ];

  const queueTiles = [
    { id: "needsModeration", label: "Cần kiểm duyệt", value: queueCounts.needsModeration ?? reviews.filter((r) => ["pending", "reported"].includes(r.status)).length, hint: "pending/reported", tone: "warning" },
    { id: "needsReply", label: "Cần phản hồi", value: needsReplyCount, hint: "1–2 sao chưa có reply", tone: "danger" },
    { id: "reports", label: "Report cần xử lý", value: reviews.filter((r) => r.status === "reported" || Number(r.reports_count || 0) > 0).length, hint: "report queue", tone: "danger" },
    { id: "highRisk", label: "Rủi ro cao", value: highRiskCount, hint: "report >= 3 hoặc 1 sao", tone: "critical" },
    { id: "recentlyDone", label: "Đã xử lý gần đây", value: doneCount, hint: "đã reply/đóng report", tone: "success" },
  ];

  const handleQueueClick = useCallback((tile) => {
    setFilters((prev) => ({
      ...prev,
      actionQueue: tile.id,
      ratings: tile.id === "needsReply" ? [1, 2] : prev.ratings,
    }));
    if (tile.id === "reports") setCurrentTab("reported");
    else setCurrentTab("all");
  }, []);

  const actionCenterItems = useMemo(() => ({
    needsModeration: reviews.filter((r) => ["pending", "reported"].includes(r.status)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(0, 5),
    needsReply: reviews.filter((r) => r.status === "published" && Number(r.rating || 0) <= 2 && !r.first_official_reply).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(0, 5),
    highRisk: reviews.filter((r) => Number(r.reports_count || 0) >= 3 || Number(r.rating || 0) <= 1).sort((a, b) => Number(b.reports_count || 0) - Number(a.reports_count || 0)).slice(0, 5),
  }), [reviews]);

  const reportRows = reportsData?.reviewReports?.items || [];
  const reportStats = reportsData?.reviewReportStats;

  const handleResolveReport = useCallback(async (report, status = "resolved") => {
    const resolutionNote = window.prompt(status === "resolved" ? "Ghi chú resolve report:" : "Lý do reject report:", "") || "";
    try {
      await resolveReviewReport({ variables: { id: report.id, input: { status, resolutionNote } } });
      await refetchReports?.();
      await refetch();
      notify(status === "resolved" ? "Đã resolve report" : "Đã reject report");
    } catch (err) {
      notify(err?.message || "Không thể xử lý report.", "error");
    }
  }, [notify, refetch, refetchReports, resolveReviewReport]);

  const handleReportReviewAction = useCallback(async (report, reviewStatus) => {
    const reason = window.prompt("Ghi chú xử lý review từ report:", "") || "";
    try {
      await setReviewStatus({ variables: { id: report.reviewId, status: reviewStatus, reason, moderationNote: reason } });
      await refetchReports?.();
      await refetch();
      notify("Đã cập nhật review từ report center");
    } catch (err) {
      notify(err?.message || "Không thể cập nhật review từ report.", "error");
    }
  }, [notify, refetch, refetchReports, setReviewStatus]);

  const handleViewReview = useCallback((review) => {
    setSelectedReview(review);
    setModalVisible(true);
  }, []);

  const handleDeleteReview = useCallback((review) => {
    setReviewPendingDelete(review);
  }, []);

  const handleCancelDeleteReview = useCallback(() => {
    if (isDeletingReview) return;
    setReviewPendingDelete(null);
  }, [isDeletingReview]);

  const handleConfirmDeleteReview = useCallback(async () => {
    if (!reviewPendingDelete?.id || isDeletingReview) return;
    setIsDeletingReview(true);
    try {
      await deleteReview({ variables: { id: reviewPendingDelete.id } });
      await refetch();
      setReviewPendingDelete(null);
      notify("Đã xóa đánh giá");
    } catch (err) {
      notify(err?.message || "Không thể xóa đánh giá. Vui lòng thử lại.", "error");
    } finally {
      setIsDeletingReview(false);
    }
  }, [deleteReview, isDeletingReview, notify, refetch, reviewPendingDelete]);

  const handleModerate = useCallback(
    async (review, status) => {
      try {
        const reason = ["hidden", "rejected"].includes(status) ? window.prompt("Nhập lý do kiểm duyệt (không bắt buộc):", "") || "" : "";
        await setReviewStatus({ variables: { id: review.id, status, reason, moderationNote: reason } });
        await refetch();
        notify(getModerationSuccessMessage(review, status));
      } catch (err) {
        notify(err?.message || "Không thể cập nhật trạng thái đánh giá.", "error");
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
    const rows = filteredReviews.map((r) =>
      [
        r.id,
        escapeCsv(r.customer_name),
        escapeCsv(r.staff_name || "Không gắn nhân viên"),
        r.rating,
        escapeCsv(r.title),
        escapeCsv(r.content),
        escapeCsv(r.restaurant_name),
        r.type,
        r.status,
        r.verified_purchase ? "yes" : "no",
        escapeCsv(r.verified_source),
        escapeCsv(r.sentiment),
        escapeCsv((r.topic_tags || []).join("; ")),
        r.first_official_reply ? "replied" : "unreplied",
        escapeCsv(r.first_official_reply_at ? new Date(r.first_official_reply_at).toLocaleString("vi-VN") : ""),
        r.reports_count || 0,
        escapeCsv(r.target_name),
        escapeCsv(new Date(r.created_at).toLocaleString("vi-VN")),
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
      const summaryBlob = new Blob([JSON.stringify({
        totalReviews: analytics.totalReviews,
        avgRating: analytics.avgRating,
        negativeCount: analytics.negativeCount,
        verifiedRate: analytics.verifiedRate,
        replyRate: analytics.replyRate,
        topTags: analytics.topTags,
        ratingTrend: analytics.ratingTrend,
        actionQueueCounts: analytics.actionQueueCounts,
        reviewInsightSummary: analytics.reviewInsightSummary,
      }, null, 2)], { type: "application/json;charset=utf-8" });
      const summaryUrl = URL.createObjectURL(summaryBlob);
      const summaryLink = document.createElement("a");
      summaryLink.href = summaryUrl;
      summaryLink.download = `reviews_analytics_summary_${today}.json`;
      summaryLink.click();
      URL.revokeObjectURL(summaryUrl);
    }
  };

  const permissions = {
    canModerate: hasPermission(me, "review.moderate"),
    canDelete: hasPermission(me, "review.delete"),
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
    pending: "Chờ duyệt",
    reported: "Bị báo cáo",
    hidden: "Đã ẩn",
    rejected: "Từ chối",
  };

  return (
    <div className="reviews-page">
      {notification && (
        <div className={`reviews-toast reviews-toast--${notification.type}`} role="status">
          {notification.message}
        </div>
      )}

      <div className="reviews-container">
        <ManagementPageHeader
          density="compact"
          showTimeWidget={false}
          eyebrow="REVIEW MANAGER"
          title="Đánh giá khách hàng"
          subtitle="Xem đánh giá, phản hồi và kiểm duyệt nội dung review."
          icon="⭐"
          stats={[
            { id: "total", icon: "🧾", label: "Tổng đánh giá", value: stats.total },
            { id: "avg", icon: "⭐", label: "Điểm trung bình", value: stats.avg },
            { id: "pending", icon: "⏳", label: "Chờ duyệt", value: stats.pending },
            { id: "bad", icon: "⚠️", label: "Tiêu cực", value: filteredReviews.filter((r) => Number(r.rating || 0) <= 2).length },
          ]}
          secondaryActions={permissions.canExport ? [{ label: "Xuất báo cáo", icon: "📊", onClick: handleExport }] : []}
        />

        <div className="reviews-notification-row">
          <div>
            <strong>Thông báo review gần đây</strong>
            <span>Manager/customer có thể xem notification in-app và đánh dấu đã đọc.</span>
          </div>
          <NotificationBell restaurantId={filters.restaurant || null} title="Thông báo review" />
        </div>

        <ManagerCommandBar
          tabs={[
            { id: "all", label: "Tất cả" },
            { id: "restaurant", label: "Nhà hàng" },
            { id: "food", label: "Món ăn" },
            { id: "service", label: "Dịch vụ" },
            { id: "pending", label: "Chờ duyệt" },
            { id: "reported", label: "Bị báo cáo" },
            { id: "hidden", label: "Đã ẩn" },
            { id: "rejected", label: "Từ chối" },
          ]}
          activeTab={currentTab}
          onTabChange={setCurrentTab}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm khách hàng, nhân viên, tiêu đề, nội dung..."
        />


        <main className="reviews-main-content">
          <div className="reviews-content-grid">
            <ReviewsSidebarFilters
              filters={filters}
              onChange={setFilters}
              restaurantOptions={restaurantOptions}
            />

            <section className="reviews-content-area">

              <section className="reviews-analytics-panel" aria-label="Tổng quan đánh giá">
                <div className="reviews-analytics-panel__header">
                  <div>
                    <p className="reviews-analytics-panel__eyebrow">Phân tích</p>
                    <h2>Tổng quan đánh giá</h2>
                  </div>
                  {!shouldSkipAnalytics && analyticsError && <button type="button" className="reviews-btn reviews-btn-secondary" onClick={() => refetchAnalytics()}>Thử lại analytics</button>}
                </div>

                {shouldSkipAnalytics ? (
                  <div className="reviews-analytics-loading">Đang chuẩn bị dữ liệu phân tích...</div>
                ) : analyticsLoading ? (
                  <div className="reviews-analytics-loading">Đang tải dữ liệu phân tích...</div>
                ) : analyticsError ? (
                  <div className="reviews-error-box">Không thể tải analytics. Dữ liệu review vẫn hiển thị bên dưới.</div>
                ) : (
                  <>

                    {analytics?.reviewInsightSummary && (
                      <div className="reviews-insight-card">
                        <div>
                          <p>Tóm tắt insight ({analytics.reviewInsightSummary.source === "ai" ? "AI" : "Heuristic summary"})</p>
                          <h3>{analytics.reviewInsightSummary.summary}</h3>
                        </div>
                        <div className="reviews-insight-card__columns">
                          <section><strong>Khách khen</strong>{analytics.reviewInsightSummary.positives.map((item) => <span key={item}>{item}</span>)}</section>
                          <section><strong>Khách chê</strong>{analytics.reviewInsightSummary.negatives.map((item) => <span key={item}>{item}</span>)}</section>
                          <section><strong>Hành động đề xuất</strong>{analytics.reviewInsightSummary.recommendedActions.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</section>
                        </div>
                      </div>
                    )}

                    <div className="reviews-analytics-cards">
                      {analyticsCards.map((card) => (
                        <div className="reviews-analytics-card" key={card.label}>
                          <span>{card.icon}</span>
                          <strong>{card.value}</strong>
                          <small>{card.label}</small>
                        </div>
                      ))}
                    </div>

                    <div className="reviews-queue-grid">
                      {queueTiles.map((tile) => (
                        <button type="button" key={tile.label} className={`reviews-queue-tile reviews-queue-tile--${tile.tone} ${filters.actionQueue === tile.id ? "is-active" : ""}`} onClick={() => handleQueueClick(tile)}>
                          <strong>{tile.value}</strong>
                          <span>{tile.label}</span>
                          <small>{tile.hint}</small>
                        </button>
                      ))}
                    </div>


                    <div className="reviews-action-center">
                      <div className="reviews-action-center__header">
                        <div>
                          <p>Review Action Center</p>
                          <h3>Hàng đợi ưu tiên xử lý</h3>
                        </div>
                        {filters.actionQueue && <button type="button" className="reviews-btn reviews-btn-secondary" onClick={() => setFilters((prev) => ({ ...prev, actionQueue: "" }))}>Xem tất cả</button>}
                      </div>
                      <div className="reviews-action-center__grid">
                        {[
                          ["needsModeration", "Cần kiểm duyệt"],
                          ["needsReply", "Cần phản hồi"],
                          ["highRisk", "High risk"],
                        ].map(([key, label]) => (
                          <div className="reviews-action-center__lane" key={key}>
                            <h4>{label}</h4>
                            {actionCenterItems[key].length ? actionCenterItems[key].map((item) => (
                              <button type="button" key={item.id} onClick={() => handleViewReview(item)}>
                                <strong>{item.rating}/5 · {item.customer_name || "Khách hàng"}</strong>
                                <span>{item.title}</span>
                                <small>{item.reports_count || 0} report · {new Date(item.created_at).toLocaleDateString("vi-VN")}</small>
                              </button>
                            )) : <p>Không có item cần xử lý.</p>}
                          </div>
                        ))}
                      </div>
                    </div>


                    <div className="reviews-report-center">
                      <div className="reviews-report-center__header">
                        <div>
                          <p>Review Report Center</p>
                          <h3>Evidence xử lý báo cáo</h3>
                        </div>
                        <div className="reviews-report-center__stats">
                          <span>Pending: {reportStats?.pending || 0}</span>
                          <span>Resolved: {reportStats?.resolved || 0}</span>
                          <span>Rejected: {reportStats?.rejected || 0}</span>
                        </div>
                      </div>
                      {reportRows.length ? (
                        <div className="reviews-report-center__list">
                          {reportRows.slice(0, 6).map((report) => (
                            <article key={report.id}>
                              <header><strong>{report.reason}</strong><span>{report.status}</span></header>
                              <p>{report.detail || "Không có mô tả thêm"}</p>
                              <small>Review #{report.reviewId} · Reporter #{report.reporterUserId} · {new Date(report.createdAt).toLocaleString("vi-VN")}</small>
                              {report.resolutionNote && <small>Ghi chú: {report.resolutionNote}</small>}
                              <div>
                                {permissions.canResolveReports && (
                                  <>
                                    <button type="button" onClick={() => handleResolveReport(report, "resolved")}>Resolve</button>
                                    <button type="button" onClick={() => handleResolveReport(report, "rejected")}>Reject report</button>
                                  </>
                                )}
                                {permissions.canModerate && (
                                  <>
                                    <button type="button" onClick={() => handleReportReviewAction(report, "hidden")}>Hide review</button>
                                    <button type="button" onClick={() => handleReportReviewAction(report, "rejected")}>Reject review</button>
                                  </>
                                )}
                                {!permissions.canResolveReports && !permissions.canModerate && (
                                  <small>Bạn không có quyền xử lý report.</small>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : <p className="reviews-report-center__empty">Chưa có report trong scope hiện tại.</p>}
                    </div>

                    <div className="reviews-analytics-tables">
                      <div className="reviews-mini-table">
                        <h3>Top vấn đề khách phàn nàn</h3>
                        {(analytics?.topTags || []).length ? (analytics.topTags || []).slice(0, 7).map((item) => (
                          <div key={item.name} className="reviews-mini-table__row"><span>{item.name}</span><strong>{item.count}</strong></div>
                        )) : <p className="reviews-mini-table__empty">Chưa có tag/vấn đề nổi bật.</p>}
                      </div>
                      <div className="reviews-mini-table">
                        <h3>Nhân viên được nhắc nhiều</h3>
                        {(analytics?.topStaffMentioned || []).length ? (analytics.topStaffMentioned || []).map((item) => (
                          <div key={item.id || item.name} className="reviews-mini-table__row"><span>{item.name || "Chưa đặt tên"}</span><strong>{item.count}</strong></div>
                        )) : <p className="reviews-mini-table__empty">Chưa có review gắn nhân viên.</p>}
                      </div>
                      <div className="reviews-mini-table">
                        <h3>Target điểm thấp</h3>
                        {(analytics?.lowRatedTargets || []).length ? (analytics.lowRatedTargets || []).map((item) => (
                          <div key={`${item.targetType}-${item.id}`} className="reviews-mini-table__row"><span>{item.name || item.id}</span><strong>{item.count}</strong></div>
                        )) : <p className="reviews-mini-table__empty">Chưa có món/dịch vụ điểm thấp.</p>}
                      </div>
                      <div className="reviews-mini-table">
                        <h3>Rating trend</h3>
                        {(analytics?.ratingTrend || []).length ? (analytics.ratingTrend || []).slice(-6).map((item) => (
                          <div key={item.date} className="reviews-mini-table__row"><span>{item.date}</span><strong>{item.avgRating}/5 · {item.total}</strong></div>
                        )) : <p className="reviews-mini-table__empty">Chưa có dữ liệu xu hướng.</p>}
                      </div>
                    </div>
                  </>
                )}
              </section>

              <div className="reviews-content-header">
                <h2 className="reviews-content-header__title">{titleMap[currentTab]}</h2>
                <div className="reviews-content-header__meta">
                  Hiển thị {reviews.length} / {reviewsTotal} đánh giá
                  {isPartialReviewList && " · Đang hiển thị 100 đánh giá mới nhất, hãy dùng bộ lọc để thu hẹp kết quả."}
                </div>
              </div>

              {error ? (
                <div className="reviews-error-box">
                  Không thể tải dữ liệu đánh giá. Vui lòng thử lại.
                </div>
              ) : (
                <ReviewsList
                  isLoading={loading}
                  reviews={filteredReviews}
                  currentTab={currentTab}
                  onView={handleViewReview}
                  onDelete={handleDeleteReview}
                  onEdit={handleModerate}
                  permissions={permissions}
                />
              )}
            </section>
          </div>
        </main>
      </div>

      {reviewPendingDelete && (
        <div className="reviews-confirm-overlay" role="presentation">
          <div className="reviews-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="review-delete-title">
            <h3 id="review-delete-title">Xóa đánh giá?</h3>
            <p>
              Bạn đang xóa đánh giá của <strong>{reviewPendingDelete.customer_name || "khách hàng"}</strong>.
              Hành động này không thể hoàn tác.
            </p>
            <div className="reviews-confirm-dialog__actions">
              <button
                type="button"
                className="reviews-btn reviews-btn-secondary"
                disabled={isDeletingReview}
                onClick={handleCancelDeleteReview}
              >
                Hủy
              </button>
              <button
                type="button"
                className="reviews-btn reviews-btn-danger"
                disabled={isDeletingReview}
                onClick={handleConfirmDeleteReview}
              >
                {isDeletingReview ? "Đang xóa..." : "Xóa đánh giá"}
              </button>
            </div>
          </div>
        </div>
      )}

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
