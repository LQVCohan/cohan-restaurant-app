import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";

const OBSERVER_KEY = "__cohanMergedTableCustomerProfilesObserver";
const SECTION_CLASS = "cohan-table-customer-profiles";

const TABLES_QUERY = gql`
  query MergedTableCustomerProfileTables($restaurantId: ID!) {
    tables(restaurantId: $restaurantId) {
      id
      code
      floorLevel
    }
  }
`;

const CUSTOMER_GROUP_QUERY = gql`
  query MergedTableCustomerProfiles(
    $restaurantId: ID!
    $tableId: ID
    $tableCode: String
  ) {
    tableCustomerGroup(
      restaurantId: $restaurantId
      tableId: $tableId
      tableCode: $tableCode
    ) {
      tableId
      tableCode
      isMerged
      customerCount
      totalPartySize
      profiles {
        sourceTableId
        sourceTableCode
        customer {
          id
          tableId
          tableCode
          customerName
          customerPhone
          customerEmail
          note
          dietaryNotes
          customerPreferences
          partySize
          timeTo
          updatedAt
        }
      }
    }
  }
`;

const UPSERT_TABLE_CUSTOMER = gql`
  mutation SaveMergedTableCustomerProfile($input: UpsertTableCustomerInput!) {
    upsertTableCustomer(input: $input) {
      id
      tableId
      tableCode
      customerName
      customerPhone
      customerEmail
      note
      partySize
      timeTo
      updatedAt
    }
  }
`;

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const getRestaurantId = () =>
  document.querySelector(".management-page-header .mph-select")?.value || "";

const getInfoValue = (modal, label) => {
  const target = normalizeText(label);
  const row = Array.from(modal.querySelectorAll(".talite-info .kv")).find(
    (item) =>
      normalizeText(item.querySelector(".k")?.textContent).startsWith(target),
  );
  return row?.querySelector(".v")?.textContent?.trim() || "";
};

const parseFloorLevel = (value) => {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : null;
};

const getModalTableIdentity = (modal) => {
  const restaurantId = getRestaurantId();
  const code =
    modal.querySelector(".talite-title b")?.textContent?.trim() ||
    getInfoValue(modal, "Mã bàn");
  const floorLevel = parseFloorLevel(getInfoValue(modal, "Tầng"));
  return {
    restaurantId,
    code,
    floorLevel,
    key: `${restaurantId}|${normalizeText(code)}|${floorLevel ?? ""}`,
  };
};

const makeElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

const formatPartySize = (value) => {
  const size = Math.max(0, Number(value) || 0);
  return size ? `${size} khách` : "Chưa nhập số khách";
};

const buildCustomerDraft = (profile) => ({
  customerName: profile?.customer?.customerName || "",
  customerPhone: profile?.customer?.customerPhone || "",
  customerEmail: profile?.customer?.customerEmail || "",
  partySize: profile?.customer?.partySize ?? "",
  note:
    profile?.customer?.note ||
    profile?.customer?.dietaryNotes ||
    profile?.customer?.customerPreferences ||
    "",
});

const renderStateMessage = (section, tone, message) => {
  section.replaceChildren();
  const shell = makeElement("section", `${SECTION_CLASS}__shell`);
  const header = makeElement("div", `${SECTION_CLASS}__header`);
  const heading = makeElement("div", `${SECTION_CLASS}__heading`);
  heading.append(
    makeElement("span", `${SECTION_CLASS}__icon`, "👥"),
    makeElement("strong", "", "Khách đang ngồi tại bàn"),
  );
  header.appendChild(heading);
  const state = makeElement(
    "div",
    `${SECTION_CLASS}__state is-${tone}`,
    message,
  );
  shell.append(header, state);
  section.appendChild(shell);
};

