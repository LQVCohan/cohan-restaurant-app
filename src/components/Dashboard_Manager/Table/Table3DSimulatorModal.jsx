import React, { useEffect, useMemo, useState } from "react";
import {
  deleteCustomTableModel,
  upsertCustomTableModel,
} from "@/config/table3dCustomModelStorage";
import {
  buildPreviewModelItemFromVisualConfig,
  buildVisualConfigFromModel,
} from "./tableVisualConfigHelpers";
import Table3DSimulatorModalV2 from "./Table3DSimulatorModalV2";

export default function Table3DSimulatorModal(props) {
  const {
    open,
    onApply,
    onClose,
    onSaveArPosition,
    restaurantId,
    restaurantName,
    table,
  } = props;
  const [hydratedModelKey, setHydratedModelKey] = useState("");
  const customModelScope = restaurantName || restaurantId || "default";

  const persistedModel = useMemo(() => {
    const model = buildPreviewModelItemFromVisualConfig(table?.visualConfig);
    if (!model?.modelUrl) return null;
    return {
      ...model,
      customModelKind: model.customModelKind || "saved",
    };
  }, [table?.visualConfig]);

  const persistedModelKey = persistedModel
    ? `${customModelScope}:${persistedModel.key}:${persistedModel.modelUrl}`
    : "";

  useEffect(() => {
    if (!open || !persistedModel || !persistedModelKey) return;
    deleteCustomTableModel(persistedModel.key, customModelScope);
    upsertCustomTableModel(persistedModel, customModelScope);
    setHydratedModelKey(persistedModelKey);
  }, [customModelScope, open, persistedModel, persistedModelKey]);

  const handleApply = async (selectedModel, extras = {}) => {
    if (!table?.id || !onSaveArPosition) {
      return onApply?.(selectedModel, extras);
    }

    try {
      await onSaveArPosition({
        visualConfigPatch:
          extras.visualConfig || buildVisualConfigFromModel(selectedModel, null),
      });
      onClose?.();
    } catch {
      // The parent save callback already reports the mutation error.
    }
  };

  if (open && persistedModelKey && hydratedModelKey !== persistedModelKey) {
    return null;
  }

  return <Table3DSimulatorModalV2 {...props} onApply={handleApply} />;
}
