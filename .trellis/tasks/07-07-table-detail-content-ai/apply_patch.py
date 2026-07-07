from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_many(path, replacements):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
        text = text.replace(old, new)
    file.write_text(text, encoding="utf-8")


# Scope promotion queries to an explicit restaurant when embedded in another screen.
promotions_path = "src/hooks/usePromotions.js"
replace_once(
    promotions_path,
    "export const usePromotions = () => {",
    """export const usePromotions = ({
  restaurantId: restaurantIdOverride = "",
  activeOnly = false,
  showErrorBanner = true,
} = {}) => {""",
)
replace_once(
    promotions_path,
    '  const defaultRestaurantId = restaurantOptions[0]?.id || "";\n',
    '  const defaultRestaurantId = restaurantOptions[0]?.id || "";\n  const scopedRestaurantId = String(restaurantIdOverride || "").trim();\n',
)
replace_once(
    promotions_path,
    """  useEffect(() => {
    if (!restaurantOptions.length) return;

    const hasSelectedRestaurant = restaurantOptions.some(
      (restaurant) => String(restaurant.id) === String(filters.restaurant || ""),
    );

    if (!filters.restaurant || !hasSelectedRestaurant) {
      setFilters((prev) => ({
        ...prev,
        restaurant: String(restaurantOptions[0].id),
      }));
    }
  }, [restaurantOptions, filters.restaurant]);

  const selectedRestaurantId = filters.restaurant || defaultRestaurantId;""",
    """  useEffect(() => {
    if (scopedRestaurantId || !restaurantOptions.length) return;

    const hasSelectedRestaurant = restaurantOptions.some(
      (restaurant) => String(restaurant.id) === String(filters.restaurant || ""),
    );

    if (!filters.restaurant || !hasSelectedRestaurant) {
      setFilters((prev) => ({
        ...prev,
        restaurant: String(restaurantOptions[0].id),
      }));
    }
  }, [restaurantOptions, filters.restaurant, scopedRestaurantId]);

  const selectedRestaurantId =
    scopedRestaurantId || filters.restaurant || defaultRestaurantId;""",
)
replace_once(
    promotions_path,
    """      activeOnly: false,
      limit: 500,""",
    """      activeOnly,
      limit: 500,""",
)
replace_once(
    promotions_path,
    "  useEffect(() => mountPromotionErrorBanner({ error, refetch }), [error, refetch]);",
    """  useEffect(
    () => (showErrorBanner ? mountPromotionErrorBanner({ error, refetch }) : undefined),
    [error, refetch, showErrorBanner],
  );""",
)

