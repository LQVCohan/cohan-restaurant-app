import React, { useState, useEffect } from "react";
import {
  Download,
  Plus,
  Calendar,
  Filter,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import "./FinanceDashboard.scss";
import {
  FinanceStats,
  RevenueChart,
  TransactionTable,
  TransactionModal,
  SupplierDebts,
} from "./FinanceComponents";

const FinanceDashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");

  // --- MOCK DATA ---
  const [transactions, setTransactions] = useState([
    {
      id: 1,
      date: "2024-12-21",
      desc: "Doanh thu trưa 21/12",
      category: "Bán hàng tại quán",
      amount: 6200000,
      type: "income",
      source: "Tiền mặt",
      status: "completed",
    },
    {
      id: 2,
      date: "2024-12-21",
      desc: "Nhập rau củ chợ đầu mối",
      category: "Nguyên liệu (COGS)",
      amount: 1500000,
      type: "expense",
      source: "Tiền mặt",
      status: "completed",
    },
    {
      id: 3,
      date: "2024-12-20",
      desc: "Thanh toán tiền Bia Tiger",
      category: "Nguyên liệu (COGS)",
      amount: 4200000,
      type: "expense",
      source: "Ngân hàng",
      status: "completed",
    },
    {
      id: 4,
      date: "2024-12-20",
      desc: "Ứng lương bếp trưởng",
      category: "Nhân sự (Lương)",
      amount: 3000000,
      type: "expense",
      source: "Ngân hàng",
      status: "pending",
    },
  ]);

  const [debts, setDebts] = useState([
    {
      id: 1,
      supplier: "NCC Thịt bò Hưng Phát",
      amount: 4500000,
      dueDate: "25/12",
    },
    { id: 2, supplier: "Đại lý Nước ngọt", amount: 2100000, dueDate: "28/12" },
  ]);

  const [stats, setStats] = useState({
    revenue: 0,
    expenses: 0,
    cashFlow: 15000000,
  });

  // --- LOGIC ---
  useEffect(() => {
    // Tự động tính tổng Thu/Chi mỗi khi có giao dịch mới
    const revenue = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Giả lập tính dòng tiền: Bắt đầu 15tr + (Thu - Chi)
    // Thực tế sẽ phức tạp hơn, nhưng đây là Logic Frontend cơ bản
    const currentCash = 15000000 + (revenue - expenses);

    setStats({ revenue, expenses, cashFlow: currentCash });
  }, [transactions]);

  const handleAddTransaction = (newTransaction) => {
    setTransactions([newTransaction, ...transactions]);
    setIsModalOpen(false);
  };

  const filteredData =
    filterType === "all"
      ? transactions
      : transactions.filter((t) => t.type === filterType);

  return (
    <div className="finance-dashboard">
      <header className="page-header">
        <div className="header-left">
          <h1>Quản Trị Tài Chính Nhà Hàng</h1>
          <p>Theo dõi dòng tiền, chi phí thực phẩm (Food Cost) & Công nợ</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary">
            <Calendar size={16} /> <span>Tháng 12</span>
          </button>
          <button className="btn-secondary">
            <Download size={16} /> <span>Báo cáo</span>
          </button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} /> <span>Tạo phiếu mới</span>
          </button>
        </div>
      </header>

      {/* 1. OVERVIEW STATS */}
      <section className="stats-section">
        <FinanceStats data={stats} />
      </section>

      {/* 2. MAIN LAYOUT (2 Cột lệch) */}
      <div className="main-layout-grid-v2">
        {/* CỘT TRÁI: BIỂU ĐỒ & BẢNG (Chiếm nhiều diện tích) */}
        <div className="col-main">
          <div className="card-container chart-card">
            <div className="card-header">
              <h3>Biểu đồ Lợi nhuận</h3>
              <div className="tab-pills">
                <button className="pill active">Tuần</button>
                <button className="pill">Tháng</button>
              </div>
            </div>
            <div className="card-body">
              <RevenueChart />
            </div>
          </div>

          <div className="card-container transactions-card">
            <div className="card-header">
              <h3>Nhật ký giao dịch</h3>
              <div className="simple-filter">
                <button
                  onClick={() => setFilterType("all")}
                  className={filterType === "all" ? "active" : ""}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setFilterType("income")}
                  className={filterType === "income" ? "active" : ""}
                >
                  Thu
                </button>
                <button
                  onClick={() => setFilterType("expense")}
                  className={filterType === "expense" ? "active" : ""}
                >
                  Chi
                </button>
              </div>
            </div>
            <TransactionTable transactions={filteredData} />
          </div>
        </div>

        {/* CỘT PHẢI: SIDEBAR (Công nợ & Cấu trúc chi phí) */}
        <div className="col-side">
          {/* Công nợ */}
          <div className="card-container debt-card">
            <div className="card-header warning-bg">
              <h3>
                <AlertCircle size={16} /> Công nợ phải trả
              </h3>
              <button className="text-btn">Chi tiết</button>
            </div>
            <div className="card-body no-padding">
              <SupplierDebts debts={debts} />
            </div>
          </div>

          {/* Phân tích chi phí (Smart Insights) */}
          <div className="card-container cost-structure">
            <div className="card-header">
              <h3>Cấu trúc chi phí</h3>
            </div>
            <div className="card-body">
              {/* Thanh COGS */}
              <div className="cost-row">
                <div className="label">COGS (Nguyên liệu)</div>
                <div className="progress">
                  <div className="fill red" style={{ width: "38%" }}></div>
                </div>
                <div className="value">38% (Mục tiêu: 35%)</div>
              </div>
              {/* Thanh Lương */}
              <div className="cost-row">
                <div className="label">Nhân sự (Labor)</div>
                <div className="progress">
                  <div className="fill orange" style={{ width: "25%" }}></div>
                </div>
                <div className="value">25% (Ổn định)</div>
              </div>
              {/* Thanh Mặt bằng */}
              <div className="cost-row">
                <div className="label">Mặt bằng & Điện nước</div>
                <div className="progress">
                  <div className="fill blue" style={{ width: "18%" }}></div>
                </div>
                <div className="value">18%</div>
              </div>

              <div className="insight-text">
                💡 <b>Gợi ý:</b> Chi phí nguyên liệu đang hơi cao. Hãy kiểm tra
                lại định lượng món Bò sốt tiêu hoặc kiểm tra lại NCC rau.
              </div>
            </div>
          </div>
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddTransaction}
      />
    </div>
  );
};

export default FinanceDashboard;
