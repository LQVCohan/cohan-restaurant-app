import React from "react";
import { createPortal } from "react-dom";
import AvailabilitySnapshotModalInline from "./AvailabilitySnapshotModalInline";

const AvailabilitySnapshotModal = ({ isOpen, ...rest }) => {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <AvailabilitySnapshotModalInline isOpen {...rest} />,
    document.body,
  );
};

export default AvailabilitySnapshotModal;
