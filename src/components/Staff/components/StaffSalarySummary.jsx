import React from "react";
import { ArrowLeft, Wallet, Clock, Calendar, CheckCircle } from "lucide-react";
import "./StaffProfileDetails.scss";

const fmtMoney = (v) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

export default function StaffSalarySummary({ data, onBack }) {
  return (
    <div className="detail-page-wrapper">
      <div className="detail-header">
        <button className="btn-back" onClick={onBack}>
          <ArrowLeft size={24} className="icon-back" /> Lương & Thưởng
        </button>
      </div>

      <div className="detail-content">
        <div className="salary-hero-card">
          <div className="hero-label">Thực lĩnh tạm tính</div>
          <h2 className="hero-amount">{fmtMoney(data?.netSalary)}</h2>
        </div>

        <div className="info-card">
          <h3 className="card-title">Chi tiết lương</h3>
          <div className="info-row">
            <div className="label-group">
              <Wallet size={18} /> Lương cơ bản
            </div>
            <div className="value">{fmtMoney(data?.baseSalary)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Clock size={18} /> Tổng giờ công
            </div>
            <div className="value">
              {Number(data?.totalHours || 0).toFixed(1)} giờ
            </div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Wallet size={18} /> Tổng lương giờ
            </div>
            <div className="value">{fmtMoney(data?.totalWage)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Wallet size={18} /> Tổng thu nhập (gross)
            </div>
            <div className="value">{fmtMoney(data?.grossIncome)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Wallet size={18} /> Tổng khấu trừ
            </div>
            <div className="value">{fmtMoney(data?.totalDeduction)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <CheckCircle size={18} /> Thưởng
            </div>
            <div className="value">{fmtMoney(data?.bonusAmount)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <CheckCircle size={18} /> BHXH / BHYT / BHTN
            </div>
            <div className="value">{fmtMoney(data?.insuranceTotal)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Clock size={18} /> Hệ số lương
            </div>
            <div className="value">{Number(data?.coefficient || 0).toFixed(2)}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Calendar size={18} /> Số bảng công (Timesheet)
            </div>
            <div className="value">{data?.timesheetCount ?? 0} phiếu</div>
          </div>
          {!!data?.warningMessages?.length && (
            <div className="info-row">
              <div className="label-group">
                <CheckCircle size={18} /> Cảnh báo
              </div>
              <div className="value">{data.warningMessages.join("; ")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
