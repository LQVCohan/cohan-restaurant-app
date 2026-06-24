const FALLBACK_LOCATION_DATA = {
  "01": {
    name: "TP. Hà Nội",
    districts: {
      "001": { name: "Quận Ba Đình", wards: ["Phường Phúc Xá", "Phường Trúc Bạch", "Phường Cống Vị", "Phường Liễu Giai"] },
      "002": { name: "Quận Hoàn Kiếm", wards: ["Phường Hàng Bạc", "Phường Hàng Gai", "Phường Tràng Tiền", "Phường Hàng Bông"] },
      "003": { name: "Quận Tây Hồ", wards: ["Phường Phú Thượng", "Phường Nhật Tân", "Phường Quảng An", "Phường Xuân La"] },
      "021": { name: "Quận Cầu Giấy", wards: ["Phường Dịch Vọng", "Phường Dịch Vọng Hậu", "Phường Quan Hoa", "Phường Yên Hòa"] },
      "268": { name: "Quận Hà Đông", wards: ["Phường Nguyễn Trãi", "Phường Mộ Lao", "Phường Văn Quán", "Phường La Khê"] },
    },
  },
  "31": {
    name: "TP. Hải Phòng",
    districts: {
      "303": { name: "Quận Hồng Bàng", wards: ["Phường Quán Toan", "Phường Hùng Vương", "Phường Sở Dầu"] },
      "304": { name: "Quận Ngô Quyền", wards: ["Phường Máy Chai", "Phường Cầu Tre", "Phường Lạc Viên"] },
      "305": { name: "Quận Lê Chân", wards: ["Phường An Biên", "Phường Lam Sơn", "Phường Niệm Nghĩa"] },
    },
  },
  "48": {
    name: "TP. Đà Nẵng",
    districts: {
      "490": { name: "Quận Liên Chiểu", wards: ["Phường Hòa Hiệp Bắc", "Phường Hòa Hiệp Nam", "Phường Hòa Khánh Bắc"] },
      "492": { name: "Quận Thanh Khê", wards: ["Phường Tam Thuận", "Phường Thanh Khê Đông", "Phường Xuân Hà"] },
      "493": { name: "Quận Hải Châu", wards: ["Phường Thạch Thang", "Phường Hải Châu I", "Phường Hải Châu II", "Phường Phước Ninh"] },
      "494": { name: "Quận Sơn Trà", wards: ["Phường Thọ Quang", "Phường Nại Hiên Đông", "Phường An Hải Bắc"] },
    },
  },
  "46": {
    name: "Thừa Thiên Huế",
    districts: {
      "474": { name: "TP. Huế", wards: ["Phường Phú Hội", "Phường Phú Nhuận", "Phường Vĩnh Ninh", "Phường Thuận Thành"] },
      "476": { name: "Huyện Phong Điền", wards: ["Thị trấn Phong Điền", "Xã Điền Hương", "Xã Điền Môn"] },
    },
  },
  "56": {
    name: "Khánh Hòa",
    districts: {
      "568": { name: "TP. Nha Trang", wards: ["Phường Lộc Thọ", "Phường Phước Tiến", "Phường Vạn Thạnh", "Phường Vĩnh Hải"] },
      "570": { name: "TP. Cam Ranh", wards: ["Phường Cam Nghĩa", "Phường Cam Phúc Bắc", "Phường Cam Lợi"] },
    },
  },
  "74": {
    name: "Bình Dương",
    districts: {
      "718": { name: "TP. Thủ Dầu Một", wards: ["Phường Phú Cường", "Phường Hiệp Thành", "Phường Chánh Nghĩa"] },
      "719": { name: "TP. Dĩ An", wards: ["Phường Dĩ An", "Phường An Bình", "Phường Tân Đông Hiệp"] },
      "721": { name: "TP. Thuận An", wards: ["Phường Lái Thiêu", "Phường An Phú", "Phường Bình Hòa"] },
    },
  },
  "75": {
    name: "Đồng Nai",
    districts: {
      "731": { name: "TP. Biên Hòa", wards: ["Phường Quyết Thắng", "Phường Thống Nhất", "Phường Tân Phong", "Phường Long Bình"] },
      "734": { name: "Huyện Long Thành", wards: ["Thị trấn Long Thành", "Xã An Phước", "Xã Long Đức"] },
    },
  },
  "77": {
    name: "Bà Rịa - Vũng Tàu",
    districts: {
      "747": { name: "TP. Vũng Tàu", wards: ["Phường 1", "Phường 2", "Phường Thắng Tam", "Phường Rạch Dừa"] },
      "748": { name: "TP. Bà Rịa", wards: ["Phường Phước Hiệp", "Phường Phước Hưng", "Phường Long Toàn"] },
    },
  },
  "79": {
    name: "TP. Hồ Chí Minh",
    districts: {
      "760": { name: "Quận 1", wards: ["Phường Bến Nghé", "Phường Bến Thành", "Phường Đa Kao", "Phường Nguyễn Thái Bình"] },
      "761": { name: "Quận 12", wards: ["Phường Thạnh Xuân", "Phường Hiệp Thành", "Phường Thới An"] },
      "765": { name: "Quận Bình Thạnh", wards: ["Phường 25", "Phường 19", "Phường 12", "Phường 22"] },
      "769": { name: "TP. Thủ Đức", wards: ["Phường Thảo Điền", "Phường An Phú", "Phường Hiệp Bình Chánh", "Phường Linh Trung"] },
      "777": { name: "Quận Bình Tân", wards: ["Phường Bình Hưng Hòa", "Phường An Lạc", "Phường Tân Tạo"] },
    },
  },
  "92": {
    name: "TP. Cần Thơ",
    districts: {
      "916": { name: "Quận Ninh Kiều", wards: ["Phường Cái Khế", "Phường An Hòa", "Phường Xuân Khánh", "Phường An Khánh"] },
      "917": { name: "Quận Ô Môn", wards: ["Phường Châu Văn Liêm", "Phường Thới Hòa", "Phường Phước Thới"] },
      "918": { name: "Quận Bình Thủy", wards: ["Phường Bình Thủy", "Phường Trà An", "Phường Long Hòa"] },
    },
  },
};