const renderCustomerGroup = ({
  modal,
  section,
  table,
  group,
  preferredSourceId,
}) => {
  const profiles = Array.isArray(group?.profiles) ? group.profiles : [];
  const selectedSourceId =
    profiles.find(
      (profile) =>
        String(profile.sourceTableId) === String(preferredSourceId || ""),
    )?.sourceTableId ||
    profiles.find((profile) => profile.customer)?.sourceTableId ||
    profiles[0]?.sourceTableId ||
    null;

  const state = {
    table,
    group,
    selectedSourceId,
  };
  section.__cohanCustomerProfileState = state;
  section.replaceChildren();

  const shell = makeElement("section", `${SECTION_CLASS}__shell`);
  const header = makeElement("div", `${SECTION_CLASS}__header`);
  const heading = makeElement("div", `${SECTION_CLASS}__heading`);
  heading.append(
    makeElement("span", `${SECTION_CLASS}__icon`, "👥"),
    makeElement("strong", "", "Khách đang ngồi tại bàn"),
  );
  const description = makeElement(
    "p",
    `${SECTION_CLASS}__description`,
    group.isMerged
      ? "Mỗi hồ sơ vẫn thuộc bàn gốc để tra cứu và khôi phục chính xác khi tách bàn."
      : "Thông tin khách được lưu theo bàn và dùng lại tại POS, nhân viên phục vụ.",
  );
  const headingWrap = makeElement("div", `${SECTION_CLASS}__heading-wrap`);
  headingWrap.append(heading, description);

  const summary = makeElement("div", `${SECTION_CLASS}__summary`);
  summary.append(
    makeElement(
      "span",
      "",
      `${profiles.length} ${profiles.length === 1 ? "bàn" : "bàn gốc"}`,
    ),
    makeElement("span", "", `${group.customerCount || 0} hồ sơ khách`),
    makeElement("strong", "", `${group.totalPartySize || 0} khách`),
  );
  header.append(headingWrap, summary);
  shell.appendChild(header);

  if (!profiles.length) {
    shell.appendChild(
      makeElement(
        "div",
        `${SECTION_CLASS}__state is-empty`,
        "Chưa tìm thấy bàn gốc để hiển thị thông tin khách.",
      ),
    );
    section.appendChild(shell);
    return;
  }

  const cards = makeElement("div", `${SECTION_CLASS}__cards`);
  cards.setAttribute("role", "list");
  profiles.forEach((profile) => {
    const customer = profile.customer;
    const selected =
      String(profile.sourceTableId) === String(state.selectedSourceId);
    const card = makeElement(
      "button",
      `${SECTION_CLASS}__card${selected ? " is-selected" : ""}${customer ? " has-customer" : " is-empty"}`,
    );
    card.type = "button";
    card.setAttribute("role", "listitem");
    card.setAttribute(
      "aria-pressed",
      selected ? "true" : "false",
    );
    card.dataset.sourceTableId = profile.sourceTableId;

    const cardTop = makeElement("span", `${SECTION_CLASS}__card-top`);
    cardTop.append(
      makeElement(
        "strong",
        `${SECTION_CLASS}__table-code`,
        `Bàn ${profile.sourceTableCode}`,
      ),
      makeElement(
        "span",
        `${SECTION_CLASS}__profile-state`,
        customer ? "Đã có thông tin" : "Chưa có thông tin",
      ),
    );

    const name = makeElement(
      "span",
      `${SECTION_CLASS}__customer-name`,
      customer?.customerName || "Thêm khách cho bàn này",
    );
    const contactParts = [
      customer?.customerPhone,
      customer?.customerEmail,
    ].filter(Boolean);
    const contact = makeElement(
      "span",
      `${SECTION_CLASS}__customer-contact`,
      contactParts.join(" · ") || "Chưa có số điện thoại hoặc email",
    );
    const cardBottom = makeElement("span", `${SECTION_CLASS}__card-bottom`);
    cardBottom.append(
      makeElement(
        "span",
        `${SECTION_CLASS}__party-size`,
        formatPartySize(customer?.partySize),
      ),
      makeElement("span", `${SECTION_CLASS}__edit-label`, "Chọn để chỉnh sửa"),
    );
    card.append(cardTop, name, contact, cardBottom);
    card.addEventListener("click", () => {
      renderCustomerGroup({
        modal,
        section,
        table,
        group,
        preferredSourceId: profile.sourceTableId,
      });
    });
    cards.appendChild(card);
  });
  shell.appendChild(cards);

  const selectedProfile = profiles.find(
    (profile) =>
      String(profile.sourceTableId) === String(state.selectedSourceId),
  );
  if (selectedProfile) {
    const editor = makeElement("form", `${SECTION_CLASS}__editor`);
    const editorHeader = makeElement("div", `${SECTION_CLASS}__editor-header`);
    const editorTitle = makeElement("div", "");
    editorTitle.append(
      makeElement(
        "strong",
        "",
        `${selectedProfile.customer ? "Chỉnh sửa" : "Thêm"} hồ sơ bàn ${selectedProfile.sourceTableCode}`,
      ),
      makeElement(
        "p",
        "",
        group.isMerged
          ? `Dữ liệu được lưu vào bàn gốc ${selectedProfile.sourceTableCode}, không ghi đè khách của bàn khác.`
          : "Cập nhật thông tin khách đang sử dụng bàn này.",
      ),
    );
    editorHeader.appendChild(editorTitle);
    editor.appendChild(editorHeader);

    const draft = buildCustomerDraft(selectedProfile);
    const grid = makeElement("div", `${SECTION_CLASS}__editor-grid`);
    const fields = [
      {
        name: "customerName",
        label: "Tên khách",
        type: "text",
        value: draft.customerName,
        placeholder: "Nhập tên khách",
      },
      {
        name: "customerPhone",
        label: "Số điện thoại",
        type: "tel",
        value: draft.customerPhone,
        placeholder: "Nhập số điện thoại",
      },
      {
        name: "customerEmail",
        label: "Email",
        type: "email",
        value: draft.customerEmail,
        placeholder: "Nhập email nếu có",
      },
      {
        name: "partySize",
        label: "Số khách",
        type: "number",
        value: draft.partySize,
        placeholder: "0",
        min: "0",
      },
    ];
    fields.forEach((field) => {
      const label = makeElement("label", `${SECTION_CLASS}__field`);
      label.appendChild(makeElement("span", "", field.label));
      const input = document.createElement("input");
      input.name = field.name;
      input.type = field.type;
      input.value = field.value;
      input.placeholder = field.placeholder;
      if (field.min != null) input.min = field.min;
      label.appendChild(input);
      grid.appendChild(label);
    });

    const noteLabel = makeElement(
      "label",
      `${SECTION_CLASS}__field ${SECTION_CLASS}__field--wide`,
    );
    noteLabel.appendChild(makeElement("span", "", "Ghi chú phục vụ"));
    const note = document.createElement("textarea");
    note.name = "note";
    note.rows = 2;
    note.value = draft.note;
    note.placeholder = "Dị ứng, sở thích hoặc lưu ý cho nhân viên";
    noteLabel.appendChild(note);
    grid.appendChild(noteLabel);
    editor.appendChild(grid);

    const feedback = makeElement("div", `${SECTION_CLASS}__feedback`);
    feedback.setAttribute("aria-live", "polite");
    const actions = makeElement("div", `${SECTION_CLASS}__actions`);
    const saveButton = makeElement(
      "button",
      `${SECTION_CLASS}__save`,
      selectedProfile.customer ? "Lưu hồ sơ này" : "Thêm khách cho bàn này",
    );
    saveButton.type = "submit";
    actions.append(feedback, saveButton);
    editor.appendChild(actions);

    editor.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(editor);
      const customerName = String(formData.get("customerName") || "").trim();
      const customerPhone = String(formData.get("customerPhone") || "").trim();
      const customerEmail = String(formData.get("customerEmail") || "").trim();
      const noteValue = String(formData.get("note") || "").trim();
      const rawPartySize = String(formData.get("partySize") || "").trim();

      if (!customerName && !customerPhone && !customerEmail) {
        feedback.textContent = "Cần nhập tên, số điện thoại hoặc email.";
        feedback.className = `${SECTION_CLASS}__feedback is-error`;
        return;
      }

      const partySize = rawPartySize === "" ? null : Number(rawPartySize);
      if (partySize != null && (!Number.isFinite(partySize) || partySize < 0)) {
        feedback.textContent = "Số khách phải là số không âm.";
        feedback.className = `${SECTION_CLASS}__feedback is-error`;
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "Đang lưu…";
      feedback.textContent = "";
      feedback.className = `${SECTION_CLASS}__feedback`;
      try {
        await apolloClient.mutate({
          mutation: UPSERT_TABLE_CUSTOMER,
          variables: {
            input: {
              restaurantId: getRestaurantId(),
              tableId: selectedProfile.sourceTableId,
              tableCode: selectedProfile.sourceTableCode,
              customerName: customerName || null,
              customerPhone: customerPhone || null,
              customerEmail: customerEmail || null,
              note: noteValue || null,
              partySize,
            },
          },
        });
        feedback.textContent = "Đã lưu đúng hồ sơ bàn gốc.";
        feedback.className = `${SECTION_CLASS}__feedback is-success`;
        await loadCustomerProfiles(modal, section, {
          force: true,
          preferredSourceId: selectedProfile.sourceTableId,
        });
      } catch (error) {
        feedback.textContent =
          error?.message || "Không thể lưu thông tin khách. Vui lòng thử lại.";
        feedback.className = `${SECTION_CLASS}__feedback is-error`;
        saveButton.disabled = false;
        saveButton.textContent = selectedProfile.customer
          ? "Lưu hồ sơ này"
          : "Thêm khách cho bàn này";
      }
    });
    shell.appendChild(editor);
  }

  section.appendChild(shell);
  section.dataset.state = "ready";
};