modal_path = "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx"
replace_once(
    modal_path,
    'import { usePromotions } from "@/hooks/usePromotions";\n',
    'import { usePromotions } from "@/hooks/usePromotions";\nimport { getToken } from "@/lib/authStorage";\nimport { toApiUrl } from "@/lib/apiBaseUrl";\n',
)
replace_once(
    modal_path,
    """import {
  buildPreviewModelItemFromVisualConfig,
  formatVisualConfigSavedAt,
  getVisualConfigSummary,
} from "@/components/Dashboard_Manager/Table/tableVisualConfigHelpers";
import { DEFAULT_CAMERA_PLACEMENT, normalizeCameraPlacement } from "@/config/table3dCameraPlacementStorage";""",
    """import {
  buildPreviewModelItemFromVisualConfig,
  getVisualConfigSummary,
} from "@/components/Dashboard_Manager/Table/tableVisualConfigHelpers";""",
)
replace_many(
    modal_path,
    [
        ('  const [posX, setPosX] = useState("");\n', ""),
        ('  const [posY, setPosY] = useState("");\n', ""),
        ('      posX: table?.position?.x != null ? String(Math.round(table.position.x)) : "",\n', ""),
        ('      posY: table?.position?.y != null ? String(Math.round(table.position.y)) : "",\n', ""),
        ('    posX,\n', ""),
        ('    posY,\n', ""),
        ('      posX: v?.posX ?? "",\n', ""),
        ('      posY: v?.posY ?? "",\n', ""),
        ('      setPosX(draft?.posX ?? "");\n', ""),
        ('      setPosY(draft?.posY ?? "");\n', ""),
        ('    setPosX(\n      table?.position?.x != null ? String(Math.round(table.position.x)) : ""\n    );\n', ""),
        ('    setPosY(\n      table?.position?.y != null ? String(Math.round(table.position.y)) : ""\n    );\n', ""),
        ('      schemaVersion: "1",', '      schemaVersion: "2",'),
    ],
)
replace_once(
    modal_path,
    """  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  const { allPromotions } = usePromotions();
  const { showNotification } = useNotification();
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:4000/graphql").replace(
    /\/graphql$/i,
    ""
  );""",
    """  const setBusyKey = (k, v) => setBusy((b) => ({ ...b, [k]: v }));
  const {
    allPromotions,
    loading: promotionsLoading,
    error: promotionsError,
  } = usePromotions({
    restaurantId,
    activeOnly: true,
    showErrorBanner: false,
  });
  const { showNotification } = useNotification();""",
)
replace_once(
    modal_path,
    """  const visualConfigPlacement = useMemo(
    () => normalizeCameraPlacement(table?.visualConfig?.placement || DEFAULT_CAMERA_PLACEMENT),
    [table?.visualConfig?.placement]
  );
""",
    "",
)
replace_once(
    modal_path,
    """  const visualSavedAtLabel = useMemo(
    () => formatVisualConfigSavedAt(table?.visualConfig?.savedAt),
    [table?.visualConfig?.savedAt]
  );
""",
    "",
)
replace_once(
    modal_path,
    """        zone: zoneLabel?.trim() || null,
        position:
          posX === "" && posY === ""
            ? table?.position
            : {
                x: posX === "" ? 0 : Number.parseFloat(posX),
                y: posY === "" ? 0 : Number.parseFloat(posY),
              },
        reservationHoldMinutes:""",
    """        zone: zoneLabel?.trim() || null,
        reservationHoldMinutes:""",
)

old_ai = """  const buildAiPayload = () => ({
    table: {
      id: table?.id,
      code: code?.trim(),
      capacity,
      status,
      type,
      floorLevel: table?.floorLevel,
      floorId: table?.floorId,
      zone: zoneLabel,
      position:
        posX !== "" && posY !== ""
          ? { x: Number.parseFloat(posX), y: Number.parseFloat(posY) }
          : table?.position,
      deposit: depositAmount === "" ? null : Number.parseFloat(depositAmount),
      holdMinutes:
        holdMinutes === "" ? null : Number.parseInt(holdMinutes, 10),
      minSpend: minSpend === "" ? null : Number.parseFloat(minSpend),
      cancelPolicy,
      usageCount: table?.usageCount,
    },
    promotions: (allPromotions || []).map((promo) => ({
      id: promo.id,
      name: promo.name,
      code: promo.code,
      level: promo.level,
      usageCount: promo.usageCount,
    })),
    history:
      table?.usageHistory || table?.history || table?.reservationHistory || [],
    tables: table?.tables || table?.nearbyTables || [],
  });

  const callAiEndpoint = async (path, key, fallback) => {
    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAiPayload()),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      const suggestion = data?.suggestion || fallback.detail;
      setAiSuggestions((prev) => ({
        ...prev,
        [key]: { ...fallback, detail: suggestion },
      }));
    } catch (error) {
      console.error(error);
      setAiSuggestions((prev) => ({ ...prev, [key]: fallback }));
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSuggestMergeAI = () => {
    const seatTarget = Math.max(4, capacity || 0) + 2;
    callAiEndpoint("/api/ai/table/merge-suggestion", "merge", {
      title: "Đề xuất ghép bàn",
      detail: `Ưu tiên ghép bàn gần kề để đạt ${seatTarget} chỗ. Gợi ý: chọn 1-2 bàn trống cùng tầng.`,
    });
  };

  const handleSuggestPromoAI = () => {
    callAiEndpoint("/api/ai/table/promo-suggestion", "promo", {
      title: "Đề xuất ưu đãi",
      detail:
        allPromotions?.length > 0
          ? `Ưu tiên gắn: ${allPromotions
              .slice(0, 2)
              .map((promo) => promo.name || promo.code)
              .join(", ")}`
          : "Chưa có promotion, nên dùng ưu đãi nhanh như tặng nước / tráng miệng.",
    });
  };

  const handlePredictTurnoverAI = () => {
    const base = status === "occupied" ? 60 : status === "reserved" ? 30 : 10;
    callAiEndpoint("/api/ai/table/turnover-prediction", "turnover", {
      title: "AI dự đoán bàn trống",
      detail: `Ước lượng ${base}–${base + 20} phút để bàn trống (phụ thuộc số khách và món).`,
    });
  };"""
