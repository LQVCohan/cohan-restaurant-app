import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { message } from "antd";
import RestaurantInfoManagement from "./RestaurantInfoManagement";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const updateRestaurantMock = vi.fn();
const updateIndexMock = vi.fn();
const rewriteRestaurantProfileMock = vi.fn();
const refetchRestaurantDetailMock = vi.fn();
const refetchIndexesMock = vi.fn();
const refetchCategoriesMock = vi.fn();

vi.mock("@apollo/client", () => ({
  gql: (strings) => strings,
  useQuery: (...args) => useQueryMock(...args),
  useMutation: (...args) => useMutationMock(...args),
}));

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal();
  const reactModule = await import("react");
  const ReactRuntime = reactModule.default || reactModule;

  const getOptionLabel = (children) => {
    if (
      ReactRuntime.isValidElement(children) &&
      typeof children.props?.text === "string"
    ) {
      return children.props.text;
    }
    return children;
  };

  const Option = ({ value, children }) =>
    ReactRuntime.createElement(
      "option",
      { value },
      getOptionLabel(children),
    );

  const Select = ({
    value,
    onChange,
    options = [],
    children,
    disabled,
    ...props
  }) =>
    ReactRuntime.createElement(
      "select",
      {
        value: value ?? "",
        disabled,
        "aria-label": props["aria-label"],
        onChange: (event) => onChange?.(event.target.value),
      },
      options.length
        ? options.map((option) =>
            ReactRuntime.createElement(
              "option",
              { key: option.value, value: option.value },
              option.label,
            ),
          )
        : children,
    );
  Select.Option = Option;

  return {
    ...actual,
    Select,
  };
});

vi.mock("../../../hooks/useAvatarUploadLocal", () => ({
  useAvatarUploadLocal: () => ({ upload: vi.fn() }),
}));

vi.mock("../shared/ManagementPageHeader", () => ({
  default: ({ primaryAction, selectedRestaurant, footerRight }) => (
    <header>
      <span data-testid="selected-restaurant">{selectedRestaurant}</span>
      <button
        type="button"
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      >
        {primaryAction.label}
      </button>
      <span>{footerRight}</span>
    </header>
  ),
}));

const customerInfo = {
  story: "",
  chef: "",
  dressCode: "",
  website: "",
  extraAmenities: [],
  parkingDetail: "",
  suitableFor: [],
  faqs: [
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
  ],
};

const initialCapabilities = {
  acceptsReservations: false,
  acceptsOrders: true,
  acceptsTableOrders: true,
  acceptsDelivery: true,
  acceptsPickup: false,
};

