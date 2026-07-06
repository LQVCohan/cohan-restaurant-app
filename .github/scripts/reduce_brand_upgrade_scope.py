from pathlib import Path
import subprocess


def replace_once(path, old, new, label):
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    print(f"{label}: {count} match(es)")
    if count != 1:
        raise SystemExit(f"Expected one match for {label}, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


jsx = "src/components/Dashboard_Manager/Brand/BrandManagement.jsx"
test = "src/components/Dashboard_Manager/Brand/BrandManagement.test.jsx"

replace_once(
    jsx,
    'import { getBrandRoleLabel, getMembershipScopeLabel } from "@/lib/userRoleDisplay";\n',
    "",
    "remove shared role display import",
)

replace_once(
    jsx,
    '''      description
      businessName
      businessTaxCode
      businessEmail
''',
    '''      businessName
      businessEmail
''',
    "trim update mutation selection",
)

replace_once(
    jsx,
    'const ROLE_OPTIONS = ["admin", "manager", "staff"];\n',
    '''const ROLE_OPTIONS = ["admin", "manager", "staff"];
const CHAIN_ROLE_LABELS = {
  owner: "Chủ chuỗi nhà hàng",
  admin: "Quản trị chuỗi",
  manager: "Quản lý chi nhánh",
  staff: "Nhân viên chi nhánh",
};

const normalizeChainRole = (value) =>
  String(typeof value === "string" ? value : value?.role || "")
    .trim()
    .toLowerCase();

const getChainRoleLabel = (value) =>
  CHAIN_ROLE_LABELS[normalizeChainRole(value)] || null;

const getChainScopeLabel = (membership, restaurants = [], chainName = "") => {
  const role = normalizeChainRole(membership);
  if (["owner", "admin"].includes(role)) {
    return chainName ? `Toàn bộ chuỗi ${chainName}` : "Toàn bộ chuỗi";
  }

  const restaurantIds = [...new Set((membership?.restaurantIds || []).map(String))];
  const restaurantById = new Map(
    restaurants.map((restaurant) => [String(restaurant.id), restaurant.name]),
  );
  const names = restaurantIds
    .map((restaurantId) => restaurantById.get(restaurantId) || restaurantId)
    .filter(Boolean);

  if (role === "manager") return names[0] || "Chưa gán chi nhánh";
  if (role === "staff") return names.length ? names.join(", ") : "Chưa gán chi nhánh";
  return "Chưa có phạm vi";
};
''',
    "add page-scoped production role labels",
)

replace_once(
    jsx,
    '''  description: "",
  businessName: "",
  businessTaxCode: "",
''',
    '''  businessName: "",
''',
    "trim chain form state",
)

replace_once(
    jsx,
    '''      description: selectedBrand.description || "",
      businessName: selectedBrand.businessName || "",
      businessTaxCode: selectedBrand.businessTaxCode || "",
''',
    '''      businessName: selectedBrand.businessName || "",
''',
    "trim selected chain form hydration",
)

replace_once(
    jsx,
    '      const roleLabel = getBrandRoleLabel({ membership: currentMember }) || "";\n      const scopeLabel = getMembershipScopeLabel(\n',
    '      const roleLabel = getChainRoleLabel(currentMember) || "";\n      const scopeLabel = getChainScopeLabel(\n',
    "use page-scoped labels in search",
)

replace_once(
    jsx,
    '''            description: trimOrNull(brandForm.description),
            businessName: trimOrNull(brandForm.businessName),
            businessTaxCode: trimOrNull(brandForm.businessTaxCode),
''',
    '''            businessName: trimOrNull(brandForm.businessName),
''',
    "trim update payload",
)

replace_once(
    jsx,
    '''  const selectedRoleLabel = selectedBrand
    ? getBrandRoleLabel({
      activeBrand: selectedBrand,
      membership: selectedBrand.membership,
    })
    : null;
''',
    '''  const selectedRoleLabel = selectedBrand
    ? getChainRoleLabel(
      selectedBrand.membership?.role || selectedBrand.membershipRole,
    )
    : null;
''',
    "use page-scoped selected role label",
)

replace_once(
    jsx,
    '''              <p>
                {selectedBrand.description ||
                  "Bổ sung mô tả ngắn để đội vận hành hiểu rõ định hướng của chuỗi."}
              </p>
''',
    '''              <p>
                Quản lý tập trung thông tin doanh nghiệp, chi nhánh và thành viên
                trong cùng một không gian vận hành.
              </p>
''',
    "use stable chain overview copy",
)

replace_once(
    jsx,
    '''                <label className="brand-field brand-field--full">
                  <span>Giới thiệu chuỗi</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={brandForm.description}
                    onChange={(event) => updateBrandField("description", event.target.value)}
                    placeholder="Mô tả ngắn về mô hình, phong cách và định hướng phục vụ"
                  />
                </label>

''',
    "",
    "remove unsupported chain description field",
)

replace_once(
    jsx,
    '''                <label className="brand-field">
                  <span>Mã số thuế</span>
                  <input
                    value={brandForm.businessTaxCode}
                    onChange={(event) => updateBrandField("businessTaxCode", event.target.value)}
                    placeholder="Nhập mã số thuế"
                  />
                </label>

''',
    "",
    "remove unsupported tax field",
)

replace_once(
    jsx,
    '{getBrandRoleLabel({ membership: { role } })}',
    '{getChainRoleLabel(role)}',
    "use page-scoped role option labels",
)

replace_once(
    jsx,
    '''                  const roleLabel =
                    getBrandRoleLabel({ membership: currentMember }) ||
                    "Chưa có vai trò";
                  const scopeLabel = getMembershipScopeLabel(
''',
    '''                  const roleLabel =
                    getChainRoleLabel(currentMember) || "Chưa có vai trò";
                  const scopeLabel = getChainScopeLabel(
''',
    "use page-scoped member labels",
)

replace_once(
    test,
    '''        description: "Chuỗi nhà hàng Việt hiện đại",
        businessName: "Công ty Cohan",
        businessTaxCode: "0312345678",
''',
    '''        businessName: "Công ty Cohan",
''',
    "align chain mutation expectation",
)

subprocess.run(
    [
        "git",
        "checkout",
        "origin/main",
        "--",
        "src/hooks/useBrandManagement.js",
        "src/lib/userRoleDisplay.js",
        "src/lib/userRoleDisplay.test.js",
        "src/components/Dashboard_Manager/Sidebar.test.jsx",
    ],
    check=True,
)

for helper in (
    ".github/workflows/reduce-brand-upgrade-scope.yml",
    ".github/scripts/reduce_brand_upgrade_scope.py",
):
    Path(helper).unlink(missing_ok=True)
