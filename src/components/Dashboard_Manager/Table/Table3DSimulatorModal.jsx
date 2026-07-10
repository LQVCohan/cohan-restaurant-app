import React from "react";

/**
 * The per-table 3D/AR placement flow has been retired.
 *
 * Keep this compatibility component temporarily so stale callers or cached bundles
 * cannot reopen the old WebXR placement path while the active table experience uses
 * photos and 360° panoramas only.
 */
export default function Table3DSimulatorModal() {
  return null;
}
