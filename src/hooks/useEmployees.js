import { useState, useEffect, useCallback } from "react";

export const useEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    initializeEmployees();
  }, []);

  const initializeEmployees = async () => {
    try {
      setLoading(true);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const sampleEmployees = [
        {
          id: "nguyen-van-a",
          name: "Nguyễn Văn An",
          role: "👨‍🍳 Bếp trưởng",
          department: "kitchen",
          status: "active",
          avatar: "A",
          phone: "0901234567",
          email: "an.nguyen@foodhub.vn",
          address: "123 Nguyễn Văn Cừ, Q.5",
          startDate: "15/03/2023",
          salary: "₫12.000.000",
          shift: "6:00 - 14:00",
          performance: "95%",
          restaurant: "district1",
        },
        {
          id: "tran-thi-b",
          name: "Trần Thị Bình",
          role: "🍽️ Phục vụ",
          department: "service",
          status: "active",
          avatar: "B",
          phone: "0902345678",
          email: "binh.tran@foodhub.vn",
          address: "456 Lê Văn Sỹ, Q.3",
          startDate: "20/04/2023",
          salary: "₫8.500.000",
          shift: "10:00 - 18:00",
          performance: "92%",
          restaurant: "district3",
        },
        {
          id: "le-van-c",
          name: "Lê Văn Cường",
          role: "💰 Thu ngân",
          department: "cashier",
          status: "break",
          avatar: "C",
          phone: "0903456789",
          email: "cuong.le@foodhub.vn",
          address: "789 Nguyễn Thị Minh Khai, Q.1",
          startDate: "10/05/2023",
          salary: "₫9.000.000",
          shift: "14:00 - 22:00",
          performance: "88%",
          restaurant: "district1",
        },
        {
          id: "pham-thi-d",
          name: "Phạm Thị Dung",
          role: "🍽️ Phục vụ",
          department: "service",
          status: "active",
          avatar: "D",
          phone: "0904567890",
          email: "dung.pham@foodhub.vn",
          address: "321 Võ Văn Tần, Q.3",
          startDate: "25/06/2023",
          salary: "₫8.000.000",
          shift: "6:00 - 14:00",
          performance: "90%",
          restaurant: "district7",
        },
        {
          id: "hoang-van-e",
          name: "Hoàng Văn Em",
          role: "👨‍🍳 Phụ bếp",
          department: "kitchen",
          status: "inactive",
          avatar: "E",
          phone: "0905678901",
          email: "em.hoang@foodhub.vn",
          address: "654 Điện Biên Phủ, Bình Thạnh",
          startDate: "15/07/2023",
          salary: "₫7.500.000",
          shift: "14:00 - 22:00",
          performance: "85%",
          restaurant: "binh-thanh",
        },
        {
          id: "nguyen-thi-f",
          name: "Nguyễn Thị Phương",
          role: "🧹 Vệ sinh",
          department: "cleaning",
          status: "active",
          avatar: "F",
          phone: "0906789012",
          email: "phuong.nguyen@foodhub.vn",
          address: "987 Kha Vạn Cân, Thủ Đức",
          startDate: "01/08/2023",
          salary: "₫6.500.000",
          shift: "22:00 - 6:00",
          performance: "93%",
          restaurant: "thu-duc",
        },
      ];

      setEmployees(sampleEmployees);
      calculateStats(sampleEmployees);
      setError(null);
    } catch (err) {
      setError("Không thể tải dữ liệu nhân viên");
      console.error("Error loading employees:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = useCallback((employeeList) => {
    const stats = {
      totalEmployees: employeeList.length,
      activeEmployees: employeeList.filter((emp) => emp.status === "active")
        .length,
      onBreak: employeeList.filter((emp) => emp.status === "break").length,
      absent: employeeList.filter((emp) => emp.status === "inactive").length,
      byDepartment: {
        kitchen: employeeList.filter((emp) => emp.department === "kitchen")
          .length,
        service: employeeList.filter((emp) => emp.department === "service")
          .length,
        cashier: employeeList.filter((emp) => emp.department === "cashier")
          .length,
        management: employeeList.filter(
          (emp) => emp.department === "management"
        ).length,
        cleaning: employeeList.filter((emp) => emp.department === "cleaning")
          .length,
      },
      byRestaurant: {
        district1: employeeList.filter((emp) => emp.restaurant === "district1")
          .length,
        district3: employeeList.filter((emp) => emp.restaurant === "district3")
          .length,
        district7: employeeList.filter((emp) => emp.restaurant === "district7")
          .length,
        "binh-thanh": employeeList.filter(
          (emp) => emp.restaurant === "binh-thanh"
        ).length,
        "thu-duc": employeeList.filter((emp) => emp.restaurant === "thu-duc")
          .length,
      },
    };
    setStats(stats);
  }, []);

  const addEmployee = useCallback(
    async (employeeData) => {
      try {
        setLoading(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        const newEmployee = {
          id: `employee-${Date.now()}`,
          ...employeeData,
          avatar: employeeData.fullName?.charAt(0).toUpperCase() || "N",
          status: "active",
          performance: "85%", // Default performance
          restaurant: "district1", // Default restaurant
        };

        const updatedEmployees = [...employees, newEmployee];
        setEmployees(updatedEmployees);
        calculateStats(updatedEmployees);

        return { success: true, employee: newEmployee };
      } catch (err) {
        setError("Không thể thêm nhân viên mới");
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [employees, calculateStats]
  );

  const updateEmployee = useCallback(
    async (employeeId, employeeData) => {
      try {
        setLoading(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        const updatedEmployees = employees.map((emp) =>
          emp.id === employeeId ? { ...emp, ...employeeData } : emp
        );

        setEmployees(updatedEmployees);
        calculateStats(updatedEmployees);

        return { success: true };
      } catch (err) {
        setError("Không thể cập nhật thông tin nhân viên");
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [employees, calculateStats]
  );

  const deleteEmployee = useCallback(
    async (employeeId) => {
      try {
        setLoading(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500));

        const updatedEmployees = employees.filter(
          (emp) => emp.id !== employeeId
        );
        setEmployees(updatedEmployees);
        calculateStats(updatedEmployees);

        return { success: true };
      } catch (err) {
        setError("Không thể xóa nhân viên");
        return { success: false, error: err.message };
      } finally {
        setLoading(false);
      }
    },
    [employees, calculateStats]
  );

  const getEmployeeById = useCallback(
    (employeeId) => {
      return employees.find((emp) => emp.id === employeeId);
    },
    [employees]
  );

  const getEmployeesByRestaurant = useCallback(
    (restaurant) => {
      if (restaurant === "all") return employees;
      return employees.filter((emp) => emp.restaurant === restaurant);
    },
    [employees]
  );

  const getEmployeesByDepartment = useCallback(
    (department) => {
      if (department === "all") return employees;
      return employees.filter((emp) => emp.department === department);
    },
    [employees]
  );

  const searchEmployees = useCallback(
    (query) => {
      if (!query.trim()) return employees;

      const lowercaseQuery = query.toLowerCase();
      return employees.filter(
        (emp) =>
          emp.name.toLowerCase().includes(lowercaseQuery) ||
          emp.role.toLowerCase().includes(lowercaseQuery) ||
          emp.email.toLowerCase().includes(lowercaseQuery) ||
          emp.phone.includes(query)
      );
    },
    [employees]
  );

  return {
    employees,
    stats,
    loading,
    error,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeById,
    getEmployeesByRestaurant,
    getEmployeesByDepartment,
    searchEmployees,
    refreshEmployees: initializeEmployees,
  };
};
