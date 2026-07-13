import React, { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { usePos } from "../../../../../context/PosContext";
import SplitTableModal from "../modals/SplitTableModal";

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
        onClick={() => setOpen(true)}
        title="Tách món sang bàn khác hoặc gộp lại lần tách đang hoạt động"
        style={{
          position: "absolute",
          right: 14,
          bottom: 14,
          zIndex: 18,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          minHeight: 38,
          padding: "0 13px",
          border: "1px solid #24705c",
          borderRadius: 11,
          color: "#fff",
          background: "linear-gradient(135deg, #318269, #195443)",
          boxShadow: "0 10px 24px rgba(25,84,67,.24)",
          fontSize: 12,
          fontWeight: 800,
          cursor: "pointer",
        }}
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
