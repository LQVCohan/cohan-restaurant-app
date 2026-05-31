import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTable3DAiGenerationJobsForTests,
  getTable3DAiGenerationAvailability,
  getTable3DAiProviderConfig,
  getTableModelGenerationStatus,
  requestTableModelGeneration,
  shouldKeepAiInputFilesForResult,
} from "../../src/services/table3d/table3dAiGeneration.service.js";

describe("table3dAiGeneration.service", () => {
  beforeEach(() => clearTable3DAiGenerationJobsForTests());

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
});
