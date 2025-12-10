// src/plugins/upload.route.js
import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import path from "node:path";
import fs from "node:fs/promises";
// import fscb from "node:fs"; // Không cần dùng cái này nữa vì sharp sẽ lo việc ghi file
import crypto from "node:crypto";
import fastifyStatic from "@fastify/static";
import process from "node:process";
import sharp from "sharp"; // [NEW] Import sharp

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

export default fp(
  async function uploadRoutes(app) {
    if (!app.hasContentTypeParser("multipart")) {
      await app.register(multipart, {
        limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // Tăng lên 10MB cho thoải mái xử lý
        attachFieldsToBody: false, // Quan trọng: để tự xử lý stream
      });
    }

    const uploadRoot = path.resolve(
      process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
    );
    await ensureDir(uploadRoot);

    await app.register(fastifyStatic, {
      root: uploadRoot,
      prefix: "/uploads/",
      decorateReply: false,
      setHeaders(res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    });

    // Hàm tạo tên file ngẫu nhiên (Luôn đuôi .webp)
    const randomName = () =>
      `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;

    app.post("/upload", async function (req, reply) {
      try {
        const data = await req.file();
        if (!data)
          return reply.code(400).send({ ok: false, message: "No file" });

        // 1. Convert Stream sang Buffer để Sharp xử lý
        // (Lưu ý: Với file < 10MB, buffer vào RAM là an toàn và nhanh nhất)
        const buffer = await data.toBuffer();

        // 2. Xử lý ảnh bằng Sharp
        // Logic: Bất kể đầu vào là jpg, png, jfif, heic, tiff... -> Đều convert sang WEBP
        const outName = randomName();
        const target = path.join(uploadRoot, outName);

        await sharp(buffer)
          .rotate() // Tự động xoay ảnh đúng chiều (quan trọng cho ảnh chụp điện thoại)
          .webp({ quality: 80 }) // Nén ảnh WebP chất lượng 80% (nhẹ mà đẹp)
          .toFile(target); // Lưu xuống đĩa

        // 3. Trả về kết quả
        const base =
          process.env.PUBLIC_BASE_URL ||
          `${req.protocol}://${
            req.headers["x-forwarded-host"] || req.headers.host
          }`;
        const publicUrl = `${base}/uploads/${outName}`;

        return reply.send({ ok: true, url: publicUrl, file: outName });
      } catch (err) {
        console.error("Upload Error:", err);
        // Nếu Sharp không đọc được file (ví dụ upload file .exe hay text), nó sẽ throw error
        return reply.code(400).send({
          ok: false,
          message: "Invalid image format. Please upload a valid image.",
        });
      }
    });

    app.get("/_probe", async () => ({ ok: true, route: "upload" }));
  },
  { name: "upload-routes", fastify: "4.x || 5.x" }
);
