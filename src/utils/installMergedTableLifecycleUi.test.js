import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/dom";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/apollo/client", () => ({
  apolloClient: {
    query: (...args) => mocks.query(...args),
  },
}));

import {
  __testables,
  installMergedTableLifecycleUi,
} from "./installMergedTableLifecycleUi";

const originalRequestAnimationFrame = window.requestAnimationFrame;

const mergedTable = {
  id: "merged-1",
  code: "A1+A2",
  capacity: 10,
  status: "occupied",
  joinGroupId: "group-1",
  mergedFromTableIds: ["source-a1", "source-a2"],
  mergeAnchorTableId: "source-a1",
  mergeDetails: {
    isMerged: true,
    sourceCount: 2,
    sourceTableCodes: ["A1", "A2"],
    customerNames: ["Nguyễn An", "Trần Bình"],
    customerLabel: "Nguyễn An + Trần Bình",
    reservationCount: 1,
    activeOrderSessionCount: 2,
    activeOrderCount: 3,
    totalOpenAmount: 250000,
    sources: [
      {
        tableId: "source-a1",
        tableCode: "A1",
        customer: { name: "Nguyễn An" },
        reservation: {
          orderCode: "RSV-001",
          customerName: "Nguyễn An",
        },
        orderSessions: [
          {
            sessionCode: "TS-A1",
            orderCodes: ["POS-A1-001"],
          },
        ],
      },
      {
        tableId: "source-a2",
        tableCode: "A2",
        customer: { name: "Trần Bình" },
        reservation: null,
        orderSessions: [
          {
            sessionCode: "TS-A2",
            orderCodes: ["POS-A2-001", "POS-A2-002"],
          },
        ],
      },
    ],
  },
};

const mountPos = () => {
  document.body.innerHTML = `
    <select class="restaurantSelect_mock">
      <option value="restaurant-1" selected>Chi nhánh 1</option>
    </select>
    <div class="tablesGrid_mock">
      <div class="tableItem_mock">
        <span class="tableCode_mock">A1+A2</span>
      </div>
    </div>
    <div role="dialog">
      <h3>🧾 Thanh Toán Hóa Đơn</h3>
      <p class="orderInfo_mock">Bàn: <b>A1+A2</b> | Hóa đơn: <b>POS-001</b></p>
    </div>
  `;
};

describe("installMergedTableLifecycleUi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mountPos();
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };
    mocks.query.mockResolvedValue({ data: { tables: [mergedTable] } });
  });

  afterEach(() => {
    window[__testables.OBSERVER_KEY]?.disconnect?.();
    delete window[__testables.OBSERVER_KEY];
    document.body.innerHTML = "";
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete window.requestAnimationFrame;
    }
  });

  it("expands the merged card and shows source sessions and combined customers", async () => {
    installMergedTableLifecycleUi();

    await waitFor(() => {
      const card = document.querySelector(".cohan-merged-table-card");
      expect(card).toBeTruthy();
      expect(card.textContent).toContain("A1 · A2");
      expect(card.textContent).toContain("Nguyễn An + Trần Bình");
      expect(card.textContent).toContain("A1: TS-A1");
      expect(card.textContent).toContain("A2: TS-A2");
      expect(card.textContent).toContain("250.000đ");
    });

    const paymentLabel = document.querySelector(
      `.${__testables.PAYMENT_CLASS}`,
    );
    expect(paymentLabel?.textContent).toContain("Nguyễn An + Trần Bình");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
