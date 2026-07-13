import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import { useLocation } from "react-router-dom";

import "./TableOrderDraftCategoryEnhancer.scss";

const TABLE_PATH_PATTERN = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;
const ALL_CATEGORIES = "all";

const CATEGORY_DATA = gql`
  query TableOrderDraftCategoryData($restaurantId: ID!) {
    breakfast: customerMenuCategories(
      restaurantId: $restaurantId
      timeSlot: breakfast
    ) {
      id
      name
      order
    }
    lunch: customerMenuCategories(
      restaurantId: $restaurantId
      timeSlot: lunch
    ) {
      id
      name
      order
    }
    dinner: customerMenuCategories(
      restaurantId: $restaurantId
      timeSlot: dinner
    ) {
      id
      name
      order
    }
    lateNight: customerMenuCategories(
      restaurantId: $restaurantId
      timeSlot: late_night
    ) {
      id
      name
      order
    }
    menuItemsConnection(
      filter: { restaurantId: $restaurantId, sort: default }
      limit: 100
    ) {
      edges {
        node {
          id
          categoryId
          name
          thumbImage
          status
        }
      }
    }
  }
`;

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("vi");

const cssUrl = (value) =>
  `url("${String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')}")`;

const getMenuRoot = () =>
  document.querySelector(
    ".table-order-draft-modal--v2 .table-order-draft--v2",
  );