new_ai = """  const assistantTitles = {
    merge: "Bàn nên ghép",
    promo: "Khuyến mãi phù hợp",
    turnover: "Thời điểm bàn có thể trống",
  };

  const buildAiPayload = () => ({
    restaurantId,
    table: {
      id: table?.id,
      code: code?.trim(),
      capacity,
      status,
      type,
      floorLevel: table?.floorLevel,
      floorId: getTableFloorId(table),
      zone: zoneLabel,
      position: table?.position,
      deposit: depositAmount === "" ? null : Number.parseFloat(depositAmount),
      holdMinutes:
        holdMinutes === "" ? null : Number.parseInt(holdMinutes, 10),
      minSpend: minSpend === "" ? null : Number.parseFloat(minSpend),
      cancelPolicy,
      usageCount: table?.usageCount,
    },
    promotions: (allPromotions || []).map((promo) => ({
      id: promo.id,
      name: promo.name,
      code: promo.code,
      level: promo.level,
      usageCount: promo.usageCount,
    })),
    history:
      table?.usageHistory || table?.history || table?.reservationHistory || [],
    tables: (tables || [])
      .filter(
        (item) =>
          String(item?.id || item?._id || "") !== String(table?.id || "") &&
          String(getTableFloorId(item) || "") === String(getTableFloorId(table) || "") &&
          String(item?.status || "").toLowerCase() === "available",
      )
      .map((item) => ({
        id: item?.id || item?._id,
        code: getTableDisplayCode(item),
        capacity: getTableDisplayCapacity(item),
        status: item?.status,
        floorId: getTableFloorId(item),
        position: item?.position,
        usageCount: item?.usageCount,
      })),
  });

  const callAiEndpoint = async (path, key) => {
    if (!restaurantId) {
      showNotification("Chưa xác định được chi nhánh của bàn.", "error");
      return;
    }

    setAiLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const token = getToken();
      const response = await fetch(toApiUrl(path), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildAiPayload()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Không thể tải gợi ý vận hành.");
      }

      const suggestion = String(data?.suggestion || "").trim();
      if (!suggestion) throw new Error("Hệ thống chưa tạo được gợi ý phù hợp.");

      setAiSuggestions((prev) => ({
        ...prev,
        [key]: { title: assistantTitles[key], detail: suggestion },
      }));
    } catch (error) {
      setAiSuggestions((prev) => ({ ...prev, [key]: null }));
      showNotification(
        error?.message || "Không thể tải gợi ý vận hành. Vui lòng thử lại.",
        "error",
      );
    } finally {
      setAiLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSuggestMergeAI = () =>
    callAiEndpoint("/ai/table/merge-suggestion", "merge");

  const handleSuggestPromoAI = () =>
    callAiEndpoint("/ai/table/promo-suggestion", "promo");

  const handlePredictTurnoverAI = () =>
    callAiEndpoint("/ai/table/turnover-prediction", "turnover");"""
replace_once(modal_path, old_ai, new_ai)

