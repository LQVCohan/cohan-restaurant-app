import { ApolloLink } from "@apollo/client";
import { getManagerMenuSelection } from "@/utils/managerMenuSelection";

const isManagerMenuPage = () => {
  if (typeof window === "undefined") return false;
  if (!window.location.pathname.startsWith("/manager")) return false;
  return (
    window.location.hash === "#menu" ||
    Boolean(document.querySelector(".mm-page-container"))
  );
};

const getManagerRestaurantId = () => {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem("manager.selectedRestaurantId") || "");
  } catch {
    return "";
  }
};

const matchesSelection = (selection, value) =>
  selection &&
  String(value?.restaurantId || "") === selection.restaurantId &&
  (!value?.timeSlot || String(value.timeSlot) === selection.timeSlot);

export const applyManagerMenuSelection = (
  operationName,
  variables = {},
  selection,
  managerRestaurantId = "",
) => {
  const scopedVariables =
    ["EnsureMenu", "CopyMenu"].includes(operationName) &&
    variables.input &&
    managerRestaurantId
      ? {
          ...variables,
          input: {
            ...variables.input,
            restaurantId: managerRestaurantId,
          },
        }
      : variables;

  if (!selection) return scopedVariables;

  if (
    operationName === "MenuItemsConnection" &&
    matchesSelection(selection, scopedVariables.filter)
  ) {
    return {
      ...scopedVariables,
      filter: { ...scopedVariables.filter, menuId: selection.menuId },
    };
  }

  if (
    ["CreateMenuItem", "SyncMenuItemInventoryStatuses"].includes(
      operationName,
    ) &&
    matchesSelection(selection, scopedVariables.input)
  ) {
    return {
      ...scopedVariables,
      input: { ...scopedVariables.input, menuId: selection.menuId },
    };
  }

  return scopedVariables;
};

export const managerMenuSelectionLink = new ApolloLink((operation, forward) => {
  if (!isManagerMenuPage()) return forward(operation);

  operation.variables = applyManagerMenuSelection(
    operation?.operationName || "",
    operation?.variables || {},
    getManagerMenuSelection(),
    getManagerRestaurantId(),
  );
  return forward(operation);
});
