// src/components/Dashboard_Manager/Storage/components/recipes/RecipeDetailModal.jsx
import React, { useMemo } from "react";
import Modal from "../../../../common/Modal";
import Card from "../../../../common/Card";
import { formatPrice } from "../../../../../utils/formatters";
import "./RecipeDetailModal.scss";

/**
 * RecipeDetailModal
 * - NEW model: servingVariants[].ingredients[] { ingredientId, qty, unit, wastePct }
 * - Backward compatible: components / Ingredients
 * - UI: đẹp + rõ ràng: header summary + variant cards + ingredient table + cost summary
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
    if (Array.isArray(variant.ingredients)) return variant.ingredients; // new
    if (Array.isArray(variant.components)) return variant.components; // legacy alias
    if (Array.isArray(variant.Ingredients)) return variant.Ingredients; // legacy
    return [];
  };

  const getVariantTitle = (v, idx) =>
    String(v?.name || v?.key || `Biến thể #${idx + 1}`).trim();

  const getModeLabel = (v) =>
    v?.mode === "BY_WEIGHT" ? "Theo trọng lượng" : "Theo phần";

  const getSellLabel = (v) => {
    const mode = v?.mode;
    const sellQty = safeNum(v?.sellQty) || 1;
    const sellUnit = v?.sellUnit || (mode === "BY_WEIGHT" ? "kg" : "portion");
    if (mode === "BY_WEIGHT") return `${formatQty(sellQty)} ${sellUnit}`;
    return "1 portion";
  };

  const getPriceLabel = (v) => {
    const mode = v?.mode;
    const price = safeNum(v?.price);
    if (mode === "BY_WEIGHT") {
      const sellQty = safeNum(v?.sellQty) || 1;
      const sellUnit = v?.sellUnit || "kg";
      const perUnit = sellQty > 0 ? price / sellQty : price;
      return {
        main: `${formatPrice(price)} / ${formatQty(sellQty)} ${sellUnit}`,
        sub: `${formatPrice(perUnit)} / ${sellUnit}`,
      };
    }
    return { main: `${formatPrice(price)} / phần`, sub: "" };
  };

  // cost per line (có tính hao hụt)
  const calcLineCost = (line) => {
    const qty = safeNum(line?.qty ?? line?.quantify ?? line?.quantity);
    const wastePct = safeNum(line?.wastePct);
    const unitCost = safeNum(line?.costPerBaseUnit ?? line?.unitCost);

    if (!(qty > 0) || !(unitCost > 0)) return 0;

    // ✅ tính hao hụt như phần thêm vào (qty * (1 + waste%))
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

    const costRows = variants.map((v, idx) => {
      const cost = calcVariantCost(v);
      return { key: v?.key || String(idx), idx, cost, v };
    });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants]);

  if (!canRender) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`🍽️ ${recipe?.name || ""}`}
      size="xl"
    >
      <div className="recipeDetail">
        {/* ===== Header summary ===== */}
        <Card className="recipeDetail__header">
          <div className="recipeDetail__titleRow">
            <div className="recipeDetail__titleBlock">
              <div className="recipeDetail__name">{recipe?.name || "—"}</div>
              {recipe?.description ? (
                <div className="recipeDetail__desc">{recipe.description}</div>
              ) : (
                <div className="recipeDetail__desc recipeDetail__desc--muted">
                  Không có mô tả
                </div>
              )}
            </div>

            <div className="recipeDetail__badges">
              <span className="pill pill--soft">
                {summary.totalVariants} biến thể
              </span>
              <span className="pill pill--soft">
                {summary.totalIngredients} nguyên liệu
              </span>
              {summary.defaultVariant ? (
                <span className="pill pill--ok" title="Biến thể mặc định">
                  ⭐ {getVariantTitle(summary.defaultVariant, 0)}
                </span>
              ) : null}
            </div>
          </div>

          {recipe?.notes ? (
            <div className="recipeDetail__notes">
              <div className="recipeDetail__notesLabel">Ghi chú</div>
              <div className="recipeDetail__notesText">{recipe.notes}</div>
            </div>
          ) : null}
        </Card>

        {/* ===== Variants ===== */}
        <div className="recipeDetail__section">
          <div className="recipeDetail__sectionTitle">
            👨‍🍳 Biến thể bán / chế biến
          </div>

          {variants.length ? (
            <div className="recipeDetail__variants">
              {variants.map((v, idx) => {
                const lines = getLines(v);
                const variantCost = calcVariantCost(v);
                const priceInfo = getPriceLabel(v);

                return (
                  <Card key={v?.key || idx} className="variantCard">
                    <div className="variantCard__head">
                      <div className="variantCard__left">
                        <div className="variantCard__nameRow">
                          <div className="variantCard__name">
                            {getVariantTitle(v, idx)}
                          </div>

                          {v?.isDefault ? (
                            <span className="pill pill--ok" title="Mặc định">
                              mặc định
                            </span>
                          ) : null}
                        </div>

                        <div className="variantCard__meta">
                          <span className="chip">{getModeLabel(v)}</span>

                          <span className="chip" title="Đơn vị bán">
                            Bán: {getSellLabel(v)}
                          </span>

                          {Number.isFinite(Number(v?.price)) ? (
                            <span className="chip" title="Giá bán">
                              Giá: {priceInfo.main}
                              {priceInfo.sub ? (
                                <span className="chip__sub">
                                  (Hiển thị: {priceInfo.sub})
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="variantCard__right">
                        <div className="variantCard__costLabel">
                          Chi phí nguyên liệu
                        </div>
                        <div className="variantCard__costValue">
                          {variantCost > 0 ? formatPrice(variantCost) : "—"}
                        </div>
                        <div className="variantCard__costHint">
                          (đã tính hao hụt)
                        </div>
                      </div>
                    </div>

                    <div className="variantCard__body">
                      <div className="variantCard__subTitle">
                        Nguyên liệu ({lines.length})
                      </div>

                      {lines.length ? (
                        <div className="ingTable">
                          <div className="ingTable__head">
                            <div>Nguyên liệu</div>
                            <div className="right">Số lượng</div>
                            <div className="right">Hao hụt</div>
                            <div className="right">Đơn giá</div>
                            <div className="right">Thành tiền</div>
                          </div>

                          <div className="ingTable__body">
                            {lines.map((c, i) => {
                              const qty = safeNum(
                                c?.qty ?? c?.quantify ?? c?.quantity
                              );
                              const unit = c?.unit || c?.baseUnit || "";
                              const wastePct = safeNum(c?.wastePct);
                              const unitCost = safeNum(
                                c?.costPerBaseUnit ?? c?.unitCost
                              );
                              const itemCost = calcLineCost(c);

                              const name =
                                c?.name ||
                                c?.ingredientName ||
                                (c?.ingredientId
                                  ? `#${String(c.ingredientId).slice(-6)}`
                                  : "Nguyên liệu");

                              return (
                                <div
                                  key={`${c?.ingredientId || i}-${i}`}
                                  className="ingRow"
                                >
                                  <div className="ingRow__name" title={name}>
                                    {name}
                                  </div>

                                  <div className="ingRow__cell right">
                                    {qty > 0
                                      ? `${formatQty(qty)} ${unit}`
                                      : "—"}
                                  </div>

                                  <div className="ingRow__cell right">
                                    {wastePct > 0
                                      ? `${formatPct(wastePct)}%`
                                      : "—"}
                                  </div>

                                  <div className="ingRow__cell right">
                                    {unitCost > 0 ? formatPrice(unitCost) : "—"}
                                  </div>

                                  <div className="ingRow__cell right strong">
                                    {itemCost > 0 ? formatPrice(itemCost) : "—"}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="variantCard__empty">
                          Chưa có nguyên liệu cho biến thể này.
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="variantCard variantCard--empty">
              Chưa cấu hình biến thể.
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
