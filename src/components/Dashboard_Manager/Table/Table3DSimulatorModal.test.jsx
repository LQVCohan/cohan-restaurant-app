import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Table3DSimulatorModal from "./Table3DSimulatorModal";

describe("Table3DSimulatorModal", () => {
  it("does not render or invoke legacy 3D and AR callbacks", () => {
    const onApply = vi.fn();
    const onSaveArPosition = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <Table3DSimulatorModal
        open
        table={{ id: "table-1", visualConfig: { modelKey: "legacy-model" } }}
        onApply={onApply}
        onSaveArPosition={onSaveArPosition}
        onClose={onClose}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(onApply).not.toHaveBeenCalled();
    expect(onSaveArPosition).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
