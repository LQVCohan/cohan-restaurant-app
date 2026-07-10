import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Calendar, Download, RefreshCw, Route } from "lucide-react";
import "./FinanceDashboard.scss";
import "./FinanceDashboardPolish.scss";
import "./FinanceDashboardPolishPriority.scss";
import {
  FinanceStats,
  ReceivableDebts,
  RevenueChart,
} from "./FinanceComponents";
import { AuthContext } from "@/context/AuthContext";
import { useFinance, toLocalDateInputValue } from "@/hooks/useFinance";
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import {
  convertAndRoundCurrencyAmount,
  formatCurrencyAmount,
  normalizeCurrency,
} from "@/utils/currency";

const COST_LABELS = {
  cogs: "Nguyên liệu",
  labor: "Nhân sự",
  operations: "Vận hành",
  other: "Chi phí khác",
};

const RECONCILIATION_STATUS_LABELS = {
  matched: "Đã khớp",
  amount_mismatch: "Lệch số tiền",
  unresolved: "Chưa xử lý",
  unmatched: "Chưa khớp",
  resolved: "Đã xử lý",
};

const RANGE_LABELS = {
  week: "Tuần này",
  month: "Tháng này",
  quarter: "Quý này",
  year: "Năm nay",
  custom: "Khoảng ngày tùy chọn",
};

const RATE_SOURCE_LABELS = {
  manual: "Tỷ giá thủ công",
  network: "Tỷ giá tham khảo trực tuyến",
  cache: "Tỷ giá tham khảo đã lưu tạm",
  fallback: "Tỷ giá dự phòng",
};

const getReconciliationStatusLabel = (status) =>
  RECONCILIATION_STATUS_LABELS[String(status || "").toLowerCase()] ||
  status ||
  "Chưa rõ";

const navigateTransactions = (query = {}) => {
  window.dispatchEvent(
    new CustomEvent("manager:navigate", {
      detail: { page: "transactions", query, source: "finance-dashboard" },
    }),
  );
};

