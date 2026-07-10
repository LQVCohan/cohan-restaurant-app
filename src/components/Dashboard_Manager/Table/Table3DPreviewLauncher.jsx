import React, {
  Suspense,
  lazy,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ScanLine } from "lucide-react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";

const Table3DSimulatorModalV2 = lazy(() =>
  import("./Table3DSimulatorModalV2"),
);
const MANAGER_RESTAURANT_STORAGE_KEY = "manager.selectedRestaurantId";
const MANAGER_SCOPE_EVENT = "manager:scope-selection";

const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

export default function Table3DPreviewLauncher() {
  const location = useLocation();
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [portalTarget, setPortalTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(MANAGER_RESTAURANT_STORAGE_KEY) || "",
  );

  const isManagerRoute = location.pathname.startsWith("/manager");

  useEffect(() => {
    if (!isManagerRoute) {
      setPortalTarget(null);
      setOpen(false);
      return undefined;
    }

    const findTarget = () => {
      const nextTarget = document.querySelector(
        ".manager-layout--tables .tm-container .mph-controls-row",
      );
      setPortalTarget((current) => (current === nextTarget ? current : nextTarget));
      if (!nextTarget) setOpen(false);
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isManagerRoute, location.hash]);

  useEffect(() => {
    if (selectedRestaurantId || !restaurants.length) return;
    setSelectedRestaurantId(getRestaurantId(restaurants[0]));
  }, [restaurants, selectedRestaurantId]);

  useEffect(() => {
    const handleScopeSelection = (event) => {
      if (event?.detail?.key !== MANAGER_RESTAURANT_STORAGE_KEY) return;
      setSelectedRestaurantId(String(event.detail.value || ""));
    };

    window.addEventListener(MANAGER_SCOPE_EVENT, handleScopeSelection);
    return () =>
      window.removeEventListener(MANAGER_SCOPE_EVENT, handleScopeSelection);
  }, []);

  const selectedRestaurant = useMemo(
    () =>
      restaurants.find(
        (restaurant) => getRestaurantId(restaurant) === selectedRestaurantId,
      ) || restaurants[0] || null,
    [restaurants, selectedRestaurantId],
  );
  const restaurantId = getRestaurantId(selectedRestaurant);

  return (
    <>
      {portalTarget &&
        createPortal(
          <button
            type="button"
            className="mph-btn mph-btn--secondary"
            onClick={() => setOpen(true)}
            disabled={!restaurantId}
            title={
              restaurantId
                ? "Chọn hoặc nhập model bàn rồi xem thử bằng camera AR"
                : "Chưa có chi nhánh để xem thử bàn"
            }
            aria-label="Xem thử bàn 3D và AR"
          >
            <ScanLine size={16} aria-hidden="true" />
            <span>Xem thử bàn</span>
          </button>,
          portalTarget,
        )}

      {open && (
        <Suspense fallback={null}>
          <Table3DSimulatorModalV2
            open
            onClose={() => setOpen(false)}
            restaurantId={restaurantId}
            restaurantName={selectedRestaurant?.name || "Nhà hàng hiện tại"}
          />
        </Suspense>
      )}
    </>
  );
}
