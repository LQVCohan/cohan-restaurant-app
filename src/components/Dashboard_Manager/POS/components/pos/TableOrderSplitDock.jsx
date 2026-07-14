import React, { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { usePos } from "../../../../../context/PosContext";
import SplitTableModal from "../modals/SplitTableModal";
import styles from "./POSLayout.module.scss";

export default function TableOrderSplitDock() {
  const {
    restaurantId,
    currentTable,
    currentOrderType,
    tables,
    refetchTables,
    selectTableForOrder,
  } = usePos();
  const [open, setOpen] = useState(false);

  const isDineIn =
    currentOrderType === "dine_in" &&
    currentTable?.id &&
    !currentTable?.isVirtual;

  if (!isDineIn) return null;

  const handleCompleted = async ({ sourceTable }) => {
    await refetchTables?.();
    const sourceCode =
      sourceTable?.code ||
      tables.find((table) => String(table.id) === String(currentTable?.id))?.code ||
      currentTable?.code;
    if (sourceCode) {
      await selectTableForOrder?.(
        sourceCode,
        sourceTable?.capacity || currentTable?.capacity || 0,
        { preserveDraftItems: false },
      );
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.splitOrderButton}
        onClick={() => setOpen(true)}
        title="Tách món sang bàn khác hoặc gộp lại lần tách đang hoạt động"
      >
        <ArrowRightLeft size={16} />
        Tách / gộp order
      </button>

      <SplitTableModal
        isOpen={open}
        restaurantId={restaurantId}
        tables={tables}
        initialSourceTable={currentTable}
        onClose={() => setOpen(false)}
        onCompleted={handleCompleted}
      />
    </>
  );
}
