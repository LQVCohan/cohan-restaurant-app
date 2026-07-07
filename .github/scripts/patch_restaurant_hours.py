from pathlib import Path
import re

COMPONENT = Path("src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx")
TEST = Path("src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx")
CSS = Path("src/styles/RestaurantProfileHoursResponsiveFix.css")


def sub_once(text, pattern, replacement, label, flags=0):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


component = COMPONENT.read_text(encoding="utf-8")

if "const getHoursValidationError" not in component:
    component = sub_once(
        component,
        r'''  if \(restaurant\?\.canOrder === true\) \{\n\s+return \{ type: "success", message: "Khách hàng hiện có thể đặt món\." \};\n  \}''',
        '''  if (restaurant?.canOrder === true) {
    if (
      restaurant?.openingStatus === "closed" &&
      form.orderPolicy?.allowWhenClosed === true
    ) {
      return {
        type: "success",
        message: "Nhà hàng đang ngoài giờ phục vụ nhưng vẫn nhận đơn online.",
      };
    }
    return { type: "success", message: "Khách hàng hiện có thể đặt món." };
  }''',
        "order availability",
    )

    helpers = '''const TIME_VALUE_PATTERN = /^(?:[01]\\d|2[0-3]):[0-5]\\d$/;

const normalizeTimeValue = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const match = text.match(/^(\\d{1,2}):(\\d{2})(?::\\d{2})?$/);
  if (!match) return text;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return text;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getHoursValidationError = (openingValue, closingValue) => {
  const openingHours = normalizeTimeValue(openingValue);
  const closingHours = normalizeTimeValue(closingValue);

  if (!openingHours && !closingHours) return "";
  if (!openingHours || !closingHours) {
    return "Vui lòng chọn đầy đủ cả giờ mở cửa và giờ đóng cửa";
  }
  if (!TIME_VALUE_PATTERN.test(openingHours)) {
    return "Giờ mở cửa phải theo định dạng 24 giờ HH:mm";
  }
  if (!TIME_VALUE_PATTERN.test(closingHours)) {
    return "Giờ đóng cửa phải theo định dạng 24 giờ HH:mm";
  }
  return "";
};

const getHoursSummary = (openingValue, closingValue) => {
  const openingHours = normalizeTimeValue(openingValue);
  const closingHours = normalizeTimeValue(closingValue);

  if (!openingHours || !closingHours) {
    return { type: "info", message: "Chưa thiết lập giờ phục vụ mặc định." };
  }
  if (!TIME_VALUE_PATTERN.test(openingHours) || !TIME_VALUE_PATTERN.test(closingHours)) {
    return { type: "warning", message: "Giờ phục vụ chưa đúng định dạng 24 giờ HH:mm." };
  }
  if (openingHours === closingHours) {
    return {
      type: "info",
      message: "Giờ mở và đóng trùng nhau: hệ thống xem là mở cửa 24 giờ.",
    };
  }
  if (closingHours < openingHours) {
    return {
      type: "warning",
      message: `Ca phục vụ ${openingHours}–${closingHours}, đóng cửa vào ngày hôm sau.`,
    };
  }
  return {
    type: "success",
    message: `Giờ phục vụ mặc định ${openingHours}–${closingHours}.`,
  };
};

'''
    marker = "const getGeolocationErrorMessage = (error) => {"
    if marker not in component:
        raise RuntimeError("hours helper insertion marker missing")
    component = component.replace(marker, helpers + marker, 1)

    component = sub_once(
        component,
        r'''  const orderAvailability = getOrderAvailabilityMessage\(\n\s+restaurantDetailData\?\.restaurant,\n\s+restaurantForm,\n\s+\);\n''',
        '''  const orderAvailability = getOrderAvailabilityMessage(
    restaurantDetailData?.restaurant,
    restaurantForm,
  );
  const operatingHoursSummary = getHoursSummary(
    restaurantForm.openingHours,
    restaurantForm.closingHours,
  );
''',
        "hours summary",
    )

    component = component.replace(
        'openingHours: r.openingHours || "",',
        "openingHours: normalizeTimeValue(r.openingHours),",
        1,
    )
    component = component.replace(
        'closingHours: r.closingHours || "",',
        "closingHours: normalizeTimeValue(r.closingHours),",
        1,
    )

    component = sub_once(
        component,
        r'''    const coordinateError = getCoordinateValidationError\(\n\s+restaurantForm\.lat,\n\s+restaurantForm\.lng,\n\s+\);''',
        '''    const hoursError = getHoursValidationError(
      restaurantForm.openingHours,
      restaurantForm.closingHours,
    );
    if (hoursError) return hoursError;
    const coordinateError = getCoordinateValidationError(
      restaurantForm.lat,
      restaurantForm.lng,
    );''',
        "hours validation",
    )

    component = component.replace(
        "openingHours: restaurantForm.openingHours || null,",
        "openingHours: normalizeTimeValue(restaurantForm.openingHours) || null,",
        1,
    )
    component = component.replace(
        "closingHours: restaurantForm.closingHours || null,",
        "closingHours: normalizeTimeValue(restaurantForm.closingHours) || null,",
        1,
    )

    component = sub_once(
        component,
        r'''\s*\["openingHours", restaurantForm\.openingHours \|\| "", latestRestaurant\.openingHours \|\| ""\],\n\s*\["closingHours", restaurantForm\.closingHours \|\| "", latestRestaurant\.closingHours \|\| ""\],''',
        '''
            [
              "openingHours",
              normalizeTimeValue(restaurantForm.openingHours),
              normalizeTimeValue(latestRestaurant.openingHours),
            ],
            [
              "closingHours",
              normalizeTimeValue(restaurantForm.closingHours),
              normalizeTimeValue(latestRestaurant.closingHours),
            ],''',
        "hours persistence",
    )

    lines = component.splitlines()
    start = next(
        (index for index, line in enumerate(lines) if '<div style={{ marginTop: 20 }}>' in line),
        None,
    )
    if start is None:
        raise RuntimeError("operating-hours JSX start marker missing")
    key_three = next(
        (index for index in range(start, len(lines)) if 'key: "3",' in lines[index]),
        None,
    )
    if key_three is None:
        raise RuntimeError("operating-hours JSX end marker missing")

    hours_block = '''                  <Card
                    className="profile-section-card operating-hours-card"
                    size="small"
                    title={
                      <Space size={8}>
                        <ClockCircleOutlined />
                        <span>Giờ phục vụ mặc định</span>
                      </Space>
                    }
                    extra={
                      <Text type="secondary" className="operating-hours-card__format">
                        Định dạng 24 giờ
                      </Text>
                    }
                  >
                    <Paragraph
                      id="operating-hours-guidance"
                      className="operating-hours-card__intro"
                    >
                      Khung giờ này áp dụng hằng ngày khi nhà hàng chưa thiết lập lịch riêng theo từng thứ.
                    </Paragraph>

                    <Row gutter={[16, 0]} className="operating-hours-grid">
                      <Col xs={24} md={12}>
                        <Form.Item label="Giờ mở cửa" extra="Ví dụ: 08:00">
                          <Input
                            aria-label="Giờ mở cửa"
                            aria-describedby="operating-hours-guidance"
                            type="time"
                            step={60}
                            autoComplete="off"
                            value={normalizeTimeValue(restaurantForm.openingHours)}
                            onChange={(e) =>
                              setRestaurantForm((previous) => ({
                                ...previous,
                                openingHours: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label="Giờ đóng cửa" extra="Có thể chọn giờ của ngày hôm sau">
                          <Input
                            aria-label="Giờ đóng cửa"
                            aria-describedby="operating-hours-guidance"
                            type="time"
                            step={60}
                            autoComplete="off"
                            value={normalizeTimeValue(restaurantForm.closingHours)}
                            onChange={(e) =>
                              setRestaurantForm((previous) => ({
                                ...previous,
                                closingHours: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Alert
                      className="operating-hours-summary"
                      type={operatingHoursSummary.type}
                      showIcon
                      message={operatingHoursSummary.message}
                    />

                    <Form.Item
                      className="operating-hours-notes"
                      label="Ghi chú giờ hoạt động"
                    >
                      <TextArea
                        rows={2}
                        value={restaurantForm.notesOnHours}
                        onChange={(e) =>
                          setRestaurantForm((previous) => ({
                            ...previous,
                            notesOnHours: e.target.value,
                          }))
                        }
                        placeholder="Ví dụ: nghỉ thứ Hai; ngày lễ áp dụng giờ phục vụ riêng"
                      />
                    </Form.Item>
                  </Card>

                  <Row gutter={[16, 0]} className="restaurant-capacity-grid">
                    <Col xs={24} md={12}>
                      <Form.Item label="Mức giá tham khảo">
                        <Input
                          prefix="₫"
                          value={restaurantForm.priceRange}
                          onChange={(e) =>
                            setRestaurantForm((previous) => ({
                              ...previous,
                              priceRange: e.target.value,
                            }))
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label="Sức chứa tối đa">
                        <Input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={restaurantForm.seatingCapacity}
                          onChange={(e) =>
                            setRestaurantForm((previous) => ({
                              ...previous,
                              seatingCapacity: e.target.value,
                            }))
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },
            {'''.splitlines()
    lines[start:key_three] = hours_block
    component = "\n".join(lines) + "\n"
    COMPONENT.write_text(component, encoding="utf-8")