const exportDashboardCsv = ({
  summary,
  trend,
  costBreakdown,
  debts,
  reconciliationSummary,
  currency,
  formatMoney,
}) => {
  const rows = [
    ["Nhóm dữ liệu", "Chỉ số", "Giá trị"],
    ["Thiết lập", "Đơn vị hiển thị", currency],
    ["Chỉ số chính", "Doanh thu ghi nhận", formatMoney(summary.revenue)],
    ["Chỉ số chính", "Chi phí đã ghi nhận", formatMoney(summary.expense)],
    ["Chỉ số chính", "Lợi nhuận tạm tính", formatMoney(summary.profit)],
    ["Chỉ số chính", "Tiền vào", formatMoney(summary.cashIn)],
    ["Chỉ số chính", "Tiền ra", formatMoney(summary.cashOut)],
    ["Chỉ số chính", "Thanh toán thành công", formatMoney(summary.payment)],
    ["Chỉ số chính", "Hoàn tiền", formatMoney(summary.refund)],
    [
      "Chỉ số chính",
      "Khoản phải thu",
      formatMoney(summary.receivable ?? summary.debt),
    ],
    ["Chỉ số chính", "Khoản phải trả", formatMoney(summary.payable || 0)],
    [
      "Chỉ số chính",
      "Tỷ lệ chi phí chính",
      `${Number(summary.primeCostRate || 0).toFixed(1)}%`,
    ],
    ["Cơ cấu chi phí", COST_LABELS.cogs, formatMoney(costBreakdown.cogs)],
    [
      "Cơ cấu chi phí",
      COST_LABELS.labor,
      formatMoney(costBreakdown.labor),
    ],
    [
      "Cơ cấu chi phí",
      COST_LABELS.operations,
      formatMoney(costBreakdown.operations),
    ],
    ["Cơ cấu chi phí", COST_LABELS.other, formatMoney(costBreakdown.other)],
    ["Đối soát", "Đã khớp / xử lý", reconciliationSummary.matched],
    ["Đối soát", "Lệch số tiền", reconciliationSummary.amountMismatch],
    ["Đối soát", "Chưa khớp", reconciliationSummary.unmatched],
    ...trend.map((point) => [
      "Xu hướng",
      point.key,
      `Doanh thu: ${formatMoney(point.revenue)}; Chi phí: ${formatMoney(
        point.expense,
      )}; Lợi nhuận: ${formatMoney(point.profit)}`,
    ]),
    ...debts.map((debt) => [
      "Khoản phải thu",
      debt.supplier,
      formatMoney(debt.amount),
    ]),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bao-cao-tai-chinh-${toLocalDateInputValue(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const FinanceDashboard = () => {
  const { user } = useContext(AuthContext) || {};
  const canExport = hasAnyPermission(user, [
    "finance.export",
    "report.export",
    "system.manage",
  ]);
  const canPersistCurrency = hasAnyPermission(user, [
    "restaurant.write",
    "system.manage",
  ]);

  const {
    range,
    setRange,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    summary,
    trend,
    debts,
    reconciliations,
    reconciliationSummary,
    costBreakdown,
    loading,
    error,
    validationError,
    canQuery,
    refetch,
    restaurantId,
    setRestaurantId,
    restaurants,
  } = useFinance();
  const {
    activeCurrency,
    setActiveCurrency,
    usdToVndRate,
    rateSource,
    manualUsdToVndRate,
    displayedUsdToVndRate,
    persistSettings,
    loading: currencyLoading,
    error: currencyError,
  } = useRestaurantCurrency(restaurantId);

  const [rateDraft, setRateDraft] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const nextRate =
      manualUsdToVndRate || usdToVndRate || displayedUsdToVndRate || 0;
    setRateDraft(nextRate > 0 ? String(Math.round(nextRate)) : "");
  }, [displayedUsdToVndRate, manualUsdToVndRate, usdToVndRate]);

  const formatMoney = useCallback(
    (value) => {
      const currency = normalizeCurrency(activeCurrency, "VND");
      const converted = convertAndRoundCurrencyAmount(
        value,
        "VND",
        currency,
        usdToVndRate,
        { usdDigits: 2 },
      );
      return formatCurrencyAmount(converted, currency);
    },
    [activeCurrency, usdToVndRate],
  );

  const safeCostBreakdown = useMemo(
    () => ({
      cogs: Number(costBreakdown?.cogs || 0),
      labor: Number(costBreakdown?.labor || 0),
      operations: Number(costBreakdown?.operations || 0),
      other: Number(costBreakdown?.other || 0),
    }),
    [costBreakdown],
  );
  const totalCost = Object.values(safeCostBreakdown).reduce(
    (sum, value) => sum + value,
    0,
  );
  const percent = (value) =>
    totalCost > 0
      ? `${Math.round((Number(value || 0) / totalCost) * 100)}%`
      : "0%";
  const selectedRestaurant = (restaurants || []).find(
    (restaurant) => String(restaurant.id) === String(restaurantId),
  );
  const netCashFlow =
    Number(summary?.cashIn || 0) - Number(summary?.cashOut || 0);

  const handleCurrencyChange = async (event) => {
    const nextCurrency = normalizeCurrency(event.target.value, "VND");
    const previousCurrency = activeCurrency;
    setActiveCurrency(nextCurrency);
    setSettingsError("");
    if (!canPersistCurrency) return;

    setSavingSettings(true);
    try {
      await persistSettings({ defaultCurrency: nextCurrency });
    } catch (persistError) {
      setActiveCurrency(previousCurrency);
      setSettingsError(
        persistError?.message || "Không thể lưu đơn vị tiền tệ.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRateBlur = async () => {
    if (!canPersistCurrency) return;
    const nextRate = Number(rateDraft);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setSettingsError("Tỷ giá USD sang VND phải lớn hơn 0.");
      setRateDraft(String(Math.round(usdToVndRate || displayedUsdToVndRate)));
      return;
    }

    setSettingsError("");
    setSavingSettings(true);
    try {
      await persistSettings({ manualUsdToVndRate: nextRate });
    } catch (persistError) {
      setSettingsError(persistError?.message || "Không thể lưu tỷ giá.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExport = () =>
    exportDashboardCsv({
      summary,
      trend,
      costBreakdown: safeCostBreakdown,
      debts,
      reconciliationSummary,
      currency: activeCurrency,
      formatMoney,
    });

  const controlsDisabled = !restaurantId || !canQuery || loading;
  const showDashboard = Boolean(restaurantId && !validationError);

  return (
    <main className="finance-dashboard finance-dashboard--polished">
      <header className="page-header finance-hero">
        <div className="header-left">
          <span className="eyebrow">Tài chính & dòng tiền</span>
          <h1>Tổng quan tài chính</h1>
          <p>
            Theo dõi doanh thu, chi phí, lợi nhuận, công nợ và đối soát theo
            đúng nhà hàng, kỳ báo cáo và đơn vị hiển thị.
          </p>
          <div className="finance-context-pills" aria-label="Ngữ cảnh tài chính">
            <span>{selectedRestaurant?.name || "Chưa chọn nhà hàng"}</span>
            <span>{RANGE_LABELS[range] || "Kỳ hiện tại"}</span>
            <span>Dòng tiền ròng: {formatMoney(netCashFlow)}</span>
          </div>
        </div>

        <div className="header-actions finance-toolbar" aria-label="Bộ lọc tài chính">
          <label className="finance-control finance-control--wide">
            <span>Nhà hàng</span>
            <select
              className="btn-secondary"
              value={restaurantId || ""}
              onChange={(event) => setRestaurantId(event.target.value)}
            >
              <option value="">Chọn nhà hàng</option>
              {(restaurants || []).map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="finance-control">
            <span>Kỳ báo cáo</span>
            <select
              className="btn-secondary"
              value={range}
              onChange={(event) => setRange(event.target.value)}
            >
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
              <option value="year">Năm nay</option>
              <option value="custom">Khoảng ngày tùy chọn</option>
            </select>
          </label>

          {range === "custom" && (
            <>
              <label className="finance-control">
                <span>Từ ngày</span>
                <input
                  className="btn-secondary"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="finance-control">
                <span>Đến ngày</span>
                <input
                  className="btn-secondary"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="finance-control">
            <span>Đơn vị hiển thị</span>
            <select
              className="btn-secondary"
              value={activeCurrency}
              onChange={handleCurrencyChange}
              disabled={currencyLoading || savingSettings}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
            <small>
              {canPersistCurrency
                ? "Lưu theo nhà hàng"
                : "Chỉ đổi cách hiển thị trong phiên này"}
            </small>
          </label>

          {activeCurrency === "USD" && (
            <label className="finance-control">
              <span>Tỷ giá USD → VND</span>
              <input
                className="btn-secondary rate-input"
                type="number"
                min="1"
                step="1"
                value={rateDraft}
                onChange={(event) => setRateDraft(event.target.value)}
                onBlur={handleRateBlur}
                disabled={!canPersistCurrency || currencyLoading || savingSettings}
              />
              <small>{RATE_SOURCE_LABELS[rateSource] || "Tỷ giá quy đổi"}</small>
            </label>
          )}

          <div className="finance-toolbar-actions finance-control--wide">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => refetch()}
              disabled={controlsDisabled}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {loading ? "Đang tải" : "Làm mới"}
            </button>
            {canExport && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleExport}
                disabled={controlsDisabled}
              >
                <Download size={16} aria-hidden="true" /> Xuất CSV
              </button>
            )}
          </div>
        </div>
      </header>

      {validationError && (
        <div className="finance-error" role="alert">
          {validationError}
        </div>
      )}
      {settingsError && (
        <div className="finance-error" role="alert">
          {settingsError}
        </div>
      )}
      {currencyError && (
        <div className="finance-error" role="alert">
          Không thể tải thiết lập tiền tệ của nhà hàng.
        </div>
      )}
      {error && (
        <div className="finance-error" role="alert">
          Không thể tải dữ liệu tài chính. Vui lòng kiểm tra quyền truy cập hoặc
          thử lại.
        </div>
      )}

      {!restaurantId ? (
        <section className="finance-page-state" aria-live="polite">
          <strong>Chọn nhà hàng để xem báo cáo</strong>
          <p>Dữ liệu tài chính luôn được giới hạn theo nhà hàng bạn quản lý.</p>
        </section>
      ) : validationError ? null : loading ? (
        <section className="finance-page-state finance-page-state--loading" aria-live="polite">
          <RefreshCw size={22} aria-hidden="true" />
          <strong>Đang tổng hợp dữ liệu tài chính</strong>
          <p>Hệ thống đang đối chiếu dòng tiền, hóa đơn và công nợ.</p>
        </section>
      ) : showDashboard ? (
        <>
          <section className="stats-section" aria-label="Chỉ số tài chính chính">
            <FinanceStats
              summary={summary}
              onNavigate={navigateTransactions}
              formatMoney={formatMoney}
            />
          </section>

          <div className="finance-focus-grid">
            <section className="card-container chart-card span-2">
              <div className="card-header">
                <div>
                  <h2>Thu, chi và lợi nhuận theo thời gian</h2>
                  <p>
                    Dữ liệu lấy từ dòng tiền đã ghi nhận, không tính giao dịch
                    đã hủy.
                  </p>
                </div>
                <Calendar size={18} aria-hidden="true" />
              </div>
              <div className="card-body">
                <RevenueChart trend={trend || []} formatMoney={formatMoney} />
              </div>
            </section>

            <section className="card-container cost-card">
              <div className="card-header">
                <h2>Cơ cấu chi phí</h2>
                <Route size={18} aria-hidden="true" />
              </div>
              <div className="card-body cost-structure">
                {[
                  [COST_LABELS.cogs, "cogs", "red", "inventory", "cogs"],
                  [COST_LABELS.labor, "labor", "orange", "payroll", "labor"],
                  [
                    COST_LABELS.operations,
                    "operations",
                    "blue",
                    "operations",
                    "",
                  ],
                  [COST_LABELS.other, "other", "slate", "other", ""],
                ].map(([label, key, color, category, subcategory]) => (
                  <button
                    key={key}
                    type="button"
                    className="cost-row cost-drilldown"
                    onClick={() =>
                      navigateTransactions({
                        tab: "journal",
                        type: "OUTFLOW",
                        category,
                        subcategory,
                      })
                    }
                  >
                    <div className="label">
                      <span>{label}</span>
                      <strong>{formatMoney(safeCostBreakdown[key])}</strong>
                    </div>
                    <div className="progress" aria-hidden="true">
                      <div
                        className={`fill ${color}`}
                        style={{ width: percent(safeCostBreakdown[key]) }}
                      />
                    </div>
                    <div className="value">
                      {percent(safeCostBreakdown[key])} tổng chi phí
                    </div>
                  </button>
                ))}
                <div className="insight-text">
                  Chọn từng nhóm để mở đúng danh sách giao dịch chi liên quan.
                </div>
              </div>
            </section>

            <section className="card-container reconciliation-card">
              <div className="card-header">
                <div>
                  <h2>Tình trạng đối soát</h2>
                  <p>Ưu tiên xử lý giao dịch lệch hoặc chưa khớp.</p>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => navigateTransactions({ tab: "reconciliation" })}
                >
                  Mở hàng đợi
                </button>
              </div>
              <div className="card-body recon-summary">
                <div className="recon-tile matched">
                  <span>Đã khớp / xử lý</span>
                  <strong>{reconciliationSummary?.matched || 0}</strong>
                </div>
                <div className="recon-tile mismatch">
                  <span>Lệch số tiền</span>
                  <strong>{reconciliationSummary?.amountMismatch || 0}</strong>
                </div>
                <div className="recon-tile unmatched">
                  <span>Chưa khớp</span>
                  <strong>{reconciliationSummary?.unmatched || 0}</strong>
                </div>
                <div className="mini-list">
                  {(reconciliations || []).slice(0, 5).map((item) => (
                    <div key={item.id} className="mini-list-row">
                      <span>{item.reference || item.id}</span>
                      <b>{getReconciliationStatusLabel(item.status)}</b>
                    </div>
                  ))}
                  {(reconciliations || []).length === 0 ? (
                    <div className="mini-list-empty">
                      Chưa có giao dịch cần đối soát.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="card-container span-2 finance-debt-card">
              <div className="card-header warning-bg">
                <div>
                  <h2>Khoản phải thu</h2>
                  <p>Các hóa đơn còn thiếu tiền, ưu tiên theo hạn thanh toán.</p>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => navigateTransactions({ tab: "debt" })}
                >
                  Xem công nợ
                </button>
              </div>
              <ReceivableDebts
                debts={debts || []}
                formatMoney={formatMoney}
              />
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
};

export default FinanceDashboard;
