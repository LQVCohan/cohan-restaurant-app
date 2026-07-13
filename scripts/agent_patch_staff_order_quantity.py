from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    file_path = ROOT / path
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:100]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


menu_path = "src/components/Staff/components/MenuOrdering.jsx"

replace_once(
    menu_path,
    """  Plus,\n  Crown,\n  ChevronRight,\n  Camera,\n} from \"lucide-react\";""",
    """  Plus,\n  Minus,\n  Scale,\n  Crown,\n  ChevronRight,\n  Camera,\n} from \"lucide-react\";""",
)

replace_once(
    menu_path,
    """import {\n  normalizeProofImages,\n  requiresProofImage,\n} from \"@/utils/orderProofRules\";\nimport \"./MenuOrdering.scss\";""",
    """import {\n  normalizeProofImages,\n  requiresProofImage,\n} from \"@/utils/orderProofRules\";\nimport {\n  getStaffOrderSelectionTotal,\n  isWeightServingVariant,\n  parsePortionQuantity,\n  parseWeightKg,\n  weightKgToGrams,\n} from \"@/utils/staffOrderQuantity\";\nimport \"./MenuOrdering.scss\";""",
)

replace_once(
    menu_path,
    """  const [serveOrder, setServeOrder] = useState(\"Mang ra cùng lúc\");\n  const [selectedVariantKey, setSelectedVariantKey] = useState(\"\");\n  const [draftProofImages, setDraftProofImages] = useState([]);""",
    """  const [serveOrder, setServeOrder] = useState(\"Mang ra cùng lúc\");\n  const [selectedVariantKey, setSelectedVariantKey] = useState(\"\");\n  const [portionQuantityInput, setPortionQuantityInput] = useState(\"1\");\n  const [weightKgInput, setWeightKgInput] = useState(\"1\");\n  const [draftProofImages, setDraftProofImages] = useState([]);""",
)

replace_once(
    menu_path,
    """  const selectedVariant = useMemo(() => {\n    return (\n      selectedVariants.find((variant) => getVariantKey(variant) === selectedVariantKey) ||\n      selectedItem?.defaultVariant ||\n      selectedVariants[0] ||\n      null\n    );\n  }, [selectedItem, selectedVariantKey, selectedVariants]);\n\n  const draftProofTarget = useMemo(() => {\n    if (!selectedItem) return null;\n    return {\n      ...selectedItem,\n      servingVariant: selectedVariant,\n      proofImages: draftProofImages,\n    };\n  }, [draftProofImages, selectedItem, selectedVariant]);""",
    """  const selectedVariant = useMemo(() => {\n    return (\n      selectedVariants.find((variant) => getVariantKey(variant) === selectedVariantKey) ||\n      selectedItem?.defaultVariant ||\n      selectedVariants[0] ||\n      null\n    );\n  }, [selectedItem, selectedVariantKey, selectedVariants]);\n\n  const isWeightVariant = isWeightServingVariant(selectedVariant);\n  const selectedUnitPrice = Number(\n    selectedVariant?.price ?? selectedItem?.price ?? 0,\n  );\n  const portionQuantity = parsePortionQuantity(portionQuantityInput);\n  const weightKg = parseWeightKg(weightKgInput);\n  const quantityIsValid = isWeightVariant\n    ? weightKg != null\n    : portionQuantity != null;\n  const selectionTotal = getStaffOrderSelectionTotal({\n    price: selectedUnitPrice,\n    variant: selectedVariant,\n    portionQuantity: portionQuantityInput,\n    weightKg: weightKgInput,\n  });\n  const quantityStepNumber = selectedVariants.length > 1 ? 2 : 1;\n  const serveOrderStepNumber = quantityStepNumber + 1;\n  const proofStepNumber = serveOrderStepNumber + 1;\n  const selectedUnitLabel = isWeightVariant\n    ? String(selectedVariant?.sellUnit || \"kg\").toLowerCase()\n    : \"phần\";\n\n  const draftProofTarget = useMemo(() => {\n    if (!selectedItem) return null;\n    return {\n      ...selectedItem,\n      quantity: isWeightVariant ? 1 : portionQuantity || 1,\n      weightGrams: isWeightVariant ? weightKgToGrams(weightKgInput) : null,\n      servingVariant: selectedVariant,\n      proofImages: draftProofImages,\n    };\n  }, [\n    draftProofImages,\n    isWeightVariant,\n    portionQuantity,\n    selectedItem,\n    selectedVariant,\n    weightKgInput,\n  ]);""",
)

