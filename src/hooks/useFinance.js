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
        payment
        refund
        settlement
        cashIn
        cashOut
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
};

export const useFinance = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState(restaurants?.[0]?.id || "");
  const [range, setRange] = useState("month");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!restaurantId && restaurants?.length) {
      setRestaurantId(restaurants[0].id);
    }
  }, [restaurants, restaurantId]);

  const { data, loading, error, refetch } = useQuery(GET_FINANCE_DASHBOARD, {
    skip: !restaurantId,
    fetchPolicy: "network-only",
    variables: {
      input: {
        restaurantId,
        range: RANGE_MAP[range] || "MONTH",
      },
    },
  });

  const dashboard = data?.financeDashboard;

  const transactions = useMemo(() => {
    const items = dashboard?.transactions || [];
    if (typeFilter === "all") return items;
    return items.filter((x) => x.type.toLowerCase() === typeFilter.toLowerCase());
  }, [dashboard, typeFilter]);

  return {
    restaurants,
    restaurantId,
    setRestaurantId,
    range,
    setRange,
    typeFilter,
    setTypeFilter,
    loading,
    error,
    refetch,
    summary: dashboard?.summary || {
      revenue: 0,
      expense: 0,
      profit: 0,
      debt: 0,
      payment: 0,
      refund: 0,
      settlement: 0,
      cashIn: 0,
      cashOut: 0,
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
