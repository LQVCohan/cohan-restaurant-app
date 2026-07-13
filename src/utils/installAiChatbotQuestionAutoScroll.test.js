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

const appendMessage = ({ messages, role, top, loading = false }) => {
  const message = document.createElement("div");
  message.className = `ai-chatbot-message ${role}${loading ? " loading" : ""}`;
  message.getBoundingClientRect = () => ({
    top,
    left: 80,
    right: 360,
    bottom: top + 50,
    width: 280,
    height: 50,
  });
  messages.appendChild(message);
  return message;
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

    appendMessage({ messages, role: "user", top: 420 });

    await waitFor(() => {
      expect(body.scrollTo).toHaveBeenCalledWith({
        top: 428,
        behavior: "smooth",
      });
    });
  });

  it("scrolls again when the latest assistant answer is added", async () => {
    const { body, messages } = createChat();
    installAiChatbotQuestionAutoScroll();

    appendMessage({ messages, role: "user", top: 420 });
    await waitFor(() => expect(body.scrollTo).toHaveBeenCalledTimes(1));

    appendMessage({ messages, role: "assistant", top: 540 });

    await waitFor(() => {
      expect(body.scrollTo).toHaveBeenLastCalledWith({
        top: 548,
        behavior: "smooth",
      });
      expect(body.scrollTo).toHaveBeenCalledTimes(2);
    });
  });

  it("scrolls to a newly added staff reply", async () => {
    const { body, messages } = createChat();
    installAiChatbotQuestionAutoScroll();

    appendMessage({ messages, role: "staff", top: 500 });

    await waitFor(() => {
      expect(body.scrollTo).toHaveBeenCalledWith({
        top: 508,
        behavior: "smooth",
      });
    });
  });

  it("does not scroll for the assistant loading bubble", async () => {
    const { body, messages } = createChat();
    installAiChatbotQuestionAutoScroll();

    appendMessage({ messages, role: "assistant", top: 500, loading: true });

    await Promise.resolve();
    await Promise.resolve();
    expect(body.scrollTo).not.toHaveBeenCalled();
  });
});
