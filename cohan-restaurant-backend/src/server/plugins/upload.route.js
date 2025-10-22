// src/plugins/upload.route.js
import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import path from "node:path";
import fs from "node:fs/promises";
import fscb from "node:fs";
import crypto from "node:crypto";
import fastifyStatic from "@fastify/static";
import process from "node:process";
const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

export default fp(
  async function uploadRoutes(app) {
    // multipart 1 lần
    if (!app.hasContentTypeParser("multipart")) {
      await app.register(multipart, {
        limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB
      });
    }

    // mount static /uploads
    const uploadRoot = path.resolve(
      process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
    );
    await ensureDir(uploadRoot);

    await app.register(fastifyStatic, {
      root: uploadRoot,
      prefix: "/uploads/",
      decorateReply: false,
      setHeaders(res, pathName) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // hoặc chỉ định FE origin
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    });

    const randomName = (ext = "") =>
      `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${
        ext ? "." + ext.replace(/^\./, "") : ""
      }`;

    app.post("/upload", async function (req, reply) {
      const file = await req.file();
      if (!file) return reply.code(400).send({ ok: false, message: "No file" });

      const ext = (file.filename?.split(".").pop() || "").toLowerCase();
      const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
      if (!allowed.includes(ext)) {
        return reply.code(400).send({ ok: false, message: "Unsupported type" });
      }

      const outName = randomName(ext);
      const target = path.join(uploadRoot, outName);

      await new Promise((resolve, reject) => {
        const ws = fscb.createWriteStream(target);
        file.file.pipe(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
      });

      const base =
        process.env.PUBLIC_BASE_URL ||
        `${req.protocol}://${
          req.headers["x-forwarded-host"] || req.headers.host
        }`;
      const publicUrl = `${base}/uploads/${outName}`;

      return reply.send({ ok: true, url: publicUrl, file: outName });
    });

    // probe nhỏ để test nhanh
    app.get("/_probe", async () => ({ ok: true, route: "upload" }));
  },
  { name: "upload-routes", fastify: "4.x || 5.x" }
);
