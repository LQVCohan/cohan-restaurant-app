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

const matchesSelection = (selection, value) =>
  selection &&
  String(value?.restaurantId || "") === selection.restaurantId &&
  (!value?.timeSlot || String(value.timeSlot) === selection.timeSlot);

export const applyManagerMenuSelection = (
  operationName,
  variables = {},
  selection,
) => {
  if (!selection) return variables;

  if (
    operationName === "MenuItemsConnection" &&
    matchesSelection(selection, variables.filter)
  ) {
    return {
      ...variables,
      filter: { ...variables.filter, menuId: selection.menuId },
    };
  }

  if (
    ["CreateMenuItem", "SyncMenuItemInventoryStatuses"].includes(
      operationName,
    ) &&
    matchesSelection(selection, variables.input)
  ) {
    return {
      ...variables,
      input: { ...variables.input, menuId: selection.menuId },
    };
  }

  return variables;
};

export const managerMenuSelectionLink = new ApolloLink((operation, forward) => {
  if (!isManagerMenuPage()) return forward(operation);

  operation.variables = applyManagerMenuSelection(
    operation?.operationName || "",
    operation?.variables || {},
    getManagerMenuSelection(),
  );
  return forward(operation);
});
