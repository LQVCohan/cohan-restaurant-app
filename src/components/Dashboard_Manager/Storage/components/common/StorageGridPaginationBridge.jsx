import React, { useEffect, useRef } from "react";

const PAGE_SIZE = 9;

const TAB_CONFIG = {
  ingredients: {
    selector: ".ing-storage-wrapper .il-grid:not(.il-grid--skeleton)",
    itemLabel: "nguyên liệu",
  },
  supplies: {
    selector: ".supply-list-container .sl-grid",
    itemLabel: "vật tư",
  },
  recipes: {
    selector: ".rl-container .rl-grid",
    itemLabel: "công thức",
  },
};

const getPageItems = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("left");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < totalPages - 1) items.push("right");
  items.push(totalPages);
  return items;
};

const makeButton = ({ text, title, disabled, active, onClick, extraClass = "" }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `storage-pagination__btn ${active ? "is-active" : ""} ${extraClass}`.trim();
  button.textContent = text;
  button.title = title || text;
  button.disabled = Boolean(disabled);
  button.addEventListener("click", onClick);
  return button;
};

const StorageGridPaginationBridge = ({ activeTab }) => {
  const pagesRef = useRef({});
  const observerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const config = TAB_CONFIG[activeTab];

    const clearPagination = () => {
      document.querySelectorAll(".storage-auto-pagination").forEach((node) => node.remove());
      Object.values(TAB_CONFIG).forEach(({ selector }) => {
        document.querySelectorAll(selector).forEach((grid) => {
          Array.from(grid.children).forEach((child) => {
            child.style.removeProperty("display");
          });
        });
      });
    };

    const applyPagination = () => {
      if (!config) {
        clearPagination();
        return;
      }

      document.querySelectorAll(".storage-auto-pagination").forEach((node) => node.remove());

      const grid = document.querySelector(config.selector);
      if (!grid) return;

      const items = Array.from(grid.children).filter((child) => {
        const className = child.className?.toString?.() || "";
        return (
          child.nodeType === 1 &&
          !className.includes("skeleton") &&
          !className.includes("storage-pagination")
        );
      });

      const totalItems = items.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
      const key = activeTab;
      const currentPage = Math.min(Math.max(1, pagesRef.current[key] || 1), totalPages);
      pagesRef.current[key] = currentPage;

      if (totalPages <= 1) {
        items.forEach((item) => item.style.removeProperty("display"));
        return;
      }

      const startIndex = (currentPage - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      items.forEach((item, index) => {
        item.style.display = index >= startIndex && index < endIndex ? "" : "none";
      });

      const nav = document.createElement("nav");
      nav.className = "storage-pagination storage-auto-pagination";
      nav.setAttribute("aria-label", `Phân trang ${config.itemLabel}`);

      const summary = document.createElement("div");
      summary.className = "storage-pagination__summary";
      const from = startIndex + 1;
      const to = Math.min(endIndex, totalItems);
      summary.innerHTML = `Hiển thị <strong>${from.toLocaleString("vi-VN")}</strong>–<strong>${to.toLocaleString("vi-VN")}</strong><span>/</span><strong>${totalItems.toLocaleString("vi-VN")}</strong><span>${config.itemLabel}</span>`;

      const controls = document.createElement("div");
      controls.className = "storage-pagination__controls";

      const goTo = (nextPage) => {
        pagesRef.current[key] = Math.min(Math.max(1, nextPage), totalPages);
        applyPagination();
      };

      controls.appendChild(makeButton({ text: "«", title: "Trang đầu", disabled: currentPage === 1, onClick: () => goTo(1), extraClass: "storage-pagination__btn--icon" }));
      controls.appendChild(makeButton({ text: "‹", title: "Trang trước", disabled: currentPage === 1, onClick: () => goTo(currentPage - 1), extraClass: "storage-pagination__btn--icon" }));

      const pages = document.createElement("div");
      pages.className = "storage-pagination__pages";
      getPageItems(currentPage, totalPages).forEach((pageItem) => {
        if (typeof pageItem !== "number") {
          const ellipsis = document.createElement("span");
          ellipsis.className = "storage-pagination__ellipsis";
          ellipsis.textContent = "…";
          pages.appendChild(ellipsis);
          return;
        }
        pages.appendChild(
          makeButton({
            text: String(pageItem),
            title: `Trang ${pageItem}`,
            active: pageItem === currentPage,
            onClick: () => goTo(pageItem),
          })
        );
      });
      controls.appendChild(pages);

      controls.appendChild(makeButton({ text: "›", title: "Trang sau", disabled: currentPage === totalPages, onClick: () => goTo(currentPage + 1), extraClass: "storage-pagination__btn--icon" }));
      controls.appendChild(makeButton({ text: "»", title: "Trang cuối", disabled: currentPage === totalPages, onClick: () => goTo(totalPages), extraClass: "storage-pagination__btn--icon" }));

      nav.appendChild(summary);
      nav.appendChild(controls);
      grid.insertAdjacentElement("afterend", nav);
    };

    const scheduleApply = () => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(applyPagination, 60);
    };

    clearPagination();
    scheduleApply();

    observerRef.current?.disconnect?.();
    observerRef.current = new MutationObserver(scheduleApply);
    const root = document.querySelector(".storage-management");
    if (root) {
      observerRef.current.observe(root, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      window.clearTimeout(timerRef.current);
      observerRef.current?.disconnect?.();
      clearPagination();
    };
  }, [activeTab]);

  return null;
};

export default StorageGridPaginationBridge;
