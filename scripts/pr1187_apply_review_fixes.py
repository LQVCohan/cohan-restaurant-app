from pathlib import Path
import re

widget_path = Path("src/components/common/AiChatbotWidget.jsx")
widget = widget_path.read_text()
import_marker = 'import "./AiChatbotWidget.scss";\n'
direct_import = 'import AiChatbotFeedbackControls from "./AiChatbotFeedbackControls";\n'
if direct_import not in widget:
    widget = widget.replace(import_marker, import_marker + direct_import, 1)
widget = widget.replace('  const [feedbackSent, setFeedbackSent] = useState({});\n', '')
pattern = re.compile(
    r'''                  \{item\.role === "assistant" && item\.meta\?\.conversationId \? \(\n                    <div\n                      className="ai-chatbot-actions"\n                      style=\{\{ marginTop: 6 \}\}\n                    >\n.*?\n                    </div>\n                  \) : null\}''',
    re.S,
)
replacement = '''                  {item.role === "assistant" && item.meta?.conversationId ? (\n                    <AiChatbotFeedbackControls\n                      item={item}\n                      index={index}\n                      messages={messages}\n                      restaurantId={item.meta?.resolvedRestaurantId || restaurantId}\n                      guestId={guestId}\n                      submitFeedback={submitFeedback}\n                    />\n                  ) : null}'''
widget, count = pattern.subn(replacement, widget, count=1)
if count != 1:
    raise RuntimeError(f"Expected one legacy feedback block, replaced {count}")
widget_path.write_text(widget)

vite_path = Path("vite.config.js")
vite = vite_path.read_text()
vite = vite.replace('import { aiChatbotFeedbackControlsPlugin } from "./build/aiChatbotFeedbackControlsPlugin.js";\n', '')
vite = vite.replace('      aiChatbotFeedbackControlsPlugin(),\n', '')
vite_path.write_text(vite)

resolver_path = Path("cohan-restaurant-backend/graphql/resolvers/aiChatbot/index.js")
resolver = resolver_path.read_text().replace(
    'import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbotReviewed.service.js";',
    'import { handleRestaurantChatbotMessage } from "../../../src/services/ai/restaurantChatbot.service.js";',
)
resolver_path.write_text(resolver)

for obsolete in [
    Path("build/aiChatbotFeedbackControlsPlugin.js"),
    Path("cohan-restaurant-backend/src/services/ai/restaurantChatbotReviewed.service.js"),
]:
    if obsolete.exists():
        obsolete.unlink()

assert "window.prompt" not in widget_path.read_text()
assert "aiChatbotFeedbackControlsPlugin" not in vite_path.read_text()
