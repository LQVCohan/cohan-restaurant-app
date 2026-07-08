import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddCustomerModal from "./AddCustomerModal";

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  createGuest: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock("../../common/Modal", () => {
  const MockModal = ({ isOpen, title, children }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null;
  MockModal.Footer = ({ children }) => <footer>{children}</footer>;
  return { default: MockModal };
});

vi.mock("../../../hooks/useUserManagement", () => ({
  default: () => ({
    roleList: [{ id: "customer-role", slug: "customer" }],
    createUser: mocks.createUser,
    createGuest: mocks.createGuest,
    creating: false,
    creatingGuest: false,
  }),
}));

vi.mock("../../../hooks/useNotification", () => ({
  useNotification: () => ({ showNotification: mocks.showNotification }),
}));

vi.mock("../../../hooks/useVnAddressLazy", () => ({
  useVnAddressLazy: () => ({
    loading: false,
    error: null,
    provinces: [],
    districts: [],
    wards: [],
    provinceKey: "",
    districtKey: "",
    wardKey: "",
    setProvince: vi.fn(),
    setDistrict: vi.fn(),
    setWard: vi.fn(),
    selectedProvince: null,
    selectedDistrict: null,
  }),
}));

const getControl = (name) => document.querySelector(`[name="${name}"]`);

const expectEmptyNoAutofill = (control) => {
  expect(control).not.toBeNull();
  expect(control.value).toBe("");
  expect(control.getAttribute("autocomplete")).toBe("off");
  expect(control.getAttribute("data-lpignore")).toBe("true");
  expect(control.getAttribute("data-1p-ignore")).toBe("true");
};

describe("AddCustomerModal autofill boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a blank customer form without reusing manager credentials", () => {
    render(<AddCustomerModal onClose={vi.fn()} onCreated={vi.fn()} />);

    const form = document.querySelector("#add-customer-form");
    expect(form).not.toBeNull();
    expect(form.getAttribute("autocomplete")).toBe("off");

    expectEmptyNoAutofill(getControl("new-customer-full-name"));
    expectEmptyNoAutofill(getControl("new-customer-username"));
    expectEmptyNoAutofill(getControl("new-customer-email"));
    expectEmptyNoAutofill(getControl("new-customer-phone"));

    const password = getControl("new-customer-password");
    const confirmation = getControl("new-customer-password-confirmation");
    expect(password).not.toBeNull();
    expect(confirmation).not.toBeNull();
    expect(password.value).toBe("");
    expect(confirmation.value).toBe("");
    expect(password.getAttribute("autocomplete")).toBe("new-password");
    expect(confirmation.getAttribute("autocomplete")).toBe("new-password");
  });

  it("keeps quick guest fields blank and excluded from autofill", () => {
    render(<AddCustomerModal onClose={vi.fn()} onCreated={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Khách vãng lai/i }),
    );

    expectEmptyNoAutofill(getControl("new-guest-full-name"));
    expectEmptyNoAutofill(getControl("new-guest-phone"));
  });
});
