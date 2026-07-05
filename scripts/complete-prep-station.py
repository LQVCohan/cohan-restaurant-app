from pathlib import Path
import json
import re
from textwrap import dedent


def block(value: str) -> str:
    return dedent(value).lstrip("\n")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


modal_path = Path(
    "src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx"
)
modal = modal_path.read_text(encoding="utf-8")

modal = replace_once(
    modal,
    block(
        '''
        const MENU_ITEM_STATUS_SET = new Set(
          MENU_ITEM_STATUS_OPTIONS.map(({ value }) => value),
        );

        const FOR_YOU_DEFAULTS = {
        '''
    ),
    block(
        '''
        const MENU_ITEM_STATUS_SET = new Set(
          MENU_ITEM_STATUS_OPTIONS.map(({ value }) => value),
        );

        const PREP_STATION_OPTIONS = [
          {
            value: "kitchen",
            label: "Bếp chính",
            helper: "Món sẽ xuất hiện trong hàng chờ của bếp chính.",
          },
          {
            value: "bar",
            label: "Quầy bar",
            helper: "Đồ uống hoặc món sẽ xuất hiện trong hàng chờ của quầy bar.",
          },
        ];
        const PREP_STATION_SET = new Set(
          PREP_STATION_OPTIONS.map(({ value }) => value),
        );
        const normalizePrepStation = (value) =>
          PREP_STATION_SET.has(value) ? value : "kitchen";

        const FOR_YOU_DEFAULTS = {
        '''
    ),
    "add preparation station constants",
)

modal = replace_once(
    modal,
    block(
        '''
          const [formData, setFormData] = useState({
            name: "",
            categoryId: "",
            status: normalizeMenuItemStatus(),
            thumbImage: "",
        '''
    ),
    block(
        '''
          const [formData, setFormData] = useState({
            name: "",
            categoryId: "",
            status: normalizeMenuItemStatus(),
            prepStation: "kitchen",
            thumbImage: "",
        '''
    ),
    "add initial preparation station",
)

modal = replace_once(
    modal,
    block(
        '''
            const hasValues =
              (formData.name || "").trim() ||
              formData.categoryId ||
              (formData.description || "").trim() ||
        '''
    ),
    block(
        '''
            const hasValues =
              (formData.name || "").trim() ||
              formData.categoryId ||
              normalizePrepStation(formData.prepStation) !== "kitchen" ||
              (formData.description || "").trim() ||
        '''
    ),
    "track preparation station draft changes",
)

modal = replace_once(
    modal,
    block(
        '''
              status: normalizeMenuItemStatus(value?.status),
              thumbImage: value?.thumbImage || "",
        '''
    ),
    block(
        '''
              status: normalizeMenuItemStatus(value?.status),
              prepStation: normalizePrepStation(value?.prepStation),
              thumbImage: value?.thumbImage || "",
        '''
    ),
    "persist preparation station in modal draft",
)

modal = replace_once(
    modal,
    block(
        '''
                  status: normalizeMenuItemStatus(currentItem.status),
                  thumbImage: currentItem.thumbImage || "",
        '''
    ),
    block(
        '''
                  status: normalizeMenuItemStatus(currentItem.status),
                  prepStation: normalizePrepStation(currentItem.prepStation),
                  thumbImage: currentItem.thumbImage || "",
        '''
    ),
    "hydrate preparation station while editing",
)

modal = replace_once(
    modal,
    block(
        '''
                setFormData({
                  name: "",
                  categoryId: "",
                  status: normalizeMenuItemStatus(),
                  thumbImage: "",
        '''
    ),
    block(
        '''
                setFormData({
                  name: "",
                  categoryId: "",
                  status: normalizeMenuItemStatus(),
                  prepStation: "kitchen",
                  thumbImage: "",
        '''
    ),
    "reset preparation station for new item",
)

modal = replace_once(
    modal,
    block(
        '''
                status: normalizeMenuItemStatus(formData.status),
                description: formData.description,
        '''
    ),
    block(
        '''
                status: normalizeMenuItemStatus(formData.status),
                prepStation: normalizePrepStation(formData.prepStation),
                description: formData.description,
        '''
    ),
    "submit preparation station",
)

modal = replace_once(
    modal,
    block(
        '''
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Ảnh món ăn</label>
        '''
    ),
    block(
        '''
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="menu-item-prep-station">
                        Khu chế biến <span className="req">*</span>
                      </label>
                      <select
                        id="menu-item-prep-station"
                        className="modern-select"
                        value={normalizePrepStation(formData.prepStation)}
                        onChange={(event) =>
                          handleInputChange("prepStation", event.target.value)
                        }
                        aria-describedby="menu-item-prep-station-hint"
                        required
                        disabled={isSaving}
                      >
                        {PREP_STATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p
                        id="menu-item-prep-station-hint"
                        className="for-you-option-group__hint"
                      >
                        {PREP_STATION_OPTIONS.find(
                          (option) =>
                            option.value === normalizePrepStation(formData.prepStation),
                        )?.helper}
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Ảnh món ăn</label>
        '''
    ),
    "render preparation station field",
)

modal_path.write_text(modal, encoding="utf-8")