replace_once(
    modal_path,
    """            <h3 id={titleId} className="talite-title">
              Cấu hình bàn ăn <b>{getTableDisplayCode(table) || "--"}</b>
            </h3>
            <p className="talite-subtitle">
              Thiết lập thông tin, VR và ưu đãi đi kèm cho bàn.
            </p>""",
    """            <h3 id={titleId} className="talite-title">
              Chi tiết bàn <b>{getTableDisplayCode(table) || "--"}</b>
            </h3>
            <p className="talite-subtitle">
              Cập nhật thông tin phục vụ, trạng thái và khuyến mãi của bàn.
            </p>""",
)
replace_once(
    modal_path,
    """            {zoneLabel && (
              <div className="kv">
                <span className="k">Khu:</span>
                <span className="v">{zoneLabel}</span>
              </div>
            )}
            {posX !== "" && posY !== "" && (
              <div className="kv">
                <span className="k">Vị trí:</span>
                <span className="v">
                  X{posX} · Y{posY}
                </span>
              </div>
            )}
""",
    "",
)
old_visual = """            {hasVisualConfig && (
              <div className="talite-visual-card">
                <div className="talite-visual-card__head">
                  <span className="talite-visual-card__icon">3D</span>
                  <div>
                    <strong>Mô phỏng 3D</strong>
                    <p>Đã gắn metadata model và camera placement cho bàn này.</p>
                  </div>
                </div>
                <div className="talite-visual-card__grid">
                  <div className="kv">
                    <span className="k">Model:</span>
                    <span className="v">{visualSummary?.label || "Mẫu bàn đã lưu"}</span>
                  </div>
                  {visualSummary?.modelKey && (
                    <div className="kv">
                      <span className="k">Key:</span>
                      <span className="v">{visualSummary.modelKey}</span>
                    </div>
                  )}
                  {visualSummary?.tableType && (
                    <div className="kv">
                      <span className="k">Loại bàn:</span>
                      <span className="v">{visualSummary.tableType}</span>
                    </div>
                  )}
                  {visualSummary?.capacity && (
                    <div className="kv">
                      <span className="k">Số ghế:</span>
                      <span className="v">{visualSummary.capacity}</span>
                    </div>
                  )}
                  {visualSummary?.source && (
                    <div className="kv">
                      <span className="k">Source:</span>
                      <span className="v">{visualSummary.source}</span>
                    </div>
                  )}
                  {visualSummary?.license && (
                    <div className="kv">
                      <span className="k">License:</span>
                      <span className="v">{visualSummary.license}</span>
                    </div>
                  )}
                  {visualSummary?.dimensions && (
                    <div className="kv">
                      <span className="k">Kích thước:</span>
                      <span className="v">{visualSummary.dimensions}</span>
                    </div>
                  )}
                  {visualSummary?.modelUrl && (
                    <div className="kv">
                      <span className="k">Model URL:</span>
                      <span className="v">
                        <a href={visualSummary.modelUrl} target="_blank" rel="noreferrer">
                          Mở model
                        </a>
                      </span>
                    </div>
                  )}
                  {visualSummary?.thumbnailUrl && (
                    <div className="kv talite-visual-card__thumb-row">
                      <span className="k">Thumbnail:</span>
                      <span className="v">
                        <img src={visualSummary.thumbnailUrl} alt="Thumbnail mô phỏng 3D" />
                      </span>
                    </div>
                  )}
                  <div className="kv">
                    <span className="k">Placement:</span>
                    <span className="v">
                      x:{visualConfigPlacement.x.toFixed(1)} · y:{visualConfigPlacement.y.toFixed(1)} · s:{visualConfigPlacement.scale.toFixed(2)} · r:{visualConfigPlacement.rotation.toFixed(0)}°
                    </span>
                  </div>
                  {visualSavedAtLabel && (
                    <div className="kv">
                      <span className="k">Lưu lúc:</span>
                      <span className="v">{visualSavedAtLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            )}"""