const normalizeCode = (value) => String(value ?? "").padStart(2, "0");

const normalizeLocationName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/\b(thanh pho|tp\.?|tinh|quan|huyen|thi xa|thi tran|phuong|xa)\b/g, "")
    .replace(/[.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toObjectLocationData = (items = []) => {
  if (!Array.isArray(items) || !items.length) return FALLBACK_LOCATION_DATA;

  return items.reduce((provinceAcc, province) => {
    const provinceCode = normalizeCode(province.code);
    const districts = (province.districts || []).reduce((districtAcc, district) => {
      const districtCode = normalizeCode(district.code);
      districtAcc[districtCode] = {
        name: district.name,
        wards: (district.wards || []).map((ward) => ward.name).filter(Boolean),
      };
      return districtAcc;
    }, {});

    if (province.name && Object.keys(districts).length) {
      provinceAcc[provinceCode] = { name: province.name, districts };
    }
    return provinceAcc;
  }, {});
};

export const getFallbackLocationData = () => FALLBACK_LOCATION_DATA;

export const loadVietnamLocationData = async () => {
  const remoteUrl = import.meta.env.VITE_VN_LOCATION_API_URL || "https://provinces.open-api.vn/api/?depth=3";

  try {
    const response = await fetch(remoteUrl, { method: "GET" });
    if (!response.ok) throw new Error("location_api_failed");
    const payload = await response.json();
    return {
      data: toObjectLocationData(payload),
      source: "remote",
    };
  } catch {
    return {
      data: FALLBACK_LOCATION_DATA,
      source: "fallback",
    };
  }
};

export const findLocationOption = (options = {}, value) => {
  const target = normalizeLocationName(value);
  if (!target) return "";

  return (
    Object.keys(options).find((key) => {
      const normalized = normalizeLocationName(options[key]?.name);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    }) || ""
  );
};

export const findWardOption = (wards = [], value) => {
  const target = normalizeLocationName(value);
  if (!target) return "";

  return (
    wards.find((ward) => {
      const normalized = normalizeLocationName(ward);
      return normalized === target || normalized.includes(target) || target.includes(normalized);
    }) || ""
  );
};

export const mapReverseGeocodeToGeo = (address = {}, locationData = FALLBACK_LOCATION_DATA) => {
  const province = findLocationOption(locationData, address.cityName || address.provinceName);
  const districtOptions = province ? locationData[province]?.districts || {} : {};
  const district = findLocationOption(districtOptions, address.districtName);
  const wards = province && district ? locationData[province]?.districts?.[district]?.wards || [] : [];
  const ward = findWardOption(wards, address.wardName);

  return {
    province,
    district,
    ward,
    specificAddress: String(address.street || address.road || "").trim(),
  };
};
