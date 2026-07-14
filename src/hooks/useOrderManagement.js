import { gql, useMutation } from "@apollo/client";
import { useCallback, useMemo } from "react";
import useOrderManagementLegacy from "./useOrderManagementLegacy";
import { getGraphQLErrorMessage } from "@/utils/graphqlErrorUtils";
import { getPartialTablePaymentSelection } from "@/utils/partialTablePaymentSelection";
import {
  filterKitchenVisibleOrders,
  isStaffKitchenWorkspacePath,
} from "@/utils/kitchenOrderVisibility";

const PAY_SELECTED_TABLE_ORDERS = gql`
  mutation PaySelectedTableOrders($input: PayOrdersByOrderIdsInput!) {
    payOrdersByOrderIds(input: $input) {
      warning
      pendingOrderCodes
      invoice {
        id
        number
        totals {
          subtotal
          discount
          discountReason
          voucherCode
          promotionId
          service
          tax
          shippingFee
          grandTotal
        }
      }
      transaction {
        id
        paidAmount
        method
        status
      }
      cashflow {
        id
        amount
        type
      }
    }
  }
`;

const normalizeIds = (values = []) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  ),
];

const selectionMatchesContext = (selection, { restaurantId, tableId } = {}) => {
  if (!selection?.active || !selection?.useOrderIds) return false;

  const expectedRestaurantId = String(selection.restaurantId || "");
  const expectedTableId = String(selection.tableId || "");
  const actualRestaurantId = String(restaurantId || "");
  const actualTableId = String(tableId || "");

  if (
    expectedRestaurantId &&
    actualRestaurantId &&
    expectedRestaurantId !== actualRestaurantId
  ) {
    return false;
  }

  if (expectedTableId && actualTableId && expectedTableId !== actualTableId) {
    return false;
  }

  return selection.selectedOrderIds.length > 0;
};

export default function useOrderManagement(pos = null) {
  const legacy = useOrderManagementLegacy(pos);
  const [paySelectedOrders, { loading: paySelectedOrdersLoading }] =
    useMutation(PAY_SELECTED_TABLE_ORDERS);
  const kitchenWorkspace = isStaffKitchenWorkspacePath(
    typeof window !== "undefined" ? window.location.pathname : "",
  );
  const visibleOrdersNow = useMemo(
    () =>
      kitchenWorkspace
        ? filterKitchenVisibleOrders(legacy.ordersNow)
        : legacy.ordersNow,
    [kitchenWorkspace, legacy.ordersNow],
  );

  const confirmPayment = useCallback(
    async ({
      restaurantId,
      method = "cash",
      paidAmount = 0,
      note = "",
      externalRef = null,
      pricing = null,
      promotionIds = [],
    } = {}) => {
      const currentOrderType = pos?.currentOrderType;
      const isDineIn = !currentOrderType || currentOrderType === "dine_in";
      const tableId =
        pos?.currentTable?.id || pos?.currentTable?._id || null;
      const selection = getPartialTablePaymentSelection();

      if (
        !isDineIn ||
        !selectionMatchesContext(selection, { restaurantId, tableId })
      ) {
        return legacy.confirmPayment({
          restaurantId,
          method,
          paidAmount,
          note,
          externalRef,
          pricing,
          promotionIds,
        });
      }

      if (!restaurantId) {
        return { success: false, message: "Thiếu restaurantId." };
      }

      const normalizedPromotionIds = normalizeIds(promotionIds);
      const orderIds = normalizeIds(selection.selectedOrderIds);
      if (!orderIds.length) {
        return {
          success: false,
          message: "Vui lòng chọn ít nhất một đợt gọi món để thanh toán.",
        };
      }

      const validation = legacy.validatePayment({
        method,
        paidAmount,
        total: Number(paidAmount || 0),
      });
      if (!validation.ok) {
        return { success: false, message: validation.message };
      }

      const idempotency =
        externalRef ||
        `partial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      try {
        const { data } = await paySelectedOrders({
          variables: {
            input: {
              restaurantId,
              orderIds,
              paidAmount: Number(paidAmount || 0),
              method,
              note,
              externalRef: idempotency,
              ...(pricing ? { pricing } : {}),
              ...(normalizedPromotionIds.length
                ? { promotionIds: normalizedPromotionIds }
                : {}),
            },
          },
        });

        const result = data?.payOrdersByOrderIds || null;
        const pendingOrderCodes = Array.isArray(result?.pendingOrderCodes)
          ? result.pendingOrderCodes
          : [];

        if (result?.warning === true || pendingOrderCodes.length > 0) {
          return {
            success: false,
            message: pendingOrderCodes.length
              ? `Không thể thanh toán các đợt chưa phục vụ xong: ${pendingOrderCodes.join(", ")}`
              : "Backend trả về cảnh báo khi thanh toán. Vui lòng kiểm tra lại trạng thái đơn.",
            data: result,
          };
        }

        if (!result?.invoice && !result?.transaction) {
          return {
            success: false,
            message: "Thanh toán chưa được backend xác nhận.",
            data: result,
          };
        }

        return {
          success: true,
          data: result,
          partialPayment: selection.isPartial,
          paidOrderIds: orderIds,
        };
      } catch (error) {
        return {
          success: false,
          message: getGraphQLErrorMessage(
            error,
            "Thanh toán theo đợt thất bại.",
          ),
        };
      }
    },
    [legacy, paySelectedOrders, pos?.currentOrderType, pos?.currentTable],
  );

  const resolvePayableOrderIds = useCallback(
    async (args = {}) => {
      const selection = getPartialTablePaymentSelection();
      if (selectionMatchesContext(selection, args)) {
        return normalizeIds(selection.selectedOrderIds);
      }
      return legacy.resolvePayableOrderIds(args);
    },
    [legacy],
  );

  return {
    ...legacy,
    ordersNow: visibleOrdersNow,
    confirmPayment,
    resolvePayableOrderIds,
    payLoading: Boolean(legacy.payLoading || paySelectedOrdersLoading),
  };
}