new_visual = """            {hasVisualConfig && (
              <div className="talite-visual-card">
                <div className="talite-visual-card__head">
                  <span className="talite-visual-card__icon">3D</span>
                  <div>
                    <strong>Đã có mô phỏng 3D</strong>
                    <p>{visualSummary?.label || "Bàn này đã được thiết lập mô phỏng."}</p>
                  </div>
                </div>
              </div>
            )}"""
replace_once(modal_path, old_visual, new_visual)

replace_once(
    modal_path,
    """              <div>
                <label className="talite-label">Vị trí X</label>
                <input
                  className="talite-input"
                  type="number"
                  value={posX}
                  onChange={(e) => setPosX(e.target.value)}
                  placeholder="VD: 120"
                />
              </div>
              <div>
                <label className="talite-label">Vị trí Y</label>
                <input
                  className="talite-input"
                  type="number"
                  value={posY}
                  onChange={(e) => setPosY(e.target.value)}
                  placeholder="VD: 80"
                />
              </div>
""",
    "",
)
replace_once(
    modal_path,
    """            <div className="actions-end">
              <button
                type="button"
                className="btn primary"
                disabled={isVrSaving}
                onClick={handleSaveBasics}
              >
                {busy.save
                  ? "Đang lưu…"
                  : vrUploading
                    ? "Đang xử lý ảnh…"
                    : "Lưu thay đổi"}
              </button>
            </div>
""",
    "",
)

