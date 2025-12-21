import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  X,
  AlertCircle,
  CreditCard,
} from "lucide-react";

// --- 1. Stats Cards (Tự động tính Prime Cost) ---
export const FinanceStats = ({ data }) => {
  const fmt = (num) => num.toLocaleString("vi-VN") + "đ";

  // Logic giả lập: Prime Cost = Tổng chi phí (Nguyên liệu + Nhân sự) / Tổng doanh thu
  // Ở đây demo lấy expenses / revenue
  const primeCostRate =
    data.revenue > 0 ? ((data.expenses / data.revenue) * 100).toFixed(1) : 0;
  const isHighCost = primeCostRate > 60; // Cảnh báo nếu > 60%

  return (
    <div className="finance-stats-grid">
      {/* Doanh thu */}
      <div className="stat-card revenue">
        <div className="icon-wrapper">
          <DollarSign size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Tổng Doanh Thu</span>
          <div className="value">{fmt(data.revenue)}</div>
          <span className="trend positive">
            <TrendingUp size={14} /> +12.5%
          </span>
        </div>
      </div>

      {/* Prime Cost (Quan trọng cho nhà hàng) */}
      <div className="stat-card prime-cost">
        <div className="icon-wrapper">
          <AlertCircle size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Prime Cost (Vốn + Lương)</span>
          <div className="value">{primeCostRate}%</div>
          <span className={`sub-text ${isHighCost ? "warning" : "success"}`}>
            {isHighCost ? "Cao hơn chuẩn (60%)" : "Đang kiểm soát tốt"}
          </span>
        </div>
      </div>

      {/* Lợi nhuận ròng */}
      <div className="stat-card profit">
        <div className="icon-wrapper">
          <Wallet size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Lợi Nhuận Ròng</span>
          <div className="value">{fmt(data.revenue - data.expenses)}</div>
          <span className="sub-text">
            Biên LN:{" "}
            <b>
              {data.revenue > 0
                ? (
                    ((data.revenue - data.expenses) / data.revenue) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </b>
          </span>
        </div>
      </div>

      {/* Tiền mặt thực tế */}
      <div className="stat-card cash">
        <div className="icon-wrapper">
          <CreditCard size={24} />
        </div>
        <div className="stat-content">
          <span className="label">Tổng Quỹ Tiền</span>
          <div className="value">{fmt(data.cashFlow)}</div>
          <span className="sub-text">Bao gồm Tiền mặt & NH</span>
        </div>
      </div>
    </div>
  );
};

// --- 2. Supplier Debts (Danh sách công nợ) ---
export const SupplierDebts = ({ debts }) => {
  return (
    <div className="debt-list">
      {debts.length === 0 ? (
        <div className="p-3 text-muted text-center">Không có khoản nợ nào</div>
      ) : (
        debts.map((d) => (
          <div key={d.id} className="debt-item">
            <div className="debt-info">
              <div className="supplier-name">{d.supplier}</div>
              <div className="due-date text-danger">Hạn: {d.dueDate}</div>
            </div>
            <div className="debt-amount">
              <div>{d.amount.toLocaleString()}đ</div>
              <button className="btn-pay-small">Trả ngay</button>
            </div>
          </div>
        ))
      )}
      {debts.length > 0 && (
        <div className="debt-footer">
          Tổng nợ:{" "}
          <b>
            {debts.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
            đ
          </b>
        </div>
      )}
    </div>
  );
};

// --- 3. Transaction Table (Có cột Nguồn tiền) ---
export const TransactionTable = ({ transactions }) => {
  return (
    <div className="table-responsive">
      <table className="clean-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nội dung</th>
            <th>Nguồn</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td
                colSpan="5"
                className="text-center text-muted"
                style={{ padding: "2rem" }}
              >
                Chưa có giao dịch nào
              </td>
            </tr>
          ) : (
            transactions.map((t) => (
              <tr key={t.id}>
                <td className="date-col">
                  <b>{t.date.split("-")[2]}</b>/{t.date.split("-")[1]}
                </td>
                <td>
                  <div className="desc">{t.desc}</div>
                  <div className="category">{t.category}</div>
                </td>
                <td className="source-col">
                  <span
                    className={`source-tag ${
                      t.source === "Tiền mặt" ? "cash" : "bank"
                    }`}
                  >
                    {t.source || "Tiền mặt"}
                  </span>
                </td>
                <td
                  className={
                    t.type === "income"
                      ? "text-success font-bold"
                      : "text-danger font-bold"
                  }
                >
                  {t.type === "income" ? "+" : "-"}
                  {parseInt(t.amount).toLocaleString()}đ
                </td>
                <td>
                  <span
                    className={`badge ${
                      t.status === "completed" ? "success" : "warning"
                    }`}
                  >
                    {t.status === "completed" ? "Hoàn tất" : "Chờ duyệt"}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

// --- 4. Revenue Chart (CSS Placeholder) ---
export const RevenueChart = () => (
  <div className="chart-placeholder-ui">
    {[60, 45, 75, 50, 80, 65, 90].map((h, i) => (
      <div key={i} className="chart-bar-group">
        <div className="bar income" style={{ height: `${h}%` }}></div>
        <div className="bar expense" style={{ height: `${h * 0.6}%` }}></div>
        <span className="label">T{i + 2}</span>
      </div>
    ))}
  </div>
);

// --- 5. Transaction Modal (Đầy đủ chức năng) ---
export const TransactionModal = ({ isOpen, onClose, onSave }) => {
  const [type, setType] = useState("income");
  const [formData, setFormData] = useState({
    amount: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    desc: "",
    source: "Tiền mặt",
    status: "completed",
  });

  if (!isOpen) return null;

  // Danh mục chuẩn nhà hàng
  const categories =
    type === "income"
      ? ["Bán hàng tại quán", "Đơn Online (App)", "Tiệc / Catering", "Khác"]
      : [
          "Nguyên liệu (COGS)",
          "Nhân sự (Lương)",
          "Điện/Nước/Gas",
          "Marketing",
          "Mặt bằng",
          "Bảo trì",
          "Khác",
        ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, type, id: Date.now() });
    setFormData({ ...formData, amount: "", desc: "" });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>Tạo Phiếu {type === "income" ? "Thu" : "Chi"}</h3>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="type-switcher">
          <button
            className={type === "income" ? "active income" : ""}
            onClick={() => setType("income")}
          >
            Thu Nhập
          </button>
          <button
            className={type === "expense" ? "active expense" : ""}
            onClick={() => setType("expense")}
          >
            Chi Phí
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Số tiền (VNĐ)</label>
            <div className="input-with-icon">
              <input
                type="number"
                required
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0"
                autoFocus
              />
              <span className="currency-tag">VNĐ</span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Danh mục</label>
              <select
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              >
                <option value="">-- Chọn --</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nguồn tiền</label>
              <select
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
              >
                <option value="Tiền mặt">Tiền mặt (Két)</option>
                <option value="Ngân hàng">Chuyển khoản NH</option>
                <option value="Ví điện tử">Momo/ZaloPay</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Ngày & Mô tả</label>
            <div className="form-row" style={{ marginBottom: "8px" }}>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
            <textarea
              rows="2"
              placeholder="Ghi chú chi tiết..."
              value={formData.desc}
              onChange={(e) =>
                setFormData({ ...formData, desc: e.target.value })
              }
            ></textarea>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className={`btn-submit ${type}`}>
              Lưu Phiếu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
