import React, { useContext, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const Q = gql`query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) { restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) { id title content category tags enabled priority