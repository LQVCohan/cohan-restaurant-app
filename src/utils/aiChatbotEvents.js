export const OPEN_AI_CHATBOT_EVENT = "cohan:open-ai-chatbot";

export const openAiMenuAssistant = ({ message = "", autoSend = false } = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(OPEN_AI_CHATBOT_EVENT, {
      detail: {
        message: String(message || ""),
        autoSend: Boolean(autoSend),
      },
    })
  );
};
