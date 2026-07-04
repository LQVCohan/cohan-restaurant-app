import path from "path";

const IMPORT_MARKER = 'import "./AiChatbotWidget.scss";';
const START_MARKER =
  '                  {item.role === "assistant" && item.meta?.conversationId ? (';
const END_MARKER =
  "                  ) : null}\n                </div>\n              ))}";
const CLOSING_MARKER = "                  ) : null}";

const REPLACEMENT = `                  {item.role === "assistant" && item.meta?.conversationId ? (
                    <AiChatbotFeedbackControls
                      item={item}
                      index={index}
                      messages={messages}
                      restaurantId={item.meta?.resolvedRestaurantId || restaurantId}
                      guestId={guestId}
                      submitFeedback={submitFeedback}
                    />
                  ) : null}`;

export const aiChatbotFeedbackControlsPlugin = () => ({
  name: "ai-chatbot-feedback-controls",
  enforce: "pre",
  transform(code, id) {
    const filePath = id.split("?")[0];
    const targetPath = path.join(
      "src",
      "components",
      "common",
      "AiChatbotWidget.jsx",
    );
    if (!path.normalize(filePath).endsWith(targetPath)) return null;

    let nextCode = code;
    if (!nextCode.includes("import AiChatbotFeedbackControls")) {
      nextCode = nextCode.replace(
        IMPORT_MARKER,
        `${IMPORT_MARKER}\nimport AiChatbotFeedbackControls from "./AiChatbotFeedbackControls";`,
      );
    }
    nextCode = nextCode.replace(
      "  const [feedbackSent, setFeedbackSent] = useState({});\n",
      "",
    );

    const startIndex = nextCode.indexOf(START_MARKER);
    const endIndex = nextCode.indexOf(END_MARKER, startIndex);
    if (startIndex < 0 || endIndex < 0) return null;

    return {
      code:
        nextCode.slice(0, startIndex) +
        REPLACEMENT +
        nextCode.slice(endIndex + CLOSING_MARKER.length),
      map: null,
    };
  },
});

export default aiChatbotFeedbackControlsPlugin;
