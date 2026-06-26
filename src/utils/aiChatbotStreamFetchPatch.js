import { toApiUrl } from "@/lib/apiBaseUrl";
import { getToken } from "@/lib/authStorage";

const PATCH_FLAG = "__cohanAiChatbotStreamFetchPatched";
const STREAM_BUBBLE_FLAG = "aiStreamBubble";
const STREAM_STATUS_FLAG = "aiStreamStatus";

const RATE_LIMIT_MESSAGE = "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.";

const fallbackResponse = (message) => ({
  answer: message || "Hiện chatbot chưa kết nối được với hệ thống. Vui lòng thử lại sau.",
  intent: "general",
  confidence: 0,
  quickReplies: [],
  isFallback: true,
  conversationId: null,
  answerMessageId: null,
  actions: [],
  sources: [],
  contextSummary: {
    restaurantCount: 0,
    menuItemCount: 0,
    couponCount: 0,
    orderCount: 0,
    reservationCount: 0,
  },
  handoffSuggested: false,
  handoffReason: null,
  handoffMessage: null,
});

const getHeaderValue = (headers, key) => {
  if (!headers) return "";
  if (typeof Headers !== "undefined" && headers instanceof Headers) return headers.get(key) || "";
  if (Array.isArray(headers)) {
    const found = headers.find(([name]) => String(name).toLowerCase() === key.toLowerCase());
    return found?.[1] || "";
  }
  return headers[key] || headers[key.toLowerCase()] || "";
};

const getAuthorizationHeader = (input, init) => {
  const requestHeaders = typeof Request !== "undefined" && input instanceof Request ? input.headers : null;
  const existing = getHeaderValue(init?.headers, "authorization") || getHeaderValue(requestHeaders, "authorization");
  if (existing) return existing;
  const token = getToken();
  return token ? `Bearer ${token}` : "";
};

const jsonGraphqlResponse = (askAiChatbot) =>
  new Response(JSON.stringify({ data: { askAiChatbot } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const parseGraphqlBody = async (input, init) => {
  if (typeof init?.body === "string") return JSON.parse(init.body);
  if (typeof Request !== "undefined" && input instanceof Request) {
    const text = await input.clone().text();
    return text ? JSON.parse(text) : null;
  }
  return null;
};

export const isAskAiChatbotOperation = (payload) => {
  const operationName = String(payload?.operationName || "");
  const query = String(payload?.query || "");
  return operationName === "AskAiChatbot" || query.includes("askAiChatbot");
};

const parseSseFrame = (frame) => {
  let event = "message";
  const data = [];
  for (const rawLine of frame.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim() || event;
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  const text = data.join("\n");
  try {
    return { event, data: JSON.parse(text) };
  } catch {
    return { event, data: text };
  }
};

export const parseSseEvents = (buffer) => {
  const normalized = String(buffer || "").replace(/\r\n/g, "\n");
  const frames = normalized.split("\n\n");
  const rest = frames.pop() || "";
  return {
    rest,
    events: frames.map(parseSseFrame).filter(Boolean),
  };
};

const findLatestLoadingBubble = () => {
  if (typeof document === "undefined") return null;
  const loadingBubbles = document.querySelectorAll(".ai-chatbot-message.loading, .ai-chatbot-streaming-message");
  return loadingBubbles[loadingBubbles.length - 1] || null;
};

const getStreamingParagraph = () => {
  const bubble = findLatestLoadingBubble();
  if (!bubble) return null;
  if (!bubble.dataset?.[STREAM_BUBBLE_FLAG]) {
    bubble.dataset[STREAM_BUBBLE_FLAG] = "1";
    bubble.className = "ai-chatbot-message assistant ai-chatbot-streaming-message";
    bubble.innerHTML = "<p></p>";
  }
  return bubble.querySelector("p");
};

const scrollChatbotToBottom = () => {
  const body = document.querySelector(".ai-chatbot-body");
  if (body) body.scrollTop = body.scrollHeight;
};

const setStreamStatus = (message) => {
  const value = String(message || "").trim();
  if (!value) return;
  const paragraph = getStreamingParagraph();
  if (!paragraph || paragraph.dataset?.[STREAM_STATUS_FLAG] === "done") return;
  paragraph.dataset[STREAM_STATUS_FLAG] = "pending";
  paragraph.textContent = value;
  scrollChatbotToBottom();
};

const appendStreamText = (text) => {
  const value = String(text || "");
  if (!value) return;
  const paragraph = getStreamingParagraph();
  if (!paragraph) return;
  if (paragraph.dataset?.[STREAM_STATUS_FLAG] === "pending") {
    paragraph.dataset[STREAM_STATUS_FLAG] = "done";
    paragraph.textContent = "";
  }
  paragraph.textContent = `${paragraph.textContent || ""}${value}`;
  scrollChatbotToBottom();
};

const readStreamResponse = async (response) => {
  const reader = response.body?.getReader?.();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseEvents(buffer);
    buffer = parsed.rest;
    for (const item of parsed.events) {
      if (item.event === "status") setStreamStatus(item.data?.message || "AI đang xử lý...");
      if (item.event === "delta") appendStreamText(item.data?.text || "");
      if (item.event === "done") donePayload = item.data;
      if (item.event === "error") throw Object.assign(new Error(item.data?.message || "AI stream failed"), { code: item.data?.code });
    }
  }

  const parsed = parseSseEvents(buffer + decoder.decode());
  for (const item of parsed.events) {
    if (item.event === "status") setStreamStatus(item.data?.message || "AI đang xử lý...");
    if (item.event === "delta") appendStreamText(item.data?.text || "");
    if (item.event === "done") donePayload = item.data;
  }
  return donePayload;
};

export function installAiChatbotStreamFetchPatch() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if (window[PATCH_FLAG]) return;

  const originalFetch = window.fetch.bind(window);
  window[PATCH_FLAG] = true;

  window.fetch = async (input, init = {}) => {
    if (window.__COHAN_DISABLE_AI_CHATBOT_STREAM__) return originalFetch(input, init);

    let payload = null;
    try {
      payload = await parseGraphqlBody(input, init);
    } catch {
      return originalFetch(input, init);
    }

    if (!isAskAiChatbotOperation(payload)) return originalFetch(input, init);

    try {
      const authHeader = getAuthorizationHeader(input, init);
      const headers = { "Content-Type": "application/json" };
      if (authHeader) headers.Authorization = authHeader;

      const streamResponse = await originalFetch(toApiUrl("/ai/chatbot/stream"), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload?.variables?.input || {}),
      });

      if (!streamResponse.ok || !streamResponse.body) return originalFetch(input, init);
      const result = await readStreamResponse(streamResponse);
      return jsonGraphqlResponse(result || fallbackResponse());
    } catch (err) {
      const message = err?.code === "RATE_LIMITED" ? RATE_LIMIT_MESSAGE : err?.message;
      return jsonGraphqlResponse(fallbackResponse(message));
    }
  };
}
