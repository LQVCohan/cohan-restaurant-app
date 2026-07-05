import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AiChatbotFeedbackControls, {
  buildAiChatbotFeedbackReason,
  findAiChatbotFeedbackQuestion,
} from "./AiChatbotFeedbackControls";

const item = {
  role: "assistant",
  content: "Bạn có thể mở thực đơn bằng nút bên dưới.",
  meta: {
    conversationId: "conversation-1",
    answerMessageId: "message-1",
  },
};

const messages = [
  { role: "assistant", content: "Xin chào" },
  { role: "user", content: "Tôi muốn xem thực đơn" },
  item,
];

const renderControls = (submitFeedback, restaurantId = "restaurant-1") =>
  render(
    <AiChatbotFeedbackControls
      item={item}
      index={2}
      messages={messages}
      restaurantId={restaurantId}
      guestId="guest-1"
      submitFeedback={submitFeedback}
    />,
  );

describe("AiChatbotFeedbackControls", () => {
  it("builds a compact feedback reason", () => {
    expect(
      buildAiChatbotFeedbackReason({
        reason: "Trả lời sai",
        details: "Nút mở nhầm trang",
      }),
    ).toBe("Trả lời sai — Nút mở nhầm trang");
    expect(findAiChatbotFeedbackQuestion(messages, 2)).toBe(
      "Tôi muốn xem thực đơn",
    );
  });

  it("keeps the negative feedback form closed while a helpful vote is sending", async () => {
    let resolveRequest;
    const submitFeedback = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    renderControls(submitFeedback);

    fireEvent.click(screen.getByRole("button", { name: "Hữu ích" }));

    expect(
      screen.getByRole("button", { name: "Đang gửi..." }),
    ).toBeDisabled();
    expect(screen.queryByText("Điều gì chưa ổn?", { exact: false })).toBeNull();

    resolveRequest({ data: {} });
    expect(
      await screen.findByText("Cảm ơn bạn! Phản hồi đã được ghi nhận."),
    ).toBeInTheDocument();
  });

  it("uses an inline form instead of window.prompt", async () => {
    const submitFeedback = vi.fn().mockResolvedValue({ data: {} });
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("");
    renderControls(submitFeedback);

    fireEvent.click(screen.getByRole("button", { name: "Không hữu ích" }));
    expect(
      screen.getByText("Điều gì chưa ổn?", { exact: false }),
    ).toBeInTheDocument();
    expect(promptSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Trả lời sai" }));
    fireEvent.change(screen.getByPlaceholderText("Ví dụ: nút không mở đúng trang..."), {
      target: { value: "Nút mở nhầm trang" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));
    expect(submitFeedback).toHaveBeenCalledWith({
      variables: {
        input: {
          restaurantId: "restaurant-1",
          conversationId: "conversation-1",
          messageId: "message-1",
          guestId: "guest-1",
          question: "Tôi muốn xem thực đơn",
          answer: item.content,
          rating: "not_helpful",
          reason: "Trả lời sai — Nút mở nhầm trang",
        },
      },
    });
    expect(
      await screen.findByText("Cảm ơn bạn! Phản hồi đã được ghi nhận."),
    ).toBeInTheDocument();

    promptSpy.mockRestore();
  });

  it("keeps the form open and shows an error when submission fails", async () => {
    const submitFeedback = vi
      .fn()
      .mockRejectedValue(new Error("Mất kết nối"));
    renderControls(submitFeedback, "");

    fireEvent.click(screen.getByRole("button", { name: "Không hữu ích" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi phản hồi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Mất kết nối");
    expect(
      screen.getByRole("button", { name: "Gửi phản hồi" }),
    ).toBeEnabled();
  });
  it("omits restaurantId for verified global feedback", async () => {
    const submitFeedback = vi.fn().mockResolvedValue({ data: {} });
    renderControls(submitFeedback, "");

    fireEvent.click(screen.getByRole("button", { name: "Hữu ích" }));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));
    const input = submitFeedback.mock.calls[0][0].variables.input;
    expect(input).not.toHaveProperty("restaurantId");
    expect(input).toMatchObject({
      conversationId: "conversation-1",
      messageId: "message-1",
      rating: "helpful",
    });
  });

});
