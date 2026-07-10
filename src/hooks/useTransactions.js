import { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "../context/AuthContext";

const TX_FIELDS = `
  id
  occurredAt
  description
  category
  type
  amount
  method
  status
  source
  referenceType
  referenceId
`;

const CASHFLOW_FIELDS = `
  id
  restaurantId
  type
  amount
  occurredAt
  currency
  category
  subcategory
  method
  status
  source
  note
  reference { kind id orderId invoiceId paymentTransactionId payrollPaymentId stockMovementId reconciliationId refundId }
  createdBy
  voidedBy
  voidedAt
  voidReason
  createdAt
  updatedAt
`;

const RECON_FIELDS = `
  id
  restaurantId
  paymentSessionId
  expectedAmount
  receivedAmount
  varianceAmount
  status
  bankTransactionId
  paymentReference
  matchedBy
  matchedAt
  note
  matchConfidence
  matchReason
  candidatePaymentSessionIds
  candidatePaymentTransactionIds
  candidateMatches
  resolvedBy
  resolvedAt
  resolution
  createdAt
`;

const BANK_FIELDS = `
  id
  provider
  restaurantId
  transactionId
  bankAccountNumberMasked
  bankAccountNumberLast4
  amount
  currency
  description
  transferContent
  occurredAt
  matchedPaymentSessionId
  matchStatus
  createdAt
`;

const SUPPLIER_PAYABLE_FIELDS = `
  id
  restaurantId
  supplierName
  supplierId
  sourceKind
  sourceId
  amount
  paidAmount
  remainingAmount
  dueDate
  status
  note
  cashflowIds
  auditTrail
  createdAt
  updatedAt
`;

const REFUND_FIELDS = `
  id
  restaurantId
  orderId
  invoiceId
  paymentTransactionId
  amount
  currency
  reason
  method
  status
  providerRefundId
  cashflowId
  auditTrail
  createdAt
  updatedAt
`;

const GET_TRANSACTIONS = gql`
  query GetTransactionManagement(
    $transactionsInput: FinanceTransactionFilterInput!
    $cashflowsInput: FinanceTransactionFilterInput!
    $refundInput: RefundRequestFilterInput!
    $restaurantId: ID!
    $reconciliationStatus: String
    $bankStatus: String
  ) {
    financeTransactions(input: $transactionsInput) { ${TX_FIELDS} }
    cashflows(input: $cashflowsInput) { ${CASHFLOW_FIELDS} }
    refundRequests(input: $refundInput) { ${REFUND_FIELDS} }
    supplierPayables(input: { restaurantId: $restaurantId, limit: 100 }) { ${SUPPLIER_PAYABLE_FIELDS} }
    reconciliationQueue(restaurantId: $restaurantId, status: $reconciliationStatus, limit: 50) { ${RECON_FIELDS} }
    bankTransactions(restaurantId: $restaurantId, matchStatus: $bankStatus, limit: 50) { ${BANK_FIELDS} }
  }
`;

const CREATE_MANUAL_CASHFLOW = gql`
  mutation CreateManualCashflow($input: ManualCashflowInput!) {
    createManualCashflow(input: $input) { ${CASHFLOW_FIELDS} }
  }
`;

const UPDATE_MANUAL_CASHFLOW = gql`
  mutation UpdateManualCashflow($id: ID!, $input: UpdateManualCashflowInput!) {
    updateManualCashflow(id: $id, input: $input) { ${CASHFLOW_FIELDS} }
  }
`;

const VOID_MANUAL_CASHFLOW = gql`
  mutation VoidManualCashflow($id: ID!, $reason: String!) {
    voidManualCashflow(id: $id, reason: $reason) { ${CASHFLOW_FIELDS} }
  }
`;

const CREATE_REFUND_REQUEST = gql`
  mutation CreateRefundRequest($input: CreateRefundRequestInput!) {
    createRefundRequest(input: $input) { ${REFUND_FIELDS} }
  }
`;

const APPROVE_REFUND_REQUEST = gql`
  mutation ApproveRefundRequest($id: ID!) {
    approveRefundRequest(id: $id) { ${REFUND_FIELDS} }
  }
`;

const CANCEL_REFUND_REQUEST = gql`
  mutation CancelRefundRequest($id: ID!, $reason: String!) {
    cancelRefundRequest(id: $id, reason: $reason) { ${REFUND_FIELDS} }
  }
`;

const RETRY_REFUND_REQUEST = gql`
  mutation RetryRefundRequest($id: ID!, $input: ProcessRefundInput) {
    retryRefundRequest(id: $id, input: $input) { ${REFUND_FIELDS} }
  }
`;

const PROCESS_REFUND_REQUEST = gql`
  mutation ProcessRefundRequest($id: ID!, $input: ProcessRefundInput) {
    processRefundRequest(id: $id, input: $input) { ${REFUND_FIELDS} }
  }
`;

const REJECT_REFUND_REQUEST = gql`
  mutation RejectRefundRequest($id: ID!, $reason: String!) {
    rejectRefundRequest(id: $id, reason: $reason) { ${REFUND_FIELDS} }
  }
`;

const CREATE_SUPPLIER_PAYABLE = gql`
  mutation CreateSupplierPayable($input: SupplierPayableInput!) {
    createSupplierPayable(input: $input) { ${SUPPLIER_PAYABLE_FIELDS} }
  }
`;

const UPDATE_SUPPLIER_PAYABLE = gql`
  mutation UpdateSupplierPayable($id: ID!, $input: UpdateSupplierPayableInput!) {
    updateSupplierPayable(id: $id, input: $input) { ${SUPPLIER_PAYABLE_FIELDS} }
  }
`;

const RECORD_SUPPLIER_PAYMENT = gql`
  mutation RecordSupplierPayment($id: ID!, $input: RecordSupplierPaymentInput!) {
    recordSupplierPayment(id: $id, input: $input) { ${SUPPLIER_PAYABLE_FIELDS} }
  }
`;

const VOID_SUPPLIER_PAYABLE = gql`
  mutation VoidSupplierPayable($id: ID!, $reason: String!) {
    voidSupplierPayable(id: $id, reason: $reason) { ${SUPPLIER_PAYABLE_FIELDS} }
  }
`;

const RECONCILE_BANK_TRANSACTION = gql`
  mutation ReconcileBankTransaction($bankTransactionId: ID!) {
    reconcileBankTransaction(bankTransactionId: $bankTransactionId) { ${RECON_FIELDS} }
  }
`;

const MANUAL_MATCH_BANK_TRANSACTION = gql`
  mutation ManuallyMatchBankTransaction($input: ManualMatchBankTransactionInput!) {
    manuallyMatchBankTransaction(input: $input) { ${RECON_FIELDS} }
  }
`;

const RESOLVE_RECONCILIATION = gql`
  mutation ResolveReconciliation($input: ResolveReconciliationInput!) {
    resolveReconciliation(input: $input) { ${RECON_FIELDS} }
  }
`;

const IGNORE_BANK_TRANSACTION = gql`
  mutation IgnoreBankTransaction($id: ID!, $reason: String!) {
    ignoreBankTransaction(id: $id, reason: $reason) { ${BANK_FIELDS} }
  }
`;

const pad2 = (value) => String(value).padStart(2, "0");

export const toLocalDateInputValue = (date) => {
  const value = date instanceof Date ? date : new Date(date);
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
    value.getDate(),
  )}`;
};

export const toGraphqlDateTime = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${
      endOfDay ? "23:59:59.999" : "00:00:00.000"
    }Z`;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getRequestedTransactionRestaurantId = (search = "") =>
  new URLSearchParams(search).get("restaurantId") || "";