replace_many(
    modal_path,
    [
        ("Thông tin cơ bản", "Thông tin bàn"),
        ("Quản lý mã bàn, sức chứa, khu vực và VR.", "Cập nhật mã bàn, số chỗ, loại bàn và khu vực phục vụ."),
        ('<label className="talite-label">Sức chứa</label>', '<label className="talite-label">Số chỗ</label>'),
        ('<label className="talite-label">Loại</label>', '<label className="talite-label">Loại bàn</label>'),
        ("Tags (phân tách dấu phẩy)", "Nhãn phân loại (cách nhau bằng dấu phẩy)"),
        ('<label className="talite-label">Khu vực (zone)</label>', '<label className="talite-label">Khu vực phục vụ</label>'),
        ("Cấu hình VR bàn", "Không gian 360° của bàn"),
        ("Gắn link VR hoặc tải ảnh 360° để xem không gian bàn.", "Thêm liên kết hoặc ảnh 360° để khách xem trước vị trí bàn."),
        (">VR 360°<", ">Ảnh 360°<"),
        ('<label className="talite-label">Link VR bàn</label>', '<label className="talite-label">Liên kết xem 360°</label>'),
        ("Dán link nếu dùng VR bên ngoài, hoặc tải", "Dán liên kết xem 360° bên ngoài hoặc tải"),
        ("<strong>Trạng thái cấu hình:</strong>", "<strong>Tình trạng:</strong>"),
        ("Đã có nguồn VR (link hoặc ảnh 360).", "Đã có nội dung xem 360°."),
        ("Chưa có nguồn VR cho bàn này.", "Chưa có nội dung xem 360°."),
        ("Bạn chưa gắn link VR hoặc ảnh 360 cho bàn này.", "Bàn này chưa có liên kết hoặc ảnh 360°."),
        ("Chưa có link VR để mở thử.", "Chưa có liên kết xem 360° để mở."),
        ("Mở VR bàn", "Mở bản xem 360°"),
        ("Sau khi kiểm tra preview, bấm", "Sau khi xem trước, bấm"),
        ("Cập nhật nhanh trạng thái vận hành của bàn.", "Chọn trạng thái hiện tại để nhân viên phối hợp phục vụ."),
        ("Chuyển tầng", "Chuyển bàn sang tầng khác"),
        ("Di chuyển bàn đến tầng mới khi cần bố trí lại.", "Chuyển bàn sang tầng khác khi thay đổi sơ đồ phục vụ."),
        ("Tầng đích", "Chuyển đến"),
        ('{busy.move ? "Đang chuyển…" : "Chuyển"}', '{busy.move ? "Đang chuyển…" : "Chuyển bàn"}'),
        ("Đổi chỗ với bàn khác (swap code)", "Đổi vị trí với bàn khác"),
        ("Hoán đổi mã bàn trong cùng tầng để tối ưu sơ đồ.", "Đổi mã hiển thị giữa hai bàn trong cùng một tầng."),
        ("Mã bàn muốn đổi", "Bàn cần đổi vị trí"),
        ("Chỉ đổi giữa 2 bàn cùng tầng.", "Chỉ áp dụng cho hai bàn trong cùng một tầng."),
        ('{busy.swap ? "Đang đổi…" : "Đổi chỗ"}', '{busy.swap ? "Đang đổi…" : "Đổi vị trí"}'),
        ("Gộp / Tách", "Ghép hoặc tách bàn"),
        ("Kết hợp bàn phục vụ nhóm lớn hoặc tách lại khi kết thúc.", "Ghép các bàn gần nhau cho nhóm đông; tách lại sau khi phục vụ xong."),
        ("Gộp với các bàn (mã cách nhau bởi dấu phẩy hoặc khoảng trắng)", "Mã các bàn cần ghép"),
        ('{busy.merge ? "Đang gộp…" : "Gộp bàn"}', '{busy.merge ? "Đang ghép…" : "Ghép bàn"}'),
        ("Đặt cọc & Ưu đãi khi đặt bàn", "Đặt cọc và khuyến mãi"),
        ("Gắn ưu đãi để hiển thị khi khách đặt bàn.", "Chọn mức đặt cọc và khuyến mãi áp dụng cho bàn này."),
        ("Giá đặt cọc (VND)", "Tiền đặt cọc (đồng)"),
        ("Giá đặt cọc sẽ hiển thị khi khách đặt bàn.", "Số tiền này sẽ hiển thị khi khách đặt bàn."),
        ("Tiện ích / ưu đãi nhanh (nhập tay)", "Quyền lợi thêm"),
        ("VD: Tặng ly nước, free tráng miệng...", "Ví dụ: Tặng nước, tặng món tráng miệng..."),
        ("Chưa có tiện ích/ưu đãi nhanh.", "Chưa có quyền lợi thêm."),
        ("Thiết lập thời lượng giữ bàn và điều kiện tối thiểu.", "Quy định thời gian giữ bàn, mức chi và điều kiện hủy."),
        ("Giữ bàn (phút)", "Thời gian giữ bàn (phút)"),
        ("Chi tiêu tối thiểu", "Mức chi tối thiểu (đồng)"),
        ("Chính sách huỷ", "Điều kiện hủy đặt bàn"),
        ("VD: Hủy trước 2 giờ để hoàn cọc...", "Ví dụ: Hủy trước 2 giờ để được hoàn cọc..."),
        ("Gợi ý AI cho bàn ăn", "Trợ lý vận hành bàn"),
        ("Tạo gợi ý nhanh để tối ưu ghép bàn, ưu đãi và thời gian trống.", "Dựa trên bàn trống cùng tầng, lịch sử phục vụ và khuyến mãi đang hiệu lực."),
        ('{aiLoading.merge ? "Đang gợi ý..." : "Đề xuất ghép bàn"}', '{aiLoading.merge ? "Đang phân tích..." : "Gợi ý bàn nên ghép"}'),
        ('{aiLoading.promo ? "Đang gợi ý..." : "Đề xuất ưu đãi"}', '{aiLoading.promo ? "Đang phân tích..." : "Gợi ý khuyến mãi phù hợp"}'),
        ('? "Đang dự đoán..."\n                  : "AI dự đoán bàn trống & thời gian quay vòng"', '? "Đang phân tích..."\n                  : "Ước tính thời điểm bàn trống"'),
        ("Xem lại bằng camera", "Xem lại mô phỏng"),
        ("Xoá bàn", "Xóa bàn"),
    ],
)