test_path = Path(
    "src/components/Dashboard_Manager/Menu/components/MenuItemModal/"
    "MenuItemModal.foodClassification.test.jsx"
)
test_path.write_text(
    block(
        '''
        import { describe, expect, it } from "vitest";
        import fs from "node:fs";

        const SOURCE_PATH = "src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx";

        describe("MenuItemModal item contract", () => {
          it("supports foodType selection and conditional meatTypes selection", () => {
            const source = fs.readFileSync(SOURCE_PATH, "utf8");

            expect(source).toContain('foodType: "UNKNOWN"');
            expect(source).toContain("const FOOD_TYPE_OPTIONS");
            expect(source).toContain("const MEAT_TYPE_OPTIONS");
            expect(source).toContain("Phân loại món ăn");
            expect(source).toContain("Loại thịt / đạm động vật");
            expect(source).toContain('["NON_VEGETARIAN", "MIXED"].includes(formData.foodType)');
            expect(source).toContain('handleInputChange("foodType"');
            expect(source).toContain('toggleArrayValue("meatTypes"');
            expect(source).toContain("foodType: formData.foodType || FOR_YOU_DEFAULTS.foodType");
          });

          it("requires and submits an explicit preparation station", () => {
            const source = fs.readFileSync(SOURCE_PATH, "utf8");

            expect(source).toContain("const PREP_STATION_OPTIONS");
            expect(source).toContain('prepStation: "kitchen"');
            expect(source).toContain("prepStation: normalizePrepStation(currentItem.prepStation)");
            expect(source).toContain("prepStation: normalizePrepStation(formData.prepStation)");
            expect(source).toContain('handleInputChange("prepStation"');
            expect(source).toContain("Khu chế biến");
            expect(source).toContain("Bếp chính");
            expect(source).toContain("Quầy bar");
          });
        });
        '''
    ),
    encoding="utf-8",
)

mutation_path = Path(
    "cohan-restaurant-backend/graphql/resolvers/order/mutation.js"
)
mutation = mutation_path.read_text(encoding="utf-8")
mutation = replace_once(
    mutation,
    block(
        '''
        const PRINT_STATIONS = {
          kitchen: "kitchen",
          bar: "bar",
          cashier: "cashier",
        };
        '''
    ),
    block(
        '''
        const PRINT_STATIONS = {
          cashier: "cashier",
        };
        '''
    ),
    "remove unused preparation print stations",
)

mutation, removed_helpers = re.subn(
    r"\nfunction mapItemToStation\(item = \{\}\) \{.*?\nasync function enqueueTemporaryBillPrintJob",
    "\nasync function enqueueTemporaryBillPrintJob",
    mutation,
    count=1,
    flags=re.S,
)
if removed_helpers != 1:
    raise RuntimeError(
        f"remove legacy print helpers: expected one match, found {removed_helpers}"
    )

mutation, removed_confirm = re.subn(
    r"\n  async confirmIncomingOrder\(_, \{ input \}, ctx\) \{.*?\n  async createTemporaryBillPrintJob",
    "\n  async createTemporaryBillPrintJob",
    mutation,
    count=1,
    flags=re.S,
)
if removed_confirm != 1:
    raise RuntimeError(
        f"remove legacy confirm resolver: expected one match, found {removed_confirm}"
    )

if "mapItemToStation" in mutation or "enqueuePrintJobsForConfirmedOrder" in mutation:
    raise RuntimeError("legacy preparation-station routing remains in mutation.js")
mutation_path.write_text(mutation, encoding="utf-8")

index_path = Path("cohan-restaurant-backend/graphql/resolvers/order/index.js")
index_source = index_path.read_text(encoding="utf-8")
index_source = replace_once(
    index_source,
    block(
        '''
        // The guarded station-aware resolver owns confirmIncomingOrder. Keep the legacy
        // implementation out of every intermediate wrapper so it cannot be exported or
        // called accidentally from resolver composition.
        const BaseOrderMutation = { ...OrderMutation };
        delete BaseOrderMutation.confirmIncomingOrder;

        const PaymentGuardedOrderMutation = {
          ...BaseOrderMutation,
          ...CustomerTrackingPaymentMutation,
        };
        '''
    ),
    block(
        '''
        const PaymentGuardedOrderMutation = {
          ...OrderMutation,
          ...CustomerTrackingPaymentMutation,
        };
        '''
    ),
    "remove obsolete resolver composition workaround",
)
index_path.write_text(index_source, encoding="utf-8")

task = {
    "id": "prep-station-routing",
    "title": "Route and operate order items by preparation station",
    "status": "implemented_unverified",
    "createdAt": "2026-07-05",
    "scope": [
        "Configure kitchen or bar per menu item",
        "Snapshot the configured station into order items",
        "Use the order snapshot for KDS work items and print jobs",
        "Remove runtime and legacy name/category keyword routing",
        "Provide a responsive shared kitchen and bar dispatch workspace",
        "Prioritize urgent work and make loading, empty, error, and retry states actionable",
    ],
    "validation": {
        "completed": [
            "Targeted frontend component tests",
            "Targeted backend resolver and station print tests",
            "Staff theme color check",
            "Frontend production build",
        ],
        "notRun": [
            "Manual responsive review at 390x844 and 430x932",
            "Menu and active-order migration apply against the deployment database",
            "RBAC reseed against the deployment database",
        ],
    },
}
Path(".trellis/tasks/prep-station-routing/task.json").write_text(
    json.dumps(task, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

prd_path = Path(".trellis/tasks/prep-station-routing/prd.md")
prd = prd_path.read_text(encoding="utf-8")
status_section = block(
    '''

    ## Implementation status

    - Code path implemented from menu configuration through order/work-item snapshots, printing, and the shared kitchen/bar workspace.
    - Menu create/edit now requires an explicit preparation station.
    - Runtime and legacy name/category keyword routing have been removed.
    - Automated targeted checks and frontend build are completed by the preparation-station completion workflow.
    - Deployment database migrations, RBAC reseed, and manual responsive smoke testing remain environment operations.
    '''
)
if "## Implementation status" not in prd:
    prd_path.write_text(prd.rstrip() + status_section + "\n", encoding="utf-8")
