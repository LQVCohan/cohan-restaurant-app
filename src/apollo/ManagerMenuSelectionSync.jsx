import { useEffect } from "react";
import { useApolloClient } from "@apollo/client";
import { MANAGER_MENU_SELECTION_EVENT } from "@/utils/managerMenuSelection";

export default function ManagerMenuSelectionSync() {
  const client = useApolloClient();

  useEffect(() => {
    const handleSelection = () => {
      client.refetchQueries({
        include: ["GetCategories", "TopCategoriesByRestaurant"],
      });
    };

    window.addEventListener(MANAGER_MENU_SELECTION_EVENT, handleSelection);
    return () =>
      window.removeEventListener(MANAGER_MENU_SELECTION_EVENT, handleSelection);
  }, [client]);

  return null;
}
