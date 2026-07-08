import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearTable3DAiGenerationJobsForTests,
  requestTableModelGeneration,
} from "../../src/services/table3d/table3dAiGeneration.service.js";

describe("table3dAiGeneration five guided photos", () => {
  let tempDir;
  let images;

  beforeEach(async () => {
    clearTable3DAiGenerationJobsForTests();
    vi.unstubAllGlobals();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "table3d-five-"));
    images = await Promise.all(
      Array.from({ length: 5 }, async (_, index) => {
        const number = index + 1;
        const filePath = path.join(tempDir, `${number}.jpg`);
        await fs.writeFile(filePath, `photo-${number}`);
        return {
          path: filePath,
          mimeType: "image/jpeg",
          originalFileName: `${number}.jpg`,
        };
      }),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("submits all five ordered images as Hi3D multi_images", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: { accessToken: "hi3d-token", tokenType: "Bearer" },
          msg: "success",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: { task_id: "hi3d-five-photo-task" },
          msg: "success",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestTableModelGeneration(
      { label: "Guided five-photo table", images },
      {
        userId: "user-1",
        env: {
          NODE_ENV: "development",
          TABLE_3D_AI_ENABLED: "true",
          TABLE_3D_AI_PROVIDER: "hi3d",
          TABLE_3D_AI_HI3D_CLIENT_ID: "client-id",
          TABLE_3D_AI_HI3D_CLIENT_SECRET: "client-secret",
          TABLE_3D_AI_ENDPOINT: "https://api.hi3d.test",
          UPLOAD_DIR: tempDir,
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      status: "queued",
      provider: "hi3d",
      providerTaskId: "hi3d-five-photo-task",
    });

    const [, submitOptions] = fetchMock.mock.calls[1];
    const submittedImages = submitOptions.body.getAll("multi_images");
    expect(submittedImages).toHaveLength(5);
    expect(submittedImages.map((file) => file.name)).toEqual([
      "1.jpg",
      "2.jpg",
      "3.jpg",
      "4.jpg",
      "5.jpg",
    ]);
  });

  it("keeps Meshy limited to its existing three-to-four image contract", async () => {
    await expect(
      requestTableModelGeneration(
        { images },
        {
          userId: "user-1",
          env: {
            NODE_ENV: "development",
            TABLE_3D_AI_ENABLED: "true",
            TABLE_3D_AI_PROVIDER: "meshy",
            TABLE_3D_AI_API_KEY: "test-key",
            TABLE_3D_AI_ENDPOINT: "https://api.meshy.test",
            UPLOAD_DIR: tempDir,
          },
        },
      ),
    ).rejects.toThrow("Meshy table generation requires 3 to 4 reference images");
  });
});
