import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHi3dJobsForTests, submitHi3dJob } from "../../src/services/table3d/hi3dClient.js";

const json = (body) => new Response(JSON.stringify(body), { status: 200 });

describe("submitHi3dJob", () => {
  afterEach(() => {
    clearHi3dJobsForTests();
    vi.unstubAllGlobals();
  });

  it("sends three images and returns a pollable job", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ code: 200, data: { accessToken: "token" } }))
      .mockResolvedValueOnce(json({ code: 200, data: { task_id: "task-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const images = [1, 2, 3].map((n) => ({
      buffer: Buffer.from(`image-${n}`),
      fileName: `${n}.png`,
      mimeType: "image/png",
    }));
    const result = await submitHi3dJob({
      images,
      userId: "user-1",
      env: {
        TABLE_3D_AI_ENABLED: "true",
        TABLE_3D_AI_PROVIDER: "hi3d",
        HI3D_CLIENT_ID: "demo-id",
        HI3D_CLIENT_SECRET: "demo-value",
        TABLE_3D_AI_ENDPOINT: "https://api.example.test",
      },
    });

    expect(result).toMatchObject({ ok: true, status: "queued", providerTaskId: "task-1" });
    expect(fetchMock.mock.calls[1][1].body.getAll("multi_images")).toHaveLength(3);
    expect(fetchMock.mock.calls[1][1].body.get("format")).toBe("2");
  });
});
