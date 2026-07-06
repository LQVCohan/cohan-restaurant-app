import React from "react";
import StorageGridPaginationBridge from "../../components/common/StorageGridPaginationBridge";
import "./Tabs.scss";
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

const Tabs = ({ tabs, activeTab, onTabChange }) => (
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
    <StorageGridPaginationBridge activeTab={activeTab} />
  </>
);

export default Tabs;