tests = TEST.read_text(encoding="utf-8")
if 'uses native 24-hour controls' not in tests:
    fixture_marker = "const pausedRestaurant = {"
    fixture = '''const savedRestaurantWithHours = {
  ...restaurant,
  openingHours: "18:00",
  closingHours: "02:00",
};

'''
    if fixture_marker not in tests:
        raise RuntimeError("saved-hours fixture marker missing")
    tests = tests.replace(fixture_marker, fixture + fixture_marker, 1)

    test_marker = '  it("preserves other capabilities when the manager disables remote orders", async () => {'
    new_tests = '''  it("uses native 24-hour controls and explains overnight hours", async () => {
    queryResults.restaurantDetail.data = {
      restaurant: {
        ...restaurant,
        openingHours: "9:00",
        closingHours: "02:00",
      },
    };

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    expect(screen.getByLabelText("Giờ mở cửa")).toHaveAttribute("type", "time");
    expect(screen.getByLabelText("Giờ mở cửa")).toHaveValue("09:00");
    expect(screen.getByLabelText("Giờ đóng cửa")).toHaveValue("02:00");
    expect(screen.getByText(/đóng cửa vào ngày hôm sau/i)).toBeInTheDocument();
  });

  it("blocks incomplete operating hours before saving", async () => {
    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.change(screen.getByLabelText("Giờ mở cửa"), {
      target: { value: "08:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(updateRestaurantMock).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith(
      "Vui lòng chọn đầy đủ cả giờ mở cửa và giờ đóng cửa",
    );
  });

  it("saves an overnight operating window in normalized HH:mm format", async () => {
    updateRestaurantMock.mockResolvedValueOnce({
      data: { updateRestaurant: savedRestaurantWithHours },
    });
    refetchRestaurantDetailMock.mockResolvedValueOnce({
      data: { restaurant: savedRestaurantWithHours },
    });

    render(<RestaurantInfoManagement />);
    await waitFor(() => {
      expect(screen.getByTestId("selected-restaurant")).toHaveTextContent("r1");
    });

    await openLocationTab();
    fireEvent.change(screen.getByLabelText("Giờ mở cửa"), {
      target: { value: "18:00" },
    });
    fireEvent.change(screen.getByLabelText("Giờ đóng cửa"), {
      target: { value: "02:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateRestaurantMock).toHaveBeenCalledTimes(1));
    expect(updateRestaurantMock.mock.calls[0][0].variables.input).toEqual(
      expect.objectContaining({
        openingHours: "18:00",
        closingHours: "02:00",
      }),
    );
  });

'''
    if test_marker not in tests:
        raise RuntimeError("hours tests insertion marker missing")
    tests = tests.replace(test_marker, new_tests + test_marker, 1)
    TEST.write_text(tests, encoding="utf-8")


