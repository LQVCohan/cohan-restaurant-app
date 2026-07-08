import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomTableModelBuilderModal from "./CustomTableModelBuilderModal";

vi.mock("@/components/common/Modal", () => ({
  default: ({ isOpen, children }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

vi.mock("@/components/common/Button", () => ({
  default: ({ children, ...props }) => <button {...props}>{children}</button>,
}));

vi.mock("@/lib/apiBaseUrl", () => ({
  toBackendRootUrl: (path) => `/api${path}`,
}));

const CAPTURE_LABELS = [
  "Ảnh 1: Chính diện",
  "Ảnh 2: Góc trái 45°",
  "Ảnh 3: Góc phải 45°",
  "Ảnh 4: Mặt sau",
  "Ảnh 5: Từ trên xuống",
];

describe("CustomTableModelBuilderModal guided AI capture", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          status: "queued",
          jobId: "hi3d-job-1",
          provider: "hi3d",
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires five ordered rear-camera captures and submits them to generate the table model", async () => {
    render(
      <CustomTableModelBuilderModal
        open
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /AI từ ảnh/i }));

    const inputs = CAPTURE_LABELS.map((label) => screen.getByLabelText(label));
    expect(inputs).toHaveLength(5);
    inputs.forEach((input) => {
      expect(input).toHaveAttribute("capture", "environment");
      expect(input).toHaveAttribute(
        "accept",
        "image/png,image/jpeg,image/webp",
      );
    });

    const generateButton = screen.getByRole("button", {
      name: "Gửi 5 ảnh tạo model",
    });
    expect(generateButton).toBeDisabled();

    const files = inputs.map((input, index) => {
      const file = new File([`photo-${index + 1}`], `photo-${index + 1}.jpg`, {
        type: "image/jpeg",
      });
      fireEvent.change(input, { target: { files: [file] } });
      return file;
    });

    expect(screen.getByText(/Đã chụp 5\/5 ảnh/i)).toBeInTheDocument();
    expect(generateButton).toBeEnabled();
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/table-3d-ai/generate");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");

    const submittedImages = options.body.getAll("images");
    expect(submittedImages).toHaveLength(5);
    expect(submittedImages.map((file) => file.name)).toEqual(
      files.map((file) => file.name),
    );

    const metadata = JSON.parse(options.body.get("metadata"));
    expect(metadata.captureOrder).toEqual([
      "front",
      "left",
      "right",
      "rear",
      "top",
    ]);
  });
});
