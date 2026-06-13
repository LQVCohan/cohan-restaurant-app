// src/pages/CustomerManagement/CustomerList.jsx
import React from "react";
import { SearchX } from "lucide-react";
import CustomerCard from "./CustomerCard";
import "./CustomerList.scss";
import "./CustomerExperiencePolish.css";
import "./CustomerOperationsPolish.scss";

const CustomerList = ({ customers, loading, onCustomerClick }) => {
  // Render Skeleton khi đang tải (giả lập 6 thẻ)
  if (loading) {
    return (
      <div className="cl-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="cl-skeleton-card">
            <div className="cl-sk-header">
              <div className="cl-sk-avatar" />
              <div className="cl-sk-info">
                <div className="cl-sk-line w-60" />
                <div className="cl-sk-line w-40" />
              </div>
            </div>
            <div className="cl-sk-body">
              <div className="cl-sk-line w-80" />
              <div className="cl-sk-line w-50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Render Empty State khi không có dữ liệu
  if (!customers || customers.length === 0) {
    return (
      <div className="cl-empty-state">
        <div className="cl-empty-icon">
          <SearchX size={48} strokeWidth={1} />
        </div>
        <h3 className="cl-empty-title">Không tìm thấy khách hàng</h3>
        <p className="cl-empty-desc">
          Hãy thử thay đổi bộ lọc hoặc tìm kiếm từ khóa khác.
        </p>
      </div>
    );
  }

  // Render Danh sách khách hàng
  return (
    <div className="cl-grid">
      {customers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          onClick={onCustomerClick}
        />
      ))}
    </div>
  );
};

export default CustomerList;
