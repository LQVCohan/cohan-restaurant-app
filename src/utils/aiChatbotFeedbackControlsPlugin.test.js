import path from "path";
import { describe, expect, it } from "vitest";
import { aiChatbotFeedbackControlsPlugin } from "../../build/aiChatbotFeedbackControlsPlugin.js";

const legacyBlock = `                  {item.role === "assistant" && item.meta?.conversationId ? (
                    <div className="ai-chatbot-actions">
                      <button type="button">Hữu ích</button>
                      <button
                        type="button"
                        onClick={() => window.prompt("Lý do")}
                      >
                        Không hữu ích
                      </button>
                    </div>
                  ) : null}`;

describe("aiChatbotFeedbackControlsPlugin", () => {
  it("replaces the legacy prompt block with the inline controls component", () => {
    const plugin = aiChatbotFeedbackControlsPlugin();
    const source = `import React, { useState } from "react";
import "./AiChatbotWidget.scss";

function AiChatbotWidget() {
  const [feedbackSent, setFeedbackSent] = useState({});
  return (
    <div>
      {messages.map((item, index) => (
        <div>
${legacyBlock}
                </div>
              ))}
    </div>
  );
}`;

    const result = plugin.transform(
      source,
      path.join(
        process.cwd(),
        "src",
        "components",
        "common",
        "AiChatbotWidget.jsx",
      ),
    );

    expect(result?.code).toContain(
      'import AiChatbotFeedbackControls from "./AiChatbotFeedbackControls";',
    );
    expect(result?.code).toContain("<AiChatbotFeedbackControls");
    expect(result?.code).not.toContain("window.prompt");
    expect(result?.code).not.toContain("feedbackSent");
  });
});