export const selectAccessibleTransactionRestaurant = (
  restaurants = [],
  requestedRestaurantId = "",
) => {
  const requested = String(requestedRestaurantId || "");
  const match = restaurants.find(
    (restaurant) => String(restaurant?.id || "") === requested,
  );
  return match?.id || restaurants?.[0]?.id || "";
};

const today = new Date();
const monthStart = toLocalDateInputValue(
  new Date(today.getFullYear(), today.getMonth(), 1),
);
const monthEnd = toLocalDateInputValue(
  new Date(today.getFullYear(), today.getMonth() + 1, 0),
);

export const CASHFLOW_CATEGORIES = [
  "sale",
  "refund",
  "payroll",
  "inventory",
  "operations",
  "supplier_payment",
  "adjustment",
  "other",
];
export const CASHFLOW_SUBCATEGORIES = [
  "labor",
  "cogs",
  "rent",
  "utility",
  "maintenance",
  "marketing",
  "bank_fee",
  "tax",
  "etc",
  "other",
];
export const PAYMENT_METHODS = [
  "cash",
  "card",
  "bank_transfer",
  "e_wallet",
  "transfer",
  "provider",
  "other",
];
export const CASHFLOW_STATUSES = ["draft", "pending", "completed", "voided"];

export function useTransactions() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const requestedRestaurantId = useMemo(
    () =>
      getRequestedTransactionRestaurantId(
        typeof window !== "undefined" ? window.location.search : "",
      ),
    [],
  );
  const [restaurantId, setRestaurantId] = useState(() =>
    selectAccessibleTransactionRestaurant(restaurants, requestedRestaurantId),
  );
  const [filters, setFilters] = useState({
    dateFrom: monthStart,
    dateTo: monthEnd,
    type: "all",
    category: "",
    subcategory: "",
    method: "",
    status: "",
    source: "",
    referenceId: "",
    search: "",
  });
  const [reconciliationStatus, setReconciliationStatus] = useState("all");
  const [bankStatus, setBankStatus] = useState("");

  useEffect(() => {
    const nextRestaurantId = selectAccessibleTransactionRestaurant(
      restaurants,
      restaurantId || requestedRestaurantId,
    );
    if (String(nextRestaurantId) !== String(restaurantId)) {
      setRestaurantId(nextRestaurantId);
    }
  }, [requestedRestaurantId, restaurantId, restaurants]);

  useEffect(() => {
    const handleNavigation = (event) => {
      if (event?.detail?.page !== "transactions") return;
      const requested = event.detail.query?.restaurantId;
      if (!requested) return;
      const nextRestaurantId = selectAccessibleTransactionRestaurant(
        restaurants,
        requested,
      );
      if (String(nextRestaurantId) === String(requested)) {
        setRestaurantId(nextRestaurantId);
      }
    };
    window.addEventListener("manager:navigation-query", handleNavigation);
    return () =>
      window.removeEventListener("manager:navigation-query", handleNavigation);
  }, [restaurants]);

  const variables = useMemo(() => {
    const base = {
      restaurantId,
      dateFrom: toGraphqlDateTime(filters.dateFrom),
      dateTo: toGraphqlDateTime(filters.dateTo, { endOfDay: true }),
      type: filters.type === "all" ? null : filters.type,
      category: filters.category || null,
      subcategory: filters.subcategory || null,
      method: filters.method || null,
      status: filters.status || null,
      source: filters.source || null,
      referenceId: filters.referenceId || null,
      search: filters.search || null,
      limit: 150,
    };
    return {
      restaurantId,
      transactionsInput: base,
      cashflowsInput: base,
      refundInput: { restaurantId, limit: 50 },
      reconciliationStatus:
        reconciliationStatus === "all" ? null : reconciliationStatus,
      bankStatus: bankStatus || null,
    };
  }, [bankStatus, filters, reconciliationStatus, restaurantId]);

  const query = useQuery(GET_TRANSACTIONS, {
    skip: !restaurantId,
    fetchPolicy: "network-only",
    variables,
  });

  const mutationOptions = { onCompleted: () => query.refetch() };
  const [createManualCashflowMutation] = useMutation(
    CREATE_MANUAL_CASHFLOW,
    mutationOptions,
  );
  const [updateManualCashflowMutation] = useMutation(
    UPDATE_MANUAL_CASHFLOW,
    mutationOptions,
  );
  const [voidManualCashflowMutation] = useMutation(
    VOID_MANUAL_CASHFLOW,
    mutationOptions,
  );
  const [createRefundRequestMutation] = useMutation(
    CREATE_REFUND_REQUEST,
    mutationOptions,
  );
  const [approveRefundRequestMutation] = useMutation(
    APPROVE_REFUND_REQUEST,
    mutationOptions,
  );
  const [processRefundRequestMutation] = useMutation(
    PROCESS_REFUND_REQUEST,
    mutationOptions,
  );
  const [cancelRefundRequestMutation] = useMutation(
    CANCEL_REFUND_REQUEST,
    mutationOptions,
  );
  const [retryRefundRequestMutation] = useMutation(
    RETRY_REFUND_REQUEST,
    mutationOptions,
  );
  const [rejectRefundRequestMutation] = useMutation(
    REJECT_REFUND_REQUEST,
    mutationOptions,
  );
  const [reconcileBankTransactionMutation] = useMutation(
    RECONCILE_BANK_TRANSACTION,
    mutationOptions,
  );
  const [manualMatchBankTransactionMutation] = useMutation(
    MANUAL_MATCH_BANK_TRANSACTION,
    mutationOptions,
  );
  const [resolveReconciliationMutation] = useMutation(
    RESOLVE_RECONCILIATION,
    mutationOptions,
  );
  const [ignoreBankTransactionMutation] = useMutation(
    IGNORE_BANK_TRANSACTION,
    mutationOptions,
  );
  const [createSupplierPayableMutation] = useMutation(
    CREATE_SUPPLIER_PAYABLE,
    mutationOptions,
  );
  const [updateSupplierPayableMutation] = useMutation(
    UPDATE_SUPPLIER_PAYABLE,
    mutationOptions,
  );
  const [recordSupplierPaymentMutation] = useMutation(
    RECORD_SUPPLIER_PAYMENT,
    mutationOptions,
  );
  const [voidSupplierPayableMutation] = useMutation(
    VOID_SUPPLIER_PAYABLE,
    mutationOptions,
  );

  return {
    restaurants,
    restaurantId,
    setRestaurantId,
    filters,
    setFilters,
    reconciliationStatus,
    setReconciliationStatus,
    bankStatus,
    setBankStatus,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    transactions: query.data?.financeTransactions || [],
    cashflows: query.data?.cashflows || [],
    refunds: query.data?.refundRequests || [],
    reconciliations: query.data?.reconciliationQueue || [],
    supplierPayables: query.data?.supplierPayables || [],
    bankTransactions: query.data?.bankTransactions || [],
    createManualCashflow: (input) =>
      createManualCashflowMutation({
        variables: { input: { ...input, restaurantId } },
      }),
    updateManualCashflow: (id, input) =>
      updateManualCashflowMutation({ variables: { id, input } }),
    voidManualCashflow: (id, reason) =>
      voidManualCashflowMutation({ variables: { id, reason } }),
    createRefundRequest: (input) =>
      createRefundRequestMutation({
        variables: { input: { ...input, restaurantId } },
      }),
    approveRefundRequest: (id) =>
      approveRefundRequestMutation({ variables: { id } }),
    processRefundRequest: (id, input = {}) =>
      processRefundRequestMutation({ variables: { id, input } }),
    cancelRefundRequest: (id, reason) =>
      cancelRefundRequestMutation({ variables: { id, reason } }),
    retryRefundRequest: (id, input = {}) =>
      retryRefundRequestMutation({ variables: { id, input } }),
    rejectRefundRequest: (id, reason) =>
      rejectRefundRequestMutation({ variables: { id, reason } }),
    reconcileBankTransaction: (bankTransactionId) =>
      reconcileBankTransactionMutation({ variables: { bankTransactionId } }),
    manualMatchBankTransaction: (input) =>
      manualMatchBankTransactionMutation({ variables: { input } }),
    resolveReconciliation: (input) =>
      resolveReconciliationMutation({ variables: { input } }),
    ignoreBankTransaction: (id, reason) =>
      ignoreBankTransactionMutation({ variables: { id, reason } }),
    createSupplierPayable: (input) =>
      createSupplierPayableMutation({
        variables: { input: { ...input, restaurantId } },
      }),
    updateSupplierPayable: (id, input) =>
      updateSupplierPayableMutation({ variables: { id, input } }),
    recordSupplierPayment: (id, input) =>
      recordSupplierPaymentMutation({ variables: { id, input } }),
    voidSupplierPayable: (id, reason) =>
      voidSupplierPayableMutation({ variables: { id, reason } }),
  };
}