const restaurant = {
  id: "r1",
  name: "COHAN",
  brandId: "b1",
  brand: { id: "b1", name: "COHAN", slug: "cohan" },
  phone: "",
  email: "",
  description: "",
  openingHours: "",
  closingHours: "",
  notesOnHours: "",
  cuisineType: "",
  priceRange: "",
  businessStatus: "active",
  operationalStatus: "normal",
  openingStatus: "closed",
  openingStatusReason: "Đã hết giờ phục vụ",
  canOrder: false,
  capabilities: initialCapabilities,
  orderPolicy: { allowWhenClosed: false, minAdvanceMinutes: 30, maxFutureDays: 7 },
  amenities: [],
  notesOnAmenities: JSON.stringify(customerInfo),
  avgRating: 0,
  seatingCapacity: 0,
  avatar: "",
  coverImage: "",
  address: {
    line1: "123 Existing Street",
    line2: "",
    ward: "",
    district: "",
    city: "",
    country: "",
    postalCode: "",
    lat: null,
    lng: null,
  },
  reservationSettings: {
    baseDepositAmount: 0,
    menuDepositPercent: 50,
    changeTimeFee: 0,
    changeTableFee: 0,
    vatRate: 0,
    serviceFee: 0,
  },
  paymentSettings: {
    defaultProvider: "momo",
    providers: [
      { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox" },
      { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox" },
    ],
  },
};

const savedRestaurant = {
  ...restaurant,
  capabilities: {
    ...initialCapabilities,
    acceptsOrders: false,
  },
};

const savedRestaurantWithOutsideHours = {
  ...restaurant,
  canOrder: true,
  orderPolicy: {
    ...restaurant.orderPolicy,
    allowWhenClosed: true,
  },
};

const pausedRestaurant = {
  ...restaurant,
  operationalStatus: "paused",
};

const queryResults = {
  me: { data: { me: { id: "u1", roleName: "manager" } } },
  scopedRestaurants: {
    data: {
      scopedRestaurants: {
        edges: [
          {
            node: {
              id: "r1",
              name: "COHAN",
              brandId: "b1",
              brand: restaurant.brand,
            },
          },
        ],
      },
    },
    loading: false,
  },
  allRestaurants: {
    data: { restaurants: { edges: [] } },
    loading: false,
  },
  staffList: { data: { staffList: [] }, loading: false },
  restaurantDetail: {
    data: { restaurant },
    loading: false,
    error: null,
    refetch: refetchRestaurantDetailMock,
  },
  layoutMetrics: { data: { floors: [], tables: [] } },
  indexes: {
    data: { restaurantCategoryIndexes: [] },
    refetch: refetchIndexesMock,
  },
  categories: {
    data: { categories: [] },
    refetch: refetchCategoriesMock,
  },
  empty: { data: {}, loading: false },
};

const operationSource = (operation) => String(operation?.[0] || operation || "");

const openLocationTab = async () => {
  fireEvent.click(
    screen.getByRole("tab", { name: /Địa chỉ & giờ hoạt động/i }),
  );
  await screen.findByRole("button", { name: /Lấy vị trí hiện tại/i });
};

const installBrowserLayoutMocks = () => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  installBrowserLayoutMocks();

  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: vi.fn() },
  });
  vi.spyOn(message, "success").mockImplementation(() => {});
  vi.spyOn(message, "warning").mockImplementation(() => {});
  vi.spyOn(message, "error").mockImplementation(() => {});

  queryResults.restaurantDetail.data = { restaurant };
  refetchRestaurantDetailMock.mockResolvedValue({
    data: { restaurant: savedRestaurant },
  });
  refetchIndexesMock.mockResolvedValue({ data: { restaurantCategoryIndexes: [] } });
  refetchCategoriesMock.mockResolvedValue({ data: { categories: [] } });

  updateRestaurantMock.mockResolvedValue({
    data: { updateRestaurant: savedRestaurant },
  });
  updateIndexMock.mockResolvedValue({
    data: { updateRestaurantCategoryIndex: { id: "idx1" } },
  });
  rewriteRestaurantProfileMock.mockResolvedValue({
    data: {
      rewriteRestaurantProfileDescription: {
        text: "COHAN mang đến không gian ẩm thực hiện đại, gần gũi và được chăm chút trong từng trải nghiệm. Đội ngũ nhà hàng phục vụ chỉn chu để mỗi bữa ăn đều thoải mái và đáng nhớ.",
        provider: "gemini",
        usedGemini: true,
        reason: "model:gemini-test",
      },
    },
  });

  useQueryMock.mockImplementation((operation) => {
    const source = operationSource(operation);

    if (source.includes("query Me")) return queryResults.me;
    if (source.includes("query ScopedRestaurants")) {
      return queryResults.scopedRestaurants;
    }
    if (source.includes("query AllRestaurants")) {
      return queryResults.allRestaurants;
    }
    if (source.includes("query StaffListForChefPicker")) {
      return queryResults.staffList;
    }
    if (source.includes("query GetRestaurantDetail")) {
      return queryResults.restaurantDetail;
    }
    if (source.includes("query GetRestaurantLayoutMetrics")) {
      return queryResults.layoutMetrics;
    }
    if (source.includes("query GetRestaurantCategoryIndexes")) {
      return queryResults.indexes;
    }
    if (source.includes("query GetCategories")) {
      return queryResults.categories;
    }

    return queryResults.empty;
  });

  useMutationMock.mockImplementation((operation) => {
    const source = operationSource(operation);
    if (source.includes("mutation UpdateRestaurantInfo")) {
      return [updateRestaurantMock, { loading: false }];
    }
    if (source.includes("mutation RewriteRestaurantProfile")) {
      return [rewriteRestaurantProfileMock, { loading: false }];
    }
    return [updateIndexMock, { loading: false }];
  });
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  vi.unstubAllGlobals();
});