replace_once(
    menu_path,
    """    setSelectedVariantKey(\"\");\n    setPrepChoice(\"\");\n    setServeOrder(\"Mang ra cùng lúc\");\n    setDraftProofImages([]);""",
    """    setSelectedVariantKey(\"\");\n    setPrepChoice(\"\");\n    setServeOrder(\"Mang ra cùng lúc\");\n    setPortionQuantityInput(\"1\");\n    setWeightKgInput(\"1\");\n    setDraftProofImages([]);""",
)

replace_once(
    menu_path,
    """    setSelectedVariantKey(getVariantKey(defaultVariant));\n    setPrepChoice(\"\");\n    setServeOrder(\"Mang ra cùng lúc\");\n    setDraftProofImages([]);""",
    """    setSelectedVariantKey(getVariantKey(defaultVariant));\n    setPrepChoice(\"\");\n    setServeOrder(\"Mang ra cùng lúc\");\n    setPortionQuantityInput(\"1\");\n    setWeightKgInput(\"1\");\n    setDraftProofImages([]);""",
)

replace_once(
    menu_path,
    """  const handleConfirmAdd = () => {\n    if (!permissions.canAddItems) {""",
    """  const adjustSelectionAmount = (direction) => {\n    setActionError(\"\");\n\n    if (isWeightVariant) {\n      const current = parseWeightKg(weightKgInput) ?? 0;\n      const next = Math.min(\n        100,\n        Math.max(0.1, Math.round((current + direction * 0.1) * 1000) / 1000),\n      );\n      setWeightKgInput(String(next));\n      return;\n    }\n\n    const current = parsePortionQuantity(portionQuantityInput) ?? 1;\n    const next = Math.min(99, Math.max(1, current + direction));\n    setPortionQuantityInput(String(next));\n  };\n\n  const handleConfirmAdd = () => {\n    if (!permissions.canAddItems) {""",
)

replace_once(
    menu_path,
    """    if (selectedVariants.length > 1 && !selectedVariant) {\n      setActionError(\"Vui lòng chọn biến thể món.\");\n      return;\n    }\n\n    setActionError(\"\");\n\n    onAdd(selectedItem, {\n      variant: selectedVariant,\n      prep: prepChoice || \"Mặc định\",\n      serveOrder,\n      proofImages: draftProofImages,\n    });""",
    """    if (selectedVariants.length > 1 && !selectedVariant) {\n      setActionError(\"Vui lòng chọn biến thể món.\");\n      return;\n    }\n\n    if (!quantityIsValid) {\n      setActionError(\n        isWeightVariant\n          ? \"Khối lượng phải lớn hơn 0 và không vượt quá 100 kg. Có thể nhập số thập phân như 0,5 hoặc 1,25.\"\n          : \"Số phần phải là số nguyên từ 1 đến 99.\",\n      );\n      return;\n    }\n\n    setActionError(\"\");\n\n    onAdd(selectedItem, {\n      variant: selectedVariant,\n      quantity: isWeightVariant ? 1 : portionQuantity,\n      weightGrams: isWeightVariant ? weightKgToGrams(weightKgInput) : null,\n      prep: prepChoice || \"Mặc định\",\n      serveOrder,\n      proofImages: draftProofImages,\n    });""",
)

replace_once(
    menu_path,
    """                <p className=\"price-text\">\n                  {selectedItem.price.toLocaleString()}đ\n                </p>""",
    """                <p className=\"price-text\">\n                  {selectedUnitPrice.toLocaleString(\"vi-VN\")}đ/{selectedUnitLabel}\n                </p>""",
)

