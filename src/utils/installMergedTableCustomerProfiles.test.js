import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, waitFor } from "@testing-library/dom";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock("@/apollo/client", () => ({
  apolloClient: {
    query: (...args) => mocks.query(...args),
    mutate: (...args) => mocks.mutate(...args),
  },
}));

import {
  __testables,
  installMergedTableCustomerProfiles,
} from "./installMergedTableCustomerProfiles";

const originalRequestAnimationFrame = window.requestAnimationFrame;

const tableResponse = {
  data: {
    tables: [{ id: "merged-1", code: "A1+A2", floorLevel: 1 }],
  },
};

const initialGroup = {
  tableId: "merged-1",
  tableCode: "A1+A2",
  isMerged: true,
  customerCount: 2,
  totalPartySize: 5,
  profiles: [
    {
      sourceTableId: "source-a1",
      sourceTableCode: "A1",
      customer: {
        id: "customer-a1",
        tableId: "source-a1",
        tableCode: "A1",
        customerName: "Nguyễn An",
        customerPhone: "0901000001",
        customerEmail: "an@example.com",
        note: "Không cay",
        partySize: 2,
      },
    },
    {
      sourceTableId: "source-a2",
      sourceTableCode: "A2",
      customer: {
        id: "customer-a2",
        tableId: "source-a2",
        tableCode: "A2",
        customerName: "Trần Bình",
        customerPhone: "0902000002",
        customerEmail: "binh@example.com",
        note: "Dị ứng đậu phộng",
        partySize: 3,
      },
    },
  ],
};

const updatedGroup = {
  ...initialGroup,
  profiles: initialGroup.profiles.map((profile) =>
    profile.sourceTableId === "source-a2"
      ? {
          ...profile,
          customer: {
            ...profile.customer,
            customerName: "Trần Bình mới",
            partySize: 4,
          },
        }
      : profile,
  ),
  totalPartySize: 6,
};

const mountModal = () => {
  document.body.innerHTML = `
    <header class="management-page-header">
      <select class="mph-select">
        <option value="restaurant-1" selected>Chi nhánh 1</option>
      </select>
    </header>
    <div class="talite-modal">
      <h3 class="talite-title">Chi tiết bàn <b>A1+A2</b></h3>
      <div class="talite-info">
        <div class="kv"><span class="k">Mã bàn:</span><span class="v">A1+A2</span></div>
        <div class="kv"><span class="k">Tầng:</span><span class="v">Tầng 1</span></div>
      </div>
      <section class="talite-group"><span class="talite-label">Thông tin bàn</span></section>
    </div>
  `;
};

describe("installMergedTableCustomerProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mountModal();
    window.requestAnimationFrame = (callback) => {
      callback();
      return 0;
    };

    let groupRequest = 0;
    mocks.query.mockImplementation(({ query }) => {
      const operation = query.definitions.find((definition) => definition.name)
        ?.name?.value;
      if (operation === "MergedTableCustomerProfileTables") {
        return Promise.resolve(tableResponse);
      }
      if (operation === "MergedTableCustomerProfiles") {
        const group = groupRequest === 0 ? initialGroup : updatedGroup;
        groupRequest += 1;
        return Promise.resolve({ data: { tableCustomerGroup: group } });
      }
      return Promise.reject(new Error(`Unexpected query: ${operation}`));
    });
    mocks.mutate.mockResolvedValue({
      data: {
        upsertTableCustomer: updatedGroup.profiles[1].customer,
      },
    });
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

  it("shows both source customers and saves only the selected source profile", async () => {
    installMergedTableCustomerProfiles();

    await waitFor(() => {
      expect(document.body.textContent).toContain("Nguyễn An");
      expect(document.body.textContent).toContain("Trần Bình");
      expect(document.body.textContent).toContain("5 khách");
    });

    const secondProfile = document.querySelector(
      'button[data-source-table-id="source-a2"]',
    );
    fireEvent.click(secondProfile);

    const nameInput = document.querySelector('input[name="customerName"]');
    const partyInput = document.querySelector('input[name="partySize"]');
    expect(nameInput.value).toBe("Trần Bình");
    expect(partyInput.value).toBe("3");

    fireEvent.input(nameInput, { target: { value: "Trần Bình mới" } });
    fireEvent.input(partyInput, { target: { value: "4" } });
    fireEvent.click(
      Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Lưu hồ sơ này"),
      ),
    );

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            input: expect.objectContaining({
              restaurantId: "restaurant-1",
              tableId: "source-a2",
              tableCode: "A2",
              customerName: "Trần Bình mới",
              partySize: 4,
            }),
          },
        }),
      );
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain("Trần Bình mới");
      expect(document.body.textContent).toContain("6 khách");
    });
  });

  it("marks and hides the customer section immediately outside supported tabs", () => {
    const modal = document.querySelector(".talite-modal");
    modal.dataset.tableDetailActiveTab = "configuration";

    const section = __testables.prepareModal(modal);

    expect(section).toHaveAttribute("data-table-detail-section", "customers");
    expect(section).toHaveAttribute("data-table-detail-kind", "customers");
    expect(section).toHaveAttribute("hidden");
  });
});
