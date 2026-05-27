import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("aiChatbot graphql schema safety mutations", () => {
  it("declares safety query and CRUD mutations", () => {
    const schemaPath = path.resolve("graphql/schema/aiChatbot.graphql");
    const sdl = fs.readFileSync(schemaPath, "utf8");
    expect(sdl).toContain("restaurantAiChatbotSafetyRules(restaurantId: ID!, filter: AiChatbotSafetyRuleFilterInput): [AiChatbotSafetyRule!]!");
    expect(sdl).toContain("createRestaurantAiChatbotSafetyRule(input: CreateAiChatbotSafetyRuleInput!): AiChatbotSafetyRule!");
    expect(sdl).toContain("updateRestaurantAiChatbotSafetyRule(input: UpdateAiChatbotSafetyRuleInput!): AiChatbotSafetyRule!");
    expect(sdl).toContain("deleteRestaurantAiChatbotSafetyRule(id: ID!): Boolean!");
  });
});
