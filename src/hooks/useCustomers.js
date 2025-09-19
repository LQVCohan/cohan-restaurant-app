import { useState, useEffect, useMemo } from "react";

const sampleCustomers = [
  {
    id: 1,
    name: "Nguyễn Văn An",
    avatar: "👨‍💼",
    email: "an.nguyen@email.com",
    phone: "0901234567",
    customerType: "VIP",
    status: "online",
    currentActivity: "Đang xem menu",
    lastActivity: "Hoạt động 2 phút trước",
    totalSpent: 2450000,
    totalOrders: 28,
    loyaltyPoints: 1250,
    favoriteItems: ["Phở bò", "Gỏi cuốn", "Chả cá", "Bún bò Huế", "Nem nướng"],
    recentOrders: [
      {
        date: "15/01/2024",
        amount: 450000,
        items: ["Phở bò", "Chả cá", "Trà đá"],
      },
      {
        date: "10/01/2024",
        amount: 320000,
        items: ["Gỏi cuốn", "Bún bò Huế"],
      },
      {
        date: "05/01/2024",
        amount: 280000,
        items: ["Nem nướng", "Cơm tấm"],
      },
    ],
    joinDate: "2023-06-15",
    address: "123 Nguyễn Huệ, Q1, TP.HCM",
    birthday: "1985-03-20",
    notes: "Khách hàng VIP, thích món ăn truyền thống",
  },
  {
    id: 2,
    name: "Trần Thị Bình",
    avatar: "👩‍💻",
    email: "binh.tran@email.com",
    phone: "0912345678",
    customerType: "Mới",
    status: "offline",
    currentActivity: "Không hoạt động",
    totalSpent: 150000,
    totalOrders: 2,
    loyaltyPoints: 75,
    favoriteItems: ["Salad", "Smoothie"],
    recentOrders: [], // Khách hàng mới chưa có đơn hàng
    joinDate: "2024-01-10",
    address: "456 Lê Lợi, Q3, TP.HCM",
    birthday: "1995-08-22",
    notes: "Khách hàng mới, quan tâm đến món healthy",
  },
  {
    id: 2,
    name: "Trần Thị Bình",
    avatar: "👩‍💻",
    email: "binh.tran@email.com",
    phone: "0912345678",
    customerType: "Mới",
    status: "offline",
    currentActivity: "Không hoạt động",
    totalSpent: 150000,
    totalOrders: 2,
    loyaltyPoints: 75,
    favoriteItems: ["Salad", "Smoothie"],
    recentOrders: [], // Khách hàng mới chưa có đơn hàng
    joinDate: "2024-01-10",
    address: "456 Lê Lợi, Q3, TP.HCM",
    birthday: "1995-08-22",
    notes: "Khách hàng mới, quan tâm đến món healthy",
  },
  {
    id: 3,
    name: "Trần Thị Bình",
    avatar: "👩‍💻",
    email: "binh.tran@email.com",
    phone: "0912345678",
    customerType: "Mới",
    status: "offline",
    currentActivity: "Không hoạt động",
    totalSpent: 150000,
    totalOrders: 2,
    loyaltyPoints: 75,
    favoriteItems: ["Salad", "Smoothie"],
    recentOrders: [], // Khách hàng mới chưa có đơn hàng
    joinDate: "2024-01-10",
    address: "456 Lê Lợi, Q3, TP.HCM",
    birthday: "1995-08-22",
    notes: "Khách hàng mới, quan tâm đến món healthy",
  },
  {
    id: 4,
    name: "Trần Thị Bình",
    avatar: "👩‍💻",
    email: "binh.tran@email.com",
    phone: "0912345678",
    customerType: "Mới",
    status: "offline",
    currentActivity: "Không hoạt động",
    totalSpent: 150000,
    totalOrders: 2,
    loyaltyPoints: 75,
    favoriteItems: ["Salad", "Smoothie"],
    recentOrders: [], // Khách hàng mới chưa có đơn hàng
    joinDate: "2024-01-10",
    address: "456 Lê Lợi, Q3, TP.HCM",
    birthday: "1995-08-22",
    notes: "Khách hàng mới, quan tâm đến món healthy",
  },
  {
    id: 5,
    name: "Trần Thị Bình",
    avatar: "👩‍💻",
    email: "binh.tran@email.com",
    phone: "0912345678",
    customerType: "Mới",
    status: "offline",
    currentActivity: "Không hoạt động",
    totalSpent: 150000,
    totalOrders: 2,
    loyaltyPoints: 75,
    favoriteItems: ["Salad", "Smoothie"],
    recentOrders: [], // Khách hàng mới chưa có đơn hàng
    joinDate: "2024-01-10",
    address: "456 Lê Lợi, Q3, TP.HCM",
    birthday: "1995-08-22",
    notes: "Khách hàng mới, quan tâm đến món healthy",
  },
];
// Sample data - trong thực tế sẽ fetch từ API
// const sampleCustomers = [
//   {
//     id: 1,
//     name: "Nguyễn Văn An",
//     email: "an.nguyen@email.com",
//     phone: "0901234567",
//     avatar: "👨‍💼",
//     status: "online",
//     lastActivity: "2 phút trước",
//     customerType: "VIP",
//     totalSpent: 12500000,
//     totalOrders: 45,
//     favoriteItems: ["Phở Bò", "Bún Chả", "Chả Cá"],
//     joinDate: "2023-01-15",
//     birthday: "1985-03-20",
//     address: "123 Nguyễn Huệ, Q1, TP.HCM",
//     preferences: {
//       spiceLevel: "Trung bình",
//       allergies: ["Tôm", "Cua"],
//       dietType: "Không ăn chay"
//     },
//     loyaltyPoints: 2450,
//     currentActivity: "Đang xem menu",
//     recentOrders: [
//       { date: "2024-12-01", items: "Phở Bò, Chả Cá", total: 280000, type: "delivery" },
//       { date: "2024-11-28", items: "Bún Chả, Nem Rán", total: 220000, type: "dine-in" },
//       { date: "2024-11-25", items: "Cơm Tấm, Chè", total: 150000, type: "takeaway" }
//     ],
//     reservations: [
//       { date: "2024-12-05", time: "19:00", guests: 4, status: "confirmed" },
//       { date: "2024-11-20", time: "18:30", guests: 2, status: "completed" }
//     ],
//     notes: "Khách VIP, thích món cay, thường đặt bàn cuối tuần"
//   },
// ];

const useCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedRestaurant, setSelectedRestaurant] = useState("saigon");

  // Simulate API call
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setCustomers(sampleCustomers);
      setLoading(false);
    };

    fetchCustomers();
  }, [selectedRestaurant]);

  // Filter customers based on search and filter
  const filteredCustomers = useMemo(() => {
    let filtered = customers;

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (customer) =>
          customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.phone.includes(searchQuery)
      );
    }

    if (activeFilter !== "all") {
      switch (activeFilter) {
        case "vip":
          filtered = filtered.filter((c) => c.customerType === "VIP");
          break;
        case "new":
          filtered = filtered.filter((c) => c.customerType === "Mới");
          break;
        case "frequent":
          filtered = filtered.filter((c) => c.customerType === "Thường xuyên");
          break;
        default:
          break;
      }
    }

    return filtered;
  }, [customers, searchQuery, activeFilter]);

  const searchCustomers = (query) => {
    setSearchQuery(query);
  };

  const filterCustomers = (filter) => {
    setActiveFilter(filter);
  };

  const switchRestaurant = (restaurantId) => {
    setSelectedRestaurant(restaurantId);
  };

  return {
    customers,
    filteredCustomers,
    loading,
    searchQuery,
    activeFilter,
    selectedRestaurant,
    searchCustomers,
    filterCustomers,
    switchRestaurant,
  };
};

export default useCustomers;
