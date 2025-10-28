import React from "react";
import styles from "./POSLayout.module.scss";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";
import PosProvider from "../../../../../context/PosContext";

export default function POSLayout() {
  const restaurantId = "68e3fc0486dc90d60c7101dc";
  const initialFloorId = 1;

  return (
    <div className={styles.pageFull}>
      <PosProvider restaurantId={restaurantId} initialFloorId={initialFloorId}>
        <div className={styles.container}>
          <LeftPanel className={styles.card} />
          <CenterPanel className={styles.card} />
          <RightPanel className={styles.card} />
        </div>
      </PosProvider>
    </div>
  );
}