replace_once(
    menu_path,
    """                          onClick={() => setSelectedVariantKey(variantKey)}""",
    """                          onClick={() => {\n                            setSelectedVariantKey(variantKey);\n                            setActionError(\"\");\n                          }}""",
)

replace_once(
    menu_path,
    """              )}\n              <div className=\"option-group\">\n                <label className=\"group-label\">2. Thứ tự lên món</label>""",
    """              )}\n\n              <div className=\"option-group\">\n                <label className=\"group-label\">\n                  {quantityStepNumber}. {isWeightVariant ? \"Khối lượng gọi món\" : \"Số phần\"}\n                </label>\n                <div className={`quantity-editor-card ${isWeightVariant ? \"is-weight\" : \"is-portion\"}`}>\n                  <div className=\"quantity-editor-card__top\">\n                    <span className=\"quantity-editor-card__icon\" aria-hidden=\"true\">\n                      <Scale size={18} />\n                    </span>\n                    <div>\n                      <strong>\n                        {isWeightVariant ? \"Nhập số kilogram\" : \"Nhập số phần nguyên\"}\n                      </strong>\n                      <p>\n                        {isWeightVariant\n                          ? \"Có thể nhập số thập phân, ví dụ 0,5 kg hoặc 1,25 kg.\"\n                          : \"Chỉ nhận số nguyên từ 1 đến 99 phần.\"}\n                      </p>\n                    </div>\n                  </div>\n\n                  <div className=\"quantity-stepper\">\n                    <button\n                      type=\"button\"\n                      className=\"quantity-stepper__button\"\n                      onClick={() => adjustSelectionAmount(-1)}\n                      aria-label={isWeightVariant ? \"Giảm 0,1 kilogram\" : \"Giảm một phần\"}\n                    >\n                      <Minus size={18} />\n                    </button>\n                    <label className=\"quantity-stepper__field\">\n                      <input\n                        type=\"text\"\n                        inputMode={isWeightVariant ? \"decimal\" : \"numeric\"}\n                        aria-label={isWeightVariant ? \"Khối lượng kilogram\" : \"Số phần\"}\n                        value={isWeightVariant ? weightKgInput : portionQuantityInput}\n                        onChange={(event) => {\n                          const next = event.target.value;\n                          setActionError(\"\");\n                          if (isWeightVariant) {\n                            if (/^\\d{0,3}(?:[.,]\\d{0,3})?$/.test(next)) {\n                              setWeightKgInput(next);\n                            }\n                            return;\n                          }\n                          setPortionQuantityInput(next.replace(/\\D/g, \"\").slice(0, 2));\n                        }}\n                      />\n                      <span className=\"quantity-stepper__suffix\">\n                        {isWeightVariant ? \"kg\" : \"phần\"}\n                      </span>\n                    </label>\n                    <button\n                      type=\"button\"\n                      className=\"quantity-stepper__button\"\n                      onClick={() => adjustSelectionAmount(1)}\n                      aria-label={isWeightVariant ? \"Tăng 0,1 kilogram\" : \"Tăng một phần\"}\n                    >\n                      <Plus size={18} />\n                    </button>\n                  </div>\n\n                  <div className=\"quantity-editor-card__meta\">\n                    <span>\n                      {isWeightVariant && weightKg != null\n                        ? `${Math.round(weightKg * 1000).toLocaleString(\"vi-VN\")} g`\n                        : isWeightVariant\n                          ? \"Chưa nhập khối lượng hợp lệ\"\n                          : portionQuantity != null\n                            ? `${portionQuantity} phần`\n                            : \"Chưa nhập số phần hợp lệ\"}\n                    </span>\n                    <span className=\"quantity-editor-card__total\">\n                      Tạm tính <strong>{selectionTotal.toLocaleString(\"vi-VN\")}đ</strong>\n                    </span>\n                  </div>\n                </div>\n              </div>\n\n              <div className=\"option-group\">\n                <label className=\"group-label\">{serveOrderStepNumber}. Thứ tự lên món</label>""",
)

replace_once(
    menu_path,
    """                  <label className=\"group-label\">3. Ảnh minh chứng</label>""",
    """                  <label className=\"group-label\">{proofStepNumber}. Ảnh minh chứng</label>""",
)