export default function TableOrderDraftCategoryEnhancer() {
  const location = useLocation();
  const match = location.pathname.match(TABLE_PATH_PATTERN);
  const restaurantId = match?.[1] || "";
  const slotRef = useRef(null);
  const [portalHost, setPortalHost] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const syncPortalHost = () => {
      const root = getMenuRoot();
      if (!root) {
        if (portalHost) setPortalHost(null);
        return;
      }

      let slot = root.querySelector(":scope > .table-order-draft-category-slot");
      if (!slot) {
        slot = document.createElement("div");
        slot.className = "table-order-draft-category-slot";
        const toolbar = root.querySelector(":scope > .table-order-draft__toolbar");
        if (toolbar) toolbar.insertAdjacentElement("afterend", slot);
        else root.prepend(slot);
      }

      slotRef.current = slot;
      setPortalHost((current) => (current === slot ? current : slot));
    };

    syncPortalHost();
    const observer = new MutationObserver(syncPortalHost);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (slotRef.current?.isConnected) slotRef.current.remove();
      slotRef.current = null;
    };
  }, [portalHost]);

  useEffect(() => {
    if (!portalHost) setSelectedCategory(ALL_CATEGORIES);
  }, [portalHost]);

  const { data, loading } = useQuery(CATEGORY_DATA, {
    variables: { restaurantId },
    skip: !restaurantId || !portalHost,
    fetchPolicy: "cache-and-network",
  });

  const menuItems = useMemo(
    () =>
      (data?.menuItemsConnection?.edges || [])
        .map((edge) => edge?.node)
        .filter(Boolean)
        .filter(
          (item) =>
            !["inactive", "archived", "hidden"].includes(
              String(item.status || "").toLowerCase(),
            ),
        ),
    [data?.menuItemsConnection?.edges],
  );

  const categories = useMemo(() => {
    const categoryMap = new Map();
    const source = [
      ...(data?.breakfast || []),
      ...(data?.lunch || []),
      ...(data?.dinner || []),
      ...(data?.lateNight || []),
    ];

    for (const category of source) {
      if (!category?.id) continue;
      const id = String(category.id);
      const current = categoryMap.get(id);
      const order = Number(category.order ?? Number.MAX_SAFE_INTEGER);
      categoryMap.set(id, {
        id,
        name: category.name || "Danh mục khác",
        order: current ? Math.min(current.order, order) : order,
        count: 0,
      });
    }

    for (const item of menuItems) {
      const id = String(item.categoryId || "");
      const category = categoryMap.get(id);
      if (category) category.count += 1;
    }

    return [...categoryMap.values()]
      .filter((category) => category.count > 0)
      .sort(
        (left, right) =>
          left.order - right.order || left.name.localeCompare(right.name, "vi"),
      );
  }, [data?.breakfast, data?.dinner, data?.lateNight, data?.lunch, menuItems]);

  useEffect(() => {
    if (
      selectedCategory !== ALL_CATEGORIES &&
      !categories.some((category) => category.id === selectedCategory)
    ) {
      setSelectedCategory(ALL_CATEGORIES);
    }
  }, [categories, selectedCategory]);

  const itemMetaByName = useMemo(() => {
    const map = new Map();
    for (const item of menuItems) {
      const key = normalizeText(item.name);
      if (!key) continue;
      const current = map.get(key) || {
        categoryIds: new Set(),
        image: item.thumbImage || "",
      };
      if (item.categoryId) current.categoryIds.add(String(item.categoryId));
      if (!current.image && item.thumbImage) current.image = item.thumbImage;
      map.set(key, current);
    }
    return map;
  }, [menuItems]);

  useEffect(() => {
    if (!portalHost) return undefined;
    const root = portalHost.parentElement;
    if (!root) return undefined;

    let frame = null;
    const applyEnhancements = () => {
      frame = null;
      const menu = root.querySelector(":scope > .table-order-draft__menu");
      if (!menu) return;

      let visibleCards = 0;
      const cards = menu.querySelectorAll(":scope > article");
      cards.forEach((card) => {
        const dishName = normalizeText(
          card.querySelector(".table-order-draft__info strong")?.textContent,
        );
        const meta = itemMetaByName.get(dishName);
        const matches =
          selectedCategory === ALL_CATEGORIES ||
          Boolean(meta?.categoryIds?.has(selectedCategory));
        card.hidden = !matches;
        card.classList.toggle("is-category-hidden", !matches);
        if (matches) visibleCards += 1;
      });

      const builtInState = menu.querySelector(":scope > .table-order-draft__state");
      let customEmpty = menu.querySelector(
        ":scope > .table-order-draft-category-empty",
      );
      if (!visibleCards && !builtInState && cards.length) {
        if (!customEmpty) {
          customEmpty = document.createElement("div");
          customEmpty.className =
            "table-order-draft__state table-order-draft-category-empty";
          customEmpty.textContent =
            "Không có món phù hợp trong danh mục và từ khóa đang chọn.";
          menu.append(customEmpty);
        }
      } else if (customEmpty) {
        customEmpty.remove();
      }

      root.querySelectorAll(".table-order-draft__line").forEach((line) => {
        const title = normalizeText(line.querySelector(":scope > span > strong")?.textContent);
        const meta = itemMetaByName.get(title);
        line.classList.add("is-enhanced-card");
        line.classList.toggle(
          "is-weighted-card",
          Boolean(line.querySelector(".table-order-draft__weight-chip")),
        );
        if (meta?.image) {
          line.style.setProperty("--table-order-line-image", cssUrl(meta.image));
        } else {
          line.style.removeProperty("--table-order-line-image");
        }

        const details = line.querySelector(":scope > span");
        details?.querySelectorAll("small").forEach((small, index) => {
          small.classList.toggle("is-serving-meta", index === 0);
          small.classList.toggle(
            "is-note-meta",
            normalizeText(small.textContent).startsWith("ghi chú:"),
          );
          small.classList.toggle(
            "is-option-meta",
            index > 0 &&
              !normalizeText(small.textContent).startsWith("ghi chú:"),
          );
        });
      });
    };

    const schedule = () => {
      if (frame != null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyEnhancements);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [itemMetaByName, portalHost, selectedCategory]);

  if (!portalHost) return null;

  return createPortal(
    <nav className="table-order-draft-categories" aria-label="Lọc món theo danh mục">
      <div className="table-order-draft-categories__label">
        <LayoutGrid aria-hidden="true" />
        <span>Danh mục</span>
      </div>
      <div className="table-order-draft-categories__scroller" role="group">
        <button
          type="button"
          className={selectedCategory === ALL_CATEGORIES ? "is-active" : ""}
          onClick={() => setSelectedCategory(ALL_CATEGORIES)}
          aria-pressed={selectedCategory === ALL_CATEGORIES}
        >
          <span>Tất cả</span>
          <b>{menuItems.length}</b>
        </button>
        {categories.map((category) => (
          <button
            type="button"
            key={category.id}
            className={selectedCategory === category.id ? "is-active" : ""}
            onClick={() => setSelectedCategory(category.id)}
            aria-pressed={selectedCategory === category.id}
          >
            <span>{category.name}</span>
            <b>{category.count}</b>
          </button>
        ))}
        {loading && !categories.length ? (
          <span className="table-order-draft-categories__loading">
            Đang tải danh mục…
          </span>
        ) : null}
      </div>
    </nav>,
    portalHost,
  );
}
