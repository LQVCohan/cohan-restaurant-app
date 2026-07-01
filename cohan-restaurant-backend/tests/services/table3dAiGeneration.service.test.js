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

  const makeImages = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "table3d-ai-"));
    await Promise.all([1, 2, 3].map((n) => fs.writeFile(path.join(dir, `${n}.png`), `image-${n}`)));
    return {
      dir,
      images: [1, 2, 3].map((n) => ({ path: path.join(dir, `${n}.png`), mimeType: "image/png" })),
    };
  };


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
