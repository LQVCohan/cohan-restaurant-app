import React, { useEffect, useRef } from "react";
import { LayoutGrid, List } from "lucide-react";
import StorageGridPaginationBridge from "../../components/common/StorageGridPaginationBridge";
import "../../StorageExperiencePolish.css";
import "../../StorageBackgroundUnify.css";
import "../../StoragePremiumNine.css";
import "../../StorageIngredientCardPremium.css";
import "../../StorageControlsPolish.css";
import "../../StorageImportToolbar.css";
import "../../StorageVisualGradeNine.css";
import "../../StorageVisibleGradeNine.css";
import "../../StorageComponentHarmony.css";
import "../../StoragePagination.css";
import "../../StorageWideLayout.css";
import "../../StorageDropdownPolish.css";
import "../../StorageModalPolish.css";
import "../../StorageModalFinalTen.css";
import "../../StorageModalRealityFix.css";
import "../../StorageModalScrollLockFix.css";
import "../../StorageCategoryModalFitFix.css";
import "../../StorageGreenToneFinal.css";
import "../../StorageChecklistPolishFinal.css";
import "../../StoragePostUpdateBugFix.css";
import "../../StorageRecipeModalUpgrade.css";
import "../../StorageRecipeModalButtonToneFix.css";
import "../../StorageRecipeModalSummaryHide.css";
import "../../StorageRecipeModalPaletteBalance.css";
import "../../StorageSageTone.scss";
import "../../IngredientModalEnhancements.css";
import "../../StorageRecipeModalCompactLayout.css";
import "./Tabs.scss";
import "../../StorageInventoryAuditStepperFix.css";

export const getRequestedStorageTab = (tabs = [], search = "") => {
  const requested = new URLSearchParams(search).get("tab") || "";
  return tabs.some((tab) => tab.id === requested) ? requested : "";
};

const Tabs = ({ tabs, activeTab, onTabChange }) => {
  const supportsViewToggle = ["ingredients", "supplies", "recipes"].includes(activeTab);
  const tabsRef = useRef(tabs);
  const activeTabRef = useRef(activeTab);
  const onTabChangeRef = useRef(onTabChange);

  useEffect(() => {
    tabsRef.current = tabs;
    activeTabRef.current = activeTab;
    onTabChangeRef.current = onTabChange;
  }, [activeTab, onTabChange, tabs]);

  useEffect(() => {
    const applyRequestedTab = (requestedTab) => {
      if (!requestedTab || requestedTab === activeTabRef.current) return;
      if (!tabsRef.current.some((tab) => tab.id === requestedTab)) return;
      onTabChangeRef.current?.(requestedTab);
    };

    applyRequestedTab(
      getRequestedStorageTab(tabsRef.current, window.location.search),
    );

    const handleNavigationQuery = (event) => {
      if (event?.detail?.page !== "inventory") return;
      applyRequestedTab(event.detail.query?.tab);
    };
    const handlePopState = () => {
      applyRequestedTab(
        getRequestedStorageTab(tabsRef.current, window.location.search),
      );
    };

    window.addEventListener("manager:navigation-query", handleNavigationQuery);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("manager:navigation-query", handleNavigationQuery);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return (
    <>
      <div className="sm-tabs-container" role="tablist" aria-label="Nhóm chức năng kho">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`sm-tab-item ${isActive ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              <span className="tab-label">{tab.label}</span>
              {isActive && <span className="active-dot" />}
            </button>
          );
        })}
      </div>

      <div
        className={`sm-view-toggle ${supportsViewToggle ? "" : "is-hidden"}`}
        role="radiogroup"
        aria-label="Kiểu hiển thị danh sách"
      >
        <label className="sm-view-toggle__option" title="Hiển thị dạng thẻ">
          <input
            className="sm-view-toggle__input"
            type="radio"
            name="storage-view-mode"
            value="grid"
            defaultChecked
          />
          <LayoutGrid size={16} aria-hidden="true" />
          <span>Thẻ</span>
        </label>
        <label className="sm-view-toggle__option" title="Hiển thị dạng danh sách ngang">
          <input
            className="sm-view-toggle__input"
            type="radio"
            name="storage-view-mode"
            value="list"
          />
          <List size={16} aria-hidden="true" />
          <span>Danh sách</span>
        </label>
      </div>

      <StorageGridPaginationBridge activeTab={activeTab} />
    </>
  );
};

export default Tabs;