replace_once(
    menu_path,
    """                </button>\n              </div>\n            </div>\n\n            <div className=\"sheet-footer\">\n              <button type=\"button\" className=\"btn-confirm-add\" onClick={handleConfirmAdd}>\n                Thêm vào đơn\n              </button>""",
    """                </button>\n              </div>\n\n              {actionError && (\n                <div className=\"item-options-error\" role=\"alert\">\n                  {actionError}\n                </div>\n              )}\n            </div>\n\n            <div className=\"sheet-footer\">\n              <button\n                type=\"button\"\n                className=\"btn-confirm-add\"\n                onClick={handleConfirmAdd}\n                disabled={!quantityIsValid}\n              >\n                {quantityIsValid\n                  ? `Thêm vào đơn • ${selectionTotal.toLocaleString(\"vi-VN\")}đ`\n                  : \"Nhập số lượng hợp lệ\"}\n              </button>""",
)

staff_path = "src/components/Staff/StaffOrdering.jsx"

replace_once(
    staff_path,
    """import {\n  buildProofState,\n  normalizeProofImages,\n  requiresProofImage,\n} from \"@/utils/orderProofRules\";\nconst STAFF_ORDER_NO_PERMISSION_MESSAGE =""",
    """import {\n  buildProofState,\n  normalizeProofImages,\n  requiresProofImage,\n} from \"@/utils/orderProofRules\";\nimport {\n  isWeightServingVariant,\n  parsePortionQuantity,\n} from \"@/utils/staffOrderQuantity\";\nconst STAFF_ORDER_NO_PERMISSION_MESSAGE =""",
)

replace_once(
    staff_path,
    """    const selectedVariant =\n      addOptions.variant ||\n      item.defaultVariant ||\n      item.servingVariants?.find((v) => v?.key === item.servingKey) ||\n      item.servingVariants?.[0] ||\n      null;\n\n    const targetTableId =""",
    """    const selectedVariant =\n      addOptions.variant ||\n      item.defaultVariant ||\n      item.servingVariants?.find((v) => v?.key === item.servingKey) ||\n      item.servingVariants?.[0] ||\n      null;\n    const isWeightVariant = isWeightServingVariant(selectedVariant);\n    const requestedPortionQuantity = parsePortionQuantity(\n      addOptions.quantity ?? \"1\",\n    );\n    const requestedWeightGrams = isWeightVariant\n      ? Number(addOptions.weightGrams)\n      : null;\n\n    if (!isWeightVariant && requestedPortionQuantity == null) {\n      alert(\"Số phần phải là số nguyên từ 1 đến 99.\");\n      return;\n    }\n    if (\n      isWeightVariant &&\n      (!Number.isFinite(requestedWeightGrams) || requestedWeightGrams <= 0)\n    ) {\n      alert(\"Vui lòng nhập khối lượng kilogram hợp lệ trước khi thêm món.\");\n      return;\n    }\n\n    const targetTableId =""",
)

replace_once(
    staff_path,
    """    const nextPriority = mapItemPriorityFromServeOrder(serveOrder);\n    const signature = `${item.id}__${selectedVariant?.key || item.servingKey || \"portion\"}__${prep || \"\"}__${serveOrder || \"\"}`;\n    const hasDraftProofImages = proofImages.length > 0;\n\n    setCartByTable((prevMap) => {\n      const prev = prevMap[targetTableId] || [];\n      const idx = hasDraftProofImages ? -1 : prev.findIndex(""",
    """    const nextPriority = mapItemPriorityFromServeOrder(serveOrder);\n    const signature = `${item.id}__${selectedVariant?.key || item.servingKey || \"portion\"}__${prep || \"\"}__${serveOrder || \"\"}${isWeightVariant ? `__${requestedWeightGrams}g` : \"\"}`;\n    const hasDraftProofImages = proofImages.length > 0;\n    const keepSeparateLine = hasDraftProofImages || isWeightVariant;\n\n    setCartByTable((prevMap) => {\n      const prev = prevMap[targetTableId] || [];\n      const idx = keepSeparateLine ? -1 : prev.findIndex(""",
)