old_promo = """              <div className="talite-promo-box">
                <div className="talite-label">Ưu đãi từ Promotion</div>
                {allPromotions?.length ? (
                  <div className="talite-promo-list">
                    {allPromotions.map((promo) => (
                      <label key={promo.id} className="talite-check">
                        <input
                          type="checkbox"
                          checked={selectedPromotions.includes(promo.id)}
                          onChange={() => togglePromotion(promo.id)}
                        />
                        <span>
                          {promo.name || promo.code || "Ưu đãi chưa đặt tên"}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="hint">Chưa có ưu đãi từ Promotion.</div>
                )}
              </div>"""
new_promo = """              <div className="talite-promo-box">
                <div className="talite-label">Khuyến mãi đang hiệu lực</div>
                {promotionsLoading ? (
                  <div className="hint">Đang tải khuyến mãi...</div>
                ) : promotionsError ? (
                  <div className="hint">Không tải được khuyến mãi của chi nhánh này.</div>
                ) : allPromotions?.length ? (
                  <div className="talite-promo-list">
                    {allPromotions.map((promo) => (
                      <label key={promo.id} className="talite-check">
                        <input
                          type="checkbox"
                          checked={selectedPromotions.includes(promo.id)}
                          onChange={() => togglePromotion(promo.id)}
                        />
                        <span>{promo.name || promo.code || "Khuyến mãi chưa đặt tên"}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="hint">Chi nhánh chưa có khuyến mãi đang hiệu lực.</div>
                )}
              </div>"""
replace_once(modal_path, old_promo, new_promo)

# Focused component regression test.
Path("src/components/Dashboard_Manager/Table/TableActionsLiteModal.test.jsx").write_text(
    r'''import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  promotions: vi.fn(),
  notify: vi.fn(),
  clearDraft: vi.fn(),
}));

vi.mock("@/hooks/usePromotions", () => ({
  usePromotions: (...args) => mocks.promotions(...args),
}));
vi.mock("@/hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.notify }),
}));
vi.mock("@/hooks/useModalDraft", () => ({
  default: () => ({
    requestCloseWithDraft: (close) => close(),
    clearDraft: mocks.clearDraft,
    didRestore: false,
  }),
}));
vi.mock("@/hooks/useModalClosePipeline", () => ({
  default: ({ onClose }) => ({
    requestClose: onClose,
    onBackdropMouseDown: vi.fn(),
  }),
}));
vi.mock("@/utils/vrStorage", () => ({
  loadTableVrImage: () => "",
  removeTableVrImage: vi.fn(),
  storeTableVrImage: vi.fn(),
}));
vi.mock("@/lib/authStorage", () => ({ getToken: () => "access-token" }));
vi.mock("@/lib/apiBaseUrl", () => ({
  toApiUrl: (path) => `http://api.test/api${path}`,
}));
vi.mock("@/components/Dashboard_Manager/Table/TableCameraPlacementPreviewModal", () => ({
  default: () => null,
}));

import TableActionsLiteModal from "./TableActionsLiteModal";

const restaurantId = "507f1f77bcf86cd799439011";
const table = {
  id: "table-a1",
  code: "A1",
  capacity: 4,
  type: "standard",
  status: "available",
  floorId: "floor-1",
  floorLevel: 1,
  position: { x: 80, y: 80 },
  promotionIds: [],
  bookingPerks: [],
};

const renderModal = () =>
  render(
    <TableActionsLiteModal
      open
      table={table}
      restaurantId={restaurantId}
      floors={[{ id: "floor-1", level: 1, name: "Tầng 1" }]}
      tables={[
        table,
        {
          id: "table-a2",
          code: "A2",
          capacity: 4,
          status: "available",
          floorId: "floor-1",
          position: { x: 120, y: 80 },
        },
        {
          id: "table-a3",
          code: "A3",
          capacity: 4,
          status: "occupied",
          floorId: "floor-1",
        },
        {
          id: "table-b1",
          code: "B1",
          capacity: 4,
          status: "available",
          floorId: "floor-2",
        },
      ]}
      actions={{
        updateTable: vi.fn(),
        setTableStatus: vi.fn(),
        moveTable: vi.fn(),
        swapTableCodes: vi.fn(),
        mergeTables: vi.fn(),
        splitTables: vi.fn(),
        deleteTable: vi.fn(),
        fetchTableByCode: vi.fn(),
        getIdFromLevel: vi.fn(),
      }}
      onUpdated={vi.fn()}
      onClose={vi.fn()}
    />,
  );

describe("TableActionsLiteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.promotions.mockReturnValue({
      allPromotions: [
        { id: "promo-1", name: "Giảm 10%", code: "GIAM10", level: 1, usageCount: 2 },
      ],
      loading: false,
      error: null,
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ suggestion: "Nên ghép với bàn A2." }),
    });
  });

  it("hides internal coordinates and requests scoped, authenticated suggestions", async () => {
    renderModal();

    expect(mocks.promotions).toHaveBeenCalledWith({
      restaurantId,
      activeOnly: true,
      showErrorBanner: false,
    });
    expect(screen.queryByLabelText("Vị trí X")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Vị trí Y")).not.toBeInTheDocument();
    expect(screen.queryByText(/swap code/i)).not.toBeInTheDocument();
    expect(screen.getByText("Khuyến mãi đang hiệu lực")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Gợi ý bàn nên ghép" }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(url).toBe("http://api.test/api/ai/table/merge-suggestion");
    expect(options.credentials).toBe("include");
    expect(options.headers.Authorization).toBe("Bearer access-token");

    const payload = JSON.parse(options.body);
    expect(payload.restaurantId).toBe(restaurantId);
    expect(payload.promotions).toEqual([
      expect.objectContaining({ id: "promo-1", code: "GIAM10" }),
    ]);
    expect(payload.tables.map((item) => item.code)).toEqual(["A2"]);
    expect(await screen.findByText("Nên ghép với bàn A2.")).toBeInTheDocument();
  });
});
''',
    encoding="utf-8",
)

