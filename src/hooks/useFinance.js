import { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";

const GET_FINANCE_DASHBOARD = gql`
  query GetFinanceDashboard($input: FinanceDashboardInput!) {
    financeDashboard(input: $input) {
      summary {
        revenue
        expense
        profit
        debt
        receivable
        payable
        overdue
        payment
        refund
        settlement
        cashIn
        cashOut
        primeCostRate
      }
      trend {
        key
        revenue
        expense
        profit
      }
      transactions {
        id
        occurredAt
        description
        category
        type
        amount
        method
        status
        source
      }
      debts {
        id
        supplier
        amount
        dueDate
        status
      }
      costBreakdown {
        cogs
        labor
        operations
        other
      }
      reconciliations {
        id
        amount
        reference
        status
        note
        time
      }
      reconciliationSummary {
        matched
        amountMismatch
        unmatched
      }
    }
  }
`;

const RANGE_MAP = {
  week: "WEEK",
  month: "MONTH",
  quarter: "QUARTER",
  year: "YEAR",
  custom: "CUSTOM",
};

export const toLocalDateInputValue = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getMonthDateRange = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return {
    from: toLocalDateInputValue(new Date(date.getFullYear(), date.getMonth(), 1)),
    to: toLocalDateInputValue(
      new Date(date.getFullYear(), date.getMonth() + 1, 0),
    ),
  };
};

export const getFinanceRangeError = ({ range, dateFrom, dateTo }) => {
  if (range !== "custom") return "";
  if (!dateFrom || !dateTo) {
    return "Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.";
  }
  if (dateFrom > dateTo) {
    return "Ngày bắt đầu không được sau ngày kết thúc.";
  }
  return "";
};

const initialMonth = getMonthDateRange();

export const useFinance = () => {
  const { restaurants = [], activeRestaurantId = "" } =
    useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState(
    activeRestaurantId || restaurants?.[0]?.id || "",
  );
  const [range, setRange] = useState("month");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(initialMonth.from);
  const [dateTo, setDateTo] = useState(initialMonth.to);

  useEffect(() => {
    if (!restaurants.length) {
      if (restaurantId) setRestaurantId("");
      return;
    }

    const stillAccessible = restaurants.some(
      (restaurant) => String(restaurant.id) === String(restaurantId),
    );
    if (!stillAccessible) {
      setRestaurantId(activeRestaurantId || restaurants[0].id);
    }
  }, [activeRestaurantId, restaurantId, restaurants]);

  const validationError = useMemo(
    () => getFinanceRangeError({ range, dateFrom, dateTo }),
    [dateFrom, dateTo, range],
  );
  const canQuery = Boolean(restaurantId && !validationError);

  const query = useQuery(GET_FINANCE_DASHBOARD, {
    skip: !canQuery,
    fetchPolicy: "network-only",
    variables: {
      input: {
        restaurantId,
        range: RANGE_MAP[range] || "MONTH",
        dateFrom: range === "custom" ? dateFrom : null,
        dateTo: range === "custom" ? dateTo : null,
      },
    },
  });

  const dashboard = query.data?.financeDashboard;

  const transactions = useMemo(() => {
    const items = dashboard?.transactions || [];
    if (typeFilter === "all") return items;
    return items.filter(
      (item) =>
        String(item.type || "").toLowerCase() === typeFilter.toLowerCase(),
    );
  }, [dashboard, typeFilter]);

  return {
    restaurants,
    restaurantId,
    setRestaurantId,
    range,
    setRange,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    typeFilter,
    setTypeFilter,
    loading: query.loading,
    error: query.error,
    validationError,
    canQuery,
    refetch: canQuery ? query.refetch : async () => null,
    summary: dashboard?.summary || {
      revenue: 0,
      expense: 0,
      profit: 0,
      debt: 0,
      receivable: 0,
      payable: 0,
      overdue: 0,
      payment: 0,
      refund: 0,
      settlement: 0,
      cashIn: 0,
      cashOut: 0,
      primeCostRate: 0,
    },
    trend: dashboard?.trend || [],
    transactions,
    debts: dashboard?.debts || [],
    costBreakdown: dashboard?.costBreakdown || {
      cogs: 0,
      labor: 0,
      operations: 0,
      other: 0,
    },
    reconciliations: dashboard?.reconciliations || [],
    reconciliationSummary: dashboard?.reconciliationSummary || {
      matched: 0,
      amountMismatch: 0,
      unmatched: 0,
    },
  };
};