replace_once(
    staff_path,
    """                    quantity: Number(x.quantity || 1) + 1,""",
    """                    quantity:\n                      Number(x.quantity || 1) + (requestedPortionQuantity || 1),""",
)

replace_once(
    staff_path,
    """              const unit =\n                defaultVariant?.mode === \"BY_WEIGHT\"\n                  ? defaultVariant?.sellUnit || \"kg\"\n                  : defaultVariant?.sellUnit || \"portion\";""",
    """              const unit = isWeightVariant\n                ? defaultVariant?.sellUnit || \"kg\"\n                : defaultVariant?.sellUnit || \"portion\";""",
)

replace_once(
    staff_path,
    """                weightGrams: null,\n                name: item.name,""",
    """                weightGrams: requestedWeightGrams,\n                name: item.name,""",
)

replace_once(
    staff_path,
    """                quantity: 1,\n\n                status: \"pending\",""",
    """                quantity: isWeightVariant\n                  ? 1\n                  : requestedPortionQuantity || 1,\n\n                status: \"pending\",""",
)

scss_path = ROOT / "src/components/Staff/components/MenuOrdering.scss"
scss = scss_path.read_text(encoding="utf-8")
marker = "// Staff quantity editor for portion and kilogram variants"
if marker not in scss:
    scss += """

// Staff quantity editor for portion and kilogram variants
.quantity-editor-card {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid #DDE6DF;
  border-radius: 16px;
  background: linear-gradient(180deg, #FFFFFF 0%, #F8FAF6 100%);
}

.quantity-editor-card.is-weight {
  border-color: rgba(31, 111, 74, 0.3);
  box-shadow: inset 0 0 0 1px rgba(31, 111, 74, 0.04);
}

.quantity-editor-card__top {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  strong {
    display: block;
    color: #1F2A24;
    font-size: 14px;
  }

  p {
    margin: 3px 0 0;
    color: #64746A;
    font-size: 12px;
    line-height: 1.45;
  }
}

.quantity-editor-card__icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  border-radius: 11px;
  background: rgba(31, 111, 74, 0.1);
  color: #1F6F4A;
}

.quantity-stepper {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  gap: 8px;
  align-items: stretch;
}

.quantity-stepper__button {
  display: grid;
  min-height: 48px;
  place-items: center;
  border: 1px solid rgba(31, 111, 74, 0.22);
  border-radius: 13px;
  background: #FFFFFF;
  color: #1F6F4A;
  cursor: pointer;

  &:active {
    transform: scale(0.96);
  }
}

.quantity-stepper__field {
  display: flex;
  min-width: 0;
  min-height: 48px;
  align-items: center;
  overflow: hidden;
  border: 1.5px solid #1F6F4A;
  border-radius: 13px;
  background: #FFFFFF;

  input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #1F2A24;
    font-size: 19px;
    font-weight: 800;
    text-align: center;
  }
}

.quantity-stepper__suffix {
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
  border-left: 1px solid #DDE6DF;
  background: #F4F7F3;
  color: #526158;
  font-size: 13px;
  font-weight: 800;
}

.quantity-editor-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #64746A;
  font-size: 12px;
}

.quantity-editor-card__total {
  white-space: nowrap;
  color: #526158;

  strong {
    color: #1F6F4A;
    font-size: 14px;
  }
}

.item-options-error {
  padding: 10px 12px;
  border: 1px solid #F5C2C7;
  border-radius: 12px;
  background: #FFF5F5;
  color: #B42318;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.45;
}

.item-options-overlay .btn-confirm-add:disabled {
  cursor: not-allowed;
  background: #AAB5AE;
  box-shadow: none;
  opacity: 0.82;
}

@media (max-width: 420px) {
  .quantity-editor-card__meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 5px;
  }

  .quantity-stepper {
    grid-template-columns: 42px minmax(0, 1fr) 42px;
  }

  .quantity-stepper__suffix {
    padding: 0 9px;
  }
}
"""
    scss_path.write_text(scss, encoding="utf-8")