# Existing API test now proves the authorized success path as well.
backend_test = "cohan-restaurant-backend/tests/server/ai-table-endpoints-auth.test.js"
replace_once(
    backend_test,
    """describe('AI table endpoints auth guard', () => {
  beforeEach(() => vi.resetAllMocks());""",
    """describe('AI table endpoints auth guard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.GEMINI_API_KEY;
  });""",
)
replace_once(
    backend_test,
    """  it('rejects forbidden restaurant with 403', async () => {
    const app = await createServer();
    authResolverMock.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: 'u1' });
    authzMock.requireRestaurantPermission.mockRejectedValue(new Error('forbidden'));
    const res = await app.inject({ method: 'POST', url: '/api/ai/table/turnover-prediction', payload: { restaurantId: '507f1f77bcf86cd799439011' } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});""",
    """  it('rejects forbidden restaurant with 403', async () => {
    const app = await createServer();
    authResolverMock.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: 'u1' });
    authzMock.requireRestaurantPermission.mockRejectedValue(new Error('forbidden'));
    const res = await app.inject({ method: 'POST', url: '/api/ai/table/turnover-prediction', payload: { restaurantId: '507f1f77bcf86cd799439011' } });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('returns a suggestion for an authorized restaurant', async () => {
    const app = await createServer();
    authResolverMock.resolveAuthenticatedUserFromRequest.mockResolvedValue({ id: 'u1' });
    authzMock.requireRestaurantPermission.mockResolvedValue(true);

    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/table/merge-suggestion',
      payload: {
        restaurantId: '507f1f77bcf86cd799439011',
        table: { id: 'a1', code: 'A1', capacity: 4, position: { x: 0, y: 0 } },
        tables: [{ id: 'a2', code: 'A2', position: { x: 10, y: 0 } }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({ ok: true }));
    expect(res.json().suggestion).toContain('A2');
    expect(authzMock.requireRestaurantPermission).toHaveBeenCalled();
    await app.close();
  });
});""",
)
