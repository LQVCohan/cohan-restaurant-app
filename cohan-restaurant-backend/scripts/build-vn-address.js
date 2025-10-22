// scripts/build-vn-address.js
// Node >= 18 (có fetch sẵn). Nếu Node < 18, cài node-fetch.
// Mục tiêu: tạo
//   - /public/data/vn-address.json   (manifest: provinces + districts + wardsFile path)
//   - /public/data/wards/{districtCode}.json (mỗi file là mảng phường/xã của quận/huyện)

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
// Nguồn dữ liệu hành chính VN (ổn định, cập nhật sau sáp nhập):
// - Tỉnh/TP:        https://provinces.open-api.vn/api/p/?depth=1
// - Quận/Huyện:     https://provinces.open-api.vn/api/p/{provinceCode}?depth=2
// - Phường/Xã theo quận/huyện: https://provinces.open-api.vn/api/d/{districtCode}?depth=2
//
// Không cần hardcode; script luôn lấy dữ liệu mới nhất từ nguồn trên.

const BASE_DIR = path.resolve(process.cwd(), "public", "data");
const WARDS_DIR = path.join(BASE_DIR, "wards");

async function ensureDirs() {
  await fs.promises.mkdir(BASE_DIR, { recursive: true });
  await fs.promises.mkdir(WARDS_DIR, { recursive: true });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch fail ${url}: ${res.status}`);
  return res.json();
}

async function build() {
  await ensureDirs();

  // 1) Lấy DS tỉnh/thành
  const provinces = await fetchJson(
    "https://provinces.open-api.vn/api/p/?depth=1"
  );

  // 2) Với mỗi tỉnh, lấy quận/huyện
  const manifestProvinces = [];
  for (const p of provinces) {
    const pFull = await fetchJson(
      `https://provinces.open-api.vn/api/p/${p.code}?depth=2`
    );
    const districts = [];

    for (const d of pFull.districts) {
      // 3) Với mỗi quận/huyện, lấy phường/xã và ghi ra /public/data/wards/{districtCode}.json
      const dFull = await fetchJson(
        `https://provinces.open-api.vn/api/d/${d.code}?depth=2`
      );
      const wards = (dFull.wards || []).map((w) => ({
        code: w.code,
        name: w.name,
        codename: w.codename,
        divType: w.division_type,
      }));

      const wardsFileRel = `/data/wards/${d.code}.json`;
      const wardsFileAbs = path.join(WARDS_DIR, `${d.code}.json`);
      await fs.promises.writeFile(wardsFileAbs, JSON.stringify(wards), "utf8");

      districts.push({
        code: d.code,
        name: d.name,
        codename: d.codename,
        divType: d.division_type,
        wardsFile: wardsFileRel,
      });
    }

    manifestProvinces.push({
      code: p.code,
      name: p.name,
      codename: p.codename,
      divType: p.division_type,
      districts,
    });
  }

  const manifest = {
    version: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
    provinces: manifestProvinces,
  };

  await fs.promises.writeFile(
    path.join(BASE_DIR, "vn-address.json"),
    JSON.stringify(manifest),
    "utf8"
  );

  console.log("✅ Built /public/data/vn-address.json + wards/* successfully.");
}

build().catch((err) => {
  console.error("Build failure:", err);
  process.exit(1);
});
