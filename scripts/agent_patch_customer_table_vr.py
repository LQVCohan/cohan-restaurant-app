from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/components/Customer/TableBooking/TableBooking.jsx",
    'import { mapCartItemToReservationOrderItemInput } from "@/utils/discountPreviewPayload";\n',
    'import { mapCartItemToReservationOrderItemInput } from "@/utils/discountPreviewPayload";\n'
    'import { loadTableVrImage } from "@/utils/vrStorage";\n'
    'import {\n'
    '  getCurrentPageReturnTo,\n'
    '  openTableVrViewerInNewTab,\n'
    '} from "@/utils/tableVrNavigation";\n',
)

replace_once(
    "src/components/Customer/TableBooking/TableBooking.jsx",
    '  const activeFloorDescription = String(activeFloorData?.description || "").trim()\n'
    '    || "Khám phá sơ đồ, kéo để di chuyển và chọn bàn phù hợp với nhóm của bạn.";\n',
    '  const activeFloorDescription = String(activeFloorData?.description || "").trim()\n'
    '    || "Khám phá sơ đồ, kéo để di chuyển và chọn bàn phù hợp với nhóm của bạn.";\n'
    '  const selectedTableVrUrl = (() => {\n'
    '    const configuredUrl = String(selectedTable?.vrUrl || "").trim();\n'
    '    if (configuredUrl) return configuredUrl;\n'
    '    if (!selectedTable?.id || !loadTableVrImage(selectedTable.id)) return "";\n'
    '    return `/vr/table/${encodeURIComponent(selectedTable.id)}`;\n'
    '  })();\n'
    '  const handleViewSelectedTable360 = () => {\n'
    '    if (!selectedTableVrUrl) return;\n'
    '    openTableVrViewerInNewTab(selectedTableVrUrl, {\n'
    '      returnTo: getCurrentPageReturnTo(),\n'
    '    });\n'
    '  };\n',
)

replace_once(
    "src/components/Customer/TableBooking/TableBooking.jsx",
    '                  onOrderDishes={() => navigate(`/cus-menu?restaurantId=${encodeURIComponent(restaurantId)}&returnTo=booking`)}\n'
    '                />',
    '                  onOrderDishes={() => navigate(`/cus-menu?restaurantId=${encodeURIComponent(restaurantId)}&returnTo=booking`)}\n'
    '                  onView360={\n'
    '                    selectedTableVrUrl ? handleViewSelectedTable360 : undefined\n'
    '                  }\n'
    '                />',
)

replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '} from "@/utils/vrStorage";\n',
    '} from "@/utils/vrStorage";\n'
    'import {\n'
    '  getCurrentPageReturnTo,\n'
    '  openTableVrViewerInNewTab,\n'
    '} from "@/utils/tableVrNavigation";\n',
)

replace_once(
    "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx",
    '                        window.open(vrUrl, "_blank", "noopener,noreferrer");',
    '                        openTableVrViewerInNewTab(vrUrl, {\n'
    '                          returnTo: getCurrentPageReturnTo(),\n'
    '                        });',
)

replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    'import { useNavigate, useParams } from "react-router-dom";\n',
    'import { useLocation, useNavigate, useParams } from "react-router-dom";\n',
)

replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    'import { loadTableVrImage } from "@/utils/vrStorage";\n',
    'import { loadTableVrImage } from "@/utils/vrStorage";\n'
    'import { getTableVrViewerNavigation } from "@/utils/tableVrNavigation";\n',
)

replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    '''const VRViewer = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    setImageUrl(loadTableVrImage(tableId));
  }, [tableId]);

  const handleCloseViewer = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.warn("Không thể thoát toàn màn hình trước khi đóng trang.", error);
    }

    try {
      window.opener?.focus?.();
    } catch {
      // Trình duyệt có thể chặn quyền truy cập cửa sổ mở trang này.
    }

    window.close();

    window.setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate("/manager#tables", { replace: true });
    }, 120);
  };
''',
    '''const VRViewer = () => {
  const { tableId } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState(null);
  const { openedInNewTab, returnTo } = getTableVrViewerNavigation(search);

  useEffect(() => {
    setImageUrl(loadTableVrImage(tableId));
  }, [tableId]);

  const navigateBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(returnTo || "/", { replace: true });
  };

  const handleCloseViewer = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.warn("Không thể thoát toàn màn hình trước khi rời trang.", error);
    }

    if (!openedInNewTab) {
      navigateBack();
      return;
    }

    try {
      window.opener?.focus?.();
    } catch {
      // Trình duyệt có thể chặn quyền truy cập cửa sổ mở trang này.
    }

    window.close();
    window.setTimeout(() => {
      if (window.closed) return;
      navigate(returnTo || "/", { replace: true });
    }, 120);
  };
''',
)

replace_once(
    "src/components/Customer/VRViewer/VRViewer.jsx",
    '''          aria-label="Đóng trang xem không gian 360 độ"
          title="Đóng trang hiện tại"
        >
          × Đóng
''',
    '''          aria-label={
            openedInNewTab
              ? "Đóng trang xem không gian 360 độ"
              : "Quay lại trang trước"
          }
          title={openedInNewTab ? "Đóng tab hiện tại" : "Quay lại trang trước"}
        >
          {openedInNewTab ? "× Đóng" : "← Quay lại"}
''',
)

replace_once(
    "src/components/Customer/TableBooking/BookingSummary/BookingSummary.scss",
    '    .bsm-info-list {\n',
    '''    .bsm-btn-vr {
      width: 100%;
      min-height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      margin: -4px 0 18px;
      padding: 11px 14px;
      color: $brand-dark;
      background: linear-gradient(135deg, $brand-soft, #fff8f2);
      border: 1px solid rgba($brand, 0.34);
      border-radius: 14px;
      font-size: 0.8rem;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      transition: 0.2s ease;

      &:hover {
        border-color: $brand;
        background: rgba($brand, 0.14);
        transform: translateY(-1px);
      }
    }

    .bsm-info-list {
''',
)

vr_test = '''import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/utils/vrStorage", () => ({
  loadTableVrImage: () => null,
}));

import VRViewer from "./VRViewer";

const renderViewer = (initialEntries, initialIndex) =>
  render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="/booking/:id" element={<div>Trang đặt bàn</div>} />
        <Route path="/vr/table/:tableId" element={<VRViewer />} />
      </Routes>
    </MemoryRouter>,
  );

describe("VRViewer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "close").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("closes the current tab only when the viewer was explicitly opened in a new tab", () => {
    renderViewer([
      "/vr/table/table-a1?openedInNewTab=1&returnTo=%2Fbooking%2Fr1",
    ]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Đóng trang xem không gian 360 độ",
      }),
    );

    expect(window.close).toHaveBeenCalledTimes(1);
    expect(screen.getByText("× Đóng")).toBeInTheDocument();
  });

  it("goes back without closing when the viewer is being used in the current tab", () => {
    renderViewer(["/booking/r1", "/vr/table/table-a1"], 1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Quay lại trang trước",
      }),
    );

    expect(window.close).not.toHaveBeenCalled();
    expect(screen.getByText("Trang đặt bàn")).toBeInTheDocument();
  });
});
'''
(ROOT / "src/components/Customer/VRViewer/VRViewer.test.jsx").write_text(
    vr_test, encoding="utf-8"
)
