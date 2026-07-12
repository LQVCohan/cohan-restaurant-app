import { useEffect } from "react";
import { useApolloClient } from "@apollo/client";
import {
  getManagerMenuSelection,
  MANAGER_MENU_SELECTION_EVENT,
} from "@/utils/managerMenuSelection";

const matchesSelection = (variables, selection) => {
  const scope = variables?.filter || variables || {};
  return (
    String(scope.restaurantId || "") === selection.restaurantId &&
    (!scope.timeSlot || String(scope.timeSlot) === selection.timeSlot)
  );
};

export default function ManagerMenuSelectionSync() {
  const client = useApolloClient();

  useEffect(() => {
    const handleSelection = (event) => {
      const selection = event?.detail || getManagerMenuSelection();
      if (!selection) return;

      void client
        .refetchQueries({
          include: [
            "MenuItemsConnection",
            "GetCategories",
            "TopCategoriesByRestaurant",
          ],
          onQueryUpdated(observableQuery) {
            const variables = observableQuery.variables || {};
            if (!matchesSelection(variables, selection)) return false;

            if (variables.filter) {
              return observableQuery.refetch({
                ...variables,
                cursor: null,
                filter: {
                  ...variables.filter,
                  menuId: selection.menuId,
                },
              });
            }

            return observableQuery.refetch({
              ...variables,
              menuId: selection.menuId,
            });
          },
        })
        .catch(() => {});
    };

    window.addEventListener(MANAGER_MENU_SELECTION_EVENT, handleSelection);
    return () =>
      window.removeEventListener(MANAGER_MENU_SELECTION_EVENT, handleSelection);
  }, [client]);

  return null;
}
