export const navigationItems = [
  {
    path: "/manager",
    title: "Tổng quan",
    icon: "📊",
  },
  {
    path: "/manager/staff",
    title: "Quản lý Nhân viên",
    icon: "👥",
    children: [
      { path: "/manager/staff/overview", title: "Tổng quan" },
      { path: "/manager/staff/list", title: "Danh sách" },
      { path: "/manager/staff/attendance", title: "Chấm công" },
      { path: "/manager/staff/payroll", title: "Lương thưởng" },
    ],
  },
  {
    path: "/manager/menu",
    title: "Quản lý Thực đơn",
    icon: "🍽️",
  },
  {
    path: "/manager/orders",
    title: "Đơn hàng",
    icon: "📋",
  },
  {
    path: "/manager/inventory",
    title: "Kho hàng",
    icon: "📦",
  },
  {
    path: "/manager/reports",
    title: "Báo cáo",
    icon: "📈",
  },
  {
    path: "/manager/settings",
    title: "Cài đặt",
    icon: "⚙️",
  },
];

export const routes = {
  "/manager": {
    title: "Tổng quan",
    breadcrumbs: ["Trang chủ", "Tổng quan"],
  },
  "/manager/staff": {
    title: "Quản lý Nhân viên",
    breadcrumbs: ["Trang chủ", "Nhân sự", "Quản lý Nhân viên"],
  },
  // ... thêm các routes khác
};
