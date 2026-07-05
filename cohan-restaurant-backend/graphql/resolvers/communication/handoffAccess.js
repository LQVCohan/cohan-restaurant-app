import { GraphQLError } from "graphql";
import { ChatThread } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  hasAnyPermission,
  hasPermission,
} from "../../../src/services/auth/authorization.service.js";
import communication from "./index.js";

const VIEW_PERMISSIONS = [
  PERMISSIONS.AI_CHATBOT_HANDOFF,
  PERMISSIONS.AI_CHATBOT_MODERATE,
];

const isAiHandoffThread = (thread) =>
  String(thread?.subject || "").trim().toLowerCase().startsWith("ai handoff");

const canViewHandoff = (user) => hasAnyPermission(user, VIEW_PERMISSIONS);
const canReplyHandoff = (user) => hasPermission(user, PERMISSIONS.AI_CHATBOT_HANDOFF);

const forbidden = () =>
  new GraphQLError("Thread not found or forbidden", {
    extensions: { code: "FORBIDDEN" },
  });

const loadThreadSubject = (threadId) =>
  ChatThread.findById(threadId).select("subject").lean();

export default {
  Query: {
    chatThreads: async (...args) => {
      const rows = await communication.Query.chatThreads(...args);
      if (!rows.some(isAiHandoffThread)) return rows;
      const allowed = await canViewHandoff(args[2]?.user);
      return allowed ? rows : rows.filter((thread) => !isAiHandoffThread(thread));
    },

    chatThread: async (...args) => {
      const thread = await communication.Query.chatThread(...args);
      if (!thread || !isAiHandoffThread(thread)) return thread;
      return (await canViewHandoff(args[2]?.user)) ? thread : null;
    },
  },

  Mutation: {
    sendChatMessage: async (...args) => {
      const thread = await loadThreadSubject(args[1]?.input?.threadId);
      if (isAiHandoffThread(thread) && !(await canReplyHandoff(args[2]?.user))) {
        throw forbidden();
      }
      return communication.Mutation.sendChatMessage(...args);
    },

    markChatThreadRead: async (...args) => {
      const thread = await loadThreadSubject(args[1]?.threadId);
      if (isAiHandoffThread(thread) && !(await canViewHandoff(args[2]?.user))) {
        return false;
      }
      return communication.Mutation.markChatThreadRead(...args);
    },
  },
};