css = CSS.read_text(encoding="utf-8")
if "/* Native operating-hours editor */" not in css:
    css += '''

/* Native operating-hours editor */
.manager-layout .restaurant-management-container .operating-hours-card.ant-card {
  margin-top: 1rem;
  border-color: var(--manager-border-strong, rgba(83, 108, 97, 0.34)) !important;
  border-radius: 16px !important;
  background: linear-gradient(135deg, rgba(249, 252, 250, 0.99), rgba(229, 240, 235, 0.88)) !important;
  box-shadow: 0 14px 30px rgba(48, 72, 61, 0.09) !important;
}

.manager-layout .restaurant-management-container .operating-hours-card .ant-card-head {
  min-height: 50px;
  border-bottom-color: var(--manager-border, rgba(83, 108, 97, 0.22));
}

.manager-layout .restaurant-management-container .operating-hours-card .ant-card-head-title {
  color: var(--manager-text, #24312c);
  font-size: 0.95rem;
  font-weight: 800;
}

.manager-layout .restaurant-management-container .operating-hours-card__format,
.manager-layout .restaurant-management-container .operating-hours-card__intro {
  color: var(--manager-muted, #607069) !important;
}

.manager-layout .restaurant-management-container .operating-hours-card__intro {
  max-width: 64ch;
  margin-bottom: 0.9rem;
  line-height: 1.55;
}

.manager-layout .restaurant-management-container .operating-hours-grid input[type="time"] {
  min-height: 50px;
  color-scheme: light;
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0.025em;
}

.manager-layout .restaurant-management-container .operating-hours-grid .ant-form-item-extra {
  min-height: auto;
  padding-top: 0.3rem;
  color: var(--manager-muted, #607069);
  font-size: 0.75rem;
}

.manager-layout .restaurant-management-container .operating-hours-summary.ant-alert {
  margin: 0.15rem 0 1rem;
  border-radius: 12px;
}

.manager-layout .restaurant-management-container .operating-hours-notes.ant-form-item {
  margin-bottom: 0;
}

.manager-layout .restaurant-management-container .restaurant-capacity-grid {
  margin-top: 1rem;
}

@media (max-width: 640px) {
  .manager-layout .restaurant-management-container .operating-hours-card__format {
    display: none;
  }

  .manager-layout .restaurant-management-container .operating-hours-grid input[type="time"] {
    min-height: 48px;
  }
}
'''
    CSS.write_text(css, encoding="utf-8")
