import React from 'react';
import CustomerCard from './CustomerCard';

const CustomerList = ({ customers, loading, onCustomerClick }) => {
  if (loading) {
    return <div>Đang tải dữ liệu khách hàng...</div>;
  }

  if (!customers || customers.length === 0) {
    return <div>Không có khách hàng nào phù hợp.</div>;
  }

  return (
    <div className="customer-list" style={{ display: 'grid', gap: '1rem' }}>
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