const loadCustomerProfiles = async (
  modal,
  section,
  { force = false, preferredSourceId = null } = {},
) => {
  const identity = getModalTableIdentity(modal);
  if (!identity.restaurantId || !identity.code) {
    renderStateMessage(
      section,
      "error",
      "Chưa xác định được chi nhánh hoặc bàn đang mở.",
    );
    section.dataset.state = "error";
    return;
  }

  if (
    !force &&
    section.dataset.identity === identity.key &&
    ["loading", "ready"].includes(section.dataset.state)
  ) {
    return;
  }

  section.dataset.identity = identity.key;
  section.dataset.state = "loading";
  const requestId = String((Number(section.dataset.requestId) || 0) + 1);
  section.dataset.requestId = requestId;
  renderStateMessage(section, "loading", "Đang tải thông tin khách theo bàn gốc…");

  try {
    const tableResponse = await apolloClient.query({
      query: TABLES_QUERY,
      variables: { restaurantId: identity.restaurantId },
      fetchPolicy: "network-only",
    });
    const currentTable = (tableResponse?.data?.tables || []).find(
      (item) =>
        normalizeText(item.code) === normalizeText(identity.code) &&
        (identity.floorLevel == null ||
          Number(item.floorLevel) === identity.floorLevel),
    );
    if (!currentTable) {
      throw new Error("Không tìm thấy bàn đang mở trong danh sách chi nhánh.");
    }

    const groupResponse = await apolloClient.query({
      query: CUSTOMER_GROUP_QUERY,
      variables: {
        restaurantId: identity.restaurantId,
        tableId: currentTable.id,
      },
      fetchPolicy: "network-only",
    });
    if (section.dataset.requestId !== requestId || !section.isConnected) return;
    const group = groupResponse?.data?.tableCustomerGroup;
    if (!group) throw new Error("Không nhận được dữ liệu khách của bàn.");

    renderCustomerGroup({
      modal,
      section,
      table: currentTable,
      group,
      preferredSourceId,
    });
  } catch (error) {
    if (section.dataset.requestId !== requestId || !section.isConnected) return;
    renderStateMessage(
      section,
      "error",
      error?.message || "Không thể tải thông tin khách của bàn.",
    );
    section.dataset.state = "error";
  }
};

const prepareModal = (modal) => {
  const info = modal?.querySelector?.(".talite-info");
  if (!info) return null;

  let section = modal.querySelector(`.${SECTION_CLASS}`);
  if (!section) {
    section = makeElement("div", SECTION_CLASS);
    info.insertAdjacentElement("afterend", section);
  }
  section.dataset.tableDetailSection = "customers";
  section.dataset.tableDetailKind = "customers";
  const activeTab = modal.dataset.tableDetailActiveTab || "overview";
  section.hidden = !["overview", "customers"].includes(activeTab);
  loadCustomerProfiles(modal, section);
  return section;
};

const prepareAllModals = () => {
  document.querySelectorAll(".talite-modal").forEach(prepareModal);
};

export const installMergedTableCustomerProfiles = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window[OBSERVER_KEY]?.disconnect?.();
  prepareAllModals();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      prepareAllModals();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window[OBSERVER_KEY] = observer;
};

export const __testables = {
  OBSERVER_KEY,
  SECTION_CLASS,
  normalizeText,
  getModalTableIdentity,
  buildCustomerDraft,
  prepareModal,
  loadCustomerProfiles,
};
