import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearTable3DAiGenerationJobsForTests,
  getTable3DAiGenerationAvailability,
  getTable3DAiProviderConfig,
  getTableModelGenerationStatus,
  normalizeTableModelGenerationInput,
  requestTableModelGeneration,
  shouldKeepAiInputFilesForResult,
} from "../../src/services/table3d/table3dAiGeneration.service.js";

describe("table3dAiGeneration.service", () => {
  beforeEach(() => {
    clearTable3DAiGenerationJobsForTests();
    vi.unstubAllGlobals();
  });

  afterEach(() => vi.unstubAllGlobals());

  const meshyEnv = (uploadDir) => ({
    NODE_ENV: "development",
    TABLE_3D_AI_ENABLED: "true",
    TABLE_3D_AI_PROVIDER: "meshy",
    TABLE_3D_AI_API_KEY: "test-key",
    TABLE_3D_AI_ENDPOINT: "https://api.meshy.test",
    UPLOAD_DIR: uploadDir,
  });

  const hi3dEnv = (uploadDir) => ({
    NODE_ENV: "development",
    TABLE_3D_AI_ENABLED: "true",
    TABLE_3D_AI_PROVIDER: "hi3d",
    TABLE_3D_AI_HI3D_CLIENT_ID: "client-id",
    TABLE_3D_AI_HI3D_CLIENT_SECRET: "client-secret",
    TABLE_3D_AI_ENDPOINT: "https://api.hi3d.test",
    UPLOAD_DIR: uploadDir,
  });

  const makeImages = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "table3d-ai-"));
    await Promise.all([1, 2, 3].map((n) => fs.writeFile(path.join(dir, `${n}.png`), `image-${n}`)));
    return {
      dir,
      images: [1, 2, 3].map((n) => ({
        path: path.join(dir, `${n}.png`),
        mimeType: "image/png",
        originalFileName: `${n}.png`,
      })),
    };
  };

  const tokenResponse = (token = "hi3d-token") => ({
    ok: true,
    status: 200,
    json: async () => ({ code: 200, data: { accessToken: token, tokenType: "Bearer" }, msg: "success" }),
  });

  it("normalizes frontend label/type and dimension fallbacks", () => {
    expect(normalizeTableModelGenerationInput({
      label: "FE Table",
      type: "round",
      widthCm: "80",
      depthCm: "70",
      heightCm: "75",
      diameterCm: "90",
    })).toMatchObject({
      name: "FE Table",
      tableType: "round",
      dimensions: { width: 80, depth: 70, height: 75, diameter: 90 },
    });

    expect(normalizeTableModelGenerationInput({
      dimensionsCm: { widthCm: "81", depth: "71" },
    }).dimensions).toEqual({ width: 81, depth: 71 });
  });

  it("configures Hi3D from backend-only credentials with web-friendly defaults", () => {
    const config = getTable3DAiProviderConfig({
      NODE_ENV: "development",
      TABLE_3D_AI_ENABLED: "true",
      TABLE_3D_AI_PROVIDER: "hitem3d",
      TABLE_3D_AI_HI3D_CLIENT_ID: "client-id",
      TABLE_3D_AI_HI3D_CLIENT_SECRET: "client-secret",
    });

    expect(config).toMatchObject({
      provider: "hi3d",
      configured: true,
      isHi3d: true,
      endpoint: "https://api.hitem3d.ai",
      hi3dModel: "hitem3dv2.1",
      hi3dResolution: "1536fast",
      hi3dFaceCount: 200000,
      hi3dPbr: true,
    });
    expect(getTable3DAiGenerationAvailability({
      NODE_ENV: "development",
      TABLE_3D_AI_ENABLED: "true",
      TABLE_3D_AI_PROVIDER: "hi3d",
      TABLE_3D_AI_HI3D_CLIENT_ID: "client-id",
      TABLE_3D_AI_HI3D_CLIENT_SECRET: "client-secret",
    })).toMatchObject({ configured: true, status: "ready", provider: "hi3d" });
  });

  it("exchanges Hi3D credentials and submits reference images as multipart", async () => {
    const { dir, images } = await makeImages();
    const env = hi3dEnv(dir);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { task_id: "hi3d-task-1" }, msg: "success" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const created = await requestTableModelGeneration({ label: "Hi3D Table", images }, { env, userId: "u1" });

    expect(created).toMatchObject({
      ok: true,
      status: "queued",
      provider: "hi3d",
      providerTaskId: "hi3d-task-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [tokenUrl, tokenOptions] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe("https://api.hi3d.test/open-api/v1/auth/token");
    expect(tokenOptions.headers.Authorization).toBe(
      `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
    );

    const [submitUrl, submitOptions] = fetchMock.mock.calls[1];
    expect(submitUrl).toBe("https://api.hi3d.test/open-api/v1/submit-task");
    expect(submitOptions.headers.Authorization).toBe("Bearer hi3d-token");
    expect(submitOptions.body).toBeInstanceOf(FormData);
    expect(submitOptions.body.getAll("multi_images")).toHaveLength(3);
    expect(submitOptions.body.get("request_type")).toBe("3");
    expect(submitOptions.body.get("model")).toBe("hitem3dv2.1");
    expect(submitOptions.body.get("resolution")).toBe("1536fast");
    expect(submitOptions.body.get("face")).toBe("200000");
    expect(submitOptions.body.get("format")).toBe("2");
    expect(submitOptions.body.get("pbr")).toBe("1");
  });

  it("maps Hi3D processing state without creating another generation task", async () => {
    const { dir, images } = await makeImages();
    const env = hi3dEnv(dir);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse("create-token"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { task_id: "hi3d-task-2" }, msg: "success" }),
      })
      .mockResolvedValueOnce(tokenResponse("poll-token"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { task_id: "hi3d-task-2", state: "processing" }, msg: "success" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const created = await requestTableModelGeneration({ images }, { env, userId: "u1" });
    const status = await getTableModelGenerationStatus(created.jobId, { env, userId: "u1" });

    expect(status).toMatchObject({ ok: true, status: "processing", provider: "hi3d" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][0]).toBe(
      "https://api.hi3d.test/open-api/v1/query-task?task_id=hi3d-task-2",
    );
  });

  it("downloads Hi3D GLB on success and returns the existing internal model contract", async () => {
    const { dir, images } = await makeImages();
    const env = hi3dEnv(dir);
    const glb = new Uint8Array([103, 108, 84, 70]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse("create-token"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { task_id: "hi3d-task-3" }, msg: "success" }),
      })
      .mockResolvedValueOnce(tokenResponse("poll-token"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            task_id: "hi3d-task-3",
            state: "success",
            url: "https://cdn.hi3d.test/model.glb",
            cover_url: "https://cdn.hi3d.test/cover.webp",
          },
          msg: "success",
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => glb.buffer });
    vi.stubGlobal("fetch", fetchMock);

    const created = await requestTableModelGeneration({ images }, { env, userId: "u1" });
    const status = await getTableModelGenerationStatus(created.jobId, { env, userId: "u1" });

    expect(status).toMatchObject({
      ok: true,
      status: "completed",
      provider: "hi3d",
      generatedThumbnailUrl: "https://cdn.hi3d.test/cover.webp",
    });
    expect(status.generatedModelUrl).toMatch(/^\/uploads\/table-3d\/models\/.+\.glb$/);
    const saved = await fs.readFile(path.join(dir, status.generatedModelUrl.replace("/uploads/", "")));
    expect([...saved]).toEqual([...glb]);
  });

  it("returns failed when Hi3D reports a failed task", async () => {
    const { dir, images } = await makeImages();
    const env = hi3dEnv(dir);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(tokenResponse("create-token"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { task_id: "hi3d-task-4" }, msg: "success" }),
      })
      .mockResolvedValueOnce(tokenResponse("poll-token"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ code: 200, data: { task_id: "hi3d-task-4", state: "failed" }, msg: "bad refs" }),
      }));

    const created = await requestTableModelGeneration({ images }, { env, userId: "u1" });
    await expect(getTableModelGenerationStatus(created.jobId, { env, userId: "u1" })).resolves.toMatchObject({
      ok: true,
      status: "failed",
      message: "bad refs",
    });
  });

  it("submits a Meshy task with mocked fetch and returns a pollable job", async () => {
    const { dir, images } = await makeImages();
    const env = meshyEnv(dir);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: "task-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const created = await requestTableModelGeneration({ label: "Meshy Table", type: "square", images }, { env, userId: "u1" });

    expect(created).toMatchObject({ ok: true, status: "queued", provider: "meshy", providerTaskId: "task-1" });
    expect(created.jobId).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.meshy.test/openapi/v1/multi-image-to-3d");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(options.body);
    expect(body.image_urls).toHaveLength(3);
    expect(body.image_urls[0]).toMatch(/^data:image\/png;base64,/);
    expect(body.target_formats).toEqual(["glb"]);
  });

  it("polls Meshy PENDING and IN_PROGRESS as processing without creating a new task", async () => {
    const { dir, images } = await makeImages();
    const env = meshyEnv(dir);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "task-2" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "PENDING", progress: 10 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "IN_PROGRESS", progress: 45 }) });
    vi.stubGlobal("fetch", fetchMock);

    const created = await requestTableModelGeneration({ images }, { env, userId: "u1" });
    await expect(getTableModelGenerationStatus(created.jobId, { env, userId: "u1" })).resolves.toMatchObject({ status: "processing", progress: 10 });
    await expect(getTableModelGenerationStatus(created.jobId, { env, userId: "u1" })).resolves.toMatchObject({ status: "processing", progress: 45 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("downloads Meshy GLB on SUCCEEDED and returns an internal generatedModelUrl", async () => {
    const { dir, images } = await makeImages();
    const env = meshyEnv(dir);
    const glb = new Uint8Array([103, 108, 84, 70]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "task-3" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "SUCCEEDED", model_urls: { glb: "https://cdn.meshy.test/model.glb" }, thumbnail_url: "https://cdn.meshy.test/thumb.png" }) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => glb.buffer });
    vi.stubGlobal("fetch", fetchMock);

    const created = await requestTableModelGeneration({ images }, { env, userId: "u1" });
    const status = await getTableModelGenerationStatus(created.jobId, { env, userId: "u1" });

    expect(status).toMatchObject({ ok: true, status: "completed", generatedThumbnailUrl: "https://cdn.meshy.test/thumb.png" });
    expect(status.generatedModelUrl).toMatch(/^\/uploads\/table-3d\/models\/.+\.glb$/);
    const saved = await fs.readFile(path.join(dir, status.generatedModelUrl.replace("/uploads/", "")));
    expect([...saved]).toEqual([...glb]);
  });

  it("returns failed when Meshy reports FAILED", async () => {
    const { dir, images } = await makeImages();
    const env = meshyEnv(dir);
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "task-4" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "FAILED", task_error: { message: "bad refs" } }) }));

    const created = await requestTableModelGeneration({ images }, { env, userId: "u1" });
    await expect(getTableModelGenerationStatus(created.jobId, { env, userId: "u1" })).resolves.toMatchObject({
      ok: true,
      status: "failed",
      message: "bad refs",
    });
  });

  it("returns not_configured when env is missing", async () => {
    const env = { NODE_ENV: "development" };
    await expect(requestTableModelGeneration({ name: "Table" }, { env })).resolves.toMatchObject({
      ok: false,
      status: "not_configured",
      message: "AI 3D generation provider is not configured",
    });
  });

  it("allows mock provider only outside production and does not provide a fake model URL", async () => {
    const env = { NODE_ENV: "development", TABLE_3D_AI_ENABLED: "true", TABLE_3D_AI_PROVIDER: "mock" };
    expect(getTable3DAiProviderConfig(env)).toMatchObject({ configured: true, isMock: true });

    const created = await requestTableModelGeneration({ name: "Mock Table" }, { env, userId: "u1" });
    expect(created).toMatchObject({ ok: true, status: "queued", provider: "mock" });

    const status = await getTableModelGenerationStatus(created.jobId, { env, userId: "u1" });
    expect(status).toMatchObject({
      ok: true,
      status: "demo_only",
      generatedModelUrl: "",
      generatedThumbnailUrl: "",
    });
  });

  it("reports availability for not_configured, mock/demo, and pending provider states", () => {
    expect(getTable3DAiGenerationAvailability({ NODE_ENV: "development" })).toMatchObject({
      configured: false,
      status: "not_configured",
      message: "AI 3D generation provider is not configured",
    });
    expect(getTable3DAiGenerationAvailability({
      NODE_ENV: "development",
      TABLE_3D_AI_ENABLED: "true",
      TABLE_3D_AI_PROVIDER: "mock",
    })).toMatchObject({ configured: true, status: "demo_only", provider: "mock", isMock: true });
    expect(getTable3DAiGenerationAvailability({
      NODE_ENV: "development",
      TABLE_3D_AI_ENABLED: "true",
      TABLE_3D_AI_PROVIDER: "future-provider",
      TABLE_3D_AI_API_KEY: "test-key",
      TABLE_3D_AI_ENDPOINT: "https://provider.example.com/jobs",
    })).toMatchObject({ configured: true, status: "pending_provider", provider: "future-provider" });
  });

  it("keeps AI input files only for real queued or processing provider jobs", () => {
    expect(shouldKeepAiInputFilesForResult({ ok: false, status: "queued", provider: "real" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: false })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: false, status: "not_configured" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: false, status: "pending_provider" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: true, status: "not_configured" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: true, status: "pending_provider" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: true, status: "demo_only", provider: "mock" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: true, status: "queued", provider: "mock" })).toBe(false);
    expect(shouldKeepAiInputFilesForResult({ ok: true, status: "queued", provider: "real-provider" })).toBe(true);
    expect(shouldKeepAiInputFilesForResult({ ok: true, status: "processing", provider: "real-provider" })).toBe(true);
  });

  it("does not enable mock provider in production", async () => {
    const env = { NODE_ENV: "production", TABLE_3D_AI_ENABLED: "true", TABLE_3D_AI_PROVIDER: "mock" };
    expect(getTable3DAiProviderConfig(env)).toMatchObject({ configured: false, isMock: false });
  });

  it("returns pending_provider for configured real provider until adapter is implemented", async () => {
    const env = {
      NODE_ENV: "development",
      TABLE_3D_AI_ENABLED: "true",
      TABLE_3D_AI_PROVIDER: "future-provider",
      TABLE_3D_AI_API_KEY: "test-key",
      TABLE_3D_AI_ENDPOINT: "https://provider.example.com/jobs",
    };

    await expect(requestTableModelGeneration({ name: "Table" }, { env })).resolves.toMatchObject({
      ok: false,
      status: "pending_provider",
      provider: "future-provider",
    });
  });

  it("keeps Gemini prompt_ready without generated model URL", async () => {
    const env = { NODE_ENV: "development", TABLE_3D_AI_ENABLED: "true", TABLE_3D_AI_PROVIDER: "gemini", TABLE_3D_AI_API_KEY: "test-key" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ finalPrompt: "make a table" }) }] } }] }),
    }));

    await expect(requestTableModelGeneration({ label: "Gemini Table" }, { env, userId: "u1" })).resolves.toMatchObject({
      ok: true,
      status: "prompt_ready",
      generatedModelUrl: "",
    });
  });
});
