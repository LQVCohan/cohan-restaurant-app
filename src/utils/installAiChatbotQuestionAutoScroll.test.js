import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installAiChatbotQuestionAutoScroll,
  uninstallAiChatbotQuestionAutoScroll,
} from "./installAiChatbotQuestionAutoScroll";

const createChat = () => {
  const body = document.createElement("div");
  body.className = "ai-chatbot-body";
  body.scrollTop = 120;
  body.getBoundingClientRect = () => ({
    top: 100,
    left: 0,
    right: 400,
    bottom: 600,
    width: 400,
    height: 500,
  });
  body.scrollTo = vi.fn();

  const messages = document.createElement("div");
  messages.className = "ai-chatbot-messages";
  body.appendChild(messages);
  document.body.appendChild(body);

  return { body, messages };
};

beforeEach(() => {
  document.body.innerHTML = "";
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    callback();
    return 1;
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  uninstallAiChatbotQuestionAutoScroll();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("installAiChatbotQuestionAutoScroll", () => {
  it("scrolls the chat body to a newly added user question", async () => {
    const { body, messages } = createChat();
    installAiChatbotQuestionAutoScroll();

    const question = document.createElement("div");
    question.className = "ai-chatbot-message user";
    question.getBoundingClientRect = () => ({
      top: 420,
      left: 80,
      right: 360,
      bottom: 470,
      width: 280,
      height: 50,
    });
    messages.appendChild(question);

    await waitFor(() => {
      expect(body.scrollTo).toHaveBeenCalledWith({
        top: 428,
        behavior: "smooth",
      });
    });
  });

  it("does not move the conversation for a newly added assistant reply", async () => {
    const { body, messages } = createChat();
    installAiChatbotQuestionAutoScroll();

    const reply = document.createElement("div");
    reply.className = "ai-chatbot-message assistant";
    messages.appendChild(reply);

    await Promise.resolve();
    expect(body.scrollTo).not.toHaveBeenCalled();
  });
});
