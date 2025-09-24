import { useState, useEffect } from "react";

export const useLeaveManagement = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);

  useEffect(() => {
    // Initialize with sample data
    const sampleRequests = [
      {
        id: "leave-001",
        employeeId: "nguyen-van-a",
        employeeName: "Nguyễn Văn An",
        leaveType: "annual",
        startDate: "2024-01-15",
        endDate: "2024-01-17",
        reason: "Nghỉ phép thăm gia đình ở quê nhà",
        status: "pending",
        createdAt: "2024-01-10",
        processedAt: null,
        rejectionReason: null,
      },
      {
        id: "leave-002",
        employeeId: "tran-thi-b",
        employeeName: "Trần Thị Bình",
        leaveType: "sick",
        startDate: "2024-01-12",
        endDate: "2024-01-13",
        reason: "Bị cảm sốt, cần nghỉ ngơi điều trị",
        status: "approved",
        createdAt: "2024-01-11",
        processedAt: "2024-01-11",
        rejectionReason: null,
      },
      {
        id: "leave-003",
        employeeId: "le-van-c",
        employeeName: "Lê Văn Cường",
        leaveType: "personal",
        startDate: "2024-01-10",
        endDate: "2024-01-12",
        reason: "Có việc cá nhân cần giải quyết",
        status: "rejected",
        createdAt: "2024-01-08",
        processedAt: "2024-01-09",
        rejectionReason: "Thời gian này nhà hàng đang bận, không thể nghỉ",
      },
    ];

    setLeaveRequests(sampleRequests);
  }, []);

  const submitLeaveRequest = (requestData) => {
    const newRequest = {
      id: `leave-${Date.now()}`,
      ...requestData,
      employeeName: getEmployeeName(requestData.employee),
      status: "pending",
      createdAt: new Date().toISOString().split("T")[0],
      processedAt: null,
      rejectionReason: null,
    };

    setLeaveRequests((prev) => [newRequest, ...prev]);

    // Show success message
    alert(
      "✅ Đã gửi đơn nghỉ phép thành công!\nĐơn sẽ được xem xét và phản hồi sớm nhất."
    );
  };

  const approveLeave = async (requestId) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setLeaveRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "approved",
              processedAt: new Date().toISOString().split("T")[0],
            }
          : request
      )
    );

    alert("✅ Đã duyệt đơn nghỉ phép thành công!");
  };

  const rejectLeave = async (requestId, reason = "") => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    setLeaveRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "rejected",
              processedAt: new Date().toISOString().split("T")[0],
              rejectionReason: reason || "Không có lý do cụ thể",
            }
          : request
      )
    );

    alert("❌ Đã từ chối đơn nghỉ phép!");
  };

  const getEmployeeName = (employeeId) => {
    const employees = {
      "nguyen-van-a": "Nguyễn Văn An",
      "tran-thi-b": "Trần Thị Bình",
      "le-van-c": "Lê Văn Cường",
      "pham-thi-d": "Phạm Thị Dung",
    };
    return employees[employeeId] || "Không xác định";
  };

  return {
    leaveRequests,
    submitLeaveRequest,
    approveLeave,
    rejectLeave,
  };
};
