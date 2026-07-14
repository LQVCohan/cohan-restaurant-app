import React, { useState } from "react";
import { useLocation } from "react-router-dom";

import TableOrderAccessGate from "./TableOrderAccessGate";
import TableOrderDraftLauncher from "./TableOrderDraftLauncher";
import TableOrderDraftCategoryEnhancer from "./TableOrderDraftCategoryEnhancer";
import TableOrderExperience from "./TableOrderExperience";
import TableProofUpdateNotifier from "./TableProofUpdateNotifier";

import "./TableOrderResponsiveLayout.scss";

const TABLE_PATH_PATTERN = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;
const IDENTITY_CHOICE_PREFIX = "cohan:table-order:identity-choice";
const IDENTITY_TOKEN_PREFIX = "cohan:table-order:identity-token";

export function clearStaleTableIdentity(pathname, storage) {
  const match = String(pathname || "").match(TABLE_PATH_PATTERN);
  if (!match || !storage) return;

  const scope = `${match[1]}:${match[2]}`;
  try {
    storage.removeItem(`${IDENTITY_CHOICE_PREFIX}:${scope}`);
    storage.removeItem(`${IDENTITY_TOKEN_PREFIX}:${scope}`);
  } catch {
    // Storage is optional; the table-order page still works with in-memory state.
  }
}

export default function TableOrderRouteExperience() {
  const location = useLocation();
  const [routeInstanceKey] = useState(() => {
    clearStaleTableIdentity(
      location.pathname,
      typeof window !== "undefined" ? window.sessionStorage : null,
    );
    return `${location.pathname}${location.search}`;
  });

  return (
    <React.Fragment key={routeInstanceKey}>
      <TableOrderAccessGate />
      <TableOrderDraftLauncher />
      <TableOrderDraftCategoryEnhancer />
      <TableOrderExperience />
      <TableProofUpdateNotifier />
    </React.Fragment>
  );
}