describe("RestaurantInfoManagement", () => {
  it("shows production-ready Vietnamese labels for time slots and preview", async () => {
    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    expect(
      screen.getByRole("combobox", { name: "Khung giờ thực đơn" }),
    ).toHaveDisplayValue("Bữa trưa");
    expect(screen.getByText("Xem trước trên ứng dụng")).toBeInTheDocument();
    expect(screen.queryByText("Live Preview")).not.toBeInTheDocument();
  });

  it("uses the backend AI rewrite mutation and updates the description", async () => {
    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    const storyInput = screen.getByPlaceholderText(
      "Viết ngắn gọn về phong cách, món nổi bật và trải nghiệm tại nhà hàng",
    );
    fireEvent.change(storyInput, { target: { value: "Không gian ấm cúng" } });
    fireEvent.click(screen.getByRole("button", { name: /Viết lại bằng AI/i }));

    await waitFor(() => expect(rewriteRestaurantProfileMock).toHaveBeenCalledTimes(1));
    expect(rewriteRestaurantProfileMock).toHaveBeenCalledWith({
      variables: {
        input: {
          restaurantId: "r1",
          restaurantName: "COHAN",
          cuisineType: undefined,
          currentText: "Không gian ấm cúng",
          chefName: undefined,
        },
      },
    });
    await waitFor(() => {
      expect(storyInput).toHaveValue(
        "COHAN mang đến không gian ẩm thực hiện đại, gần gũi và được chăm chút trong từng trải nghiệm. Đội ngũ nhà hàng phục vụ chỉn chu để mỗi bữa ăn đều thoải mái và đáng nhớ.",
      );
    });
    expect(message.success).toHaveBeenCalledWith("Đã viết lại mô tả bằng AI");
  });

  it("preserves other capabilities when the manager disables remote orders", async () => {
    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    const remoteOrderSwitch = screen.getByRole("switch", {
      name: "Nhận đơn từ xa",
    });
    expect(remoteOrderSwitch).toBeChecked();

    fireEvent.click(remoteOrderSwitch);
    expect(remoteOrderSwitch).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    expect(
      updateRestaurantMock.mock.calls[0][0].variables.input.capabilities,
    ).toEqual({
      ...initialCapabilities,
      acceptsOrders: false,
    });
    expect(refetchRestaurantDetailMock).toHaveBeenCalledTimes(1);
  });

  it("reflects queried order policy on the outside-hours switch", async () => {
    queryResults.restaurantDetail.data = {
      restaurant: {
        ...restaurant,
        orderPolicy: { ...restaurant.orderPolicy, allowWhenClosed: true },
      },
    };

    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    expect(
      screen.getByRole("switch", { name: "Nhận đơn ngoài giờ mở cửa" }),
    ).toBeChecked();
  });

  it("sends full order policy and preserves extra policy fields when outside-hours orders are enabled", async () => {
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: savedRestaurantWithOutsideHours },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant: savedRestaurantWithOutsideHours },
    });

    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    fireEvent.click(
      screen.getByRole("switch", { name: "Nhận đơn ngoài giờ mở cửa" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    expect(updateRestaurantMock.mock.calls[0][0].variables.input.orderPolicy).toEqual({
      allowWhenClosed: true,
      minAdvanceMinutes: 30,
      maxFutureDays: 7,
    });
  });

  it("disables outside-hours orders when remote orders are disabled", async () => {
    queryResults.restaurantDetail.data = {
      restaurant: {
        ...restaurant,
        capabilities: { ...initialCapabilities, acceptsOrders: false },
      },
    };

    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    expect(
      screen.getByRole("switch", { name: "Nhận đơn ngoài giờ mở cửa" }),
    ).toBeDisabled();
  });

  it("keeps the form dirty and warns when refetch returns a different outside-hours policy", async () => {
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: savedRestaurantWithOutsideHours },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant },
    });

    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    fireEvent.click(
      screen.getByRole("switch", { name: "Nhận đơn ngoài giờ mở cửa" }),
    );
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(message.warning).toHaveBeenCalledWith(
      "Đã gửi yêu cầu lưu nhưng dữ liệu trả về chưa đồng bộ. Vui lòng tải lại trang hoặc kiểm tra lại API.",
    ));
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument();
    expect(message.success).not.toHaveBeenCalledWith(
      "Cập nhật thông tin nhà hàng thành công",
    );
  });

  it("saves paused operational status without sending legacy status", async () => {
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: pausedRestaurant },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant: pausedRestaurant },
    });

    render(<RestaurantInfoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    const operationalStatusSelect = screen.getByRole("combobox", {
      name: "Trạng thái vận hành",
    });
    fireEvent.change(operationalStatusSelect, {
      target: { value: "paused" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    const input = updateRestaurantMock.mock.calls[0][0].variables.input;
    expect(input.operationalStatus).toBe("paused");
    expect(input).not.toHaveProperty("status");
    expect(refetchRestaurantDetailMock).toHaveBeenCalledTimes(1);
  });

  it("reverse-geocodes current coordinates into the address form and saves numbers", async () => {
    const getCurrentPosition = vi.fn((success, _error, options) => {
      expect(options).toEqual({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      success({
        coords: {
          latitude: 10.895109,
          longitude: 106.83339,
        },
      });
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: "12 Nguyễn Ái Quốc, Long Bình, Biên Hòa, Đồng Nai",
          address: {
            house_number: "12",
            road: "Nguyễn Ái Quốc",
            suburb: "Phường Long Bình",
            city_district: "TP. Biên Hòa",
            city: "Biên Hòa",
            state: "Đồng Nai",
            country: "Việt Nam",
            postcode: "810000",
          },
        }),
      }),
    );

    const locatedRestaurant = {
      ...restaurant,
      address: {
        ...restaurant.address,
        line1: "12 Nguyễn Ái Quốc",
        ward: "Phường Long Bình",
        district: "TP. Biên Hòa",
        city: "Đồng Nai",
        country: "Việt Nam",
        postalCode: "810000",
        lat: 10.895109,
        lng: 106.83339,
      },
    };
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: locatedRestaurant },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant: locatedRestaurant },
    });

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Vĩ độ")).toHaveValue(10.895109);
      expect(screen.getByLabelText("Kinh độ")).toHaveValue(106.83339);
      expect(screen.getByLabelText("Số nhà / Đường")).toHaveValue("12 Nguyễn Ái Quốc");
      expect(screen.getByLabelText("Phường / Xã")).toHaveValue("Phường Long Bình");
      expect(screen.getByLabelText("Quận / Huyện")).toHaveValue("TP. Biên Hòa");
      expect(screen.getByLabelText("Tỉnh / Thành phố")).toHaveValue("Đồng Nai");
      expect(screen.getByLabelText("Quốc gia")).toHaveValue("Việt Nam");
      expect(screen.getByLabelText("Mã bưu chính")).toHaveValue("810000");
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1",
      ),
      expect.objectContaining({
        headers: expect.objectContaining({ "Accept-Language": "vi" }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));

    expect(updateRestaurantMock.mock.calls[0][0].variables.input.address).toEqual(
      expect.objectContaining({
        line1: "12 Nguyễn Ái Quốc",
        ward: "Phường Long Bình",
        district: "TP. Biên Hòa",
        city: "Đồng Nai",
        country: "Việt Nam",
        postalCode: "810000",
        lat: 10.895109,
        lng: 106.83339,
      }),
    );
  });

  it("keeps captured coordinates and the manual address when reverse geocoding fails", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: { latitude: 10.895109, longitude: 106.83339 } }),
        ),
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Vĩ độ")).toHaveValue(10.895109);
      expect(screen.getByLabelText("Kinh độ")).toHaveValue(106.83339);
      expect(screen.getByLabelText("Số nhà / Đường")).toHaveValue("123 Existing Street");
      expect(message.warning).toHaveBeenCalledWith(
        "Đã cập nhật tọa độ nhưng chưa tra được địa chỉ. Vui lòng nhập địa chỉ thủ công.",
      );
    });
  });

  it("blocks incomplete coordinates before calling the mutation", async () => {
    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.change(screen.getByLabelText("Vĩ độ"), {
      target: { value: "10.7769" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(updateRestaurantMock).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith(
      "Vui lòng nhập đầy đủ cả vĩ độ và kinh độ",
    );
  });

  it("blocks out-of-range coordinates before calling the mutation", async () => {
    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.change(screen.getByLabelText("Vĩ độ"), {
      target: { value: "91" },
    });
    fireEvent.change(screen.getByLabelText("Kinh độ"), {
      target: { value: "106.7009" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(updateRestaurantMock).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith(
      "Vĩ độ phải nằm trong khoảng -90 đến 90",
    );
  });

  it("reports an unsupported geolocation browser", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    expect(message.error).toHaveBeenCalledWith(
      "Trình duyệt không hỗ trợ định vị",
    );
  });

  it("reports denied geolocation permission and clears the loading state", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((_success, error) => error({ code: 1 })),
      },
    });

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.click(screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }));

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(
        "Bạn đã từ chối quyền vị trí. Hãy cấp quyền trong cài đặt trình duyệt rồi thử lại.",
      );
      expect(
        screen.getByRole("button", { name: /Lấy vị trí hiện tại/i }),
      ).not.toBeDisabled();
    });
  });
});
