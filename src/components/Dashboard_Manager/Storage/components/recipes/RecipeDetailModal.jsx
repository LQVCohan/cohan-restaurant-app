// src/components/Dashboard_Manager/Storage/components/recipes/RecipeDetailModal.jsx
import React, { useMemo } from "react";
import Modal from "../../../../common/Modal";
import Card from "../../../../common/Card";
import { formatPrice } from "../../../../../utils/formatters";
import "./RecipeDetailModal.scss";

/**
 * RecipeDetailModal
 * Hiển thị chi tiết công thức, các biến thể định lượng và tổng hợp chi phí
 */
const RecipeDetailModal = ({ isOpen, onClose, recipe }) => {
  const canRender = Boolean(isOpen && recipe);

  const formatQty = (val) =>
    (Number(val) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

  const formatPct = (val) =>
    (Number(val) || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 });

  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const variants = useMemo(() => {
    const v = recipe?.servingVariants;
    return Array.isArray(v) ? v : [];
  }, [recipe]);

  const getLines = (variant) => {
    if (!variant) return [];
    if (Array.isArray(variant.ingredients)) return variant.ingredients;
    if (Array.isArray(variant.components)) return variant.components;
    if (Array.isArray(variant.Ingredients)) return variant.Ingredients;
    return [];
  };

  const getVariantTitle = (v, idx) =>
    String(v?.name || v?.key || `Biến thể #${idx + 1}`).trim();

  const calcLineCost = (line) => {
    const qty = safeNum(line?.qty ?? line?.quantify ?? line?.quantity);
    const wastePct = safeNum(line?.wastePct);
    const unitCost = safeNum(line?.costPerBaseUnit ?? line?.unitCost);
    if (!(qty > 0) || !(unitCost > 0)) return 0;
    // Công thức tính: (số lượng * (1 + hao hụt %)) * đơn giá
    const effectiveQty = qty * (1 + wastePct / 100);
    return effectiveQty * unitCost;
  };

  const calcVariantCost = (variant) =>
    getLines(variant).reduce((sum, c) => sum + calcLineCost(c), 0);

  const summary = useMemo(() => {
    const allLines = variants.flatMap((v) => getLines(v));
    const ingredientIdSet = new Set();

    allLines.forEach((l) => {
      if (l?.ingredientId) ingredientIdSet.add(String(l.ingredientId));
    });

    const defaultVariant =
      variants.find((v) => v?.isDefault) || variants[0] || null;

    const costRows = variants.map((v, idx) => ({
      key: v?.key || String(idx),
      idx,
      cost: calcVariantCost(v),
      v,
    }));

    const costs = costRows
      .map((r) => r.cost)
      .filter((n) => Number.isFinite(n) && n > 0);
    const minCost = costs.length ? Math.min(...costs) : 0;

    return {
      totalVariants: variants.length,
      totalIngredients: ingredientIdSet.size,
      defaultVariant,
      costRows,
      minCost,
    };
  }, [variants]);

  if (!canRender) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🍽️ ${recipe?.name || "Chi tiết công thức"}`}
      size="xl"
    >
      <div className="recipeDetail">
        {/* ===== Header summary ===== */}
        <Card className="recipeDetail__header">
          <div className="recipeDetail__name">{recipe?.name || "—"}</div>
          {recipe?.description ? (
            <div className="recipeDetail__desc">{recipe.description}</div>
          ) : (
            <div className="recipeDetail__desc" style={{ color: "#94a3b8" }}>
              Không có ghi chú cách chế biến.
            </div>
          )}
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span className="pill pill--soft">
              Biến thể: {summary.totalVariants}
            </span>
            <span className="pill pill--soft">
              Loại nguyên liệu: {summary.totalIngredients}
            </span>
          </div>
        </Card>

        {/* ===== Variants List ===== */}
        <div className="variantList">
          {variants.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {variants.map((variant, idx) => {
                const lines = getLines(variant);
                return (
                  <Card key={idx} className="variantCard">
                    <div className="variantCard__header">
                      <div className="variantCard__title">
                        {getVariantTitle(variant, idx)}
                      </div>
                      {variant.isDefault && (
                        <span className="pill pill--ok">Mặc định</span>
                      )}
                    </div>

                    <div className="variantCard__content">
                      {/* Bảng nguyên liệu: Grid Header */}
                      <div className="ingRow ingRow--header">
                        <div className="ingRow__cell">Tên nguyên liệu</div>
                        <div className="ingRow__cell right">Số lượng</div>
                        <div className="ingRow__cell right">Hao hụt</div>
                        <div className="ingRow__cell right">Đơn giá</div>
                        <div className="ingRow__cell right">Thành tiền</div>
                      </div>

                      {/* Danh sách nguyên liệu */}
                      {lines.length > 0 ? (
                        lines.map((line, lIdx) => (
                          <div key={lIdx} className="ingRow">
                            <div className="ingRow__cell strong">
                              {line.ingredientName ||
                                line.ingredient?.name ||
                                "Nguyên liệu ẩn"}
                            </div>
                            <div className="ingRow__cell right">
                              {formatQty(line.qty)} {line.unit}
                            </div>
                            <div
                              className="ingRow__cell right"
                              style={{
                                color:
                                  line.wastePct > 0 ? "#ef4444" : "inherit",
                              }}
                            >
                              {formatPct(line.wastePct)}%
                            </div>
                            <div className="ingRow__cell right">
                              {formatPrice(
                                line.basePrice || line.costPerBaseUnit,
                              )}
                            </div>
                            <div className="ingRow__cell right strong">
                              {formatPrice(calcLineCost(line))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            color: "#94a3b8",
                            fontSize: "13px",
                          }}
                        >
                          Biến thể này chưa có nguyên liệu nào
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="variantCard variantCard--empty">
              Chưa cấu hình biến thể nào cho công thức này.
            </Card>
          )}
        </div>

        {/* ===== Cost summary ===== */}
        <Card className="costSummary">
          <div className="costSummary__title">💰 Tổng kết chi phí</div>
          <div className="costSummary__grid">
            {summary.costRows.map((row) => (
              <div key={row.key} className="costSummary__row">
                <div className="costSummary__rowName">
                  {getVariantTitle(row.v, row.idx)}
                </div>
                <div className="costSummary__rowValue">
                  {row.cost > 0 ? formatPrice(row.cost) : "—"}
                </div>
              </div>
            ))}
          </div>
          <div className="costSummary__footer">
            <div className="costSummary__min">
              Chi phí thấp nhất:{" "}
              <strong>
                {summary.minCost > 0 ? formatPrice(summary.minCost) : "—"}
              </strong>
            </div>
            <div className="costSummary__note">
              Gợi ý: chi phí đã tính hao hụt theo từng dòng nguyên liệu.
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default RecipeDetailModal;
