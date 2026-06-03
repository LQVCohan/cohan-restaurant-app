import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("aiChatbot graphql rollout schema smoke", () => {
  const schemaPath = path.resolve(
    __dirname,
    "../../graphql/schema/aiChatbot.graphql",
  );
  const sdl = fs.readFileSync(schemaPath, "utf8");

  it("exposes public chatbot APIs", () => {
    expect(sdl).toContain(
      "publicAiChatbotSettings(restaurantId: ID): PublicAiChatbotSettings!",
    );
    expect(sdl).toContain(
      "askAiChatbot(input: AskAiChatbotInput!): AiChatbotResponse!",
    );
    expect(sdl).toContain(
      "submitAiChatbotAnswerFeedback(input: SubmitAiChatbotAnswerFeedbackInput!): AiChatbotAnswerFeedback!",
    );
  });

  it("exposes manager knowledge/suggestion/feedback/safety/evaluation/analytics APIs", () => {
    expect(sdl).toContain(
      "aiChatbotAnalytics(input: AiChatbotAnalyticsInput!): AiChatbotAnalyticsResponse!",
    );

    expect(sdl).toContain(
      "restaurantAiChatbotKnowledge(restaurantId: ID!, filter: AiChatbotKnowledgeFilterInput): [AiChatbotKnowledgeItem!]!",
    );
    expect(sdl).toContain(
      "importRestaurantAiChatbotKnowledge(input: ImportAiChatbotKnowledgeInput!): ImportAiChatbotKnowledgeResult!",
    );
    expect(sdl).toContain(
      'exportRestaurantAiChatbotKnowledge(restaurantId: ID!, format: String = "json"): String!',
    );

    expect(sdl).toContain(
      "restaurantAiChatbotKnowledgeSuggestions(restaurantId: ID!, filter: AiChatbotKnowledgeSuggestionFilterInput): [AiChatbotKnowledgeSuggestion!]!",
    );
    expect(sdl).toContain(
      "restaurantAiChatbotAnswerFeedback(restaurantId: ID!, filter: AiChatbotAnswerFeedbackFilterInput): [AiChatbotAnswerFeedback!]!",
    );
    expect(sdl).toContain(
      "restaurantAiChatbotSafetyRules(restaurantId: ID!, filter: AiChatbotSafetyRuleFilterInput): [AiChatbotSafetyRule!]!",
    );

    expect(sdl).toContain(
      "evaluateRestaurantAiChatbotPrompt(input: EvaluateAiChatbotPromptInput!): AiChatbotEvaluationResult!",
    );
    expect(sdl).toContain(
      "runRestaurantAiChatbotEvaluationSet(input: RunAiChatbotEvaluationSetInput!): [AiChatbotEvaluationResult!]!",
    );
    expect(sdl).toContain(
      "restaurantAiChatbotEvaluationCases(restaurantId: ID!): [AiChatbotEvaluationCase!]!",
    );
  });

  it("exposes bulk operations introduced in Phase 18+", () => {
    expect(sdl).toContain(
      "bulkUpdateRestaurantAiChatbotKnowledgeEnabled(input: BulkAiChatbotIdsInput!, enabled: Boolean!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkDeleteRestaurantAiChatbotKnowledge(input: BulkAiChatbotIdsInput!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkDismissRestaurantAiChatbotKnowledgeSuggestions(input: BulkAiChatbotIdsInput!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkDeleteRestaurantAiChatbotKnowledgeSuggestions(input: BulkAiChatbotIdsInput!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkMarkAiChatbotAnswerFeedbackReviewed(input: BulkAiChatbotIdsInput!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkIgnoreAiChatbotAnswerFeedback(input: BulkAiChatbotIdsInput!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkConvertAiChatbotFeedbackToSuggestion(input: BulkAiChatbotIdsInput!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkUpdateRestaurantAiChatbotSafetyRuleEnabled(input: BulkAiChatbotIdsInput!, enabled: Boolean!): Boolean!",
    );
    expect(sdl).toContain(
      "bulkDeleteRestaurantAiChatbotSafetyRules(input: BulkAiChatbotIdsInput!): Boolean!",
    );
  });
});
