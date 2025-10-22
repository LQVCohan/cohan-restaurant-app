// src/hooks/useVnAddressLazy.js
import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Hook: useVnAddressLazy
 *  ---------------------
 *  - Lazy load dữ liệu địa giới hành chính Việt Nam.
 *  - Đọc từ file tĩnh /public/data/vn-address.json và /public/data/wards/{districtCode}.json.
 *
 *  ✅ Tự động:
 *    • Load danh sách Tỉnh/TP khi bật enabled.
 *    • Khi user chọn Tỉnh → load Quận/Huyện tương ứng.
 *    • Khi user chọn Quận → lazy fetch danh sách Phường/Xã (1 file nhỏ riêng).
 *
 *  @param {object} options
 *  @param {boolean} options.enabled - có load dữ liệu khi mount không.
 *  @param {object} options.initial - giá trị mặc định (city, district, ward)
 *
 *  @returns {
 *    loading, error,
 *    provinces, districts, wards,
 *    provinceKey, districtKey, wardKey,
 *    setProvince, setDistrict, setWard,
 *    selectedProvince, selectedDistrict
 *  }
 */

export function useVnAddressLazy(options = {}) {
  const { enabled = true, initial = {} } = options;

  /* ───────────── STATES ───────────── */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [provinceKey, setProvinceKey] = useState(initial.city || "");
  const [districtKey, setDistrictKey] = useState(initial.district || "");
  const [wardKey, setWardKey] = useState(initial.ward || "");

  const [manifest, setManifest] = useState(null);

  /* ───────────── LOAD PROVINCES ───────────── */
  useEffect(() => {
    if (!enabled) return;
    let ignore = false;

    async function loadProvinces() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/data/vn-address.json");
        if (!res.ok) throw new Error("Không tải được danh mục tỉnh/thành");
        const data = await res.json();
        if (ignore) return;
        setManifest(data);
        setProvinces(data.provinces || []);
      } catch (err) {
        if (!ignore) setError(err.message || "Lỗi tải dữ liệu");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadProvinces();
    return () => {
      ignore = true;
    };
  }, [enabled]);

  /* ───────────── CHỌN TỈNH → CẬP NHẬT QUẬN ───────────── */
  const setProvince = useCallback(
    (code) => {
      setProvinceKey(code);
      setDistrictKey("");
      setWardKey("");
      setWards([]);
      if (!manifest) return;
      const found = manifest.provinces.find(
        (p) => String(p.code) === String(code)
      );
      setDistricts(found ? found.districts || [] : []);
    },
    [manifest]
  );

  /* ───────────── CHỌN QUẬN → LAZY LOAD WARDS ───────────── */
  const setDistrict = useCallback(
    async (code) => {
      setDistrictKey(code);
      setWardKey("");
      setWards([]);
      if (!manifest) return;
      try {
        const foundProv = manifest.provinces.find(
          (p) => String(p.code) === String(provinceKey)
        );
        const foundDist = foundProv?.districts.find(
          (d) => String(d.code) === String(code)
        );
        if (foundDist?.wardsFile) {
          const res = await fetch(foundDist.wardsFile);
          if (!res.ok) throw new Error("Không tải được danh mục phường/xã");
          const data = await res.json();
          setWards(data || []);
        }
      } catch (err) {
        setError(err.message || "Lỗi tải phường/xã");
      }
    },
    [manifest, provinceKey]
  );

  /* ───────────── CHỌN PHƯỜNG ───────────── */
  const setWard = useCallback((code) => {
    setWardKey(code);
  }, []);

  /* ───────────── CHỌN MẶC ĐỊNH BAN ĐẦU ───────────── */
  // Khi provinces được load, nếu có initial.city thì auto chọn
  useEffect(() => {
    if (!enabled || !provinces.length) return;
    if (initial.city && !provinceKey) setProvince(initial.city);
  }, [enabled, provinces, initial.city, provinceKey, setProvince]);

  // Khi districts được load (sau setProvince), auto setDistrict
  useEffect(() => {
    if (!enabled || !districts.length) return;
    if (initial.district && !districtKey) setDistrict(initial.district);
  }, [enabled, districts, initial.district, districtKey, setDistrict]);

  // Khi wards được load, auto setWard
  useEffect(() => {
    if (!enabled || !wards.length) return;
    if (initial.ward && !wardKey) setWard(initial.ward);
  }, [enabled, wards, initial.ward, wardKey, setWard]);

  /* ───────────── CÁC GIÁ TRỊ TÍNH TOÁN ───────────── */
  const selectedProvince = useMemo(
    () => provinces.find((p) => String(p.code) === String(provinceKey)),
    [provinces, provinceKey]
  );

  const selectedDistrict = useMemo(
    () => districts.find((d) => String(d.code) === String(districtKey)),
    [districts, districtKey]
  );

  /* ───────────── XUẤT RA ───────────── */
  return {
    loading,
    error,

    provinces,
    districts,
    wards,

    provinceKey,
    districtKey,
    wardKey,

    setProvince,
    setDistrict,
    setWard,

    selectedProvince,
    selectedDistrict,
  };
}
