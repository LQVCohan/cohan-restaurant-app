export const OPEN_AI_CHATBOT_EVENT = "cohan:open-ai-chatbot";

export const openAiMenuAssistant = ({
  message = "",
  autoSend = false,
  restaurantId = null,
  pageContext = null,
} = {}) => {
  if (typeof window === "undefined") return;

  const normalizedRestaurantId = restaurantId == null ? null : String(restaurantId);
  const resolvedPageContext = {
    pathname: window.location?.pathname || "",
    restaurantId: normalizedRestaurantId,
    ...(pageContext || {}),
  };

  window.dispatchEvent(
    new CustomEvent(OPEN_AI_CHATBOT_EVENT, {
      detail: {
        message: String(message || ""),
        autoSend: Boolean(autoSend),
        restaurantId: normalizedRestaurantId,
        pageContext: resolvedPageContext,
      },
    })
  );
};
