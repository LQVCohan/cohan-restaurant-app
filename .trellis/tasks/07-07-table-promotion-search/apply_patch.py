from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:160]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


modal_path = "src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx"

replace_once(
    modal_path,
    """const joinUniqueLabels = (values = [], separator = " · ") =>
  getUniqueDisplayLabels(values).join(separator);
""",
    """const joinUniqueLabels = (values = [], separator = " · ") =>
  getUniqueDisplayLabels(values).join(separator);

const normalizePromotionSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/\\s+/g, " ")
    .trim();
""",
)

replace_once(
    modal_path,
    '  const [selectedPromotions, setSelectedPromotions] = useState([]);\n',
    '  const [selectedPromotions, setSelectedPromotions] = useState([]);\n  const [promotionSearch, setPromotionSearch] = useState("");\n',
)

replace_once(
    modal_path,
    """  } = usePromotions({
    restaurantId,
    activeOnly: true,
    showErrorBanner: false,
  });
  const { showNotification } = useNotification();
""",
    """  } = usePromotions({
    restaurantId,
    activeOnly: true,
    showErrorBanner: false,
  });
  const filteredPromotions = useMemo(() => {
    const query = normalizePromotionSearch(promotionSearch);
    if (!query) return allPromotions || [];

    return (allPromotions || []).filter((promotion) =>
      normalizePromotionSearch(`${promotion?.name || ""} ${promotion?.code || ""}`).includes(query),
    );
  }, [allPromotions, promotionSearch]);
  const { showNotification } = useNotification();

  useEffect(() => {
    if (isOpen) setPromotionSearch("");
  }, [isOpen, table?.id]);
""",
)

old_promotion_block = """              <div className="talite-promo-box">
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

new_promotion_block = """              <div className="talite-promo-box">
                <div className="talite-label">Khuyến mãi đang hiệu lực</div>
                {promotionsLoading ? (
                  <div className="hint">Đang tải khuyến mãi…</div>
                ) : promotionsError ? (
                  <div className="hint">Không tải được khuyến mãi của chi nhánh này.</div>
                ) : allPromotions?.length ? (
                  <>
                    <div style={{ margin: "8px 0 10px" }}>
                      <label className="talite-label" htmlFor="talite-promotion-search">
                        Tìm khuyến mãi
                      </label>
                      <input
                        id="talite-promotion-search"
                        name="promotionSearch"
                        type="search"
                        autoComplete="off"
                        spellCheck={false}
                        className="talite-input"
                        value={promotionSearch}
                        onChange={(event) => setPromotionSearch(event.target.value)}
                        placeholder="Nhập tên hoặc mã khuyến mãi…"
                        aria-describedby="talite-promotion-search-summary"
                      />
                      <div id="talite-promotion-search-summary" className="hint" aria-live="polite">
                        {promotionSearch.trim()
                          ? `Tìm thấy ${filteredPromotions.length}/${allPromotions.length} khuyến mãi.`
                          : `${allPromotions.length} khuyến mãi đang hiệu lực.`}
                      </div>
                    </div>
                    {filteredPromotions.length ? (
                      <div className="talite-promo-list">
                        {filteredPromotions.map((promo) => (
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
                      <div className="hint">Không tìm thấy khuyến mãi phù hợp.</div>
                    )}
                  </>
                ) : (
                  <div className="hint">Chi nhánh chưa có khuyến mãi đang hiệu lực.</div>
                )}
              </div>"""

replace_once(modal_path, old_promotion_block, new_promotion_block)


test_path = "src/components/Dashboard_Manager/Table/TableActionsLiteModal.test.jsx"
test_file = Path(test_path)
test_text = test_file.read_text(encoding="utf-8")
closing = "  });\n});\n"
if not test_text.endswith(closing):
    raise SystemExit("Unexpected test file ending")

new_test = r'''

  it("filters active promotions by name or code without changing selections", () => {
    mocks.promotions.mockReturnValue({
      allPromotions: [
        { id: "promo-1", name: "Giảm 10%", code: "GIAM10" },
        { id: "promo-2", name: "Ưu đãi trưa Việt", code: "TRUAVIET" },
      ],
      loading: false,
      error: null,
    });

    renderModal();

    const discountCheckbox = screen.getByRole("checkbox", { name: "Giảm 10%" });
    fireEvent.click(discountCheckbox);
    expect(discountCheckbox).toBeChecked();

    const searchInput = screen.getByLabelText("Tìm khuyến mãi");
    fireEvent.change(searchInput, { target: { value: "uu dai" } });
    expect(screen.getByText("Ưu đãi trưa Việt")).toBeInTheDocument();
    expect(screen.queryByText("Giảm 10%")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "GIAM10" } });
    expect(screen.getByRole("checkbox", { name: "Giảm 10%" })).toBeChecked();

    fireEvent.change(searchInput, { target: { value: "không tồn tại" } });
    expect(screen.getByText("Không tìm thấy khuyến mãi phù hợp.")).toBeInTheDocument();
  });
'''

test_file.write_text(test_text[: -len(closing)] + "  });" + new_test + "\n});\n", encoding="utf-8")
