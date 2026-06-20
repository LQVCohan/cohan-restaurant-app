import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StaffAvatarField from "./StaffAvatarField";

describe("StaffAvatarField", () => {
  it("accepts a valid PNG file and returns its data URL", async () => {
    const onChange = vi.fn();
    render(<StaffAvatarField name="Nguyễn Văn A" onChange={onChange} />);

    const file = new File(["avatar-content"], "avatar.png", {
      type: "image/png",
    });
    fireEvent.change(
      screen.getByLabelText("Chọn ảnh đại diện nhân viên"),
      { target: { files: [file] } },
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toMatch(/^data:image\/png;base64,/);
    expect(onChange.mock.calls[0][1]).toBe(file);
    expect(screen.getByText("Đã chọn: avatar.png")).toBeInTheDocument();
  });

  it("rejects unsupported file formats", async () => {
    const onChange = vi.fn();
    render(<StaffAvatarField name="Nguyễn Văn A" onChange={onChange} />);

    const file = new File(["document"], "profile.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(
      screen.getByLabelText("Chọn ảnh đại diện nhân viên"),
      { target: { files: [file] } },
    );

    expect(
      await screen.findByText("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP."),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("notifies the parent when the existing photo is removed", () => {
    const onRemove = vi.fn();
    render(
      <StaffAvatarField
        name="Nguyễn Văn A"
        currentAvatar="/uploads/avatars/staff.webp"
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Xóa ảnh" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
