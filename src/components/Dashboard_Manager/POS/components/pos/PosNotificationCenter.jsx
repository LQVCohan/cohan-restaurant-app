import React, { useEffect, useRef, useState } from "react";
import { BellRing, ChevronDown, X } from "lucide-react";

import CustomerRequestQueuePanel from "./CustomerRequestQueuePanel";
import EligibleGiftSuggestionPanel from "./EligibleGiftSuggestionPanel";
import PosIncomingTableOrderQueue from "./PosIncomingTableOrderQueue";
import TablePaymentRequestNotice from "./TablePaymentRequestNotice";
import styles from "./PosNotificationCenter.module.scss";

export default function PosNotificationCenter({ restaurantId, onOpenPayment }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!restaurantId) return null;

  return (
    <div className={styles.notificationCenter} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""}`}
        aria-expanded={isOpen}
        aria-controls="pos-notification-center-popover"
        aria-label="Mở trung tâm thông báo POS"
        onClick={() => setIsOpen((value) => !value)}
      >
        <BellRing size={17} aria-hidden="true" />
        <span>Thông báo</span>
        <ChevronDown
          size={15}
          className={isOpen ? styles.chevronOpen : styles.chevron}
          aria-hidden="true"
        />
      </button>

      <section
        id="pos-notification-center-popover"
        className={styles.popover}
        role="dialog"
        aria-modal="false"
        aria-label="Trung tâm thông báo POS"
        hidden={!isOpen}
      >
        <header className={styles.popoverHeader}>
          <div>
            <strong>Thông báo & gợi ý</strong>
            <span>QR tại bàn, yêu cầu khách, thanh toán và ưu đãi được gom tại đây.</span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            aria-label="Đóng trung tâm thông báo"
            onClick={() => setIsOpen(false)}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={styles.popoverBody}>
          <TablePaymentRequestNotice />
          <CustomerRequestQueuePanel
            restaurantId={restaurantId}
            onOpenPayment={onOpenPayment}
          />
          <PosIncomingTableOrderQueue restaurantId={restaurantId} />
          <EligibleGiftSuggestionPanel />
        </div>
      </section>
    </div>
  );
}
