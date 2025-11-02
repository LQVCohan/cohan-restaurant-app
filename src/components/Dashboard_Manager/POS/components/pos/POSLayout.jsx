// src/components/Dashboard_Manager/POS/POSLayout.jsx
import React from "react";
import styles from "./POSLayout.module.scss";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";
import PosProvider from "../../../../../context/PosContext";

export default function POSLayout() {
  // sau bạn truyền từ router cũng được
  const restaurantId = "68e3fc0486dc90d60c7101dc";

  return (
    <div className={styles.page}>
      <PosProvider restaurantId={restaurantId}>
        <div className={styles.shell}>
          {/* Cột trái: bàn */}
          <div className={styles.leftCol}>
            <div className={styles.card}>
              <LeftPanel />
            </div>
          </div>

          {/* Cột giữa: menu */}
          <div className={styles.centerCol}>
            <div className={styles.card}>
              <CenterPanel />
            </div>
          </div>

          {/* Cột phải: order hiện tại */}
          <div className={styles.rightCol}>
            <div className={styles.card}>
              <RightPanel />
            </div>
          </div>
        </div>
      </PosProvider>
    </div>
  );
}
