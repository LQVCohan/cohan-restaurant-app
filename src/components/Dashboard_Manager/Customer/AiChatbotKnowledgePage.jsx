import React, { useContext, useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";
import "./AiChatbotAdminFinalPolish.scss";

const KNOWLEDGE_QUERY = gql`
  query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) {
    restaurantAiChatbotKnowledge(restaurantId: $restaurantId