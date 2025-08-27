import { CATEGORIES, STATUSES } from "./constants";
import { getCategoryEmoji } from "./formatters";

// Helper function to get category text from key
export const getCategoryText = (categoryKey) => {
  const category = Object.values(CATEGORIES).find(
    (cat) => cat.key === categoryKey
  );
  return category ? category.name : "Khác";
};

// Helper function to get status text from key
export const getStatusText = (statusKey) => {
  const status = Object.values(STATUSES).find((stat) => stat.key === statusKey);
  return status ? status.name : "Không xác định";
};

// Helper function to get category key from text
export const getCategoryKey = (categoryText) => {
  const category = Object.values(CATEGORIES).find(
    (cat) => cat.name.toLowerCase() === categoryText.toLowerCase()
  );
  return category ? category.key : "other";
};

// Helper function to get status key from text
export const getStatusKey = (statusText) => {
  const status = Object.values(STATUSES).find(
    (stat) => stat.name.toLowerCase() === statusText.toLowerCase()
  );
  return status ? status.key : "available";
};

// Helper function to escape CSV values
const escapeCSVValue = (value) => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

// Helper function to parse CSV line properly
const parseCSVLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
};

// Export menu items to CSV/Excel format
export const exportToExcel = (menuItems, restaurantName = "Restaurant") => {
  const headers = [
    "STT",
    "Tên món",
    "Danh mục",
    "Giá (VNĐ)",
    "Mô tả",
    "Trạng thái",
    "Thời gian chuẩn bị (phút)",
    "Thành phần",
    "Cách chế biến",
    "Giá cách chế biến",
  ];

  const data = menuItems.map((item, index) => {
    // Format cooking methods
    const cookingMethodsText =
      item.cookingMethods && item.cookingMethods.length > 0
        ? item.cookingMethods.map((method) => method.name).join("; ")
        : "";

    const cookingMethodsPrices =
      item.cookingMethods && item.cookingMethods.length > 0
        ? item.cookingMethods
            .map((method) => `${method.name}: ${method.price}`)
            .join("; ")
        : "";

    return [
      index + 1,
      item.name || "",
      getCategoryText(item.category),
      item.price || 0,
      item.description || "",
      getStatusText(item.status),
      item.prepTime || 15,
      item.ingredients || "",
      cookingMethodsText,
      cookingMethodsPrices,
    ];
  });

  // Create CSV content with proper escaping
  const csvRows = [headers, ...data].map((row) =>
    row.map((cell) => escapeCSVValue(cell)).join(",")
  );

  const csvContent = csvRows.join("\n");

  // Create and download file
  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `menu-${restaurantName.replace(/[^a-zA-Z0-9]/g, "-")}-${
    new Date().toISOString().split("T")[0]
  }.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Import menu items from CSV/Excel file
export const importFromExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const text = e.target.result;
        const lines = text.split("\n").filter((line) => line.trim() !== "");

        if (lines.length < 2) {
          reject(new Error("File không có dữ liệu hợp lệ"));
          return;
        }

        // Parse header to understand column structure
        const headers = parseCSVLine(lines[0]).map((h) =>
          h.toLowerCase().trim()
        );

        // Find column indices
        const getColumnIndex = (possibleNames) => {
          for (const name of possibleNames) {
            const index = headers.findIndex((h) =>
              h.includes(name.toLowerCase())
            );
            if (index !== -1) return index;
          }
          return -1;
        };

        const columnIndices = {
          name: getColumnIndex(["tên món", "name", "tên"]),
          category: getColumnIndex(["danh mục", "category", "loại"]),
          price: getColumnIndex(["giá", "price", "cost"]),
          description: getColumnIndex(["mô tả", "description", "desc"]),
          status: getColumnIndex(["trạng thái", "status", "tình trạng"]),
          prepTime: getColumnIndex(["thời gian", "prep time", "time"]),
          ingredients: getColumnIndex([
            "thành phần",
            "ingredients",
            "nguyên liệu",
          ]),
          cookingMethods: getColumnIndex([
            "cách chế biến",
            "cooking methods",
            "methods",
          ]),
          cookingPrices: getColumnIndex([
            "giá cách chế biến",
            "cooking prices",
            "method prices",
          ]),
        };

        const importedItems = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);

            // Skip empty rows
            if (values.every((val) => !val || val.trim() === "")) continue;

            // Extract basic info
            const name =
              columnIndices.name >= 0 ? values[columnIndices.name]?.trim() : "";
            if (!name) {
              errors.push(`Dòng ${i + 1}: Thiếu tên món`);
              continue;
            }

            const categoryText =
              columnIndices.category >= 0
                ? values[columnIndices.category]?.trim()
                : "";
            const categoryKey = getCategoryKey(categoryText);

            const priceText =
              columnIndices.price >= 0
                ? values[columnIndices.price]?.trim()
                : "0";
            const price = parseInt(priceText.replace(/[^\d]/g, "")) || 0;

            const description =
              columnIndices.description >= 0
                ? values[columnIndices.description]?.trim()
                : "";

            const statusText =
              columnIndices.status >= 0
                ? values[columnIndices.status]?.trim()
                : "";
            const statusKey = getStatusKey(statusText);

            const prepTimeText =
              columnIndices.prepTime >= 0
                ? values[columnIndices.prepTime]?.trim()
                : "15";
            const prepTime = parseInt(prepTimeText.replace(/[^\d]/g, "")) || 15;

            const ingredients =
              columnIndices.ingredients >= 0
                ? values[columnIndices.ingredients]?.trim()
                : "";

            // Parse cooking methods
            const cookingMethods = [];
            if (
              columnIndices.cookingMethods >= 0 &&
              columnIndices.cookingPrices >= 0
            ) {
              const methodsText =
                values[columnIndices.cookingMethods]?.trim() || "";
              const pricesText =
                values[columnIndices.cookingPrices]?.trim() || "";

              if (methodsText && pricesText) {
                const methods = methodsText
                  .split(";")
                  .map((m) => m.trim())
                  .filter((m) => m);
                const prices = pricesText
                  .split(";")
                  .map((p) => p.trim())
                  .filter((p) => p);

                methods.forEach((method, idx) => {
                  if (method) {
                    let methodPrice = 0;
                    if (prices[idx]) {
                      const priceMatch = prices[idx].match(/(\d+)/);
                      methodPrice = priceMatch ? parseInt(priceMatch[1]) : 0;
                    }

                    cookingMethods.push({
                      id: Date.now() + idx,
                      name: method,
                      price: methodPrice,
                    });
                  }
                });
              }
            }

            const item = {
              id: Date.now() + Math.random(),
              name,
              category: categoryKey,
              price,
              description,
              status: statusKey,
              prepTime,
              ingredients,
              emoji: getCategoryEmoji(categoryKey),
              cookingMethods,
            };

            importedItems.push(item);
          } catch (error) {
            errors.push(`Dòng ${i + 1}: ${error.message}`);
          }
        }

        if (errors.length > 0) {
          console.warn("Import warnings:", errors);
        }

        resolve({
          items: importedItems,
          errors: errors,
          totalProcessed: lines.length - 1,
          successCount: importedItems.length,
          errorCount: errors.length,
        });
      } catch (error) {
        reject(new Error(`Lỗi khi xử lý file: ${error.message}`));
      }
    };

    reader.onerror = () => reject(new Error("Lỗi khi đọc file"));

    // Try to read as UTF-8 first, fallback to other encodings if needed
    reader.readAsText(file, "UTF-8");
  });
};

// Generate sample CSV template for download
export const downloadSampleTemplate = (restaurantName = "Restaurant") => {
  const headers = [
    "STT",
    "Tên món",
    "Danh mục",
    "Giá (VNĐ)",
    "Mô tả",
    "Trạng thái",
    "Thời gian chuẩn bị (phút)",
    "Thành phần",
    "Cách chế biến",
    "Giá cách chế biến",
  ];

  const sampleData = [
    [
      1,
      "Phở Bò Tái",
      "Món chính",
      85000,
      "Phở bò truyền thống với thịt bò tái",
      "Có sẵn",
      20,
      "Bánh phở, thịt bò, hành lá, ngò gai",
      "Nước dùng đặc biệt; Thêm chả",
      "Nước dùng đặc biệt: 10000; Thêm chả: 15000",
    ],
    [
      2,
      "Cơm Gà Nướng",
      "Món chính",
      75000,
      "Cơm với gà nướng thơm ngon",
      "Có sẵn",
      25,
      "Cơm, thịt gà, rau sống",
      "Nướng than; Nướng lò",
      "Nướng than: 5000; Nướng lò: 0",
    ],
    [
      3,
      "Trà Đá",
      "Đồ uống",
      15000,
      "Trà đá mát lạnh",
      "Có sẵn",
      5,
      "Trà, đá, đường",
      "",
      "",
    ],
  ];

  const csvRows = [headers, ...sampleData].map((row) =>
    row.map((cell) => escapeCSVValue(cell)).join(",")
  );

  const csvContent = csvRows.join("\n");

  const blob = new Blob(["\ufeff" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `menu-template-${restaurantName.replace(
    /[^a-zA-Z0-9]/g,
    "-"
  )}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Validate imported data
export const validateImportData = (items) => {
  const errors = [];
  const warnings = [];

  items.forEach((item, index) => {
    const lineNumber = index + 1;

    // Required field validation
    if (!item.name || item.name.trim() === "") {
      errors.push(`Dòng ${lineNumber}: Tên món không được để trống`);
    }

    if (item.price < 0) {
      errors.push(`Dòng ${lineNumber}: Giá không được âm`);
    }

    if (item.prepTime < 1) {
      warnings.push(`Dòng ${lineNumber}: Thời gian chuẩn bị quá ngắn`);
    }

    // Category validation
    const validCategories = Object.values(CATEGORIES).map((cat) => cat.key);
    if (!validCategories.includes(item.category)) {
      warnings.push(
        `Dòng ${lineNumber}: Danh mục không hợp lệ, sẽ được đặt thành 'Khác'`
      );
    }

    // Status validation
    const validStatuses = Object.values(STATUSES).map((stat) => stat.key);
    if (!validStatuses.includes(item.status)) {
      warnings.push(
        `Dòng ${lineNumber}: Trạng thái không hợp lệ, sẽ được đặt thành 'Có sẵn'`
      );
    }

    // Cooking methods validation
    if (item.cookingMethods && item.cookingMethods.length > 0) {
      item.cookingMethods.forEach((method, methodIndex) => {
        if (!method.name || method.name.trim() === "") {
          warnings.push(
            `Dòng ${lineNumber}: Cách chế biến ${methodIndex + 1} thiếu tên`
          );
        }
        if (method.price < 0) {
          warnings.push(
            `Dòng ${lineNumber}: Giá cách chế biến ${
              methodIndex + 1
            } không được âm`
          );
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};
